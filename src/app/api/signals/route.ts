import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

const CURRENT_ENGINE_VERSION = "scalp-v9-pump-retrace";
const WINDOW_MS = 30 * 60 * 1000;

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

type Candle = {
  openTime: number;
  closeTime: number;
  open: number;
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
  currentRangePercent: number;
  rsi: number | null;
  atrPercent: number | null;
  support: number;
  supportDistance: number;
  resistance: number;
  resistanceDistance: number;
  invalidation: number | null;
  riskLevel: "Low" | "Moderate" | "High" | "Extreme";
  liquidity: number;
  spreadBps: number | null;
  fundingRate: number | null;
  capturedAt: string;
  expiresAt: string;
  tools: Record<string, ToolResult>;
  reasons: string[];
};

type ScanCache = {
  windowId: number;
  data: {
    ok: true;
    windowId: number;
    updatedAt: string;
    scanId: string;
    btcRegime: "Bullish" | "Bearish" | "Neutral";
    scanIntervalMinutes: 30;
    rows: SignalRow[];
  };
};

// One canonical scan snapshot for every visitor/account/browser.
// The service-role key is server-only and must NEVER be exposed to the client.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVER_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const sharedSupabase =
  SUPABASE_URL && SUPABASE_SERVER_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVER_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function requireSharedSupabase() {
  if (!sharedSupabase) {
    throw new Error(
      "Shared signal storage is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in Vercel."
    );
  }
  return sharedSupabase;
}

async function readSharedSnapshot(windowId: number): Promise<ScanCache["data"] | null> {
  if (!sharedSupabase) return null;
  try {
    const { data, error } = await sharedSupabase
      .from("signal_scan_snapshots")
      .select("payload")
      .eq("window_id", windowId)
      .eq("engine_version", CURRENT_ENGINE_VERSION)
      .maybeSingle();
    if (error || !data?.payload) return null;
    return data.payload as ScanCache["data"];
  } catch {
    return null;
  }
}

type GlobalHistoryRow = {
  id: number;
  window_id: number;
  symbol: string;
  direction: "LONG" | "SHORT";
  score: number;
  status: string;
  price: number | null;
  signal_time: string;
  expires_at: string | null;
  volume_spike: number | null;
  rsi: number | null;
  tool_scores: Record<string, ToolResult> & { __meta?: Record<string, unknown> };
  reason: string | null;
};

let legacyHistoryMigrated = false;

async function migrateLegacyHistory() {
  if (!sharedSupabase || legacyHistoryMigrated) return;
  try {
    const { data, error } = await sharedSupabase
      .from("signal_history")
      .select("symbol, direction, score, status, price, signal_time, expires_at, volume_spike, rsi, tool_scores, reason")
      .order("signal_time", { ascending: false })
      .limit(5000);

    if (error) {
      return;
    }
    if (!data?.length) {
      legacyHistoryMigrated = true;
      return;
    }

    const rows = data.flatMap((row: any) => {
      const timestamp = Date.parse(row.signal_time);
      if (!Number.isFinite(timestamp)) return [];
      return [
        {
          window_id: Math.floor(timestamp / WINDOW_MS),
          symbol: String(row.symbol ?? ""),
          direction: row.direction,
          score: Number(row.score ?? 0),
          status: String(row.status ?? ""),
          price: row.price == null ? null : Number(row.price),
          signal_time: row.signal_time,
          expires_at: row.expires_at ?? null,
          volume_spike: row.volume_spike == null ? null : Number(row.volume_spike),
          rsi: row.rsi == null ? null : Number(row.rsi),
          tool_scores: row.tool_scores ?? {},
          reason: row.reason ?? null,
        },
      ];
    });

    if (rows.length) {
      await sharedSupabase
        .from("signal_history_global")
        .upsert(rows, { onConflict: "window_id,symbol", ignoreDuplicates: true });
    }
  } catch {
    // Migration is best-effort; the canonical current scan can still work.
  } finally {
    legacyHistoryMigrated = true;
  }
}

