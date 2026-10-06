import { NextResponse } from "next/server";

const API_BASE = "https://api.binance.com";
const ALLOWED_INTERVALS = new Set(["1h", "4h", "1d"]);

const stableAssets = new Set([
  "USDT", "USDC", "FDUSD", "TUSD", "USDE", "DAI", "BUSD",
]);

type SymbolInfo = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
};

type Ticker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
};

type Kline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

function calculateRsi(closes: number[], period = 14) {
  if (closes.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  for (let i = period + 1; i < closes.length; i += 1) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;

    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
  }

  if (averageLoss === 0) return 100;

  const rs = averageGain / averageLoss;
  return 100 - 100 / (1 + rs);
}

function levelForSpike(spike: number) {
  if (spike >= 4) return "Extreme";
  if (spike >= 3) return "High";
  if (spike >= 2) return "Moderate";
  return "Normal";
}

function reasonForData(spike: number, change: number, rsi: number | null) {
  const reasons: string[] = [];

  if (spike >= 4) reasons.push("exceptional volume expansion");
  else if (spike >= 3) reasons.push("strong volume expansion");
  else if (spike >= 2) reasons.push("volume rising above average");
  else reasons.push("activity near normal range");

  if (change >= 1) reasons.push("price momentum positive");
  else if (change <= -1) reasons.push("selling pressure increasing");

  if (rsi !== null && rsi >= 70) reasons.push("RSI overbought");
  else if (rsi !== null && rsi <= 30) reasons.push("RSI oversold");

  return reasons.slice(0, 2).join(" + ");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const interval = url.searchParams.get("interval") || "1h";

  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { ok: false, error: "Invalid interval" },
      { status: 400 }
    );
  }

  try {
    const [exchangeInfo, tickers] = await Promise.all([
      fetchJson<{ symbols: SymbolInfo[] }>(
        `${API_BASE}/api/v3/exchangeInfo`
      ),
      fetchJson<Ticker[]>(
        `${API_BASE}/api/v3/ticker/24hr`
      ),
    ]);

    const allowed = new Set(
      exchangeInfo.symbols
        .filter(
          (item) =>
            item.status === "TRADING" &&
            item.quoteAsset === "USDT" &&
            item.isSpotTradingAllowed !== false &&
            !stableAssets.has(item.baseAsset)
        )
        .map((item) => item.symbol)
    );

    const candidates = tickers
      .filter((item) => allowed.has(item.symbol))
      .map((item) => ({
        symbol: item.symbol,
        change24h: Number(item.priceChangePercent),
        quoteVolume24h: Number(item.quoteVolume),
        price: Number(item.lastPrice),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.change24h) &&
          Number.isFinite(item.quoteVolume24h) &&
          item.quoteVolume24h > 0 &&
          Number.isFinite(item.price)
      )
      .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h)
      .slice(0, 12);

    const rows = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const klines = await fetchJson<Kline[]>(
            `${API_BASE}/api/v3/klines?symbol=${candidate.symbol}&interval=${interval}&limit=21`
          );

          if (klines.length < 16) return null;

          const quoteVolumes = klines.map((k) => Number(k[7]));
          const closes = klines.map((k) => Number(k[4]));

          const currentVolume = quoteVolumes.at(-1) ?? 0;
          const previousVolumes = quoteVolumes.slice(0, -1);
          const averageVolume =
            previousVolumes.reduce((sum, value) => sum + value, 0) /
            previousVolumes.length;

          if (!Number.isFinite(currentVolume) || !Number.isFinite(averageVolume) || averageVolume <= 0) {
            return null;
          }

          const spike = currentVolume / averageVolume;
          const rsi = calculateRsi(closes);
          const level = levelForSpike(spike);

          return {
            symbol: candidate.symbol,
            price: candidate.price,
            change24h: candidate.change24h,
            volume: currentVolume,
            averageVolume,
            spike,
            rsi,
            level,
            reason: reasonForData(spike, candidate.change24h, rsi),
          };
        } catch {
          return null;
        }
      })
    );

    const data = rows
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.spike - a.spike);

    return NextResponse.json({
      ok: true,
      interval,
      updatedAt: new Date().toISOString(),
      rows: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Volume data unavailable",
      },
      { status: 502 }
    );
  }
}
