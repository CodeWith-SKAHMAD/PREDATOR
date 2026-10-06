 "use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

type KlineRow = [
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

type Candle = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

type VolumeBar = {
  time: UTCTimestamp;
  value: number;
  color: string;
};

const TIMEFRAMES = [
  ["1m", "1m"],
  ["5m", "5m"],
  ["15m", "15m"],
  ["30m", "30m"],
  ["1h", "1H"],
  ["4h", "4H"],
  ["1d", "1D"],
] as const;

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "—";

  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (value >= 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  });
}

export default function CoinChart({
  symbol,
}: {
  symbol: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef =
    useRef<ISeriesApi<"Candlestick"> | null>(null);

  const volumeSeriesRef =
    useRef<ISeriesApi<"Histogram"> | null>(null);

  const [chartInterval, setChartInterval] =
    useState("15m");

  const [price, setPrice] =
    useState<number | null>(null);

  const [change, setChange] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,

      layout: {
        background: {
          color: "transparent",
        },
        textColor: "#8d8d8d",
        attributionLogo: true,
      },

      grid: {
        vertLines: {
          color: "rgba(255,255,255,0.045)",
        },
        horzLines: {
          color: "rgba(255,255,255,0.045)",
        },
      },

      rightPriceScale: {
        borderColor:
          "rgba(255,255,255,0.10)",
      },

      timeScale: {
        borderColor:
          "rgba(255,255,255,0.10)",
        timeVisible: true,
        secondsVisible: false,
      },

      crosshair: {
        vertLine: {
          color:
            "rgba(239,35,60,0.25)",
          labelBackgroundColor:
            "#ef233c",
        },

        horzLine: {
          color:
            "rgba(239,35,60,0.25)",
          labelBackgroundColor:
            "#ef233c",
        },
      },
    });

    const candleSeries = chart.addSeries(
      CandlestickSeries,
      {
        upColor: "#43d17d",
        downColor: "#ef233c",
        borderUpColor: "#43d17d",
        borderDownColor: "#ef233c",
        wickUpColor: "#43d17d",
        wickDownColor: "#ef233c",
      }
    );

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: {
          type: "volume",
        },

        priceScaleId: "volume",

        base: 0,
      }
    );

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    candleSeriesRef.current =
      candleSeries;

    volumeSeriesRef.current =
      volumeSeries;

    chartRef.current = chart;

    const resizeObserver =
      new ResizeObserver(() => {
        if (!containerRef.current) {
          return;
        }

        chart.applyOptions({
          width:
            containerRef.current
              .clientWidth,
        });
      });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();

      chart.remove();

      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadChart() {
      if (
        !chartRef.current ||
        !candleSeriesRef.current ||
        !volumeSeriesRef.current
      ) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/klines?symbol=${encodeURIComponent(
            symbol
          )}&interval=${encodeURIComponent(
            chartInterval
          )}&limit=500`,
          {
            cache: "no-store",
          }
        );

        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.error ||
              "Chart data unavailable"
          );
        }

        if (!active) return;

        const rows =
          payload.rows as KlineRow[];

        const candles: Candle[] =
          rows.map((row) => ({
            time: Math.floor(
              row[0] / 1000
            ) as UTCTimestamp,

            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
          }));

        const volumes: VolumeBar[] =
          rows.map((row) => ({
            time: Math.floor(
              row[0] / 1000
            ) as UTCTimestamp,

            value: Number(row[5]),

            color:
              Number(row[4]) >=
              Number(row[1])
                ? "rgba(67,209,125,0.28)"
                : "rgba(239,35,60,0.28)",
          }));

        const previous =
          candles.length > 1
            ? candles[candles.length - 2]
            : null;

        const last =
          candles.length > 0
            ? candles[candles.length - 1]
            : null;

        setPrice(
          last ? last.close : null
        );

        setChange(
          last &&
          previous &&
          previous.close !== 0
            ? ((last.close -
                previous.close) /
                previous.close) *
                100
            : null
        );

        candleSeriesRef.current.setData(
          candles
        );

        volumeSeriesRef.current.setData(
          volumes
        );

        chartRef.current
          .timeScale()
          .fitContent();
      } catch (requestError) {
        if (!active) return;

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Chart data unavailable"
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadChart();

    const timer = window.setInterval(
      loadChart,
      15000
    );

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol, chartInterval]);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="label">
            PRICE CHART
          </span>

          <h2 style={{ marginTop: "3px" }}>
            {symbol.replace(
              "USDT",
              "/USDT"
            )}
          </h2>
        </div>

        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
          }}
        >
          {TIMEFRAMES.map(
            ([value, label]) => (
              <button
                key={value}
                className={
                  chartInterval === value
                    ? "chip active"
                    : "chip"
                }
                onClick={() =>
                  setChartInterval(value)
                }
                style={{
                  padding:
                    "6px 9px",
                }}
                type="button"
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "14px",
          marginBottom: "12px",
          flexWrap: "wrap",
        }}
      >
        <strong
          className="mono"
          style={{
            fontSize: "24px",
          }}
        >
          {price === null
            ? "—"
            : formatPrice(price)}
        </strong>

        <span
          className={
            change !== null &&
            change >= 0
              ? "up"
              : "muted"
          }
        >
          {change === null
            ? "—"
            : `${change >= 0 ? "+" : ""}${change.toFixed(
                2
              )}%`}
        </span>

        {loading && (
          <span className="muted">
            Loading…
          </span>
        )}
      </div>

      {error ? (
        <div className="auth-message error">
          {error}
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            minHeight: "520px",
            borderRadius: "14px",
            overflow: "hidden",
            background:
              "rgba(0,0,0,.20)",
            border:
              "1px solid rgba(255,255,255,.06)",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
          marginTop: "9px",
          fontSize: "9px",
          color: "#666",
        }}
      >
        <span>
          Live market chart
        </span>

        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#777",
            textDecoration: "none",
          }}
        >
          TradingView Lightweight Charts™
        </a>
      </div>
    </div>
  );
}
