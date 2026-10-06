import { NextResponse } from "next/server";

const API_BASES = [
  "https://data-api.binance.vision",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

const STABLE_ASSETS = new Set([
  "USDT",
  "USDC",
  "FDUSD",
  "TUSD",
  "USDE",
  "DAI",
  "BUSD",
]);

type ExchangeSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
};

type Ticker24h = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
};

async function fetchJson<T>(
  path: string,
  timeoutMs = 7000
): Promise<T> {
  let lastError = "Market data request failed";

  for (const base of API_BASES) {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      timeoutMs
    );

    try {
      const response = await fetch(
        `${base}${path}`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        lastError = `Request failed: ${response.status}`;
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError =
        error instanceof Error
          ? error.message
          : "Market data request failed";
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

export async function GET() {
  try {
    const [exchangeData, tickers] =
      await Promise.all([
        fetchJson<{ symbols: ExchangeSymbol[] }>(
          "/api/v3/exchangeInfo"
        ),
        fetchJson<Ticker24h[]>(
          "/api/v3/ticker/24hr"
        ),
      ]);

    const allowedSymbols = new Set(
      exchangeData.symbols
        .filter(
          (item) =>
            item.status === "TRADING" &&
            item.quoteAsset === "USDT" &&
            item.isSpotTradingAllowed !== false &&
            !STABLE_ASSETS.has(item.baseAsset)
        )
        .map((item) => item.symbol)
    );

    const markets = tickers
      .filter((item) =>
        allowedSymbols.has(item.symbol)
      )
      .map((item) => ({
        symbol: item.symbol,
        price: Number(item.lastPrice),
        change24h: Number(item.priceChangePercent),
        volume24h: Number(item.volume),
        quoteVolume24h: Number(item.quoteVolume),
        high24h: Number(item.highPrice),
        low24h: Number(item.lowPrice),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.price) &&
          Number.isFinite(item.change24h) &&
          Number.isFinite(item.quoteVolume24h)
      )
      .sort(
        (a, b) =>
          b.quoteVolume24h -
          a.quoteVolume24h
      );

    const btc =
      markets.find(
        (item) => item.symbol === "BTCUSDT"
      ) ?? null;

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      btc,
      markets: markets.slice(0, 100),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Market data unavailable",
      },
      { status: 502 }
    );
  }
}
