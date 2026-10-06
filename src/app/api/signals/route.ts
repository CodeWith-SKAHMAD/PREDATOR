import { NextResponse } from "next/server";

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

const STABLE_ASSETS = new Set([
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

type FuturesSymbol = {
  symbol: string;
  status: string;
  contractType?: string;
  quoteAsset?: string;
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
  string
];

type FundingRow = {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
};

type OiRow = {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
};

type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
};

type ToolResult = {
  score: number;
  label: string;
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
  liquidity: number;
  spreadBps: number | null;
  capturedAt: string;
  tools: Record<string, ToolResult>;
  reasons: string[];
};

async function fetchJson<T>(
  baseUrls: string[],
  path: string,
  timeoutMs = 8500
): Promise<T> {
  let lastError = "Market data request failed";

  for (const base of baseUrls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${base}${path}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

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

async function safeFetch<T>(
  baseUrls: string[],
  path: string
): Promise<T | null> {
  try {
    return await fetchJson<T>(baseUrls, path);
  } catch {
    return null;
  }
}

function toCandles(rows: Kline[]): Candle[] {
  return rows.map((row) => ({
    openTime: Number(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    quoteVolume: Number(row[7]),
  }));
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0;
  if (values.length < period) {
    return values[values.length - 1] ?? 0;
  }

  const multiplier = 2 / (period + 1);
  let value =
    values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i += 1) {
    value =
      (values[i] - value) * multiplier + value;
  }

  return value;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length <= period) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i += 1) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses += Math.abs(delta);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i += 1) {
    const delta = values[i] - values[i - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values: number[]) {
  if (values.length < 35) {
    return {
      line: 0,
      signal: 0,
      histogram: 0,
    };
  }

  const fastValues: number[] = [];
  const slowValues: number[] = [];

  for (let i = 0; i < values.length; i += 1) {
    fastValues.push(ema(values.slice(0, i + 1), 12));
    slowValues.push(ema(values.slice(0, i + 1), 26));
  }

  const lineSeries = fastValues.map(
    (v, index) => v - slowValues[index]
  );

  const signal = ema(lineSeries, 9);
  const line = lineSeries[lineSeries.length - 1] ?? 0;

  return {
    line,
    signal,
    histogram: line - signal,
  };
}

function atr(candles: Candle[], period = 14) {
  if (candles.length <= period) return null;

  const tr: number[] = [];

  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];

    tr.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    );
  }

  const latest = tr.slice(-period);

  return latest.reduce((a, b) => a + b, 0) / latest.length;
}

function vwap(candles: Candle[]) {
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (const candle of candles.slice(-48)) {
    const typical =
      (candle.high + candle.low + candle.close) / 3;

    cumulativePV += typical * candle.volume;
    cumulativeVolume += candle.volume;
  }

  if (cumulativeVolume === 0) return null;

  return cumulativePV / cumulativeVolume;
}

function adx(candles: Candle[], period = 14) {
  if (candles.length <= period * 2) return null;

  const trs: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];

    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;

    plusDM.push(
      upMove > downMove && upMove > 0 ? upMove : 0
    );

    minusDM.push(
      downMove > upMove && downMove > 0 ? downMove : 0
    );

    trs.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    );
  }

  const recentTR = trs.slice(-period);
  const recentPlus = plusDM.slice(-period);
  const recentMinus = minusDM.slice(-period);

  const trAvg =
    recentTR.reduce((a, b) => a + b, 0) / period;

  if (trAvg === 0) return 0;

  const plusDI =
    100 *
    (recentPlus.reduce((a, b) => a + b, 0) /
      period) /
    trAvg;

  const minusDI =
    100 *
    (recentMinus.reduce((a, b) => a + b, 0) /
      period) /
    trAvg;

  const denominator = plusDI + minusDI;

  if (denominator === 0) return 0;

  return (
    100 *
    Math.abs(plusDI - minusDI) /
    denominator
  );
}

