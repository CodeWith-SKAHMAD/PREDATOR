import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SPOT_BASES = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
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

type PremiumIndexRow = {
  symbol: string;
  lastFundingRate?: string;
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
type EntryStatus =
  | "OBSERVE"
  | "VALID ENTRY ZONE"
  | "WAIT RETEST"
  | "BREAKOUT"
  | "RETEST"
  | "EXTENDED"
  | "PUMPED"
  | "NO TRADE";

type ToolResult = {
  score: 0 | 10;
  label: string;
  bias: Bias;
};

type SignalRow = {
  symbol: string;
  baseAsset: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
  status: string;
  entryStatus: EntryStatus;
  price: number;
  triggerPrice: number;
  priceChange24h: number;
  change15m: number;
  change1h: number;
  volumeSpike: number;
  incomingVolume: number;
  rsi: number | null;
  funding: number | null;
  atrPercent: number | null;
  support: number;
  supportDistance: number;
  resistance: number;
  resistanceDistance: number;
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

async function fetchJson<T>(bases: string[], path: string, timeoutMs = 6500): Promise<T> {
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
      lastError = error instanceof Error ? error.message : "Market data request failed";
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
    .filter((row) =>
      [row.high, row.low, row.close, row.volume, row.quoteVolume].every(
        (value) => Number.isFinite(value),
      ),
    );
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0;
  if (values.length < period) return values[values.length - 1] ?? 0;

  const multiplier = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i += 1) {
    value += (values[i] - value) * multiplier;
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
  if (values.length < 35) return { line: 0, signal: 0, histogram: 0 };

  const lineSeries: number[] = [];

  for (let i = 0; i < values.length; i += 1) {
    const fast = ema(values.slice(0, i + 1), 12);
    const slow = ema(values.slice(0, i + 1), 26);
    lineSeries.push(fast - slow);
  }

  const line = lineSeries[lineSeries.length - 1] ?? 0;
  const signal = ema(lineSeries.slice(-9), 9);

  return { line, signal, histogram: line - signal };
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

  let trAvg = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let plus = plusDm.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let minus = minusDm.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const dxValues: number[] = [];

  for (let i = period; i < tr.length; i += 1) {
    trAvg = (trAvg * (period - 1) + tr[i]) / period;
    plus = (plus * (period - 1) + plusDm[i]) / period;
    minus = (minus * (period - 1) + minusDm[i]) / period;

    if (trAvg <= 0) continue;

    const plusDi = (plus / trAvg) * 100;
    const minusDi = (minus / trAvg) * 100;
    const denominator = plusDi + minusDi;

    if (denominator > 0) {
      dxValues.push((Math.abs(plusDi - minusDi) / denominator) * 100);
    }
  }

  if (!dxValues.length) return null;
  return dxValues.slice(-period).reduce((a, b) => a + b, 0) / Math.min(period, dxValues.length);
}

function tool(score: 0 | 10, label: string, bias: Bias): ToolResult {
  return { score, label, bias };
}

function binaryDirection(longCondition: boolean, shortCondition: boolean, longLabel: string, shortLabel: string): ToolResult {
  if (longCondition && !shortCondition) return tool(10, longLabel, "LONG");
  if (shortCondition && !longCondition) return tool(10, shortLabel, "SHORT");
  return tool(0, "No clear confirmation", "NEUTRAL");
}

function volumeTool(spike: number, change: number): ToolResult {
  if (spike >= 1.5 && change > 0) return tool(10, `${spike.toFixed(1)}× bullish participation`, "LONG");
  if (spike >= 1.5 && change < 0) return tool(10, `${spike.toFixed(1)}× bearish participation`, "SHORT");
  return tool(0, `${spike.toFixed(1)}× volume`, "NEUTRAL");
}

function rsiTool(value: number | null): ToolResult {
  if (value === null) return tool(0, "RSI unavailable", "NEUTRAL");
  if (value >= 50 && value <= 68) return tool(10, `Bullish RSI ${value.toFixed(1)}`, "LONG");
  if (value >= 32 && value < 50) return tool(10, `Bearish RSI ${value.toFixed(1)}`, "SHORT");
  return tool(0, `RSI ${value.toFixed(1)} outside setup zone`, "NEUTRAL");
}

function fundingTool(value: number | null): ToolResult {
  if (value === null) return tool(0, "Funding unavailable", "NEUTRAL");

  const pct = value * 100;
  if (pct <= -0.03) return tool(10, `Negative funding ${pct.toFixed(3)}%`, "LONG");
  if (pct >= 0.03) return tool(10, `Positive funding ${pct.toFixed(3)}%`, "SHORT");
  return tool(0, `Neutral funding ${pct.toFixed(3)}%`, "NEUTRAL");
}

function liquidityTool(volume24h: number, spreadBps: number | null): ToolResult {
  const volumeOk = volume24h >= 50_000_000;
  const spreadOk = spreadBps === null || spreadBps <= 8;
  if (volumeOk && spreadOk) {
    return tool(10, spreadBps === null ? "High liquidity" : `Liquidity ${spreadBps.toFixed(1)} bps`, "NEUTRAL");
  }
  return tool(0, spreadBps === null ? "Liquidity filter failed" : `Wide spread ${spreadBps.toFixed(1)} bps`, "NEUTRAL");
}

function atrTool(atrPercent: number | null): ToolResult {
  if (atrPercent === null) return tool(0, "ATR unavailable", "NEUTRAL");
  if (atrPercent >= 0.15 && atrPercent <= 2.5) return tool(10, `Healthy ATR ${atrPercent.toFixed(2)}%`, "NEUTRAL");
  return tool(0, `ATR ${atrPercent.toFixed(2)}% outside range`, "NEUTRAL");
}

function marketStructureTool(
  price: number,
  support: number,
  resistance: number,
  ema21: number,
  change15m: number,
): ToolResult {
  const range = resistance - support;
  if (range <= 0) return tool(0, "Structure unavailable", "NEUTRAL");

  const position = (price - support) / range;

  if (price > ema21 && change15m > 0 && position >= 0.35 && position <= 0.82) {
    return tool(10, "Bullish structure with room", "LONG");
  }

  if (price < ema21 && change15m < 0 && position >= 0.18 && position <= 0.65) {
    return tool(10, "Bearish structure with room", "SHORT");
  }

  return tool(0, "No clean structure confirmation", "NEUTRAL");
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

function inferDirection(tools: Record<string, ToolResult>, score: number): Bias {
  let long = 0;
  let short = 0;

  for (const current of Object.values(tools)) {
    if (current.bias === "LONG") long += current.score;
    if (current.bias === "SHORT") short += current.score;
  }

  if (score < 80 || long === short) return "NEUTRAL";
  return long > short ? "LONG" : "SHORT";
}

function getEntryStatus(
  score: number,
  direction: Bias,
  breakoutLong: boolean,
  breakoutShort: boolean,
  supportDistance: number,
  resistanceDistance: number,
): EntryStatus {
  if (direction === "NEUTRAL" || score < 80) return "NO TRADE";
  if (score >= 130) return "PUMPED";
  if (score >= 120) return "EXTENDED";
  if (breakoutLong || breakoutShort) return "BREAKOUT";

  if (direction === "LONG") {
    if (supportDistance <= 1.2 && supportDistance < resistanceDistance) return score >= 100 ? "VALID ENTRY ZONE" : "RETEST";
    return "WAIT RETEST";
  }

  if (resistanceDistance <= 1.2 && resistanceDistance < supportDistance) return score >= 100 ? "VALID ENTRY ZONE" : "RETEST";
  return "WAIT RETEST";
}

function windowMeta() {
  const windowMs = 30 * 60 * 1000;
  const windowId = Math.floor(Date.now() / windowMs);
  const capturedAt = new Date(windowId * windowMs).toISOString();
  return { windowId, capturedAt, scanId: capturedAt };
}

async function getKlines(symbol: string, interval: "15m" | "1h", limit: number) {
  const rows = await fetchJson<Kline[]>(
    SPOT_BASES,
    `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  return toClosedCandles(rows);
}

async function getFundingForSymbol(
  symbol: string,
  globalValue: string | undefined,
): Promise<number | null> {
  if (globalValue !== undefined) {
    const value = Number(globalValue);
    if (Number.isFinite(value)) return value;
  }

  // Prefer the single-symbol premium-index endpoint. It is the most direct
  // public source for the latest perpetual funding rate.
  const premium = await safeFetch<PremiumIndexRow>(
    FUTURES_BASES,
    `/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`,
  );

  if (premium?.lastFundingRate !== undefined) {
    const parsed = Number(premium.lastFundingRate);
    if (Number.isFinite(parsed)) return parsed;
  }

  // Fallback to the public funding-rate history endpoint.
  const latest = await safeFetch<FundingRow[]>(
    FUTURES_BASES,
    `/fapi/v1/fundingRate?symbol=${encodeURIComponent(symbol)}&limit=1`,
  );

  const value = latest?.[0]?.fundingRate;
  if (value === undefined) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
      safeFetch<PremiumIndexRow[]>(FUTURES_BASES, "/fapi/v1/premiumIndex"),
    ]);

    const tradable = exchangeInfo.symbols
      .filter((item) =>
        item.status === "TRADING" &&
        item.quoteAsset === "USDT" &&
        item.isSpotTradingAllowed !== false &&
        !STABLE_BASES.has(item.baseAsset),
      )
      .map((item) => item.symbol);

    const tickerMap = new Map(tickers.map((item) => [item.symbol, item]));
    const bookMap = new Map((books ?? []).map((item) => [item.symbol, item]));
    const fundingMap = new Map((fundingAll ?? []).map((item) => [item.symbol, item.lastFundingRate]));

    const candidates = tradable
      .map((symbol) => {
        const ticker = tickerMap.get(symbol);
        if (!ticker) return null;

        const price = Number(ticker.lastPrice);
        const change24h = Number(ticker.priceChangePercent);
        const volume24h = Number(ticker.quoteVolume);

        if (!Number.isFinite(price) || !Number.isFinite(change24h) || !Number.isFinite(volume24h)) return null;
        if (volume24h < 20_000_000) return null;

        return { symbol, price, change24h, volume24h };
      })
      .filter((item): item is { symbol: string; price: number; change24h: number; volume24h: number } => item !== null)
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 10);

    const [btc15, btc1h] = await Promise.all([
      getKlines("BTCUSDT", "15m", 120),
      getKlines("BTCUSDT", "1h", 120),
    ]);

    if (btc15.length < 60 || btc1h.length < 40) {
      throw new Error("BTC market data is temporarily incomplete");
    }

    const btc15Closes = btc15.map((c) => c.close);
    const btc1hCloses = btc1h.map((c) => c.close);
    const btc15Close = btc15Closes[btc15Closes.length - 1];
    const btc1hClose = btc1hCloses[btc1hCloses.length - 1];
    const btc15Ema9 = ema(btc15Closes, 9);
    const btc15Ema21 = ema(btc15Closes, 21);
    const btc15Ema50 = ema(btc15Closes, 50);
    const btc1hEma21 = ema(btc1hCloses, 21);
    const btc1hEma50 = ema(btc1hCloses, 50);
    const btc15Momentum = ((btc15Close / btc15Closes[Math.max(0, btc15Closes.length - 5)] - 1) * 100);
    const btc1hMomentum = ((btc1hClose / btc1hCloses[Math.max(0, btc1hCloses.length - 4)] - 1) * 100);
    const btcBull = btc15Close > btc15Ema9 && btc15Ema9 > btc15Ema21 && btc15Ema21 > btc15Ema50 && btc1hClose > btc1hEma21 && btc1hEma21 >= btc1hEma50 && btc15Momentum > 0 && btc1hMomentum > 0;
    const btcBear = btc15Close < btc15Ema9 && btc15Ema9 < btc15Ema21 && btc15Ema21 < btc15Ema50 && btc1hClose < btc1hEma21 && btc1hEma21 <= btc1hEma50 && btc15Momentum < 0 && btc1hMomentum < 0;
    const btcRegime: "Bullish" | "Bearish" | "Neutral" = btcBull ? "Bullish" : btcBear ? "Bearish" : "Neutral";

    const rows = await Promise.all(
      candidates.map(async (candidate): Promise<SignalRow | null> => {
        try {
          const [raw15m, raw1h, funding] = await Promise.all([
            safeFetch<Kline[]>(SPOT_BASES, `/api/v3/klines?symbol=${candidate.symbol}&interval=15m&limit=121`),
            safeFetch<Kline[]>(SPOT_BASES, `/api/v3/klines?symbol=${candidate.symbol}&interval=1h&limit=121`),
            getFundingForSymbol(candidate.symbol, fundingMap.get(candidate.symbol)),
          ]);

          if (!raw15m || !raw1h) return null;

          const c15 = toClosedCandles(raw15m);
          const c1h = toClosedCandles(raw1h);
          if (c15.length < 60 || c1h.length < 40) return null;

          const closes15 = c15.map((c) => c.close);
          const closes1h = c1h.map((c) => c.close);
          const current = c15[c15.length - 1];
          const previous = c15[c15.length - 2];

          const previous20 = c15.slice(-21, -1);
          const averageVolume = previous20.length
            ? previous20.reduce((sum, candle) => sum + candle.quoteVolume, 0) / previous20.length
            : current.quoteVolume;
          const volumeSpike = averageVolume > 0 ? current.quoteVolume / averageVolume : 1;

          const ema9 = ema(closes15, 9);
          const ema21 = ema(closes15, 21);
          const ema50 = ema(closes15, 50);
          const ema1h21 = ema(closes1h, 21);
          const ema1h50 = ema(closes1h, 50);
          const vwapValue = vwap(c15);
          const rsiValue = rsi(closes15);
          const macdValue = macd(closes15);
          const atrValue = atr(c15);
          const adxValue = adx(c15);

          const structure = c15.slice(-21, -1);
          const support = Math.min(...structure.map((c) => c.low));
          const resistance = Math.max(...structure.map((c) => c.high));

          const change15m = previous.close > 0 ? ((current.close / previous.close) - 1) * 100 : 0;
          const oneHourAgo = c15[Math.max(0, c15.length - 5)]?.close ?? current.close;
          const change1h = oneHourAgo > 0 ? ((current.close / oneHourAgo) - 1) * 100 : 0;
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

          const atrPercent = atrValue !== null && current.close > 0 ? (atrValue / current.close) * 100 : null;
          const distanceToSupport = current.close > 0 ? ((current.close - support) / current.close) * 100 : 0;
          const distanceToResistance = current.close > 0 ? ((resistance - current.close) / current.close) * 100 : 0;

          const breakoutLong = current.close > resistance && current.volume >= averageVolume * 1.2 && current.close > previous.close;
          const breakoutShort = current.close < support && current.volume >= averageVolume * 1.2 && current.close < previous.close;

          const tools: Record<string, ToolResult> = {};
          tools["Volume Spike"] = volumeTool(volumeSpike, change15m);
          tools["EMA Trend"] = binaryDirection(
            current.close > ema9 && ema9 > ema21 && ema21 > ema50,
            current.close < ema9 && ema9 < ema21 && ema21 < ema50,
            "EMA 9/21/50 bullish",
            "EMA 9/21/50 bearish",
          );
          tools.VWAP = binaryDirection(
            vwapValue !== null && current.close >= vwapValue * 1.002,
            vwapValue !== null && current.close <= vwapValue * 0.998,
            "Above VWAP",
            "Below VWAP",
          );
          tools.RSI = rsiTool(rsiValue);
          tools.MACD = binaryDirection(
            macdValue.histogram > 0 && macdValue.line > 0,
            macdValue.histogram < 0 && macdValue.line < 0,
            "MACD bullish",
            "MACD bearish",
          );
          tools.Breakout = binaryDirection(
            breakoutLong,
            breakoutShort,
            "Confirmed 15m breakout",
            "Confirmed 15m breakdown",
          );
          tools["Market Structure"] = marketStructureTool(current.close, support, resistance, ema21, change15m);
          tools.Funding = fundingTool(funding);
          tools["BTC Confirmation"] = binaryDirection(
            btcBull && current.close > ema21 && change1h > 0,
            btcBear && current.close < ema21 && change1h < 0,
            "BTC trend confirms long",
            "BTC trend confirms short",
          );
          tools.Liquidity = liquidityTool(candidate.volume24h, spreadBps);
          tools.ATR = atrTool(atrPercent);
          tools["Support / Resistance"] = binaryDirection(
            distanceToSupport <= 1.5 && distanceToSupport < distanceToResistance,
            distanceToResistance <= 1.5 && distanceToResistance < distanceToSupport,
            "Near support with room",
            "Near resistance with room",
          );
          tools["Trend Strength"] = binaryDirection(
            adxValue !== null && adxValue >= 20 && ema9 > ema21,
            adxValue !== null && adxValue >= 20 && ema9 < ema21,
            `ADX ${adxValue === null ? "N/A" : adxValue.toFixed(1)} bullish`,
            `ADX ${adxValue === null ? "N/A" : adxValue.toFixed(1)} bearish`,
          );
          tools["Momentum Alignment"] = binaryDirection(
            change15m > 0.15 && momentum1h > 0.3,
            change15m < -0.15 && momentum1h < -0.3,
            "15m + 1h momentum aligned",
            "15m + 1h momentum aligned",
          );
          tools["Market Regime"] = binaryDirection(
            ema1h21 > ema1h50 && current.close > ema21 && momentum1h > 0,
            ema1h21 < ema1h50 && current.close < ema21 && momentum1h < 0,
            "Bull trend regime",
            "Bear trend regime",
          );

          const score = Object.values(tools).reduce((sum, currentTool) => sum + currentTool.score, 0);
          const direction = inferDirection(tools, score);
          const status = getStatus(score);
          const entryStatus = getEntryStatus(score, direction, breakoutLong, breakoutShort, distanceToSupport, distanceToResistance);

          const reasons: string[] = [];
          const triggered = Object.entries(tools)
            .filter(([, value]) => value.score === 10)
            .map(([name, value]) => `${name}: ${value.label}`);

          if (triggered.length) reasons.push(...triggered.slice(0, 4));
          if (reasons.length === 0) reasons.push("Not enough confluence for a trade setup");

          const invalidation = direction === "LONG"
            ? Math.max(support * 0.998, current.close - (atrValue ?? 0))
            : direction === "SHORT"
              ? Math.min(resistance * 1.002, current.close + (atrValue ?? 0))
              : null;

          return {
            symbol: candidate.symbol,
            baseAsset: candidate.symbol.replace(/USDT$/, ""),
            direction,
            score,
            status,
            entryStatus,
            price: candidate.price,
            triggerPrice: current.close,
            priceChange24h: candidate.change24h,
            change15m,
            change1h,
            volumeSpike,
            incomingVolume: current.quoteVolume,
            rsi: rsiValue,
            funding,
            atrPercent,
            support,
            supportDistance: distanceToSupport,
            resistance,
            resistanceDistance: distanceToResistance,
            invalidation,
            riskLevel: getRisk(atrPercent, status),
            liquidity: candidate.volume24h,
            spreadBps,
            capturedAt,
            tools,
            reasons: reasons.slice(0, 4),
          };
        } catch {
          return null;
        }
      }),
    );

    const data = rows
      .filter((row): row is SignalRow => row !== null)
      .sort((a, b) => b.score - a.score)
      .filter((row) => row.score >= 80 && row.direction !== "NEUTRAL")
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
