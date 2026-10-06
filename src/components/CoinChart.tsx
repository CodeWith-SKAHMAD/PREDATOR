"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  type UTCTimestamp,
} from "lightweight-charts";

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
  color?: string;
};

const timeframes = [
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

export default function CoinChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  const [interval, setInterval] = useState("15m");
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 520,
      layout: {
        background: { color: "transparent" },
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
        borderColor: "rgba(255,255,255,0.10)",
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.10)",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: "rgba(239,35,60,0.25)",
          labelBackgroundColor: "#ef233c",
        },
        horzLine: {
          color: "rgba(239,35,60,0.25)",
          labelBackgroundColor: "#ef233c",
        },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#43d17d",
      downColor: "#ef233c",
      borderVisible: false,
      wickUpColor: "#43d17d",
      wickDownColor: "#ef233c",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "rgba(239,35,60,0.30)",
      base: 0,
    });

    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    chart.priceScale("volume").applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({
        width: container.clientWidth,
      });
    });

    resizeObserver.observe(container);
    chartRef.current = chart;

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
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      if (!chartRef.current) return;

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=500`,
          { cache: "no-store" }
        );

        const payload = await response.json();

        if (!response.ok || !payload.ok) {
          throw new Error(
            payload.error || "Chart data unavailable"
          );
        }

        if (!active) return;

        const candles: Candle[] = payload.rows.map(
          (row: number[]) => ({
            time: Math.floor(row[0] / 1000) as UTCTimestamp,
            open: Number(row[1]),
            high: Number(row[2]),
            low: Number(row[3]),
            close: Number(row[4]),
          })
        );

        const volumes: VolumeBar[] = payload.rows.map(
          (row: number[]) => ({
            time: Math.floor(row[0] / 1000) as UTCTimestamp,
            value: Number(row[5]),
            color:
              Number(row[4]) >= Number(row[1])
                ? "rgba(67,209,125,0.28)"
                : "rgba(239,35,60,0.28)",
          })
        );

        const last = candles.at(-1);
        const first = candles.at(-2);

        setPrice(last?.close ?? null);
        setChange(
          last && first && first.close !== 0
            ? ((last.close - first.close) / first.close) * 100
            : null
        );

        const chart = chartRef.current;
        const series = candleSeriesRef.current;
        const volume = volumeSeriesRef.current;
        if (!chart || !series || !volume) return;

        series.setData(candles);
        volume.setData(volumes);
        chart.timeScale().fitContent();
      } catch (requestError) {
        if (!active) return;

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Chart data unavailable"
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    timer = setInterval(load, 15000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [symbol, interval]);

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
          <span className="label">PRICE CHART</span>
          <h2 style={{ marginTop: "3px" }}>
            {symbol.replace("USDT", "/USDT")}
          </h2>
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {timeframes.map(([value, label]) => (
            <button
              key={value}
              className={interval === value ? "chip active" : "chip"}
              onClick={() => setInterval(value)}
              style={{ padding: "6px 9px" }}
            >
              {label}
            </button>
          ))}
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
        <strong className="mono" style={{ fontSize: "24px" }}>
          {price === null ? "—" : formatPrice(price)}
        </strong>

        <span
          className={
            change !== null && change >= 0 ? "up" : "muted"
          }
        >
          {change === null
            ? "—"
            : `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`}
        </span>

        {loading && (
          <span className="muted">Loading…</span>
        )}
      </div>

      {error ? (
        <div className="auth-message error">{error}</div>
      ) : (
        <div
          ref={containerRef}
          style={{
            width: "100%",
            minHeight: "520px",
            borderRadius: "14px",
            overflow: "hidden",
            background: "rgba(0,0,0,.20)",
            border: "1px solid rgba(255,255,255,.06)",
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
        <span>Live market chart</span>
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#777", textDecoration: "none" }}
        >
          TradingView Lightweight Charts™
        </a>
      </div>
    </div>
  );
}
