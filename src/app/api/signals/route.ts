import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SPOT_BASES = [
  "https://data-api.binance.vision",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

const FUTURES_BASES = [
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com",
  "https://fapi4.binance.com",
];

const STABLE_BASES = new Set([
  "USDT",
  "USDC",
  "FDUSD",
  "TUSD",
  "USDE",
  "DAI",
  "BUSD",
]);

type SpotSymbol = {
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

type BookTicker = {
  symbol: string;
  bidPrice: string;
  askPrice: string;
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
  string,
];

type FundingRow = {
  symbol: string;
  fundingRate: string;
};

type OiRow = {
  symbol: string;
  sumOpenInterestValue: string;
  timestamp: number;
};

type Candle = {
  openTime: number;
  closeTime: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
};

type Bias = "LONG" | "SHORT" | "NEUTRAL";

type ToolResult = {
  score: number;
  label: string;
  bias: Bias;
};

type SignalRow = {
  symbol: string;
  baseAsset: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
  status: string;
  price: number;
  priceChange24h: number;
  volumeSpike: number;
  rsi: number | null;
  funding: number | null;
  openInterestChange: number | null;
  atrPercent: number | null;
  support: number;
  resistance: number;
  invalidation: number | null;
  riskLevel: "Low" | "Moderate" | "High" | "Extreme";
  liquidity: number;
  spreadBps: number | null;
  capturedAt: string;
  tools: Record<string, ToolResult>;
  reasons: string[];
};

type ScanCache = {
  windowId: number;
  data: {
    ok: true;
    updatedAt: string;
    scanId: string;
    btcRegime: "Bullish" | "Bearish" | "Neutral";
    scanIntervalMinutes: 30;
    rows: SignalRow[];
  };
};

let scanCache: ScanCache | null = null;

async function fetchJson<T>(
  bases: string[],
  path: string,
  timeoutMs = 7000,
): Promise<T> {
  let lastError = "Market data request failed";

  for (const base of bases) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${base}${path}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = `Request failed: ${response.status}`;
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Market data request failed";
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(lastError);
}

async function safeFetch<T>(bases: string[], path: string): Promise<T | null> {
  try {
    return await fetchJson<T>(bases, path);
  } catch {
    return null;
  }
}

function toClosedCandles(rows: Kline[]): Candle[] {
  const now = Date.now();
  return rows
    .filter((row) => Number(row[6]) <= now)
    .map((row) => ({
      openTime: Number(row[0]),
      closeTime: Number(row[6]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
      quoteVolume: Number(row[7]),
    }))
    .filter(
      (row) =>
        Number.isFinite(row.close) &&
        Number.isFinite(row.high) &&
        Number.isFinite(row.low) &&
        Number.isFinite(row.volume) &&
        Number.isFinite(row.quoteVolume),
    );
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0;
  if (values.length < period) return values[values.length - 1] ?? 0;

  const multiplier = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i += 1) {
    value = value + (values[i] - value) * multiplier;
  }

  return value;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;

  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    gain += Math.max(delta, 0);
    loss += Math.max(-delta, 0);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;

  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }

  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values: number[]) {
  if (values.length < 35) {
    return { line: 0, signal: 0, histogram: 0 };
  }

  const lineSeries: number[] = [];

  for (let i = 0; i < values.length; i += 1) {
    const fast = ema(values.slice(0, i + 1), 12);
    const slow = ema(values.slice(0, i + 1), 26);
    lineSeries.push(fast - slow);
  }

  const line = lineSeries[lineSeries.length - 1] ?? 0;
  const signal = ema(lineSeries.slice(-9), 9);

  return {
    line,
    signal,
    histogram: line - signal,
  };
}

function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  const ranges: number[] = [];

  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];

    ranges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    );
  }

  const latest = ranges.slice(-period);
  if (!latest.length) return null;

  return latest.reduce((sum, value) => sum + value, 0) / latest.length;
}