function scoreFromBias(
  bullish: boolean,
  bearish: boolean,
  strength = 0.6
): ToolResult {
  if (bullish && !bearish) {
    return {
      score: Math.round(5 + 5 * strength),
      label: "Bullish",
    };
  }

  if (bearish && !bullish) {
    return {
      score: Math.round(5 + 5 * strength),
      label: "Bearish",
    };
  }

  return {
    score: 5,
    label: "Neutral",
  };
}

function scoreVolumeSpike(
  current: Candle,
  previous: Candle[]
): { tool: ToolResult; value: number } {
  const avg =
    previous.reduce(
      (sum, candle) => sum + candle.quoteVolume,
      0
    ) / Math.max(previous.length, 1);

  const spike =
    avg > 0 ? current.quoteVolume / avg : 1;

  let score = 3;

  if (spike >= 3) score = 10;
  else if (spike >= 2.5) score = 9;
  else if (spike >= 2) score = 8;
  else if (spike >= 1.6) score = 7;
  else if (spike >= 1.3) score = 6;
  else if (spike >= 1) score = 5;

  return {
    tool: {
      score,
      label: `${spike.toFixed(1)}x`,
    },
    value: spike,
  };
}

function scoreRsi(value: number | null): ToolResult {
  if (value === null) {
    return { score: 5, label: "N/A" };
  }

  if (value >= 55 && value <= 68) {
    return { score: 10, label: "Bullish zone" };
  }

  if (value >= 70) {
    return { score: 4, label: "Overbought" };
  }

  if (value <= 30) {
    return { score: 4, label: "Oversold" };
  }

  if (value >= 50) {
    return { score: 7, label: "Positive" };
  }

  return { score: 6, label: "Weak" };
}

function scoreLiquidity(
  volume24h: number,
  spreadBps: number | null
): ToolResult {
  let score = 5;

  if (volume24h >= 500_000_000) score = 10;
  else if (volume24h >= 250_000_000) score = 9;
  else if (volume24h >= 100_000_000) score = 8;
  else if (volume24h >= 50_000_000) score = 7;
  else if (volume24h >= 20_000_000) score = 6;
  else if (volume24h < 5_000_000) score = 3;

  if (spreadBps !== null) {
    if (spreadBps > 12) score = Math.max(score - 2, 1);
    else if (spreadBps > 6) score = Math.max(score - 1, 1);
  }

  return {
    score,
    label:
      spreadBps === null
        ? "Liquid"
        : `${spreadBps.toFixed(1)} bps`,
  };
}

function scoreAtr(
  atrPercent: number | null
): ToolResult {
  if (atrPercent === null) {
    return { score: 5, label: "N/A" };
  }

  if (atrPercent >= 0.25 && atrPercent <= 2.5) {
    return { score: 9, label: "Healthy range" };
  }

  if (atrPercent < 0.1) {
    return { score: 4, label: "Low volatility" };
  }

  return {
    score: 6,
    label:
      atrPercent > 2.5
        ? "High volatility"
        : "Moderate",
  };
}

function scoreFunding(
  value: number | null
): ToolResult {
  if (value === null) {
    return { score: 5, label: "N/A" };
  }

  const percent = value * 100;

  if (percent > 0.1) {
    return { score: 3, label: "Crowded long" };
  }

  if (percent > 0.03) {
    return { score: 6, label: "Positive" };
  }

  if (percent < -0.1) {
    return { score: 8, label: "Short pressure" };
  }

  if (percent < -0.03) {
    return { score: 7, label: "Negative" };
  }

  return { score: 5, label: "Neutral" };
}