async function syncSnapshotHistory(data: ScanCache["data"]) {
  if (!sharedSupabase || !data.rows?.length) return;
  try {
    const rows = data.rows.map((signal) => ({
      window_id: data.windowId,
      symbol: signal.symbol,
      direction: signal.direction,
      score: signal.score,
      status: signal.status,
      price: signal.price,
      signal_time: signal.capturedAt,
      expires_at: signal.expiresAt,
      volume_spike: signal.volumeSpike,
      rsi: signal.rsi,
      tool_scores: {
        ...signal.tools,
        __meta: {
          change15m: signal.change15m,
          change1h: signal.change1h,
          support: signal.support,
          resistance: signal.resistance,
          supportDistance: signal.supportDistance,
          resistanceDistance: signal.resistanceDistance,
          fundingRate: signal.fundingRate,
          baseAsset: signal.baseAsset,
          capturedAt: signal.capturedAt,
        },
      },
      reason: signal.reasons.join(" · "),
    }));

    await sharedSupabase
      .from("signal_history_global")
      .upsert(rows, { onConflict: "window_id,symbol", ignoreDuplicates: true });
  } catch {
    // History should not prevent the market scan response.
  }
}

async function readGlobalHistory(): Promise<GlobalHistoryRow[]> {
  const supabase = requireSharedSupabase();
  const { data, error } = await supabase
    .from("signal_history_global")
    .select("id, window_id, symbol, direction, score, status, price, signal_time, expires_at, volume_spike, rsi, tool_scores, reason")
    .order("signal_time", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Global history read failed: ${error.message}`);
  return (data ?? []) as GlobalHistoryRow[];
}

async function publishCanonicalSnapshot(
  windowId: number,
  data: ScanCache["data"],
  force = false,
): Promise<ScanCache["data"]> {
  const supabase = requireSharedSupabase();

  // First writer wins for this window + engine version. Every caller then
  // re-reads the stored row so all devices/accounts receive the exact same
  // canonical payload.
  const { error } = await supabase
    .from("signal_scan_snapshots")
    .upsert(
      {
        window_id: windowId,
        engine_version: CURRENT_ENGINE_VERSION,
        payload: data,
        created_at: data.updatedAt,
      },
      { onConflict: "window_id,engine_version", ignoreDuplicates: !force },
    );

  if (error) {
    throw new Error(`Signal snapshot write failed: ${error.message}`);
  }

  const canonical = await readSharedSnapshot(windowId);
  if (!canonical) {
    throw new Error("Signal snapshot was written but could not be read back.");
  }
  return canonical;
}

async function fetchJson<T>(bases: string[], path: string, timeoutMs = 5000): Promise<T> {
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

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runner = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

function toClosedCandles(rows: Kline[]): Candle[] {
  const now = Date.now();

  return rows
    .filter((row) => Number(row[6]) <= now)
    .map((row) => ({
      openTime: Number(row[0]),
      closeTime: Number(row[6]),
      open: Number(row[1]),
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


function liquidityTool(_volume24h: number, spreadBps: number | null): ToolResult {
  // Do not hard-exclude small-cap coins by 24h volume. For scalping,
  // executable spread is the primary liquidity-quality check here.
  if (spreadBps !== null && spreadBps <= 10) {
    return tool(10, `Executable spread ${spreadBps.toFixed(1)} bps`, "NEUTRAL");
  }
  return tool(0, spreadBps === null ? "Order-book spread unavailable" : `Wide spread ${spreadBps.toFixed(1)} bps`, "NEUTRAL");
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

function directionalTotals(tools: Record<string, ToolResult>) {
  let long = 0;
  let short = 0;
  let longVotes = 0;
  let shortVotes = 0;
  for (const current of Object.values(tools)) {
    if (current.bias === "LONG" && current.score === 10) { long += 10; longVotes += 1; }
    if (current.bias === "SHORT" && current.score === 10) { short += 10; shortVotes += 1; }
  }
  return { long, short, longVotes, shortVotes };
}

function passesHardScalpFilter(args: {
  direction: Bias;
  score: number;
  tools: Record<string, ToolResult>;
  atrPercent: number | null;
  spreadBps: number | null;
  change15m: number;
  change1h: number;
  volumeSpike: number;
  currentRangePercent: number;
  btcRegime: "Bullish" | "Bearish" | "Neutral";
  breakoutLong: boolean;
  breakoutShort: boolean;
  supportDistance: number;
  resistanceDistance: number;
  pumpRetraceLong: boolean;
  pumpRetraceShort: boolean;
}) {
  const {
    direction, score, tools, atrPercent, spreadBps, change15m, change1h,
    volumeSpike, currentRangePercent, btcRegime, breakoutLong, breakoutShort,
    supportDistance, resistanceDistance, pumpRetraceLong, pumpRetraceShort,
  } = args;

  if (direction === "NEUTRAL") return false;
  if (score < 90) return false;

  // Hard execution-quality gates. We keep the universe open to every eligible
  // Binance USDT spot pair; these gates only decide whether a setup is tradable.
  if (tools.Liquidity?.score !== 10) return false;
  if (tools.ATR?.score !== 10) return false;
  if (tools["Volume Spike"]?.score !== 10) return false;
  if (spreadBps === null || spreadBps > 25) return false;
  if (atrPercent === null || atrPercent < 0.20 || atrPercent > 4.50) return false;
  if (currentRangePercent > 4.50) return false;

  const directional = [
    tools["EMA Trend"],
    tools.VWAP,
    tools.RSI,
    tools.MACD,
    tools.Breakout,
    tools["Market Structure"],
    tools["BTC Confirmation"],
    tools["Support / Resistance"],
    tools["Trend Strength"],
    tools["Momentum Alignment"],
    tools["Market Regime"],
    tools["Volume Pressure"],
  ];
  let aligned = 0;
  let opposing = 0;
  for (const current of directional) {
    if (!current || current.score !== 10) continue;
    if (current.bias === direction) aligned += 1;
    if (current.bias !== direction && current.bias !== "NEUTRAL") opposing += 1;
  }
  if (aligned < 6) return false;
  if (opposing > 2) return false;

  const trendCore = [tools["EMA Trend"], tools["Market Structure"], tools["Trend Strength"], tools["Market Regime"]]
    .filter((item) => item?.score === 10 && item?.bias === direction).length;
  if (trendCore < 2) return false;

  const momentumCore = [tools.VWAP, tools.RSI, tools.MACD]
    .filter((item) => item?.score === 10 && item?.bias === direction).length;
  if (momentumCore < 2) return false;

  if (btcRegime === "Bullish" && direction !== "LONG") return false;
  if (btcRegime === "Bearish" && direction !== "SHORT") return false;
  if (btcRegime !== "Neutral" && tools["BTC Confirmation"]?.bias !== direction) return false;

  // The strategy is specifically built around either a confirmed breakout or
  // an impulse followed by a controlled retracement/retest.
  const setupLong = breakoutLong || pumpRetraceLong;
  const setupShort = breakoutShort || pumpRetraceShort;
  if (direction === "LONG" && !setupLong) return false;
  if (direction === "SHORT" && !setupShort) return false;

  // Avoid chasing a candle that has already expanded too far before the entry.
  if (direction === "LONG") {
    if (change1h < -1.0) return false;
    if (pumpRetraceLong) {
      if (change15m < -3.5 || change15m > 1.25) return false;
    } else if (change15m <= 0 || change15m > 3.5) {
      return false;
    }
  }

  if (direction === "SHORT") {
    if (change1h > 1.0) return false;
    if (pumpRetraceShort) {
      if (change15m > 3.5 || change15m < -1.25) return false;
    } else if (change15m >= 0 || change15m < -3.5) {
      return false;
    }
  }

  const srFavorable = direction === "LONG"
    ? supportDistance <= 3.0 && supportDistance < resistanceDistance
    : resistanceDistance <= 3.0 && resistanceDistance < supportDistance;

  if (!srFavorable && !breakoutLong && !breakoutShort && !(pumpRetraceLong || pumpRetraceShort)) return false;

  // Require a real participation event, not just indicator alignment.
  if (volumeSpike < 1.0 && !tools["Volume Spike"]?.score) return false;

  return true;
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


function aggregateCandles(candles: Candle[], bucketMs: number): Candle[] {
  if (!candles.length) return [];
  const map = new Map<number, Candle>();
  for (const candle of candles) {
    const bucket = Math.floor(candle.openTime / bucketMs) * bucketMs;
    const existing = map.get(bucket);
    if (!existing) {
      map.set(bucket, { ...candle, openTime: bucket });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.closeTime = candle.closeTime;
    existing.volume += candle.volume;
    existing.quoteVolume += candle.quoteVolume;
  }
  return [...map.values()].sort((a, b) => a.openTime - b.openTime);
}

function collectSwingLevels(candles: Candle[], kind: "support" | "resistance", weight: number) {
  const values: Array<{ price: number; weight: number }> = [];
  if (candles.length < 7) return values;
  const start = Math.max(2, candles.length - 160);
  for (let i = start; i < candles.length - 2; i += 1) {
    const current = candles[i];
    const left = candles.slice(i - 2, i);
    const right = candles.slice(i + 1, i + 3);
    const recentBonus = i >= candles.length - 32 ? 1.25 : 1;
    if (kind === "support") {
      const isSwing = left.every((c) => current.low <= c.low) && right.every((c) => current.low <= c.low);
      if (isSwing) values.push({ price: current.low, weight: weight * recentBonus });
    } else {
      const isSwing = left.every((c) => current.high >= c.high) && right.every((c) => current.high >= c.high);
      if (isSwing) values.push({ price: current.high, weight: weight * recentBonus });
    }
  }
  return values;
}

function clusterLevels(items: Array<{ price: number; weight: number }>, mergePct = 0.004) {
  const clusters: Array<{ price: number; weight: number; touches: number }> = [];
  for (const item of items.sort((a, b) => a.price - b.price)) {
    const existing = clusters.find((cluster) => Math.abs(item.price / cluster.price - 1) <= mergePct);
    if (!existing) {
      clusters.push({ price: item.price, weight: item.weight, touches: 1 });
    } else {
      const total = existing.weight + item.weight;
      existing.price = (existing.price * existing.weight + item.price * item.weight) / total;
      existing.weight = total;
      existing.touches += 1;
    }
  }
  return clusters;
}

function majorLevels(price: number, c15: Candle[], c1h: Candle[], c4h: Candle[]) {
  const supportItems = [
    ...collectSwingLevels(c15, "support", 1),
    ...collectSwingLevels(c1h, "support", 2),
    ...collectSwingLevels(c4h, "support", 4),
  ].filter((item) => item.price < price);
  const resistanceItems = [
    ...collectSwingLevels(c15, "resistance", 1),
    ...collectSwingLevels(c1h, "resistance", 2),
    ...collectSwingLevels(c4h, "resistance", 4),
  ].filter((item) => item.price > price);

  const fallbackSupport = Math.min(...c1h.slice(-72).map((c) => c.low));
  const fallbackResistance = Math.max(...c1h.slice(-72).map((c) => c.high));

  const supportClusters = clusterLevels(supportItems).filter((c) => c.price > price * 0.80);
  const resistanceClusters = clusterLevels(resistanceItems).filter((c) => c.price < price * 1.20);

  const support = supportClusters.sort((a, b) => {
    const aScore = a.weight * 10 + a.touches * 2 - Math.abs(price - a.price) / price * 100;
    const bScore = b.weight * 10 + b.touches * 2 - Math.abs(price - b.price) / price * 100;
    return bScore - aScore;
  })[0]?.price ?? fallbackSupport;

  const resistance = resistanceClusters.sort((a, b) => {
    const aScore = a.weight * 10 + a.touches * 2 - Math.abs(a.price - price) / price * 100;
    const bScore = b.weight * 10 + b.touches * 2 - Math.abs(b.price - price) / price * 100;
    return bScore - aScore;
  })[0]?.price ?? fallbackResistance;

  return {
    support: Number.isFinite(support) ? support : price,
    resistance: Number.isFinite(resistance) ? resistance : price,
  };
}

function shortTermStructure(candles: Candle[]) {
  if (candles.length < 16) return { long: false, short: false };
  const recent = candles.slice(-6);
  const previous = candles.slice(-12, -6);
  const recentHigh = Math.max(...recent.map((c) => c.high));
  const recentLow = Math.min(...recent.map((c) => c.low));
  const previousHigh = Math.max(...previous.map((c) => c.high));
  const previousLow = Math.min(...previous.map((c) => c.low));
  return {
    long: recentHigh > previousHigh && recentLow >= previousLow,
    short: recentLow < previousLow && recentHigh <= previousHigh,
  };
}


function detectImpulseRetrace(candles: Candle[], averageQuoteVolume: number, current: Candle) {
  const sample = candles.slice(-10, -1);
  if (sample.length < 6 || averageQuoteVolume <= 0) {
    return {
      longImpulse: false,
      shortImpulse: false,
      recentLongHigh: current.high,
      recentShortLow: current.low,
      longImpulsePct: 0,
      shortImpulsePct: 0,
      maxImpulseVolume: 0,
    };
  }

  const startClose = sample[0]?.close || current.close;
  const recentLongHigh = Math.max(...sample.map((c) => c.high));
  const recentShortLow = Math.min(...sample.map((c) => c.low));
  const longImpulsePct = startClose > 0 ? ((recentLongHigh / startClose) - 1) * 100 : 0;
  const shortImpulsePct = startClose > 0 ? ((startClose / recentShortLow) - 1) * 100 : 0;
  const maxImpulseVolume = Math.max(...sample.map((c) => c.quoteVolume / averageQuoteVolume));

  return {
    longImpulse: longImpulsePct >= 1.25 && maxImpulseVolume >= 1.5,
    shortImpulse: shortImpulsePct >= 1.25 && maxImpulseVolume >= 1.5,
    recentLongHigh,
    recentShortLow,
    longImpulsePct,
    shortImpulsePct,
    maxImpulseVolume,
  };
}

function volumePressureTool(candle: Candle, averageQuoteVolume: number): ToolResult {
  const range = Math.max(candle.high - candle.low, candle.close * 0.000001);
  const body = candle.close - candle.open;
  const bodyRatio = Math.abs(body) / range;
  const volumeConfirmed = candle.quoteVolume >= averageQuoteVolume * 1.1;
  if (!volumeConfirmed || bodyRatio < 0.45) return tool(0, "No strong volume pressure", "NEUTRAL");
  if (body > 0) return tool(10, "Strong buying pressure", "LONG");
  if (body < 0) return tool(10, "Strong selling pressure", "SHORT");
  return tool(0, "Balanced pressure", "NEUTRAL");
}

function emaSlope(values: number[], period: number): number {
  if (values.length < period + 3) return 0;
  const now = ema(values, period);
  const prev = ema(values.slice(0, -3), period);
  return prev !== 0 ? ((now - prev) / prev) * 100 : 0;
}

function rsiSlope(values: number[]): number {
  if (values.length < 20) return 0;
  const now = rsi(values) ?? 50;
  const prev = rsi(values.slice(0, -2)) ?? 50;
  return now - prev;
}


export async function GET(request: Request) {
  try {
    requireSharedSupabase();

    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const headers = {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    };

    if (url.searchParams.get("history") === "1") {
      await migrateLegacyHistory();
      return NextResponse.json({ ok: true, history: await readGlobalHistory() }, { headers });
    }

    const { windowId, scanId } = windowMeta();

    // Database snapshot is the ONLY source of truth. We intentionally do not
    // fall back to a per-instance cache because that could make two devices
    // see different scan results when Supabase is unavailable.
    const sharedSnapshot = force ? null : await readSharedSnapshot(windowId);
    if (sharedSnapshot) {
      await migrateLegacyHistory();
      await syncSnapshotHistory(sharedSnapshot);
      return NextResponse.json(sharedSnapshot, { headers });
    }

    const [exchangeInfo, tickers, books, premiums] = await Promise.all([
      fetchJson<{ symbols: SpotSymbol[] }>(SPOT_BASES, "/api/v3/exchangeInfo"),
      fetchJson<Ticker[]>(SPOT_BASES, "/api/v3/ticker/24hr"),
      safeFetch<BookTicker[]>(SPOT_BASES, "/api/v3/ticker/bookTicker"),
      safeFetch<Array<{ symbol: string; lastFundingRate: string }>>(FUTURES_BASES, "/fapi/v1/premiumIndex"),
    ]);

    const tradable = exchangeInfo.symbols
      .filter((item) =>
        item.status === "TRADING" &&
        item.quoteAsset === "USDT" &&
        item.isSpotTradingAllowed !== false &&
        !STABLE_BASES.has(item.baseAsset) && !/(UP|DOWN|BULL|BEAR|HEDGE)$/.test(item.baseAsset),
      )
      .map((item) => item.symbol);

    const tickerMap = new Map(tickers.map((item) => [item.symbol, item]));
    const bookMap = new Map((books ?? []).map((item) => [item.symbol, item]));
    const fundingMap = new Map(
      (premiums ?? [])
        .map((item) => [item.symbol, Number(item.lastFundingRate)] as const)
        .filter(([, value]) => Number.isFinite(value)),
    );
    const candidates = tradable
      .map((symbol) => {
        const ticker = tickerMap.get(symbol);
        if (!ticker) return null;

        const price = Number(ticker.lastPrice);
        const change24h = Number(ticker.priceChangePercent);
        const volume24h = Number(ticker.quoteVolume);
        if (!Number.isFinite(price) || !Number.isFinite(change24h) || !Number.isFinite(volume24h)) return null;
        return { symbol, price, change24h, volume24h };
      })
      .filter((item): item is { symbol: string; price: number; change24h: number; volume24h: number } => item !== null)
      .sort((a, b) => b.volume24h - a.volume24h);

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

    const rows = await mapWithConcurrency(candidates, 18, async (candidate): Promise<SignalRow | null> => {
        try {
          const [raw15m, raw1h] = await Promise.all([
            safeFetch<Kline[]>(SPOT_BASES, `/api/v3/klines?symbol=${candidate.symbol}&interval=15m&limit=121`),
            safeFetch<Kline[]>(SPOT_BASES, `/api/v3/klines?symbol=${candidate.symbol}&interval=1h&limit=121`),
          ]);

          if (!raw15m || !raw1h) return null;

          const c15 = toClosedCandles(raw15m);
          const c1h = toClosedCandles(raw1h);
          const c4h = aggregateCandles(c1h, 4 * 60 * 60 * 1000);
          if (c15.length < 60 || c1h.length < 60 || c4h.length < 18) return null;

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
          const ema1h9 = ema(closes1h, 9);
          const ema1h21 = ema(closes1h, 21);
          const ema1h50 = ema(closes1h, 50);
          const vwapValue = vwap(c15);
          const vwap1hValue = vwap(c1h, 24);
          const rsiValue = rsi(closes15);
          const rsi1hValue = rsi(closes1h);
          const rsi15Slope = rsiSlope(closes15);
          const rsi1hSlope = rsiSlope(closes1h);
          const macdValue = macd(closes15);
          const macd1hValue = macd(closes1h);
          const atrValue = atr(c15);
          const adxValue = adx(c15);
          const adx1hValue = adx(c1h);
          const ema9Slope15 = emaSlope(closes15, 9);
          const ema21Slope15 = emaSlope(closes15, 21);
          const ema21Slope1h = emaSlope(closes1h, 21);

          const levels = majorLevels(current.close, c15, c1h, c4h);
          const support = levels.support;
          const resistance = levels.resistance;

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
          const currentRangePercent = current.close > 0 ? ((current.high - current.low) / current.close) * 100 : 0;
          const distanceToSupport = current.close > 0 ? ((current.close - support) / current.close) * 100 : 0;
          const distanceToResistance = current.close > 0 ? ((resistance - current.close) / current.close) * 100 : 0;

          const previousStructure15 = c15.slice(-22, -1);
          const previousHigh = Math.max(...previousStructure15.map((c) => c.high));
          const previousLow = Math.min(...previousStructure15.map((c) => c.low));
          const breakoutLong = current.close > previousHigh && current.quoteVolume >= averageVolume * 1.2 && current.close > previous.close;
          const breakoutShort = current.close < previousLow && current.quoteVolume >= averageVolume * 1.2 && current.close < previous.close;

          const structure15 = shortTermStructure(c15);
          const structure1h = shortTermStructure(c1h);

          const impulse = detectImpulseRetrace(c15, averageVolume, current);
          const longRetracePct = impulse.recentLongHigh > 0
            ? ((impulse.recentLongHigh - current.close) / impulse.recentLongHigh) * 100
            : 0;
          const shortRetracePct = impulse.recentShortLow > 0
            ? ((current.close - impulse.recentShortLow) / impulse.recentShortLow) * 100
            : 0;

          const pumpRetraceLong = impulse.longImpulse && longRetracePct >= 0.25 && longRetracePct <= 3.50;
          const pumpRetraceShort = impulse.shortImpulse && shortRetracePct >= 0.25 && shortRetracePct <= 3.50;

          const reclaimLong = vwapValue !== null && current.close > vwapValue && current.low <= vwapValue * 1.003;
          const reclaimShort = vwapValue !== null && current.close < vwapValue && current.high >= vwapValue * 0.997;

          const tools: Record<string, ToolResult> = {};

          const emaBull15 = current.close > ema9 && ema9 > ema21 && ema21 > ema50 && ema9Slope15 > 0 && ema21Slope15 > 0;
          const emaBear15 = current.close < ema9 && ema9 < ema21 && ema21 < ema50 && ema9Slope15 < 0 && ema21Slope15 < 0;
          const emaBull1h = c1h[c1h.length - 1].close > ema1h9 && ema1h9 > ema1h21 && ema1h21 > ema1h50 && ema21Slope1h > 0;
          const emaBear1h = c1h[c1h.length - 1].close < ema1h9 && ema1h9 < ema1h21 && ema1h21 < ema1h50 && ema21Slope1h < 0;

          tools["Volume Spike"] = binaryDirection(
            impulse.longImpulse || (volumeSpike >= 1.5 && change15m > 0),
            impulse.shortImpulse || (volumeSpike >= 1.5 && change15m < 0),
            `${impulse.maxImpulseVolume.toFixed(1)}× impulse volume / ${impulse.longImpulse ? impulse.longImpulsePct.toFixed(1) : Math.max(0, change15m).toFixed(1)}% move`,
            `${impulse.maxImpulseVolume.toFixed(1)}× impulse volume / ${impulse.shortImpulse ? impulse.shortImpulsePct.toFixed(1) : Math.abs(Math.min(0, change15m)).toFixed(1)}% move`,
          );

          tools["EMA Trend"] = binaryDirection(
            emaBull15 && emaBull1h,
            emaBear15 && emaBear1h,
            "15m + 1h EMA trend aligned bullish",
            "15m + 1h EMA trend aligned bearish",
          );

          tools.VWAP = binaryDirection(
            vwapValue !== null && vwap1hValue !== null && current.close > vwapValue && current.close > vwap1hValue || reclaimLong,
            vwapValue !== null && vwap1hValue !== null && current.close < vwapValue && current.close < vwap1hValue || reclaimShort,
            reclaimLong ? "VWAP reclaim after impulse" : "Above 15m + 1h VWAP",
            reclaimShort ? "VWAP rejection after impulse" : "Below 15m + 1h VWAP",
          );

          const rsiLong = rsiValue !== null && rsi1hValue !== null && rsiValue >= 48 && rsiValue <= 70 && rsi1hValue >= 48 && rsi1hValue <= 72 && rsi15Slope > -1.0;
          const rsiShort = rsiValue !== null && rsi1hValue !== null && rsiValue >= 30 && rsiValue <= 52 && rsi1hValue >= 28 && rsi1hValue <= 52 && rsi15Slope < 1.0;
          tools.RSI = binaryDirection(
            rsiLong,
            rsiShort,
            `15m ${rsiValue?.toFixed(1)} + 1h ${rsi1hValue?.toFixed(1)} supports long`,
            `15m ${rsiValue?.toFixed(1)} + 1h ${rsi1hValue?.toFixed(1)} supports short`,
          );

          tools.MACD = binaryDirection(
            macdValue.histogram > 0 && macd1hValue.histogram >= -Math.abs(macd1hValue.line) * 0.05 && macdValue.line >= macdValue.signal || pumpRetraceLong,
            macdValue.histogram < 0 && macd1hValue.histogram <= Math.abs(macd1hValue.line) * 0.05 && macdValue.line <= macdValue.signal || pumpRetraceShort,
            pumpRetraceLong ? "MACD supports post-pump continuation" : "15m MACD bullish with 1h support",
            pumpRetraceShort ? "MACD supports post-pump continuation" : "15m MACD bearish with 1h support",
          );

          tools.Breakout = binaryDirection(
            breakoutLong || (impulse.longImpulse && longRetracePct >= 0.25 && longRetracePct <= 3.50),
            breakoutShort || (impulse.shortImpulse && shortRetracePct >= 0.25 && shortRetracePct <= 3.50),
            breakoutLong ? "Confirmed breakout; retest possible" : "Pump impulse followed by controlled retrace",
            breakoutShort ? "Confirmed breakdown; retest possible" : "Pump impulse followed by controlled retrace",
          );

          const structureLong = (structure15.long || impulse.longImpulse) && (structure1h.long || current.close > ema1h21) && current.close > ema21;
          const structureShort = (structure15.short || impulse.shortImpulse) && (structure1h.short || current.close < ema1h21) && current.close < ema21;
          tools["Market Structure"] = binaryDirection(
            structureLong,
            structureShort,
            "15m + 1h structure supports continuation",
            "15m + 1h structure supports downside continuation",
          );

          tools["BTC Confirmation"] = binaryDirection(
            btcBull && change1h >= 0 || btcRegime === "Neutral" && change1h > 0.1,
            btcBear && change1h <= 0 || btcRegime === "Neutral" && change1h < -0.1,
            btcRegime === "Neutral" ? "BTC neutral but not fighting long" : "BTC trend confirms long",
            btcRegime === "Neutral" ? "BTC neutral but not fighting short" : "BTC trend confirms short",
          );

          tools.Liquidity = liquidityTool(candidate.volume24h, spreadBps);
          tools.ATR = atrTool(atrPercent);

          const srLong = (distanceToSupport <= 3.0 && distanceToSupport < distanceToResistance) || (pumpRetraceLong && reclaimLong);
          const srShort = (distanceToResistance <= 3.0 && distanceToResistance < distanceToSupport) || (pumpRetraceShort && reclaimShort);
          tools["Support / Resistance"] = binaryDirection(
            srLong,
            srShort,
            `Support/retest area ${distanceToSupport.toFixed(2)}% away`,
            `Resistance/retest area ${distanceToResistance.toFixed(2)}% away`,
          );

          const trendLong = adxValue !== null && adx1hValue !== null && adxValue >= 18 && adx1hValue >= 16 && ema21Slope15 > -0.1;
          const trendShort = adxValue !== null && adx1hValue !== null && adxValue >= 18 && adx1hValue >= 16 && ema21Slope15 < 0.1;
          tools["Trend Strength"] = binaryDirection(
            trendLong && (structure15.long || impulse.longImpulse),
            trendShort && (structure15.short || impulse.shortImpulse),
            `ADX ${adxValue?.toFixed(1)} / 1h ${adx1hValue?.toFixed(1)} active trend`,
            `ADX ${adxValue?.toFixed(1)} / 1h ${adx1hValue?.toFixed(1)} active trend`,
          );

          tools["Momentum Alignment"] = binaryDirection(
            (change1h > 0.25 && (change15m > -2.5 || pumpRetraceLong) && btcRegime !== "Bearish") || pumpRetraceLong,
            (change1h < -0.25 && (change15m < 2.5 || pumpRetraceShort) && btcRegime !== "Bullish") || pumpRetraceShort,
            "1h momentum supports continuation/retest",
            "1h momentum supports continuation/retest",
          );

          tools["Market Regime"] = binaryDirection(
            ema1h21 >= ema1h50 && rsi1hValue !== null && rsi1hValue >= 48 && momentum1h > -0.2,
            ema1h21 <= ema1h50 && rsi1hValue !== null && rsi1hValue <= 52 && momentum1h < 0.2,
            "1h market regime supports long",
            "1h market regime supports short",
          );

          tools["Volume Pressure"] = volumePressureTool(current, averageVolume);

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

          const triggerTimeMs = Math.max(windowId * 30 * 60 * 1000, current.closeTime);
          const capturedAtForSignal = new Date(triggerTimeMs).toISOString();
          const expiresAtForSignal = new Date((windowId + 1) * 30 * 60 * 1000).toISOString();
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
            currentRangePercent,
            rsi: rsiValue,
            atrPercent,
            support,
            supportDistance: distanceToSupport,
            resistance,
            resistanceDistance: distanceToResistance,
            invalidation,
            riskLevel: getRisk(atrPercent, status),
            liquidity: candidate.volume24h,
            spreadBps,
            fundingRate: fundingMap.get(candidate.symbol) ?? null,
            capturedAt: capturedAtForSignal,
            expiresAt: expiresAtForSignal,
            tools,
            reasons: reasons.slice(0, 4),
          };
        } catch {
          return null;
        }
      });

    const validRows = rows
      .filter((row): row is SignalRow => row !== null)
      .filter((row) => passesHardScalpFilter({
        direction: row.direction,
        score: row.score,
        tools: row.tools,
        atrPercent: row.atrPercent,
        spreadBps: row.spreadBps,
        change15m: row.change15m,
        change1h: row.change1h,
        volumeSpike: row.volumeSpike,
        currentRangePercent: row.currentRangePercent,
        btcRegime,
        breakoutLong: row.tools.Breakout?.bias === "LONG" && row.tools.Breakout?.score === 10,
        breakoutShort: row.tools.Breakout?.bias === "SHORT" && row.tools.Breakout?.score === 10,
        supportDistance: row.supportDistance,
        resistanceDistance: row.resistanceDistance,
        pumpRetraceLong: row.tools.Breakout?.bias === "LONG" && row.tools.Breakout?.score === 10 && row.tools["Volume Spike"]?.bias === "LONG",
        pumpRetraceShort: row.tools.Breakout?.bias === "SHORT" && row.tools.Breakout?.score === 10 && row.tools["Volume Spike"]?.bias === "SHORT",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    const data = validRows;

    const nextScanAt = new Date((windowId + 1) * 30 * 60 * 1000).toISOString();
    const windowStartAt = new Date(windowId * 30 * 60 * 1000).toISOString();
    const response = {
      ok: true as const,
      windowId,
      updatedAt: new Date().toISOString(),
      windowStartAt,
      nextScanAt,
      scanId,
      btcRegime,
      scanIntervalMinutes: 30 as const,
      rows: data,
    };

    const canonical = await publishCanonicalSnapshot(windowId, response, force);
    await migrateLegacyHistory();
    await syncSnapshotHistory(canonical);
    return NextResponse.json(canonical, { headers });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Signal scan failed",
      },
      {
        status: 502,
        headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
      },
    );
  }
}