function vwap(candles: Candle[], lookback = 48): number | null {
  const source = candles.slice(-lookback);
  let pv = 0;
  let volume = 0;

  for (const candle of source) {
    const typical = (candle.high + candle.low + candle.close) / 3;
    pv += typical * candle.volume;
    volume += candle.volume;
  }

  return volume > 0 ? pv / volume : null;
}

function adx(candles: Candle[], period = 14): number | null {
  if (candles.length < period * 2 + 1) return null;

  const tr: number[] = [];
  const plusDm: number[] = [];
  const minusDm: number[] = [];

  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];

    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    plusDm.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDm.push(downMove > upMove && downMove > 0 ? downMove : 0);

    tr.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    );
  }

  let plus = plusDm.slice(-period).reduce((a, b) => a + b, 0) / period;
  let minus = minusDm.slice(-period).reduce((a, b) => a + b, 0) / period;
  let trAvg = tr.slice(-period).reduce((a, b) => a + b, 0) / period;

  if (trAvg <= 0) return 0;

  let dxValues: number[] = [];

  for (let i = period; i < tr.length; i += 1) {
    const trValue = tr[i];
    const plusValue = plusDm[i];
    const minusValue = minusDm[i];

    trAvg = (trAvg * (period - 1) + trValue) / period;
    plus = (plus * (period - 1) + plusValue) / period;
    minus = (minus * (period - 1) + minusValue) / period;

    if (trAvg <= 0) continue;

    const plusDi = (plus / trAvg) * 100;
    const minusDi = (minus / trAvg) * 100;
    const denominator = plusDi + minusDi;

    if (denominator > 0) {
      dxValues.push((Math.abs(plusDi - minusDi) / denominator) * 100);
    }
  }

  if (!dxValues.length) return null;

  return dxValues.slice(-period).reduce((a, b) => a + b, 0) /
    Math.min(period, dxValues.length);
}

function scoreDirection(bullish: boolean, bearish: boolean, strength = 1): ToolResult {
  if (bullish && !bearish) {
    return { score: Math.max(6, Math.min(10, Math.round(5 + 5 * strength))), label: "Bullish", bias: "LONG" };
  }

  if (bearish && !bullish) {
    return { score: Math.max(6, Math.min(10, Math.round(5 + 5 * strength))), label: "Bearish", bias: "SHORT" };
  }

  return { score: 5, label: "Neutral", bias: "NEUTRAL" };
}

function scoreVolume(spike: number, priceChange: number): ToolResult {
  if (spike >= 2) {
    return {
      score: 10,
      label: `${spike.toFixed(1)}x spike`,
      bias: priceChange > 0 ? "LONG" : priceChange < 0 ? "SHORT" : "NEUTRAL",
    };
  }

  if (spike >= 1.5) {
    return {
      score: 8,
      label: `${spike.toFixed(1)}x elevated`,
      bias: priceChange > 0 ? "LONG" : priceChange < 0 ? "SHORT" : "NEUTRAL",
    };
  }

  if (spike >= 1.2) {
    return {
      score: 6,
      label: `${spike.toFixed(1)}x active`,
      bias: priceChange > 0 ? "LONG" : priceChange < 0 ? "SHORT" : "NEUTRAL",
    };
  }

  return { score: 5, label: `${spike.toFixed(1)}x normal`, bias: "NEUTRAL" };
}

function scoreRsi(value: number | null): ToolResult {
  if (value === null) return { score: 5, label: "N/A", bias: "NEUTRAL" };
  if (value >= 55 && value <= 68) return { score: 9, label: "Bullish zone", bias: "LONG" };
  if (value >= 70) return { score: 6, label: "Overbought", bias: "SHORT" };
  if (value <= 30) return { score: 6, label: "Oversold", bias: "LONG" };
  if (value <= 45) return { score: 7, label: "Weak", bias: "SHORT" };
  return { score: 6, label: "Neutral", bias: "NEUTRAL" };
}