async function getKlines(
  symbol: string,
  interval: string,
  limit: number
) {
  const data = await fetchJson<Kline[]>(
    SPOT_BASES,
    `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );

  return toCandles(data);
}

export async function GET() {
  try {
    const [spotInfo, tickers, bookTickers] =
      await Promise.all([
        fetchJson<{ symbols: SpotSymbol[] }>(
          SPOT_BASES,
          "/api/v3/exchangeInfo"
        ),
        fetchJson<Ticker[]>(
          SPOT_BASES,
          "/api/v3/ticker/24hr"
        ),
        fetchJson<BookTicker[]>(
          SPOT_BASES,
          "/api/v3/ticker/bookTicker"
        ),
      ]);

    const spotSymbols = spotInfo.symbols
      .filter(
        (item) =>
          item.status === "TRADING" &&
          item.quoteAsset === "USDT" &&
          item.isSpotTradingAllowed !== false &&
          !STABLE_ASSETS.has(item.baseAsset)
      )
      .map((item) => item.symbol);

    let futuresSymbols: Set<string> | null = null;

    const futuresInfo =
      await safeFetch<{
        symbols: FuturesSymbol[];
      }>(
        FUTURES_BASES,
        "/fapi/v1/exchangeInfo"
      );

    if (futuresInfo?.symbols) {
      futuresSymbols = new Set(
        futuresInfo.symbols
          .filter(
            (item) =>
              item.status === "TRADING" &&
              item.contractType === "PERPETUAL" &&
              item.quoteAsset === "USDT"
          )
          .map((item) => item.symbol)
      );
    }

    const allowedSymbols =
      futuresSymbols && futuresSymbols.size > 0
        ? spotSymbols.filter((symbol) =>
            futuresSymbols!.has(symbol)
          )
        : spotSymbols;

    const tickerMap = new Map(
      tickers.map((item) => [
        item.symbol,
        item,
      ])
    );

    const bookMap = new Map(
      bookTickers.map((item) => [
        item.symbol,
        item,
      ])
    );

    const candidates = allowedSymbols
      .map((symbol) => {
        const ticker = tickerMap.get(symbol);
        if (!ticker) return null;

        return {
          symbol,
          change24h: Number(
            ticker.priceChangePercent
          ),
          volume24h: Number(
            ticker.quoteVolume
          ),
          price: Number(
            ticker.lastPrice
          ),
        };
      })
      .filter(
        (
          item
        ): item is {
          symbol: string;
          change24h: number;
          volume24h: number;
          price: number;
        } =>
          item !== null &&
          Number.isFinite(item.change24h) &&
          Number.isFinite(item.volume24h) &&
          Number.isFinite(item.price) &&
          item.volume24h > 0
      )
      .sort(
        (a, b) =>
          b.volume24h - a.volume24h
      )
      .slice(0, 16);

    const btc15 = await getKlines(
      "BTCUSDT",
      "15m",
      120
    );

    const btcCloses = btc15.map(
      (c) => c.close
    );

    const btcEma9 = ema(
      btcCloses,
      9
    );

    const btcEma21 = ema(
      btcCloses,
      21
    );

    const btcTrendBull =
      btcCloses.at(-1)! > btcEma9 &&
      btcEma9 > btcEma21;

    const btcTrendBear =
      btcCloses.at(-1)! < btcEma9 &&
      btcEma9 < btcEma21;

    const btcMomentum =
      (btcCloses.at(-1)! /
        btcCloses.at(-7)! -
        1) *
      100;

    const rows = await Promise.all(
      candidates.map(async (candidate) => {
        const [c5, c15, oiHist, fundingRows] =
          await Promise.all([
            safeFetch<Kline[]>(
              SPOT_BASES,
              `/api/v3/klines?symbol=${candidate.symbol}&interval=5m&limit=120`
            ),
            safeFetch<Kline[]>(
              SPOT_BASES,
              `/api/v3/klines?symbol=${candidate.symbol}&interval=15m&limit=120`
            ),
            futuresSymbols
              ? safeFetch<OiRow[]>(
                  FUTURES_BASES,
                  `/futures/data/openInterestHist?symbol=${candidate.symbol}&period=15m&limit=2`
                )
              : Promise.resolve(null),
            futuresSymbols
              ? safeFetch<FundingRow[]>(
                  FUTURES_BASES,
                  `/fapi/v1/fundingRate?symbol=${candidate.symbol}&limit=1`
                )
              : Promise.resolve(null),
          ]);

        if (!c5 || !c15 || c15.length < 60) {
          return null;
        }

        const candles5 = toCandles(c5);
        const candles15 = toCandles(c15);

        const closes5 = candles5.map(
          (c) => c.close
        );

        const closes15 = candles15.map(
          (c) => c.close
        );

        const current5 =
          candles5.at(-1)!;

        const current15 =
          candles15.at(-1)!;

        const volumeTool =
          scoreVolumeSpike(
            current5,
            candles5.slice(-21, -1)
          );

        const ema9 = ema(
          closes15,
          9
        );

        const ema21 = ema(
          closes15,
          21
        );

        const ema55 = ema(
          closes15,
          55
        );

        const lastPrice = current15.close;

        const emaTool =
          scoreFromBias(
            lastPrice > ema9 &&
              ema9 > ema21 &&
              ema21 > ema55,
            lastPrice < ema9 &&
              ema9 < ema21 &&
              ema21 < ema55,
            1
          );

        const vwapValue =
          vwap(candles15);

        const vwapTool =
          scoreFromBias(
            vwapValue !== null &&
              lastPrice > vwapValue,
            vwapValue !== null &&
              lastPrice < vwapValue,
            0.9
          );

        const rsiValue =
          rsi(closes15);

        let rsiTool = scoreRsi(rsiValue);

        if (
          rsiValue !== null &&
          rsiValue < 45
        ) {
          rsiTool = {
            score: 7,
            label: "Weak",
          };
        }

        const macdValue =
          macd(closes15);

        const macdTool =
          scoreFromBias(
            macdValue.histogram > 0 &&
              macdValue.line > 0,
            macdValue.histogram < 0 &&
              macdValue.line < 0,
            1
          );

        const priorCandles =
          candles15.slice(-21, -1);

        const highest =
          Math.max(
            ...priorCandles.map(
              (c) => c.high
            )
          );

        const lowest =
          Math.min(
            ...priorCandles.map(
              (c) => c.low
            )
          );

        const breakoutLong =
          lastPrice >= highest;

        const breakoutShort =
          lastPrice <= lowest;

        const breakoutTool =
          scoreFromBias(
            breakoutLong,
            breakoutShort,
            breakoutLong || breakoutShort ? 1 : 0.5
          );

        const oiRows =
          oiHist ?? [];

        let oiChange: number | null = null;

        if (oiRows.length >= 2) {
          const oldOI = Number(
            oiRows[0].sumOpenInterestValue
          );

          const newOI = Number(
            oiRows.at(-1)!.sumOpenInterestValue
          );

          if (
            Number.isFinite(oldOI) &&
            Number.isFinite(newOI) &&
            oldOI > 0
          ) {
            oiChange =
              ((newOI - oldOI) /
                oldOI) *
              100;
          }
        }

        const oiTool =
          oiChange === null
            ? { score: 5, label: "N/A" }
            : scoreFromBias(
                oiChange > 2 &&
                  lastPrice > ema9,
                oiChange > 2 &&
                  lastPrice < ema9,
                Math.min(
                  Math.abs(oiChange) /
                    5,
                  1
                )
              );

        const funding =
          fundingRows?.[0]
            ? Number(
                fundingRows[0].fundingRate
              )
            : null;

        const fundingTool =
          scoreFunding(funding);

        const btcTool =
          scoreFromBias(
            btcTrendBull &&
              btcMomentum > 0 &&
              lastPrice > ema21,
            btcTrendBear &&
              btcMomentum < 0 &&
              lastPrice < ema21,
            0.9
          );

        const book =
          bookMap.get(
            candidate.symbol
          );

        let spreadBps: number | null =
          null;

        if (book) {
          const bid = Number(
            book.bidPrice
          );

          const ask = Number(
            book.askPrice
          );

          const mid =
            (bid + ask) / 2;

          if (
            Number.isFinite(mid) &&
            mid > 0
          ) {
            spreadBps =
              ((ask - bid) /
                mid) *
              10000;
          }
        }

        const liquidityTool =
          scoreLiquidity(
            candidate.volume24h,
            spreadBps
          );

        const atrValue =
          atr(candles15);

        const atrPercent =
          atrValue === null
            ? null
            : (atrValue /
                lastPrice) *
              100;

        const atrTool =
          scoreAtr(atrPercent);

        const supportDistance =
          ((lastPrice - lowest) /
            lastPrice) *
          100;

        const resistanceDistance =
          ((highest - lastPrice) /
            lastPrice) *
          100;

        const supportResistanceTool =
          scoreFromBias(
            resistanceDistance >
              0.8 &&
              lastPrice >
                (lowest + highest) /
                  2,
            supportDistance >
              0.8 &&
              lastPrice <
                (lowest + highest) /
                  2,
            0.8
          );

        const adxValue =
          adx(candles15);

        const trendStrengthTool =
          adxValue === null
            ? { score: 5, label: "N/A" }
            : scoreFromBias(
                adxValue >= 20 &&
                  ema9 > ema21,
                adxValue >= 20 &&
                  ema9 < ema21,
                Math.min(
                  adxValue / 35,
                  1
                )
              );

        const momentum30m =
          (closes5.at(-1)! /
            closes5.at(-7)! -
            1) *
          100;

        const momentum1h =
          (closes15.at(-1)! /
            closes15.at(-5)! -
            1) *
          100;

        const momentum4h =
          closes15.length >= 17
            ? (closes15.at(-1)! /
                closes15.at(-17)! -
                1) *
              100
            : momentum1h;

        const momentumLong =
          momentum30m > 0.15 &&
          momentum1h > 0.25 &&
          momentum4h > 0.5;

        const momentumShort =
          momentum30m < -0.15 &&
          momentum1h < -0.25 &&
          momentum4h < -0.5;

        const momentumTool =
          scoreFromBias(
            momentumLong,
            momentumShort,
            1
          );

        const regimeTool =
          scoreFromBias(
            btcTrendBull &&
              ema21 > ema55,
            btcTrendBear &&
              ema21 < ema55,
            0.9
          );

        const tools: Record<
          string,
          ToolResult
        > = {
          "Volume Spike": volumeTool.tool,
          "EMA Trend": emaTool,
          VWAP: vwapTool,
          RSI: rsiTool,
          MACD: macdTool,
          Breakout: breakoutTool,
          "OI Change": oiTool,
          Funding: fundingTool,
          "BTC Confirmation": btcTool,
          Liquidity: liquidityTool,
          ATR: atrTool,
          "Support / Resistance":
            supportResistanceTool,
          "Trend Strength":
            trendStrengthTool,
          "Momentum Alignment":
            momentumTool,
          "Market Regime": regimeTool,
        };

        const score = Object.values(
          tools
        ).reduce(
          (sum, tool) =>
            sum + tool.score,
          0
        );

        const longSignals = Object.values(
          tools
        ).filter(
          (tool) =>
            tool.label === "Bullish" ||
            tool.label === "Positive" ||
            tool.label ===
              "Bullish zone" ||
            tool.label ===
              "Short pressure" ||
            tool.label ===
              "Healthy range"
        ).length;

        const shortSignals = Object.values(
          tools
        ).filter(
          (tool) =>
            tool.label === "Bearish" ||
            tool.label ===
              "Crowded long" ||
            tool.label ===
              "Negative"
        ).length;

        let direction:
          | "LONG"
          | "SHORT"
          | "NEUTRAL" =
          "NEUTRAL";

        if (
          score >= 80 &&
          longSignals > shortSignals
        ) {
          direction = "LONG";
        } else if (
          score >= 80 &&
          shortSignals > longSignals
        ) {
          direction = "SHORT";
        } else if (
          emaTool.label === "Bullish" &&
          momentumLong
        ) {
          direction = "LONG";
        } else if (
          emaTool.label === "Bearish" &&
          momentumShort
        ) {
          direction = "SHORT";
        }

        let status = "Ignore";

        if (score >= 120) {
          status = "Extended / Pumped";
        } else if (score >= 110) {
          status = "Strong";
        } else if (score >= 100) {
          status = "Valid";
        } else if (score >= 80) {
          status = "Observe";
        }

        const reasons: string[] = [];

        if (
          volumeTool.value >= 2
        ) {
          reasons.push(
            `${volumeTool.value.toFixed(1)}x volume expansion`
          );
        }

        if (
          emaTool.label !==
          "Neutral"
        ) {
          reasons.push(
            `EMA structure ${emaTool.label.toLowerCase()}`
          );
        }

        if (
          rsiValue !== null &&
          rsiValue >= 70
        ) {
          reasons.push(
            "RSI overbought"
          );
        } else if (
          rsiValue !== null &&
          rsiValue <= 30
        ) {
          reasons.push(
            "RSI oversold"
          );
        }

        if (breakoutLong) {
          reasons.push(
            "20-bar breakout"
          );
        } else if (breakoutShort) {
          reasons.push(
            "20-bar breakdown"
          );
        }

        if (
          oiChange !== null &&
          Math.abs(oiChange) >= 2
        ) {
          reasons.push(
            `OI ${oiChange > 0 ? "+" : ""}${oiChange.toFixed(1)}%`
          );
        }

        if (reasons.length === 0) {
          reasons.push(
            "multiple market factors aligned"
          );
        }

        const support = lowest;
        const resistance = highest;

        const invalidation =
          direction === "LONG" && atrValue !== null
            ? Math.max(0, lastPrice - atrValue * 1.2)
            : direction === "SHORT" && atrValue !== null
              ? lastPrice + atrValue * 1.2
              : null;

        const riskLevel =
          status === "Extended / Pumped"
            ? "Extreme"
            : atrPercent !== null && atrPercent >= 3
              ? "High"
              : atrPercent !== null && atrPercent >= 1.5
                ? "Moderate"
                : "Low";

        return {
          symbol: candidate.symbol,
          baseAsset:
            candidate.symbol.replace(
              /USDT$/,
              ""
            ),
          direction,
          score,
          status,
          price: candidate.price,
          priceChange24h:
            candidate.change24h,
          volumeSpike:
            volumeTool.value,
          rsi: rsiValue,
          funding,
          openInterestChange:
            oiChange,
          atrPercent,
          support,
          resistance,
          invalidation,
          riskLevel,
          liquidity:
            candidate.volume24h,
          spreadBps,
          capturedAt:
            new Date().toISOString(),
          tools,
          reasons:
            reasons.slice(0, 3),
        } satisfies SignalRow;
      })
    );

    const data = rows
      .filter(
        (
          row
        ): row is SignalRow =>
          row !== null
      )
      .sort(
        (a, b) =>
          b.score - a.score
      )
      .filter(
        (row) =>
          row.score >= 80
      );

    return NextResponse.json({
      ok: true,
      updatedAt:
        new Date().toISOString(),
      btcRegime:
        btcTrendBull
          ? "Bullish"
          : btcTrendBear
            ? "Bearish"
            : "Neutral",
      scanIntervalMinutes: 30,
      rows: data.slice(0, 24),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Signal scan failed",
      },
      { status: 502 }
    );
  }
}