function scoreLiquidity(volume24h: number, spreadBps: number | null): ToolResult {
  let score = 5;

  if (volume24h >= 500_000_000) score = 10;
  else if (volume24h >= 250_000_000) score = 9;
  else if (volume24h >= 100_000_000) score = 8;
  else if (volume24h >= 50_000_000) score = 7;
  else if (volume24h >= 20_000_000) score = 6;
  else if (volume24h < 5_000_000) score = 3;

  if (spreadBps !== null) {
    if (spreadBps > 12) score = Math.max(1, score - 2);
    else if (spreadBps > 6) score = Math.max(1, score - 1);
  }

  return {
    score,
    label: spreadBps === null ? "Liquid" : `${spreadBps.toFixed(1)} bps`,
    bias: "NEUTRAL",
  };
}

function scoreAtr(atrPercent: number | null): ToolResult {
  if (atrPercent === null) return { score: 5, label: "N/A", bias: "NEUTRAL" };
  if (atrPercent >= 0.25 && atrPercent <= 2.5) return { score: 9, label: "Healthy", bias: "NEUTRAL" };
  if (atrPercent < 0.1) return { score: 4, label: "Too quiet", bias: "NEUTRAL" };
  if (atrPercent > 3) return { score: 4, label: "Too volatile", bias: "NEUTRAL" };
  return { score: 6, label: "Moderate", bias: "NEUTRAL" };
}

function scoreFunding(value: number | null): ToolResult {
  if (value === null) return { score: 5, label: "N/A", bias: "NEUTRAL" };

  const percent = value * 100;
  if (percent >= 0.1) return { score: 8, label: "Crowded long", bias: "SHORT" };
  if (percent >= 0.03) return { score: 6, label: "Positive", bias: "NEUTRAL" };
  if (percent <= -0.1) return { score: 8, label: "Crowded short", bias: "LONG" };
  if (percent <= -0.03) return { score: 6, label: "Negative", bias: "NEUTRAL" };
  return { score: 5, label: "Neutral", bias: "NEUTRAL" };
}

function getStatus(score: number): string {
  if (score >= 120) return "Extended / Pumped";
  if (score >= 110) return "Strong";
  if (score >= 100) return "Valid";
  if (score >= 80) return "Observe";
  return "Ignore";
}

function getRisk(atrPercent: number | null, status: string): "Low" | "Moderate" | "High" | "Extreme" {
  if (status === "Extended / Pumped") return "Extreme";
  if (atrPercent !== null && atrPercent >= 3) return "High";
  if (atrPercent !== null && atrPercent >= 1.5) return "Moderate";
  return "Low";
}

function windowMeta() {
  const windowMs = 30 * 60 * 1000;
  const windowId = Math.floor(Date.now() / windowMs);
  const capturedAt = new Date(windowId * windowMs).toISOString();
  const scanId = new Date(windowId * windowMs).toISOString();
  return { windowId, capturedAt, scanId };
}

function inferDirection(tools: Record<string, ToolResult>, score: number): Bias {
  let long = 0;
  let short = 0;

  Object.values(tools).forEach((tool) => {
    if (tool.bias === "LONG") long += tool.score;
    if (tool.bias === "SHORT") short += tool.score;
  });

  if (score < 80) return "NEUTRAL";
  if (long === short) return "NEUTRAL";
  return long > short ? "LONG" : "SHORT";
}

async function getKlines(symbol: string, interval: "15m" | "1h", limit: number) {
  const rows = await fetchJson<Kline[]>(
    SPOT_BASES,
    `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  return toClosedCandles(rows);
}

export async function GET() {
  try {
    const { windowId, capturedAt, scanId } = windowMeta();

    if (scanCache && scanCache.windowId === windowId) {
      return NextResponse.json(scanCache.data);
    }

    const [exchangeInfo, tickers, books, fundingAll] = await Promise.all([
      fetchJson<{ symbols: SpotSymbol[] }>(SPOT_BASES, "/api/v3/exchangeInfo"),
      fetchJson<Ticker[]>(SPOT_BASES, "/api/v3/ticker/24hr"),
      safeFetch<BookTicker[]>(SPOT_BASES, "/api/v3/ticker/bookTicker"),
      safeFetch<FundingRow[]>(FUTURES_BASES, "/fapi/v1/premiumIndex"),
    ]);

    const tradable = exchangeInfo.symbols
      .filter(
        (item) =>
          item.status === "TRADING" &&
          item.quoteAsset === "USDT" &&
          item.isSpotTradingAllowed !== false &&
          !STABLE_BASES.has(item.baseAsset),
      )
      .map((item) => item.symbol);

    const tickerMap = new Map(tickers.map((item) => [item.symbol, item]));
    const bookMap = new Map((books ?? []).map((item) => [item.symbol, item]));
    const fundingMap = new Map((fundingAll ?? []).map((item) => [item.symbol, item]));

    const candidates = tradable
      .map((symbol) => {
        const ticker = tickerMap.get(symbol);
        if (!ticker) return null;

        const price = Number(ticker.lastPrice);
        const change24h = Number(ticker.priceChangePercent);
        const volume24h = Number(ticker.quoteVolume);

        if (!Number.isFinite(price) || !Number.isFinite(change24h) || !Number.isFinite(volume24h)) {
          return null;
        }

        return { symbol, price, change24h, volume24h };
      })
      .filter((item): item is { symbol: string; price: number; change24h: number; volume24h: number } => item !== null)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);

    const btc15 = await getKlines("BTCUSDT", "15m", 120);
    const btc1h = await getKlines("BTCUSDT", "1h", 120);

    const btc15Close = btc15[btc15.length - 1]?.close ?? 0;
    const btc1hClose = btc1h[btc1h.length - 1]?.close ?? 0;
    const btc15Ema9 = ema(btc15.map((c) => c.close), 9);
    const btc15Ema21 = ema(btc15.map((c) => c.close), 21);
    const btc1hEma21 = ema(btc1h.map((c) => c.close), 21);
    const btc15Momentum = btc15.length >= 5
      ? ((btc15Close / btc15[btc15.length - 5].close) - 1) * 100
      : 0;
    const btc1hMomentum = btc1h.length >= 4
      ? ((btc1hClose / btc1h[btc1h.length - 4].close) - 1) * 100
      : 0;

    const btcBull = btc15Close > btc15Ema9 && btc15Ema9 > btc15Ema21 && btc1hClose > btc1hEma21 && btc1hMomentum >= 0;
    const btcBear = btc15Close < btc15Ema9 && btc15Ema9 < btc15Ema21 && btc1hClose < btc1hEma21 && btc1hMomentum <= 0;
    const btcRegime: "Bullish" | "Bearish" | "Neutral" = btcBull ? "Bullish" : btcBear ? "Bearish" : "Neutral";

    const rows = await Promise.all(
      candidates.map(async (candidate): Promise<SignalRow | null> => {
        try {
          const [raw15m, raw1h, oiHistory] = await Promise.all([
            safeFetch<Kline[]>(SPOT_BASES, `/api/v3/klines?symbol=${candidate.symbol}&interval=15m&limit=121`),
            safeFetch<Kline[]>(SPOT_BASES, `/api/v3/klines?symbol=${candidate.symbol}&interval=1h&limit=121`),
            safeFetch<OiRow[]>(FUTURES_BASES, `/futures/data/openInterestHist?symbol=${candidate.symbol}&period=15m&limit=2`),
          ]);

          if (!raw15m || !raw1h) return null;

          const c15 = toClosedCandles(raw15m);
          const c1h = toClosedCandles(raw1h);

          if (c15.length < 60 || c1h.length < 30) return null;

          const closes15 = c15.map((c) => c.close);
          const closes1h = c1h.map((c) => c.close);
          const current = c15[c15.length - 1];

          const previous20 = c15.slice(-21, -1);
          const averageVolume = previous20.length
            ? previous20.reduce((sum, candle) => sum + candle.quoteVolume, 0) / previous20.length
            : current.quoteVolume;
          const volumeSpike = averageVolume > 0 ? current.quoteVolume / averageVolume : 1;

          const ema9 = ema(closes15, 9);
          const ema21 = ema(closes15, 21);
          const ema50 = ema(closes15, 50);
          const ema1h21 = ema(closes1h, 21);

          const vwapValue = vwap(c15);
          const rsiValue = rsi(closes15);
          const macdValue = macd(closes15);
          const atrValue = atr(c15);
          const adxValue = adx(c15);

          const prior = c15.slice(-21, -1);
          const support = Math.min(...prior.map((c) => c.low));
          const resistance = Math.max(...prior.map((c) => c.high));

          const momentum15m = c15.length >= 5
            ? ((current.close / c15[c15.length - 5].close) - 1) * 100
            : 0;
          const momentum1h = c1h.length >= 4
            ? ((c1h[c1h.length - 1].close / c1h[c1h.length - 4].close) - 1) * 100
            : 0;

          const book = bookMap.get(candidate.symbol);
          let spreadBps: number | null = null;
          if (book) {
            const bid = Number(book.bidPrice);
            const ask = Number(book.askPrice);
            const mid = (bid + ask) / 2;
            if (Number.isFinite(mid) && mid > 0) spreadBps = ((ask - bid) / mid) * 10000;
          }

          const fundingRaw = fundingMap.get(candidate.symbol)?.fundingRate;
          const funding = fundingRaw === undefined ? null : Number(fundingRaw);

          let oiChange: number | null = null;
          if (oiHistory && oiHistory.length >= 2) {
            const first = Number(oiHistory[0].sumOpenInterestValue);
            const last = Number(oiHistory[oiHistory.length - 1].sumOpenInterestValue);
            if (first > 0 && Number.isFinite(first) && Number.isFinite(last)) {
              oiChange = ((last - first) / first) * 100;
            }
          }

          const tools: Record<string, ToolResult> = {};

          tools["Volume Spike"] = scoreVolume(volumeSpike, candidate.change24h);
          tools["EMA Trend"] = scoreDirection(
            current.close > ema9 && ema9 > ema21 && ema21 > ema50,
            current.close < ema9 && ema9 < ema21 && ema21 < ema50,
            1,
          );
          tools.VWAP = scoreDirection(
            vwapValue !== null && current.close > vwapValue * 1.002,
            vwapValue !== null && current.close < vwapValue * 0.998,
            0.9,
          );
          tools.RSI = scoreRsi(rsiValue);
          tools.MACD = scoreDirection(
            macdValue.line > 0 && macdValue.histogram > 0,
            macdValue.line < 0 && macdValue.histogram < 0,
            1,
          );

          const breakoutLong = current.close > resistance && current.volume >= averageVolume;
          const breakoutShort = current.close < support && current.volume >= averageVolume;
          tools.Breakout = scoreDirection(
            breakoutLong,
            breakoutShort,
            breakoutLong || breakoutShort ? 1 : 0.5,
          );

          if (oiChange === null) {
            tools["OI Change"] = { score: 5, label: "N/A", bias: "NEUTRAL" };
          } else {
            const long = oiChange > 1.5 && current.close > ema21;
            const short = oiChange > 1.5 && current.close < ema21;
            tools["OI Change"] = {
              score: Math.abs(oiChange) >= 3 ? 10 : Math.abs(oiChange) >= 1.5 ? 8 : 5,
              label: `${oiChange >= 0 ? "+" : ""}${oiChange.toFixed(1)}%`,
              bias: long ? "LONG" : short ? "SHORT" : "NEUTRAL",
            };
          }

          tools.Funding = scoreFunding(funding);
          tools["BTC Confirmation"] = scoreDirection(
            btcBull && momentum15m > 0 && current.close > ema21,
            btcBear && momentum15m < 0 && current.close < ema21,
            0.9,
          );
          tools.Liquidity = scoreLiquidity(candidate.volume24h, spreadBps);

          const atrPercent = atrValue === null || current.close <= 0 ? null : (atrValue / current.close) * 100;
          tools.ATR = scoreAtr(atrPercent);

          const distanceToSupport = current.close > 0 ? ((current.close - support) / current.close) * 100 : 0;
          const distanceToResistance = current.close > 0 ? ((resistance - current.close) / current.close) * 100 : 0;
          tools["Support / Resistance"] = scoreDirection(
            distanceToSupport >= 0.5 && distanceToResistance >= 1.0,
            distanceToResistance >= 0.5 && distanceToSupport >= 1.0,
            0.8,
          );

          tools["Trend Strength"] = scoreDirection(
            adxValue !== null && adxValue >= 20 && ema9 > ema21,
            adxValue !== null && adxValue >= 20 && ema9 < ema21,
            adxValue === null ? 0.5 : Math.min(adxValue / 30, 1),
          );

          tools["Momentum Alignment"] = scoreDirection(
            momentum15m > 0.15 && momentum1h > 0.3,
            momentum15m < -0.15 && momentum1h < -0.3,
            1,
          );

          const regimeBull = ema21 > ema50 && current.close > ema21 && momentum1h > 0;
          const regimeBear = ema21 < ema50 && current.close < ema21 && momentum1h < 0;
          tools["Market Regime"] = scoreDirection(regimeBull, regimeBear, 0.9);

          const score = Object.values(tools).reduce((sum, tool) => sum + tool.score, 0);
          const direction = inferDirection(tools, score);
          const status = getStatus(score);

          const reasons: string[] = [];
          if (volumeSpike >= 1.5) reasons.push(`Volume ${volumeSpike.toFixed(1)}× vs 20-bar avg`);
          if (breakoutLong) reasons.push("15m resistance breakout");
          if (breakoutShort) reasons.push("15m support breakdown");
          if (oiChange !== null && Math.abs(oiChange) >= 1.5) reasons.push(`OI ${oiChange >= 0 ? "+" : ""}${oiChange.toFixed(1)}%`);
          if (rsiValue !== null && rsiValue >= 70) reasons.push("RSI overbought");
          if (rsiValue !== null && rsiValue <= 30) reasons.push("RSI oversold");
          if (reasons.length === 0) reasons.push("Multiple market factors aligned");

          const invalidation = atrValue === null
            ? null
            : direction === "LONG"
              ? Math.max(0, current.close - atrValue * 1.2)
              : direction === "SHORT"
                ? current.close + atrValue * 1.2
                : null;

          const row: SignalRow = {
            symbol: candidate.symbol,
            baseAsset: candidate.symbol.replace(/USDT$/, ""),
            direction,
            score,
            status,
            price: candidate.price,
            priceChange24h: candidate.change24h,
            volumeSpike,
            rsi: rsiValue,
            funding,
            openInterestChange: oiChange,
            atrPercent,
            support,
            resistance,
            invalidation,
            riskLevel: getRisk(atrPercent, status),
            liquidity: candidate.volume24h,
            spreadBps,
            capturedAt,
            tools,
            reasons: reasons.slice(0, 3),
          };

          return row;
        } catch {
          return null;
        }
      }),
    );

    const data = rows
      .filter((row): row is SignalRow => row !== null)
      .sort((a, b) => b.score - a.score)
      .filter((row) => row.score >= 80)
      .slice(0, 24);

    const response = {
      ok: true as const,
      updatedAt: new Date().toISOString(),
      scanId,
      btcRegime,
      scanIntervalMinutes: 30 as const,
      rows: data,
    };

    scanCache = { windowId, data: response };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Signal scan failed",
      },
      { status: 502 },
    );
  }
}
