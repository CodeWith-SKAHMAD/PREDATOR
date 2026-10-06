 "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode, CSSProperties, ChangeEvent, MouseEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BarChart3, Calculator as CalculatorIcon, ChevronRight, Clock3,
  LayoutDashboard, LogOut, Moon, Newspaper, PanelLeft, RefreshCw, Settings,
  Sun, Wallet, Zap
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import CoinChart from "@/components/CoinChart";

type Tab = "Dashboard"|"Signal"|"Volume Spike"|"BTC Report"|"Portfolio"|"Calculator"|"Settings";

const tabs: {name: Tab; icon: ComponentType<{size?:number; strokeWidth?:number}>}[] = [
  {name:"Dashboard",icon:LayoutDashboard},
  {name:"Signal",icon:Zap},
  {name:"Volume Spike",icon:BarChart3},
  {name:"BTC Report",icon:Newspaper},
  {name:"Portfolio",icon:Wallet},
  {name:"Calculator",icon:CalculatorIcon},
  {name:"Settings",icon:Settings},
];

const signals = [
  ["BTC/USDT","LONG","112","Strong","$121,840","1.9x","62"],
  ["ETH/USDT","LONG","104","Valid","$4,520","1.6x","59"],
  ["SOL/USDT","SHORT","97","Observe","$214.30","2.3x","43"],
  ["XRP/USDT","LONG","83","Observe","$2.74","1.8x","57"],
];

const spikes = [
  ["BTC","1.9x","$84.2B","62","High","1H"],
  ["SOL","3.4x","$9.8B","71","Extreme","4H"],
  ["DOGE","2.8x","$5.1B","68","High","1H"],
  ["LINK","2.1x","$1.7B","54","Moderate","1D"],
];

function getDisplayName(user: User) {
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.preferred_username ||
    user.user_metadata?.user_name ||
    user.email?.split("@")[0] ||
    "Trader"
  );
}

function getAvatar(user: User) {
  return user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
}

function Logo() {
  return (
    <div className="brand" title="PREDATOR Home">
      <img src="/predator-logo.png" alt="PREDATOR" className="predator-logo" />
      <span>PREDATOR</span>
    </div>
  );
}

function SessionBar() {
  const [now,setNow] = useState(new Date());
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),1000); return ()=>clearInterval(t)},[]);
  const h=now.getUTCHours();
  const session=h<7?"ASIA":h<13?"LONDON":h<21?"NEW YORK":"ASIA";
  return <div className="sessionbar">
    <div className="session-title"><Clock3 size={15}/><span>MARKET SESSION</span></div>
    <div className="sessions">
      {["ASIA","LONDON","NEW YORK"].map(s=><div key={s} className={"session "+(s===session?"active":"")}>{s}</div>)}
    </div>
    <div className="clock">{now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
  </div>
}

function Card({children,className="",onClick,style}:{children:ReactNode;className?:string;onClick?:()=>void;style?:CSSProperties;key?:string|number}) {
  return <div className={"glass-card "+className} onClick={onClick} style={style}>{children}</div>;
}

type MarketItem = {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
};

type MarketResponse = {
  ok: boolean;
  updatedAt?: string;
  btc: MarketItem | null;
  markets: MarketItem[];
  error?: string;
};


type DashboardSignal = {
  symbol: string;
  baseAsset: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  score: number;
  status: string;
  price: number;
  priceChange24h: number;
  volumeSpike: number;
  rsi: number | null;
  capturedAt?: string;
};

type DashboardVolume = {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  averageVolume: number;
  spike: number;
  rsi: number | null;
  level: string;
  reason: string;
};

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

function formatCompactUsd(value: number) {
  if (!Number.isFinite(value)) return "—";

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  return `$${value.toFixed(2)}`;
}

function formatPct(value: number) {
  if (!Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}


async function fetchJsonWithFallback<T>(urls: string[]): Promise<T> {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

function emaValue(values: number[], period: number) {
  if (!values.length) return null;
  const p = Math.max(1, Math.min(period, values.length));
  const k = 2 / (p + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i += 1) ema = values[i] * k + ema * (1 - k);
  return ema;
}

function rsiValue(values: number[], period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i += 1) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(d, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-d, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function atrPercentFromKlines(klines: any[], period = 14) {
  if (klines.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i += 1) {
    const high = Number(klines[i][2]);
    const low = Number(klines[i][3]);
    const prevClose = Number(klines[i - 1][4]);
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  const atr = trs.slice(-period).reduce((a, b) => a + b, 0) / period;
  const price = Number(klines.at(-1)?.[4]);
  return price > 0 ? (atr / price) * 100 : null;
}

function vwapFromKlines(klines: any[]) {
  let pv = 0;
  let vol = 0;
  for (const k of klines) {
    const typical = (Number(k[2]) + Number(k[3]) + Number(k[4])) / 3;
    const volume = Number(k[5]);
    pv += typical * volume;
    vol += volume;
  }
  return vol > 0 ? pv / vol : null;
}

function fmtMetric(value: number | null, digits = 2, suffix = "") {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${value.toFixed(digits)}${suffix}`;
}

function marketTone(change: number) {
  if (change >= 0.5) return "up";
  if (change <= -0.5) return "down";
  return "neutral";
}


function levelTone(level: string) {
  const normalized = level.toLowerCase();
  if (normalized.includes("extreme")) return "danger";
  if (normalized.includes("high")) return "warning";
  if (normalized.includes("moderate")) return "up";
  return "muted";
}

function Dashboard({
  go,
  onCoinClick,
}: {
  go: (t: Tab) => void;
  onCoinClick: (symbol: string) => void;
}) {
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [liveSignals, setLiveSignals] = useState<DashboardSignal[]>([]);
  const [volumeRows, setVolumeRows] = useState<DashboardVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState("");

  async function loadDashboardData(isManual = false) {
    if (isManual) setRefreshing(true);
    setError("");

    try {
      const [marketResponse, signalResponse, volumeResponse] = await Promise.all([
        fetch(`/api/market?ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/signals?ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/volume-spike?interval=1h&ts=${Date.now()}`, {
          cache: "no-store",
        }),
      ]);

      const [marketData, signalData, volumeData] = await Promise.all([
        marketResponse.json() as Promise<MarketResponse>,
        signalResponse.json(),
        volumeResponse.json(),
      ]);

      if (!marketResponse.ok || !marketData.ok) {
        throw new Error(marketData.error || "Market data unavailable");
      }

      setMarket(marketData);
      setLiveSignals(
        signalResponse.ok && signalData?.ok && Array.isArray(signalData.rows)
          ? signalData.rows
          : [],
      );
      setVolumeRows(
        volumeResponse.ok && volumeData?.ok && Array.isArray(volumeData.rows)
          ? volumeData.rows
          : [],
      );

      const updateSource =
        marketData.updatedAt || signalData?.updatedAt || volumeData?.updatedAt;

      setLastUpdated(
        updateSource
          ? new Date(updateSource).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : "",
      );

      if (!signalResponse.ok || !signalData?.ok) {
        setError("Signal data temporarily unavailable.");
      } else if (!volumeResponse.ok || !volumeData?.ok) {
        setError("Volume data temporarily unavailable.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Live dashboard data unavailable",
      );
      setMarket(null);
      setLiveSignals([]);
      setVolumeRows([]);
      setLastUpdated("");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboardData();

    const timer = window.setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const btc = market?.btc ?? null;

  const movers = [...volumeRows]
    .sort((a, b) => {
      if (b.spike !== a.spike) return b.spike - a.spike;
      return Math.abs(b.change24h) - Math.abs(a.change24h);
    })
    .slice(0, 5);

  const strongestSignals = [...liveSignals]
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const signalCounts = {
    strong: liveSignals.filter((signal) => signal.score >= 110 && signal.score <= 120).length,
    valid: liveSignals.filter((signal) => signal.score >= 100 && signal.score < 110).length,
    observe: liveSignals.filter((signal) => signal.score >= 80 && signal.score < 100).length,
  };

  const topVolume = movers[0] ?? null;
  const averageSpike =
    movers.length > 0
      ? movers.reduce((sum, item) => sum + item.spike, 0) / movers.length
      : 0;

  const marketStatus =
    btc == null
      ? "Unavailable"
      : btc.change24h >= 1.5
        ? "Risk-On"
        : btc.change24h <= -1.5
          ? "Risk-Off"
          : "Balanced";

  const marketStatusText =
    btc == null
      ? "Waiting for live data"
      : `BTC 24H ${formatPct(btc.change24h)}`;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="muted">
            Live market overview
            {lastUpdated ? ` · Updated ${lastUpdated}` : ""}
          </p>
        </div>

        <button
          className="glass-btn"
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
        >
          <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          className="glass-card"
          style={{
            marginBottom: "14px",
            padding: "12px 14px",
            fontSize: "12px",
          }}
        >
          <span className="muted">LIVE STATUS: {error}</span>
        </div>
      )}

      <div className="stats-grid">
        <Card
          onClick={() => onCoinClick("BTCUSDT")}
          style={{ cursor: "pointer" }}
        >
          <span className="label">BTC</span>
          <strong className="price">
            {loading || !btc ? "—" : `$${formatPrice(btc.price)}`}
          </strong>
          <span
            className={
              btc && marketTone(btc.change24h) === "up" ? "up" : "muted"
            }
          >
            {loading || !btc ? "Loading..." : formatPct(btc.change24h)}
          </span>
          {btc && (
            <div className="mini-line" />
          )}
          {btc && (
            <div className="muted" style={{ marginTop: "8px", fontSize: "10px" }}>
              H {formatPrice(btc.high24h)} · L {formatPrice(btc.low24h)}
            </div>
          )}
        </Card>

        <Card>
          <span className="label">MARKET STATUS</span>
          <strong>{marketStatus}</strong>
          <span className="muted">{marketStatusText}</span>
          <div className="status-dot" />
        </Card>

        <Card onClick={() => go("Signal")} style={{ cursor: "pointer" }}>
          <span className="label">LIVE SIGNALS</span>
          <strong>{loading ? "—" : liveSignals.length}</strong>
          <span className="muted">
            {signalCounts.strong} Strong · {signalCounts.valid} Valid · {signalCounts.observe} Observe
          </span>
        </Card>

        <Card onClick={() => go("Volume Spike")} style={{ cursor: "pointer" }}>
          <span className="label">VOLUME SUMMARY</span>
          <strong>
            {loading || !topVolume ? "—" : `${topVolume.spike.toFixed(1)}x`}
          </strong>
          <span className="muted">
            {topVolume
              ? `${topVolume.symbol.replace("USDT", "")} · ${topVolume.level}`
              : "Waiting for volume scan"}
          </span>
          {topVolume && (
            <div className="muted" style={{ marginTop: "8px", fontSize: "10px" }}>
              Avg top-5 spike {averageSpike.toFixed(1)}x
            </div>
          )}
        </Card>
      </div>

      <div className="two-col">
        <Card>
          <div className="card-head">
            <div>
              <span className="label">LIVE MARKET MOVERS</span>
              <h2>Volume activity</h2>
            </div>
            <button className="text-btn" onClick={() => go("Volume Spike")}>
              View all <ChevronRight size={14} />
            </button>
          </div>

          {loading && (
            <div className="row">
              <span className="muted">Loading live volume scan...</span>
            </div>
          )}

          {!loading && movers.length === 0 && (
            <div className="row">
              <span className="muted">No live volume movers right now.</span>
            </div>
          )}

          {!loading &&
            movers.map((item) => {
              const symbol = item.symbol.replace("USDT", "");
              const changeClass =
                marketTone(item.change24h) === "up" ? "up" : "muted";

              return (
                <div
                  className="row"
                  key={item.symbol}
                  onClick={() => onCoinClick(item.symbol)}
                  style={{ cursor: "pointer" }}
                >
                  <div>
                    <b>{symbol}</b>
                    <span className="muted">
                      ${formatPrice(item.price)} · {item.level}
                    </span>
                  </div>
                  <span className={changeClass}>{formatPct(item.change24h)}</span>
                  <span className="mono">{item.spike.toFixed(1)}x</span>
                </div>
              );
            })}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <span className="label">LIVE SIGNAL SUMMARY</span>
              <h2>Highest confluence</h2>
            </div>
            <button className="text-btn" onClick={() => go("Signal")}>
              Open <ChevronRight size={14} />
            </button>
          </div>

          {loading && (
            <div className="row">
              <span className="muted">Loading live signals...</span>
            </div>
          )}

          {!loading && strongestSignals.length === 0 && (
            <div className="row">
              <span className="muted">No qualifying live signals right now.</span>
            </div>
          )}

          {!loading &&
            strongestSignals.map((signal) => (
              <div
                className="signal-row"
                key={signal.symbol}
                onClick={() => onCoinClick(signal.symbol)}
                style={{ cursor: "pointer" }}
              >
                <div
                  className={
                    "badge " +
                    (signal.direction === "LONG"
                      ? "long"
                      : signal.direction === "SHORT"
                        ? "short"
                        : "")
                  }
                >
                  {signal.direction}
                </div>

                <div>
                  <b>{signal.baseAsset || signal.symbol.replace("USDT", "")}</b>
                  <span className="muted">
                    {signal.status} · {signal.volumeSpike.toFixed(1)}x vol
                  </span>
                </div>

                <strong className="mono">{signal.score}/150</strong>
              </div>
            ))}
        </Card>
      </div>

      <Card style={{ marginTop: "14px" }}>
        <div className="card-head">
          <div>
            <span className="label">VOLUME SNAPSHOT</span>
            <h2>Why the market is moving</h2>
          </div>
          <button className="text-btn" onClick={() => go("Volume Spike")}>
            Volume Spike <ChevronRight size={14} />
          </button>
        </div>

        {loading || !topVolume ? (
          <div className="row">
            <span className="muted">Waiting for the live volume engine...</span>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
              alignItems: "center",
            }}
          >
            <div>
              <span className="label">TOP VOLUME COIN</span>
              <strong style={{ display: "block", marginTop: "5px", fontSize: "20px" }}>
                {topVolume.symbol.replace("USDT", "/USDT")}
              </strong>
              <span className="muted" style={{ display: "block", marginTop: "5px" }}>
                {topVolume.reason}
              </span>
            </div>

            <div>
              <span className="label">SPIKE</span>
              <strong className="mono" style={{ display: "block", marginTop: "5px" }}>
                {topVolume.spike.toFixed(2)}x
              </strong>
              <span className={levelTone(topVolume.level)} style={{ display: "block", marginTop: "5px", fontSize: "11px" }}>
                {topVolume.level}
              </span>
            </div>

            <div>
              <span className="label">24H CHANGE</span>
              <strong
                className={marketTone(topVolume.change24h) === "up" ? "up" : "muted"}
                style={{ display: "block", marginTop: "5px" }}
              >
                {formatPct(topVolume.change24h)}
              </strong>
              <span className="muted" style={{ display: "block", marginTop: "5px" }}>
                RSI {topVolume.rsi === null ? "—" : topVolume.rsi.toFixed(1)}
              </span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}


type CompactSignalCardProps = {
  baseAsset: string;
  direction: "LONG" | "SHORT";
  score: number;
  status: string;
  price: number;
  change15m: number | null;
  change1h: number | null;
  support: number | null;
  resistance: number | null;
  supportDistance: number | null;
  resistanceDistance: number | null;
  fundingRate: number | null;
  capturedAt?: string;
  expired?: boolean;
  onClick: () => void;
};

function CompactCoinIcon({ baseAsset }: { baseAsset: string }) {
  const [failed, setFailed] = useState(false);
  const short = baseAsset.slice(0, 3).toUpperCase();
  const iconUrl = `https://assets.coincap.io/assets/icons/${baseAsset.toLowerCase()}@2x.png`;

  return failed ? (
    <div
      aria-hidden="true"
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        flex: "0 0 auto",
        background: "linear-gradient(145deg, rgba(22,35,48,.96), rgba(8,13,19,.98))",
        border: "1px solid rgba(132,185,255,.35)",
        boxShadow: "0 0 18px rgba(69,160,255,.12), inset 0 0 12px rgba(255,255,255,.03)",
        color: "#dff4ff",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: ".06em",
      }}
    >
      {short}
    </div>
  ) : (
    <img
      src={iconUrl}
      alt=""
      width={48}
      height={48}
      onError={() => setFailed(true)}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        objectFit: "cover",
        flex: "0 0 auto",
        background: "#0c1118",
        border: "1px solid rgba(255,255,255,.1)",
        boxShadow: "0 0 16px rgba(42,226,168,.08)",
      }}
    />
  );
}

function CompactSignalCard({
  baseAsset,
  direction,
  score,
  status,
  price,
  change15m,
  change1h,
  support,
  resistance,
  supportDistance,
  resistanceDistance,
  fundingRate,
  capturedAt,
  expired = false,
  onClick,
}: CompactSignalCardProps) {
  const scorePercent = Math.max(0, Math.min(100, (score / 150) * 100));
  const accent = direction === "LONG" ? "#10e7a0" : "#ff596d";
  const scoreText = status || (score >= 120 ? "Extended / Pumped" : score >= 110 ? "Strong" : score >= 100 ? "Valid" : "Observe");
  const fundingText = fundingRate === null || !Number.isFinite(fundingRate)
    ? "N/A"
    : `${fundingRate >= 0 ? "+" : ""}${(fundingRate * 100).toFixed(4)}%`;

  const metricBox = (label: string, value: number | null) => {
    const positive = typeof value === "number" && value >= 0;
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: "7px 9px",
          borderRadius: 12,
          border: `1px solid ${positive ? "rgba(16,231,160,.26)" : "rgba(255,89,109,.22)"}`,
          background: positive ? "linear-gradient(180deg, rgba(16,231,160,.09), rgba(16,231,160,.035))" : "linear-gradient(180deg, rgba(255,89,109,.08), rgba(255,89,109,.025))",
          boxShadow: "inset 0 0 14px rgba(255,255,255,.018)",
        }}
      >
        <span style={{ display: "block", color: "#95a0ad", fontSize: 10, letterSpacing: ".05em", marginBottom: 3 }}>{label}</span>
        <strong style={{ color: positive ? "#31efb3" : "#ff6f80", fontSize: 13 }}>{
          typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}%` : "N/A"
        }</strong>
      </div>
    );
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: 12,
        borderRadius: 15,
        border: "1px solid rgba(125,170,215,.24)",
        background: "linear-gradient(145deg, rgba(17,25,34,.90), rgba(7,11,16,.96))",
        boxShadow: "0 18px 35px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.045), inset 0 0 30px rgba(72,126,176,.035)",
        color: "inherit",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(circle at 84% 10%, ${direction === "LONG" ? "rgba(16,231,160,.10)" : "rgba(255,89,109,.09)"}, transparent 28%), radial-gradient(circle at 6% 85%, rgba(111,171,255,.055), transparent 28%)`,
        }}
      />

      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            <CompactCoinIcon baseAsset={baseAsset} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <strong style={{ fontSize: 16, letterSpacing: ".015em" }}>{baseAsset}</strong>
                <span style={{ color: "#84909c", fontSize: 11 }}>USDT</span>
              </div>
              <div style={{ color: "#75818d", fontSize: 10, marginTop: 3 }}>{expired ? "EXPIRED SIGNAL" : scoreText}</div>
            </div>
          </div>

          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
              background: `conic-gradient(${accent} ${scorePercent * 3.6}deg, rgba(115,130,145,.16) 0deg)`,
              boxShadow: `0 0 19px ${direction === "LONG" ? "rgba(16,231,160,.14)" : "rgba(255,89,109,.13)"}`,
            }}
          >
            <div style={{ width: 43, height: 43, borderRadius: "50%", display: "grid", placeItems: "center", background: "#0b1118", border: "1px solid rgba(255,255,255,.05)" }}>
              <strong className="mono" style={{ fontSize: 15 }}>{score}</strong>
            </div>
          </div>
        </div>

        <div className="mono" style={{ fontSize: 24, fontWeight: 800, marginTop: 9, letterSpacing: ".01em" }}>
          {formatPrice(price)}
        </div>
        <div style={{ color: "#74808c", fontSize: 9, marginTop: 2 }}>CURRENT PRICE</div>

        <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
          {metricBox("1H", change1h)}
          {metricBox("15M", change15m)}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ color: "#31efb3", fontWeight: 800, fontSize: 12 }}>S</span>
              <strong style={{ color: "#31efb3", fontSize: 13 }}>
                {typeof supportDistance === "number" ? `${supportDistance >= 0 ? "↑" : "↓"} ${Math.abs(supportDistance).toFixed(2)}%` : "N/A"}
              </strong>
            </div>
            <div className="mono" style={{ color: "#b6c1cb", fontSize: 9, marginTop: 3 }}>{support === null ? "—" : formatPrice(support)}</div>
          </div>

          <div style={{ minWidth: 0, paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,.07)" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={{ color: "#ff6f80", fontWeight: 800, fontSize: 12 }}>R</span>
              <strong style={{ color: "#ff6f80", fontSize: 15 }}>
                {typeof resistanceDistance === "number" ? `${resistanceDistance >= 0 ? "↓" : "↑"} ${Math.abs(resistanceDistance).toFixed(2)}%` : "N/A"}
              </strong>
            </div>
            <div className="mono" style={{ color: "#b6c1cb", fontSize: 10, marginTop: 4 }}>{resistance === null ? "—" : formatPrice(resistance)}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,.07)",
          }}
        >
          <div>
            <div style={{ color: "#78838f", fontSize: 10 }}>FUNDING RATE</div>
            <strong style={{ color: fundingRate !== null && fundingRate < 0 ? "#ff6f80" : "#31efb3", fontSize: 12 }}>
              {fundingText}
            </strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {capturedAt && (
              <span style={{ color: "#75808b", fontSize: 10 }}>
                {new Date(capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <span
              style={{
                padding: "6px 11px",
                borderRadius: 10,
                border: `1px solid ${accent}66`,
                color: accent,
                background: `${direction === "LONG" ? "rgba(16,231,160,.075)" : "rgba(255,89,109,.075)"}`,
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: ".04em",
              }}
            >
              {direction}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}


function Signals({
  user,
  onCoinClick,
}: {
  user: User;
  onCoinClick: (symbol: string) => void;
}) {
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
    triggerPrice: number;
    change15m: number;
    change1h: number;
    volumeSpike: number;
    incomingVolume: number;
    rsi: number | null;
    atrPercent: number | null;
    supportDistance: number;
    resistanceDistance: number;
    entryStatus: string;
    liquidity: number;
    spreadBps: number | null;
    fundingRate: number | null;
    capturedAt: string;
    tools: Record<string, ToolResult>;
    reasons: string[];
    support: number;
    resistance: number;
    invalidation: number | null;
    riskLevel: "Low" | "Moderate" | "High" | "Extreme";
    expiresAt: string;
  };

  type HistoryMeta = {
    change15m: number;
    change1h: number;
    support: number;
    resistance: number;
    supportDistance: number;
    resistanceDistance: number;
    fundingRate: number | null;
    baseAsset: string;
    capturedAt: string;
  };

  type HistoryRow = {
    id: number;
    symbol: string;
    direction: "LONG" | "SHORT";
    score: number;
    status: string;
    price: number | null;
    signal_time: string;
    expires_at: string | null;
    volume_spike: number | null;
    rsi: number | null;
    tool_scores: (Record<string, ToolResult> & { __meta?: HistoryMeta }) | null;
    reason: string | null;
  };

  type SignalSnapshot = {
    windowId: number;
    windowStartAt: string;
    nextScanAt: string;
    updatedAt: string;
    rows: SignalRow[];
  };

  const [rows, setRows] = useState<SignalRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [view, setView] = useState<"active" | "history">("active");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [savingHistory, setSavingHistory] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [last, setLast] = useState<Date | null>(null);
  const [nextScanAt, setNextScanAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const scanBusyRef = useRef(false);

  const categoryLabel = (score: number) => {
    if (score >= 120) return "Extended / Pumped";
    if (score >= 110) return "Strong";
    if (score >= 100) return "Valid";
    if (score >= 80) return "Observe";
    return "Ignore";
  };

  const riskLevelFor = (signal: SignalRow) => {
    if (signal.status === "Extended / Pumped") return "Extreme" as const;
    if (signal.atrPercent !== null && signal.atrPercent >= 3) return "High" as const;
    if (signal.atrPercent !== null && signal.atrPercent >= 1.5) return "Moderate" as const;
    return "Low" as const;
  };

  const formatPrice = (value: number) => {
    if (value >= 1000) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    if (value >= 1) {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      });
    }

    return value.toLocaleString(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8,
    });
  };

  async function loadHistory() {
    if (!supabase) {
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");

    const { data, error: historyLoadError } = await supabase
      .from("signal_history")
      .select(
        "id, symbol, direction, score, status, price, signal_time, expires_at, volume_spike, rsi, tool_scores, reason"
      )
      .eq("user_id", user.id)
      .order("signal_time", { ascending: false })
      .limit(200);

    if (historyLoadError) {
      setHistoryError(historyLoadError.message);
    } else {
      setHistory((data ?? []) as HistoryRow[]);
    }

    setHistoryLoading(false);
  }

  async function saveNewSignals(signalRows: SignalRow[]) {
    if (!supabase || signalRows.length === 0) return;

    const qualifying = signalRows.filter(
      (signal) =>
        signal.score >= 80 &&
        (signal.direction === "LONG" ||
          signal.direction === "SHORT")
    );

    if (qualifying.length === 0) return;

    setSavingHistory(true);

    try {
      const now = new Date();
      const nowIso = now.toISOString();

      const symbols = qualifying.map(
        (signal) => signal.symbol
      );

      const { data: activeRows, error: activeError } =
        await supabase
          .from("signal_history")
          .select("symbol")
          .eq("user_id", user.id)
          .in("symbol", symbols)
          .gt("expires_at", nowIso);

      if (activeError) {
        setHistoryError(activeError.message);
        return;
      }

      const activeSymbols = new Set(
        (activeRows ?? []).map(
          (item: { symbol: string }) => item.symbol
        )
      );

      const newRows = qualifying
        .filter(
          (signal) =>
            !activeSymbols.has(signal.symbol)
        )
        .map((signal) => {
          const signalTime = new Date(
            signal.capturedAt
          );

          const expiresAt = new Date(signal.expiresAt);

          return {
            user_id: user.id,
            symbol: signal.symbol,
            direction: signal.direction,
            score: signal.score,
            status:
              signal.status ||
              categoryLabel(signal.score),
            price: signal.price,
            signal_time: signalTime.toISOString(),
            expires_at:
              expiresAt.toISOString(),
            volume_spike:
              signal.volumeSpike,
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
            reason: signal.reasons.join(
              " · "
            ),
          };
        });

      if (newRows.length === 0) {
        return;
      }

      const { error: insertError } =
        await supabase
          .from("signal_history")
          .insert(newRows);

      if (insertError) {
        setHistoryError(
          insertError.message
        );
        return;
      }

      await loadHistory();
    } finally {
      setSavingHistory(false);
    }
  }

  const loadSignals = useCallback(async (mode: "initial" | "manual" | "auto" = "initial") => {
    const forceNetwork = mode === "auto";
    if (scanBusyRef.current && forceNetwork) return;
    scanBusyRef.current = true;
    try {
      setError("");
      if (mode === "auto" || mode === "initial" || mode === "manual") {
        setLoading(mode === "auto" ? false : true);
      }

      // IMPORTANT: do not use browser/sessionStorage as the signal source.
      // The API now returns one shared Supabase-backed snapshot for everyone.
      // This guarantees PC/mobile/different accounts see identical results
      // during the same 30-minute scan window.
      const response = await fetch(`/api/signals?ts=${Date.now()}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload.ok) throw new Error(payload.error || "Signal scan failed");

      const nextRows = (payload.rows ?? []) as SignalRow[];
      const serverNextScan = Number.isFinite(Date.parse(payload.nextScanAt || ""))
        ? Date.parse(payload.nextScanAt)
        : null;
      const serverWindowStart = Number.isFinite(Date.parse(payload.windowStartAt || ""))
        ? Date.parse(payload.windowStartAt)
        : Date.now();

      setRows(nextRows);
      setLast(new Date(serverWindowStart));
      setNextScanAt(serverNextScan);
      if (serverNextScan !== null) {
        setSeconds(Math.max(0, Math.ceil((serverNextScan - Date.now()) / 1000)));
      }

      await saveNewSignals(nextRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signal scan failed");
    } finally {
      setLoading(false);
      scanBusyRef.current = false;
    }
  }, [user.id]);

  useEffect(() => {
    loadSignals("initial");
    loadHistory();
  }, [loadSignals]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const target = nextScanAt ?? 0;
      const remaining = target ? Math.max(0, Math.ceil((target - Date.now()) / 1000)) : 0;
      setSeconds(remaining);
      if (target && Date.now() >= target && !scanBusyRef.current) {
        loadSignals("auto");
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [nextScanAt, loadSignals]);

  const topRows = rows.slice(0, 24);

  const historyGroups = history.reduce<
    Record<string, HistoryRow[]>
  >((groups, row) => {
    if (!groups[row.symbol]) {
      groups[row.symbol] = [];
    }

    groups[row.symbol].push(row);
    return groups;
  }, {});

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            SCALPING SCANNER
          </p>

          <h1>Live Signals</h1>

          <p className="muted">
            15 tools × 10 points · Score is not an entry.
          </p>
        </div>

        <div className="actions">
          <span className="countdown">
            NEXT SCAN{" "}
            {String(Math.floor(seconds / 60)).padStart(2, "0")}
            :
            {String(seconds % 60).padStart(2, "0")}
          </span>

          <button
            className="glass-btn"
            onClick={() =>
              loadSignals("manual")
            }
            disabled={loading}
          >
            <RefreshCw
              size={15}
              style={
                loading
                  ? {
                      animation:
                        "predator-spin 1s linear infinite",
                    }
                  : undefined
              }
            />
            Force refresh
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <button
          className={
            view === "active"
              ? "chip active"
              : "chip"
          }
          onClick={() => setView("active")}
          type="button"
        >
          Active
        </button>

        <button
          className={
            view === "history"
              ? "chip active"
              : "chip"
          }
          onClick={() => setView("history")}
          type="button"
        >
          History
          {history.length > 0
            ? ` · ${history.length}`
            : ""}
        </button>

        {savingHistory && (
          <span className="muted">
            Saving scan…
          </span>
        )}
      </div>

      {view === "active" ? (
        <>
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "14px",
              }}
            >
              <div>
                <span className="label">
                  LIVE SCAN
                </span>

                <h2
                  style={{
                    marginTop: "4px",
                  }}
                >
                  {loading
                    ? "Scanning markets..."
                    : `${topRows.length} active signals`}
                </h2>
              </div>

              {last && (
                <span className="muted">
                  Updated{" "}
                  {last.toLocaleTimeString(
                    [],
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }
                  )}
                </span>
              )}
            </div>

            {error && (
              <div
                style={{
                  padding: "11px",
                  borderRadius: "10px",
                  border:
                    "1px solid rgba(239,35,60,.20)",
                  background:
                    "rgba(239,35,60,.07)",
                  color: "#ff7180",
                  fontSize: "12px",
                  marginBottom: "14px",
                }}
              >
                {error}
              </div>
            )}

            {!loading &&
              !error &&
              topRows.length === 0 && (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                  }}
                >
                  <p className="muted">
                    No qualifying signals right now.
                  </p>

                  <p
                    className="muted"
                    style={{
                      marginTop: "6px",
                    }}
                  >
                    The scanner only shows coins
                    scoring 80+.
                  </p>
                </div>
              )}
          </Card>

          {!loading &&
            topRows.length > 0 && (
              <div
                className="signal-card-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {topRows.map((signal) => (
                  <CompactSignalCard
                    key={signal.symbol}
                    baseAsset={signal.baseAsset}
                    direction={signal.direction === "SHORT" ? "SHORT" : "LONG"}
                    score={signal.score}
                    status={categoryLabel(signal.score)}
                    price={signal.price}
                    change15m={signal.change15m}
                    change1h={signal.change1h}
                    support={signal.support}
                    resistance={signal.resistance}
                    supportDistance={signal.supportDistance}
                    resistanceDistance={signal.resistanceDistance}
                    fundingRate={signal.fundingRate}
                    capturedAt={signal.capturedAt}
                    onClick={() => onCoinClick(signal.symbol)}
                  />
                ))}
              </div>
            )}
        </>
      ) : (
        <div className="page">
          <Card>
            <div className="card-head">
              <div>
                <span className="label">
                  SIGNAL HISTORY
                </span>

                <h2>
                  Expired & previous scans
                </h2>
              </div>

              <button
                className="glass-btn"
                onClick={loadHistory}
                disabled={historyLoading}
                type="button"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            {historyError && (
              <div className="auth-message error">
                {historyError}
              </div>
            )}

            {historyLoading ? (
              <div
                style={{
                  padding: "30px",
                  textAlign: "center",
                }}
              >
                <span className="muted">
                  Loading signal history…
                </span>
              </div>
            ) : Object.keys(historyGroups)
                .length === 0 ? (
              <div
                style={{
                  padding: "30px",
                  textAlign: "center",
                }}
              >
                <p className="muted">
                  No signal history yet.
                </p>
              </div>
            ) : (
              <div
                className="signal-card-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                {history.slice(0, 48).map((item) => {
                  const meta = item.tool_scores?.__meta;
                  const expired = item.expires_at
                    ? new Date(item.expires_at).getTime() <= Date.now()
                    : true;

                  return (
                    <CompactSignalCard
                      key={item.id}
                      baseAsset={meta?.baseAsset || item.symbol.replace("USDT", "")}
                      direction={item.direction}
                      score={item.score}
                      status={item.status}
                      price={Number(item.price ?? 0)}
                      change15m={typeof meta?.change15m === "number" ? meta.change15m : null}
                      change1h={typeof meta?.change1h === "number" ? meta.change1h : null}
                      support={typeof meta?.support === "number" ? meta.support : null}
                      resistance={typeof meta?.resistance === "number" ? meta.resistance : null}
                      supportDistance={typeof meta?.supportDistance === "number" ? meta.supportDistance : null}
                      resistanceDistance={typeof meta?.resistanceDistance === "number" ? meta.resistanceDistance : null}
                      fundingRate={typeof meta?.fundingRate === "number" ? meta.fundingRate : null}
                      capturedAt={meta?.capturedAt || item.signal_time}
                      expired={expired}
                      onClick={() => onCoinClick(item.symbol)}
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}


function VolumeSpike({ onCoinClick }:{ onCoinClick:(symbol:string)=>void }) {
  const [interval, setIntervalValue] = useState<"1h" | "4h" | "1d">("1h");
  const [rows, setRows] = useState<Array<{
    symbol: string;
    price: number;
    change24h: number;
    volume: number;
    averageVolume: number;
    spike: number;
    rsi: number | null;
    level: string;
    reason: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/volume-spike?interval=${interval}`, {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Volume data unavailable");
        }

        if (!active) return;

        setRows(data.rows || []);
        setLastUpdated(new Date(data.updatedAt));
      } catch (requestError) {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Volume data unavailable"
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    const timer = window.setInterval(load, 60000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [interval]);

  const formatVolume = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatRsi = (value: number | null) =>
    value === null ? "—" : value.toFixed(0);

  const rsiStatus = (value: number | null) => {
    if (value === null) return "Normal";
    if (value >= 70) return "Overbought";
    if (value <= 30) return "Oversold";
    return "Neutral";
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">UNUSUAL ACTIVITY</p>
          <h1>Volume Spike</h1>
          <p className="muted">
            Activity monitor — not a trade signal.
          </p>
        </div>

        <div className="chips">
          {([
            ["1h", "1H"],
            ["4h", "4H"],
            ["1d", "1D"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              className={interval === value ? "chip active" : "chip"}
              onClick={() => setIntervalValue(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="card-head">
          <div>
            <span className="label">LIVE SCAN</span>
            <h2>{loading ? "Scanning..." : `${rows.length} markets`}</h2>
          </div>

          <span className="muted">
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}`
              : "Waiting for data"}
          </span>
        </div>

        {error ? (
          <div className="auth-message error">{error}</div>
        ) : loading && rows.length === 0 ? (
          <div className="muted" style={{ padding: "22px 0" }}>
            Loading unusual activity…
          </div>
        ) : rows.length === 0 ? (
          <div className="muted" style={{ padding: "22px 0" }}>
            No unusual activity found for this timeframe.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>COIN</th>
                  <th>SPIKE</th>
                  <th>VOLUME</th>
                  <th>RSI</th>
                  <th>RSI STATUS</th>
                  <th>LEVEL</th>
                  <th>WHY</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.symbol}
                    onClick={() => onCoinClick(row.symbol)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>
                      <b>{row.symbol.replace("USDT", "/USDT")}</b>
                    </td>

                    <td className="mono">
                      {row.spike.toFixed(1)}×
                    </td>

                    <td className="mono">
                      {formatVolume(row.volume)}
                    </td>

                    <td className="mono">
                      {formatRsi(row.rsi)}
                    </td>

                    <td>
                      <span className="muted">
                        {rsiStatus(row.rsi)}
                      </span>
                    </td>

                    <td>
                      <span className={`level ${row.level.toLowerCase()}`}>
                        {row.level}
                      </span>
                    </td>

                    <td>
                      <span className="muted">{row.reason}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function BTCReport({ onCoinClick }: { onCoinClick: (symbol: string) => void }) {
  type Liquidation = { side?: string; price?: string; origQty?: string; avgPrice?: string };
  type CoinMetricsResponse = Array<Record<string, string>> | { data?: Array<Record<string, string>> };
  type BtcData = {
    price: number;
    change24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    change15m: number;
    change1h: number;
    change7d: number;
    ema21: number | null;
    ema50: number | null;
    rsi: number | null;
    atrPercent: number | null;
    vwap: number | null;
    support: number;
    resistance: number;
    openInterestUsd: number | null;
    fundingRate: number | null;
    longLiquidationUsd: number | null;
    shortLiquidationUsd: number | null;
    etfFlow: number | null;
    mvrv: number | null;
    nupl: number | null;
    marketHealth: number;
    marketCondition: string;
    cycleScore: number;
    cycleStage: string;
    updatedAt: string;
  };

  const [data, setData] = useState<BtcData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [sourceNote, setSourceNote] = useState("");

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    setError("");
    try {
      const marketPayload = await fetchJsonWithFallback<MarketResponse>([
        `/api/market?ts=${Date.now()}`,
      ]);
      const btcMarket = marketPayload.btc;
      if (!btcMarket) throw new Error("BTC market data unavailable");

      const [k15m, k1h, oi, premium, forceOrders, metrics] = await Promise.all([
        fetchJsonWithFallback<any[]>([
          "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=120",
          "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=120",
        ]),
        fetchJsonWithFallback<any[]>([
          "https://data-api.binance.vision/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200",
          "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=200",
        ]),
        fetchJsonWithFallback<{ openInterest: string }>([
          "https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT",
        ]).catch(() => null),
        fetchJsonWithFallback<{ lastFundingRate: string }>([
          "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT",
        ]).catch(() => null),
        fetchJsonWithFallback<Liquidation[]>([
          "https://fapi.binance.com/fapi/v1/allForceOrders?symbol=BTCUSDT&limit=50",
        ]).catch(() => []),
        fetchJsonWithFallback<CoinMetricsResponse>([
          "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=CapMrktCurUSD,CapRealUSD&frequency=1d&page_size=1&sort=desc",
        ]).catch(() => null),
      ]);

      const closes15 = k15m.map((k) => Number(k[4])).filter(Number.isFinite);
      const closes1h = k1h.map((k) => Number(k[4])).filter(Number.isFinite);
      if (!closes15.length || !closes1h.length) throw new Error("BTC candle data unavailable");

      const price = btcMarket.price;
      const change15m = closes15.length >= 2 ? (price / closes15.at(-2)! - 1) * 100 : 0;
      const change1h = closes1h.length >= 2 ? (price / closes1h.at(-2)! - 1) * 100 : 0;
      const change7d = closes1h.length >= 168 ? (price / closes1h.at(-169)! - 1) * 100 : (price / closes1h[0] - 1) * 100;
      const ema21 = emaValue(closes1h, 21);
      const ema50 = emaValue(closes1h, 50);
      const rsi = rsiValue(closes1h);
      const atrPercent = atrPercentFromKlines(k1h);
      const vwap = vwapFromKlines(k15m.slice(-96));
      const recent = closes1h.slice(-96);
      const support = Math.min(...recent);
      const resistance = Math.max(...recent);

      const oiUsd = oi?.openInterest ? Number(oi.openInterest) * price : null;
      const fundingRate = premium?.lastFundingRate ? Number(premium.lastFundingRate) : null;
      let longLiquidationUsd = 0;
      let shortLiquidationUsd = 0;
      for (const item of forceOrders) {
        const notional = Math.abs(Number(item.avgPrice || item.price || 0) * Number(item.origQty || 0));
        if (!Number.isFinite(notional)) continue;
        if ((item.side || "").toUpperCase() === "SELL") longLiquidationUsd += notional;
        if ((item.side || "").toUpperCase() === "BUY") shortLiquidationUsd += notional;
      }

      let etfFlow: number | null = null;
      try {
        const textResponse = await fetch("https://r.jina.ai/http://farside.co.uk/bitcoin-etf-flow-all-data/", { cache: "no-store" });
        if (textResponse.ok) {
          const text = await textResponse.text();
          const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
          const dated = lines.filter((line) => /\b\d{2}\s+[A-Z][a-z]{2}\s+\d{4}\b/.test(line));
          const lastLine = dated.at(-1) || "";
          const nums = [...lastLine.matchAll(/(?:\(|-)?\d+(?:,\d{3})*(?:\.\d+)?\)?/g)].map((m) => m[0]);
          const totalToken = nums.at(-1);
          if (totalToken) {
            const negative = totalToken.includes("(") || totalToken.startsWith("-");
            etfFlow = (negative ? -1 : 1) * Number(totalToken.replace(/[(),]/g, ""));
          }
        }
      } catch {}

      let mvrv: number | null = null;
      let nupl: number | null = null;
      const metricRow = Array.isArray(metrics) ? metrics[0] : metrics?.data?.[0];
      if (metricRow) {
        const marketCap = Number(metricRow.CapMrktCurUSD || metricRow.CapMrktCurUSD?.toString());
        const realizedCap = Number(metricRow.CapRealUSD || metricRow.CapRealUSD?.toString());
        if (marketCap > 0 && realizedCap > 0) {
          mvrv = marketCap / realizedCap;
          nupl = (marketCap - realizedCap) / marketCap;
        }
      }

      const priceStructureScore =
        ema21 !== null && ema50 !== null
          ? price > ema21 && ema21 > ema50
            ? 90
            : price > ema21 || ema21 > ema50
              ? 65
              : 30
          : null;
      const momentumScore =
        rsi === null
          ? null
          : (rsi >= 55 && rsi <= 68) || (rsi >= 32 && rsi <= 45 && change1h < 0)
            ? 80
            : rsi >= 50
              ? 65
              : 40;
      const volumeRatio = k1h.length >= 21
        ? Number(k1h.at(-1)?.[5]) / (k1h.slice(-21, -1).reduce((sum, k) => sum + Number(k[5]), 0) / 20)
        : null;
      const volumeScore = volumeRatio === null ? null : Math.max(25, Math.min(95, 55 + (volumeRatio - 1) * 25));
      const derivativesScore = oiUsd === null && fundingRate === null
        ? null
        : Math.max(25, Math.min(90, 65 + (change1h >= 0 ? 12 : -10) - Math.min(Math.abs((fundingRate || 0) * 10000), 18)));
      const liquidationScore = atrPercent === null
        ? null
        : atrPercent <= 2 ? 85 : atrPercent <= 4 ? 65 : 40;
      const onchainScore = mvrv === null || nupl === null
        ? null
        : Math.max(20, Math.min(90, (mvrv >= 1 && mvrv <= 2.5 ? 80 : mvrv > 2.5 && mvrv < 3.5 ? 65 : mvrv >= 3.5 ? 35 : 55)) + (nupl > 0 && nupl < 0.5 ? 8 : nupl >= 0.5 ? -8 : 0));
      const etfScore = etfFlow === null ? null : etfFlow > 0 ? 85 : etfFlow < 0 ? 35 : 60;

      const weighted = [
        [20, priceStructureScore], [15, etfScore], [20, derivativesScore],
        [15, momentumScore], [10, volumeScore], [10, onchainScore], [10, liquidationScore],
      ] as Array<[number, number | null]>;
      const usable = weighted.filter(([, score]) => score !== null);
      const marketHealth = usable.length
        ? Math.round(usable.reduce((sum, [weight, score]) => sum + weight * (score || 0), 0) / usable.reduce((sum, [weight]) => sum + weight, 0))
        : 0;

      const marketCondition =
        change1h > 0.8 && price > (ema21 || price) ? "Bullish" :
        change1h < -0.8 && price < (ema21 || price) ? "Bearish" : "Range / Mixed";

      const sevenDayRange = closes1h.slice(-168);
      const low7 = sevenDayRange.length ? Math.min(...sevenDayRange) : price;
      const high7 = sevenDayRange.length ? Math.max(...sevenDayRange) : price;
      const rangePosition = high7 > low7 ? (price - low7) / (high7 - low7) : 0.5;
      const cycleScore = Math.round(Math.max(0, Math.min(100,
        25 + (change7d + 10) * 2 + (rangePosition * 35) + (rsi ?? 50) * 0.2
      )));
      const cycleStage = cycleScore < 25 ? "Accumulation" : cycleScore < 45 ? "Early Markup" : cycleScore < 70 ? "Markup" : cycleScore < 85 ? "Distribution Risk" : "Markdown";

      const notes = [
        `Price is ${marketCondition.toLowerCase()} on the current structure.`,
        `15m ${formatPct(change15m)} · 1h ${formatPct(change1h)} · 7d ${formatPct(change7d)}.`,
        `Support $${formatPrice(support)} · Resistance $${formatPrice(resistance)}.`,
        `Cycle is a technical proxy${mvrv === null ? " because on-chain data is unavailable" : " using current market/on-chain context"}.`,
      ];
      setSourceNote(`${mvrv === null ? "MVRV/NUPL unavailable" : "MVRV/NUPL loaded"} · ${etfFlow === null ? "ETF flow unavailable" : "ETF flow loaded"} · refreshed ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      setData({
        price, change24h: btcMarket.change24h, high24h: btcMarket.high24h, low24h: btcMarket.low24h, volume24h: btcMarket.quoteVolume24h,
        change15m, change1h, change7d, ema21, ema50, rsi, atrPercent, vwap, support, resistance,
        openInterestUsd: oiUsd, fundingRate, longLiquidationUsd: longLiquidationUsd || null, shortLiquidationUsd: shortLiquidationUsd || null,
        etfFlow, mvrv, nupl, marketHealth, marketCondition, cycleScore, cycleStage, updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "BTC report unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const d = data;
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">BTC INTELLIGENCE CENTER</p>
          <h1>BTC Report</h1>
          <p className="muted">Live structure, derivatives, on-chain context and cycle proxy.</p>
        </div>
        <div className="actions">
          <button className="glass-btn" onClick={() => onCoinClick("BTCUSDT")} type="button">Open chart <ChevronRight size={14} /></button>
          <button className="glass-btn" onClick={() => load(true)} disabled={refreshing} type="button"><RefreshCw size={14} /> {refreshing ? "Refreshing" : "Refresh"}</button>
        </div>
      </div>

      {error && <div className="glass-card" style={{ padding: "12px 14px", marginBottom: "14px", color: "#ff7180" }}>{error}</div>}
      {sourceNote && <p className="muted" style={{ margin: "0 0 12px", fontSize: "10px" }}>{sourceNote}</p>}

      <div className="stats-grid">
        <Card><span className="label">BTC PRICE</span><strong className="price">{loading || !d ? "—" : `$${formatPrice(d.price)}`}</strong><span className={d && d.change24h >= 0 ? "up" : "muted"}>{d ? formatPct(d.change24h) : "Loading..."}</span></Card>
        <Card><span className="label">MARKET HEALTH</span><strong>{d ? `${d.marketHealth}/100` : "—"}</strong><span className={d && d.marketHealth >= 65 ? "up" : "muted"}>{d ? d.marketCondition : "Loading"}</span></Card>
        <Card><span className="label">CYCLE SCORE</span><strong>{d ? d.cycleScore : "—"}</strong><span className="muted">{d ? d.cycleStage : "Loading"}</span></Card>
        <Card><span className="label">FUNDING</span><strong>{d?.fundingRate === null || d?.fundingRate === undefined ? "N/A" : `${(d.fundingRate * 100).toFixed(4)}%`}</strong><span className="muted">BTC perpetual</span></Card>
      </div>

      <div className="btc-layout" style={{ marginTop: "14px" }}>
        <Card className="chart-card">
          <div className="card-head"><div><span className="label">PRICE STRUCTURE</span><h2>BTC / USDT</h2></div><span className="muted">15m + 1h context</span></div>
          <CoinChart symbol="BTCUSDT" />
          <div className="report-grid" style={{ marginTop: "14px" }}>
            <div><span className="label">15M</span><h2>{d ? formatPct(d.change15m) : "—"}</h2></div>
            <div><span className="label">1H</span><h2>{d ? formatPct(d.change1h) : "—"}</h2></div>
            <div><span className="label">7D</span><h2>{d ? formatPct(d.change7d) : "—"}</h2></div>
          </div>
        </Card>

        <Card>
          <span className="label">KEY LEVELS</span>
          <div className="level-list">
            <div><span>Support</span><b className="mono">{d ? `$${formatPrice(d.support)}` : "—"}</b></div>
            <div><span>Resistance</span><b className="mono">{d ? `$${formatPrice(d.resistance)}` : "—"}</b></div>
            <div><span>EMA 21</span><b className="mono">{d?.ema21 === null ? "N/A" : d ? `$${formatPrice(d.ema21)}` : "—"}</b></div>
            <div><span>EMA 50</span><b className="mono">{d?.ema50 === null ? "N/A" : d ? `$${formatPrice(d.ema50)}` : "—"}</b></div>
            <div><span>RSI 14</span><b className="mono">{fmtMetric(d?.rsi ?? null, 1)}</b></div>
            <div><span>ATR</span><b className="mono">{fmtMetric(d?.atrPercent ?? null, 2, "%")}</b></div>
          </div>
        </Card>
      </div>

      <div className="stats-grid" style={{ marginTop: "14px" }}>
        <Card><span className="label">OPEN INTEREST</span><strong>{d?.openInterestUsd === null ? "N/A" : d ? formatCompactUsd(d.openInterestUsd) : "—"}</strong><span className="muted">Current BTC futures OI</span></Card>
        <Card><span className="label">LONG LIQUIDATIONS</span><strong>{d?.longLiquidationUsd === null ? "N/A" : d ? formatCompactUsd(d.longLiquidationUsd) : "—"}</strong><span className="muted">Recent force orders</span></Card>
        <Card><span className="label">SHORT LIQUIDATIONS</span><strong>{d?.shortLiquidationUsd === null ? "N/A" : d ? formatCompactUsd(d.shortLiquidationUsd) : "—"}</strong><span className="muted">Recent force orders</span></Card>
        <Card><span className="label">ETF NET FLOW</span><strong>{d?.etfFlow === null ? "N/A" : d ? `${d.etfFlow >= 0 ? "+" : ""}$${d.etfFlow.toFixed(1)}M` : "—"}</strong><span className="muted">Latest published day</span></Card>
      </div>

      <div className="two-col" style={{ marginTop: "14px" }}>
        <Card>
          <div className="card-head"><div><span className="label">ON-CHAIN</span><h2>MVRV / NUPL</h2></div><span className="muted">Live where public data is available</span></div>
          <div className="report-grid">
            <div><span className="label">MVRV</span><h2>{fmtMetric(d?.mvrv ?? null, 2)}</h2></div>
            <div><span className="label">NUPL</span><h2>{fmtMetric(d?.nupl ?? null, 3)}</h2></div>
            <div><span className="label">24H RANGE</span><h2>{d ? `$${formatPrice(d.low24h)} — $${formatPrice(d.high24h)}` : "—"}</h2></div>
          </div>
        </Card>
        <Card>
          <span className="label">KEY TAKEAWAYS</span>
          {d ? <div style={{ display: "grid", gap: "8px", marginTop: "8px" }}>
            <p className="muted" style={{ margin: 0 }}>• Market condition: <b>{d.marketCondition}</b> with health score <b>{d.marketHealth}/100</b>.</p>
            <p className="muted" style={{ margin: 0 }}>• 15m {formatPct(d.change15m)} · 1h {formatPct(d.change1h)} · 7d {formatPct(d.change7d)}.</p>
            <p className="muted" style={{ margin: 0 }}>• Key range: support <b>${formatPrice(d.support)}</b> / resistance <b>${formatPrice(d.resistance)}</b>.</p>
            <p className="muted" style={{ margin: 0 }}>• Cycle stage: <b>{d.cycleStage}</b> (technical proxy, not a guaranteed market-cycle label).</p>
          </div> : <p className="muted">Loading report…</p>}
        </Card>
      </div>
    </div>
  );
}

function Portfolio({ user }: { user: User }) {
  type Holding = {
    id: string;
    symbol: string;
    quantity: number;
    entryPrice: number;
    invested: number;
    plan: string;
    notes: string;
    createdAt: string;
  };

  const [holdings, setHoldings] = useState<Holding[]>(() => {
    const raw = user.user_metadata?.predator_portfolio;
    return Array.isArray(raw) ? raw : [];
  });
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [marketSymbols, setMarketSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [quantity, setQuantity] = useState(0);
  const [entryPrice, setEntryPrice] = useState(0);
  const [invested, setInvested] = useState(0);
  const [plan, setPlan] = useState("Scalp");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      try {
        const auth = supabase.auth as any;
        const result = await auth.getUser();
        const latest = result?.data?.user?.user_metadata?.predator_portfolio;
        if (active && Array.isArray(latest)) setHoldings(latest);
      } catch {}
    })();
    return () => { active = false; };
  }, [user.id]);

  const refreshPrices = async () => {
    setLoading(true);
    try {
      const market = await fetchJsonWithFallback<MarketResponse>([`/api/market?ts=${Date.now()}`]);
      const next: Record<string, number> = {};
      const symbols = new Set<string>();
      for (const item of market.markets || []) {
        next[item.symbol] = item.price;
        symbols.add(item.symbol);
      }
      if (market.btc) {
        next["BTCUSDT"] = market.btc.price;
        symbols.add("BTCUSDT");
      }
      for (const holding of holdings) {
        if (!next[holding.symbol]) {
          try {
            const ticker = await fetchJsonWithFallback<{ price: string }>([
              `https://data-api.binance.vision/api/v3/ticker/price?symbol=${encodeURIComponent(holding.symbol)}`,
              `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(holding.symbol)}`,
            ]);
            next[holding.symbol] = Number(ticker.price);
            symbols.add(holding.symbol);
          } catch {}
        }
      }
      setPrices(next);
      setMarketSymbols([...symbols].sort());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not refresh prices");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshPrices();
    const timer = window.setInterval(refreshPrices, 30000);
    return () => window.clearInterval(timer);
  }, [holdings.length]);

  const saveToSupabase = async (next: Holding[]) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const auth = supabase.auth as any;
    const result = await auth.updateUser({ data: { predator_portfolio: next } });
    if (result.error) throw result.error;
  };

  const resetForm = () => {
    setEditingId(null); setSymbol("BTCUSDT"); setQuantity(0); setEntryPrice(0); setInvested(0); setPlan("Scalp"); setNotes("");
  };

  const startEdit = (h: Holding) => {
    setEditingId(h.id); setSymbol(h.symbol); setQuantity(h.quantity); setEntryPrice(h.entryPrice); setInvested(h.invested); setPlan(h.plan); setNotes(h.notes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveHolding = async () => {
    const cleanSymbol = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    const finalSymbol = cleanSymbol.endsWith("USDT") ? cleanSymbol : `${cleanSymbol}USDT`;
    if (!finalSymbol || quantity <= 0 || entryPrice <= 0 || invested <= 0) {
      setMessage("Coin, Quantity, Entry and Investment must be greater than 0.");
      return;
    }
    const item: Holding = {
      id: editingId || crypto.randomUUID(),
      symbol: finalSymbol,
      quantity,
      entryPrice,
      invested,
      plan: plan.trim() || "Scalp",
      notes: notes.trim(),
      createdAt: editingId ? (holdings.find((h) => h.id === editingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    };
    const next = editingId ? holdings.map((h) => h.id === editingId ? item : h) : [item, ...holdings];
    setSaving(true); setMessage("");
    try {
      await saveToSupabase(next);
      setHoldings(next);
      setMessage(editingId ? "Position updated." : "Position saved.");
      resetForm();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save position");
    } finally { setSaving(false); }
  };

  const deleteHolding = async (id: string) => {
    if (!window.confirm("Delete this portfolio position?")) return;
    const next = holdings.filter((h) => h.id !== id);
    setSaving(true); setMessage("");
    try { await saveToSupabase(next); setHoldings(next); setMessage("Position deleted."); if (editingId === id) resetForm(); }
    catch (err) { setMessage(err instanceof Error ? err.message : "Could not delete position"); }
    finally { setSaving(false); }
  };

  const calcInvestment = () => setInvested(quantity * entryPrice);
  const calcQuantity = () => entryPrice > 0 ? setQuantity(invested / entryPrice) : setMessage("Enter Entry price first.");
  const calcEntry = () => quantity > 0 ? setEntryPrice(invested / quantity) : setMessage("Enter Quantity first.");

  const investedTotal = holdings.reduce((sum, h) => sum + h.invested, 0);
  const currentTotal = holdings.reduce((sum, h) => sum + h.quantity * (prices[h.symbol] || h.entryPrice), 0);
  const pnl = currentTotal - investedTotal;
  const pnlPct = investedTotal > 0 ? pnl / investedTotal * 100 : 0;

  return (
    <div className="page">
      <div className="page-head"><div><p className="eyebrow">INVESTMENTS</p><h1>Portfolio</h1><p className="muted">Live USD portfolio with Supabase persistence.</p></div><button className="glass-btn" onClick={refreshPrices} disabled={loading}><RefreshCw size={14} /> {loading ? "Refreshing" : "Refresh prices"}</button></div>

      <div className="stats-grid">
        <Card><span className="label">INVESTED</span><strong>${investedTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></Card>
        <Card><span className="label">CURRENT VALUE</span><strong>${currentTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></Card>
        <Card><span className="label">P&amp;L</span><strong className={pnl >= 0 ? "up" : "muted"}>{pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toFixed(2)}</strong><span className="muted">{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</span></Card>
        <Card><span className="label">COINS</span><strong>{holdings.length}</strong><span className="muted">Live priced</span></Card>
      </div>

      <Card style={{ marginTop: "14px" }}>
        <div className="card-head"><div><span className="label">{editingId ? "EDIT POSITION" : "ADD POSITION"}</span><h2>{editingId ? "Update holding" : "New holding"}</h2></div></div>
        <div className="form-grid">
          <label>Coin<input list="portfolio-coins" value={symbol.replace("USDT","")} onChange={(e: ChangeEvent<HTMLInputElement>)=>setSymbol(e.target.value)} placeholder="BTC" /><datalist id="portfolio-coins">{marketSymbols.map((s)=><option key={s} value={s.replace("USDT","")} />)}</datalist></label>
          <label>Quantity<input type="number" min="0" step="any" value={quantity || ""} onChange={(e: ChangeEvent<HTMLInputElement>)=>setQuantity(Number(e.target.value)||0)} /></label>
          <label>Entry price <span className="muted">USD</span><input type="number" min="0" step="any" value={entryPrice || ""} onChange={(e: ChangeEvent<HTMLInputElement>)=>setEntryPrice(Number(e.target.value)||0)} /></label>
          <label>Total investment <span className="muted">USD</span><input type="number" min="0" step="any" value={invested || ""} onChange={(e: ChangeEvent<HTMLInputElement>)=>setInvested(Number(e.target.value)||0)} /></label>
          <label>Plan<input value={plan} onChange={(e: ChangeEvent<HTMLInputElement>)=>setPlan(e.target.value)} placeholder="Scalp / Swing / Long-term" /></label>
          <label>Notes<input value={notes} onChange={(e: ChangeEvent<HTMLInputElement>)=>setNotes(e.target.value)} placeholder="Why / thesis / risk" /></label>
        </div>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginTop:"10px" }}>
          <button className="chip" type="button" onClick={calcInvestment}>Auto-calc Investment</button>
          <button className="chip" type="button" onClick={calcQuantity}>Auto-calc Quantity</button>
          <button className="chip" type="button" onClick={calcEntry}>Auto-calc Entry</button>
          <button className="glass-btn" type="button" onClick={saveHolding} disabled={saving}>{saving ? "Saving..." : editingId ? "Update position" : "Add position"}</button>
          {editingId && <button className="chip" type="button" onClick={resetForm}>Cancel</button>}
        </div>
        {message && <p className="muted" style={{ marginTop:"10px" }}>{message}</p>}
      </Card>

      <Card style={{ marginTop:"14px" }}>
        <div className="card-head"><div><span className="label">HOLDINGS</span><h2>Live positions</h2></div><span className="muted">Current prices update every 30s</span></div>
        {holdings.length === 0 ? <div className="muted" style={{ padding:"24px 0" }}>No holdings yet. Add your first position above.</div> : (
          <div className="table-wrap"><table><thead><tr><th>COIN</th><th>QTY</th><th>ENTRY</th><th>INVESTED</th><th>CURRENT</th><th>P&amp;L</th><th>PLAN</th><th></th></tr></thead><tbody>
            {holdings.map((h)=>{const current=prices[h.symbol] || h.entryPrice; const value=h.quantity*current; const hpnl=value-h.invested; return <tr key={h.id}><td><b>{h.symbol.replace("USDT","/USDT")}</b></td><td className="mono">{h.quantity.toLocaleString(undefined,{maximumFractionDigits:8})}</td><td className="mono">${formatPrice(h.entryPrice)}</td><td className="mono">${h.invested.toFixed(2)}</td><td className="mono">${value.toFixed(2)}</td><td className={hpnl>=0?"up":"muted"}>{hpnl>=0?"+":"-"}${Math.abs(hpnl).toFixed(2)}</td><td>{h.plan}</td><td><button className="chip" type="button" onClick={()=>startEdit(h)}>Edit</button> <button className="chip" type="button" onClick={()=>deleteHolding(h.id)}>Delete</button></td></tr>})}
          </tbody></table></div>
        )}
      </Card>
    </div>
  );
}

function CalculatorPage() {
  const [main, setMain] = useState(100);
  const [percent, setPercent] = useState(10);
  const [expression, setExpression] = useState("");
  const [display, setDisplay] = useState("0");
  const [from, setFrom] = useState("EUR");
  const [to, setTo] = useState("USD");
  const [amount, setAmount] = useState(100);
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);

  const formatCalculatorDisplay = (value: string) => {
    if (value === "Error") return value;
    const raw = value.replace(/,/g, "");
    if (!raw || raw === "-") return raw || "0";
    const parts = raw.split(".");
    const sign = parts[0].startsWith("-") ? "-" : "";
    const integer = parts[0].replace(/^-/, "");
    const formattedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",") || "0";
    return sign + formattedInteger + (parts.length > 1 ? `.${parts[1]}` : "");
  };

  const evaluateExpression = (value: string) => {
    const sanitized = value.replace(/×/g, "*").replace(/÷/g, "/").replace(/,/g, "");
    if (!sanitized || !/^[0-9+\-*/%.() ]+$/.test(sanitized)) return null;
    try {
      const result = Function(`"use strict"; return (${sanitized || "0"})`)();
      const numeric = Number(result);
      return Number.isFinite(numeric) ? String(Number(numeric.toFixed(12))) : null;
    } catch {
      return null;
    }
  };

  const pushCalc = (key: string) => {
    if (key === "AC") {
      setExpression("");
      setDisplay("0");
      setJustEvaluated(false);
      return;
    }

    if (key === "⌫") {
      if (justEvaluated) {
        setExpression("");
        setDisplay("0");
        setJustEvaluated(false);
        return;
      }
      const next = expression.slice(0, -1);
      setExpression(next);
      setDisplay(next || "0");
      return;
    }

    if (key === "=") {
      const result = evaluateExpression(expression);
      if (result === null) {
        setDisplay("Error");
        setExpression("");
      } else {
        setDisplay(result);
        setExpression(result);
        setJustEvaluated(true);
      }
      return;
    }

    if (key === "%") {
      const current = evaluateExpression(expression);
      if (current !== null) {
        const next = String(Number((Number(current) / 100).toFixed(12)));
        setExpression(next);
        setDisplay(next);
        setJustEvaluated(false);
      }
      return;
    }

    const isOperator = ["+", "-", "×", "÷"].includes(key);
    if (justEvaluated && !isOperator) {
      const next = key === "." ? "0." : key;
      setExpression(next);
      setDisplay(next);
      setJustEvaluated(false);
      return;
    }

    if (isOperator) {
      const trimmed = expression.replace(/[+\-×÷]+$/, "");
      const next = `${trimmed}${key}`;
      setExpression(next);
      setDisplay(next || "0");
      setJustEvaluated(false);
      return;
    }

    if (key === ".") {
      const currentNumber = expression.split(/[+\-×÷]/).pop() || "";
      if (currentNumber.includes(".")) return;
      if (!expression || isOperator && expression.endsWith(key)) return;
    }

    const next = expression === "0" ? key : expression + key;
    setExpression(next);
    setDisplay(next);
    setJustEvaluated(false);
  };

  useEffect(() => {
    let active = true;
    const loadRate = async () => {
      setRateLoading(true);
      setRateError("");
      try {
        const payload = await fetchJsonWithFallback<{ rates?: Record<string, number> }>([
          `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`,
        ]);
        const nextRate = payload.rates?.[to];
        if (!Number.isFinite(nextRate)) throw new Error("Rate unavailable");
        if (active) setRate(Number(nextRate));
      } catch (err) {
        if (active) {
          setRate(null);
          setRateError(err instanceof Error ? err.message : "Rate unavailable");
        }
      } finally {
        if (active) setRateLoading(false);
      }
    };
    loadRate();
    return () => {
      active = false;
    };
  }, [from, to]);

  const converted = rate === null ? null : amount * rate;
  const percentageResult = main * percent / 100;
  const calcKeys = [
    ["AC", "⌫", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    ["0", ".", "(", ")"],
    ["="],
  ];

  const keyStyle = (key: string): CSSProperties => {
    const operator = ["÷", "×", "-", "+", "="].includes(key);
    const utility = ["AC", "⌫", "%"].includes(key);
    return {
      minHeight: "58px",
      borderRadius: "12px",
      border: "1px solid rgba(255,255,255,0.08)",
      background: operator ? "rgba(255,60,80,0.16)" : utility ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.045)",
      color: operator ? "#ff6678" : "#ededed",
      fontSize: "19px",
      fontWeight: 700,
      cursor: "pointer",
      transition: "transform 100ms ease, background 120ms ease",
    };
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Calculator</h1>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.25fr) minmax(300px, 0.75fr)",
          gap: "16px",
          alignItems: "start",
        }}
      >
        <Card>
          <div style={{ maxWidth: "560px", margin: "0 auto" }}>
            <div
              className="mono"
              style={{
                minHeight: "88px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "flex-end",
                overflow: "auto",
                whiteSpace: "nowrap",
                padding: "6px 4px 14px",
                fontSize: display.length > 13 ? "32px" : "46px",
                lineHeight: 1,
                color: "#f2f2f2",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
              aria-live="polite"
            >
              {formatCalculatorDisplay(display)}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: "9px",
                marginTop: "12px",
              }}
            >
              {calcKeys.slice(0, 5).flat().map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  className="calculator-key"
                  style={keyStyle(key)}
                  onClick={() => pushCalc(key)}
                  onMouseDown={(event: MouseEvent<HTMLButtonElement>) => {
                    event.currentTarget.style.transform = "scale(0.98)";
                  }}
                  onMouseUp={(event: MouseEvent<HTMLButtonElement>) => {
                    event.currentTarget.style.transform = "scale(1)";
                  }}
                  onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => {
                    event.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  {key}
                </button>
              ))}
              <button
                type="button"
                aria-label="equals"
                className="glass-btn"
                style={{ minHeight: "58px", borderRadius: "12px", justifyContent: "center", fontSize: "19px", fontWeight: 700 }}
                onClick={() => pushCalc("=")}
              >
                =
              </button>
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gap: "14px" }}>
          <Card>
            <div className="card-head"><h2>Percentage</h2></div>
            <div className="form-grid">
              <label>Main<input type="number" value={main} onChange={(e: ChangeEvent<HTMLInputElement>) => setMain(Number(e.target.value) || 0)} /></label>
              <label>%<input type="number" value={percent} onChange={(e: ChangeEvent<HTMLInputElement>) => setPercent(Number(e.target.value) || 0)} /></label>
            </div>
            <div className="result mono" style={{ fontSize: "28px", marginTop: "10px" }}>{percentageResult.toFixed(2)}</div>
          </Card>

          <Card>
            <div className="card-head">
              <h2>Currency</h2>
              <span className="muted">{rateLoading ? "Updating…" : "Live"}</span>
            </div>
            <div className="form-grid">
              <label>Amount<input type="number" value={amount} onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(Number(e.target.value) || 0)} /></label>
              <label>From<select value={from} onChange={(e: ChangeEvent<HTMLSelectElement>) => setFrom(e.target.value)}><option>EUR</option><option>USD</option><option>BDT</option></select></label>
              <label>To<select value={to} onChange={(e: ChangeEvent<HTMLSelectElement>) => setTo(e.target.value)}><option>USD</option><option>EUR</option><option>BDT</option></select></label>
            </div>
            <div className="result mono" style={{ fontSize: "24px", marginTop: "10px" }}>
              {converted === null ? (rateError || "N/A") : `${converted.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${to}`}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
function CoinDetails({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const title = symbol.replace("USDT", "/USDT");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        padding: "18px",
        background: "rgba(0,0,0,.82)",
        backdropFilter: "blur(14px)",
        overflow: "auto",
      }}
    >
      <div
        className="glass-card"
        style={{
          minHeight: "calc(100vh - 36px)",
          maxWidth: "1500px",
          margin: "0 auto",
          background: "rgba(7,7,7,.94)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <div>
            <p className="eyebrow">COIN INTELLIGENCE</p>
            <h1>{title}</h1>
            <p className="muted">Interactive price chart</p>
          </div>

          <button
            className="glass-btn"
            onClick={onClose}
            aria-label={`Close ${title} chart`}
          >
            <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} />
            Back
          </button>
        </div>

        <CoinChart symbol={symbol} />
      </div>
    </div>
  );
}

function SettingsPage({ user, onLogout, onProfileNameChange }: { user: User; onLogout: () => void; onProfileNameChange: (name: string) => void }) {
  const displayNameFromAuth = getDisplayName(user);
  const [name, setName] = useState(displayNameFromAuth);
  const [email, setEmail] = useState(user.email || "");
  const [experience, setExperience] = useState("Beginner");
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("predator-theme");
    return saved !== "light";
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [status, setStatus] = useState("");
  const provider = user.app_metadata?.provider || "email";
  const avatar = getAvatar(user);
  const identities = user.identities || [];
  const discordConnected = identities.some((identity: any) => identity.provider === "discord") || provider === "discord";

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("predator-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase.from("profiles").select("display_name, trading_experience").eq("id", user.id).maybeSingle();
      if (!mounted) return;
      if (error) setStatus(error.message);
      else { setName(data?.display_name || displayNameFromAuth); setExperience(data?.trading_experience || "Beginner"); }
      setLoading(false);
    };
    loadProfile();
    return () => { mounted = false; };
  }, [user.id, displayNameFromAuth]);

  const saveProfile = async () => {
    if (!supabase) { setStatus("Supabase is not configured."); return; }
    const cleanName = name.trim();
    if (!cleanName) { setStatus("Name cannot be empty."); return; }
    setSaving(true); setStatus("");
    try {
      const { error } = await supabase.from("profiles").update({ display_name: cleanName, trading_experience: experience, updated_at: new Date().toISOString() }).eq("id", user.id);
      if (error) throw error;
      const auth = supabase.auth as any;
      const authResult = await auth.updateUser({ data: { full_name: cleanName, name: cleanName } });
      if (authResult?.error) throw authResult.error;
      onProfileNameChange(cleanName);
      setStatus("Profile saved successfully.");
    } catch (err) { setStatus(err instanceof Error ? err.message : "Could not save profile"); }
    finally { setSaving(false); }
  };

  const updateEmail = async () => {
    if (!supabase) return;
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || cleanEmail === (user.email || "").toLowerCase()) { setStatus("Enter a new email address first."); return; }
    setSaving(true); setStatus("");
    try {
      const auth = supabase.auth as any;
      const result = await auth.updateUser({ email: cleanEmail });
      if (result.error) throw result.error;
      setStatus("Email update requested. Check the confirmation email.");
    } catch (err) { setStatus(err instanceof Error ? err.message : "Could not update email"); }
    finally { setSaving(false); }
  };

  const connectDiscord = async () => {
    if (!supabase) return;
    setIdentityLoading(true); setStatus("");
    try {
      const auth = supabase.auth as any;
      const result = await auth.linkIdentity({ provider: "discord", options: { redirectTo: `${window.location.origin}/auth/callback` } });
      if (result?.error) throw result.error;
      setStatus("Discord connection started. Complete the OAuth window to finish linking.");
    } catch (err) { setStatus(err instanceof Error ? err.message : "Could not connect Discord"); }
    finally { setIdentityLoading(false); }
  };

  const disconnectDiscord = async () => {
    if (!supabase) return;
    const auth = supabase.auth as any;
    if (!window.confirm("Disconnect Discord from this account?")) return;
    setIdentityLoading(true); setStatus("");
    try {
      const result = await auth.getUserIdentities();
      if (result?.error) throw result.error;
      const discordIdentity = (result.identities || []).find((x: any) => x.provider === "discord");
      if (!discordIdentity) throw new Error("Discord identity not found.");
      if ((result.identities || []).length <= 1) throw new Error("Add another login method before disconnecting the only identity.");
      const unlink = await auth.unlinkIdentity(discordIdentity);
      if (unlink?.error) throw unlink.error;
      setStatus("Discord disconnected.");
    } catch (err) { setStatus(err instanceof Error ? err.message : "Could not disconnect Discord"); }
    finally { setIdentityLoading(false); }
  };

  const deleteAccount = async () => {
    if (!supabase) return;
    if (!window.confirm("This will permanently delete the account when the secure delete_user database function is configured. Continue?")) return;
    setSaving(true); setStatus("");
    try {
      const auth = supabase.auth as any;
      const result = await supabase.rpc("delete_user");
      if (result.error) throw result.error;
      await auth.signOut();
    } catch (err) {
      setStatus(err instanceof Error ? `Account deletion is not enabled yet: ${err.message}` : "Account deletion is not enabled yet.");
    } finally { setSaving(false); }
  };

  return (
    <div className="page">
      <div className="page-head"><div><p className="eyebrow">ACCOUNT</p><h1>Settings</h1><p className="muted">Profile, login identities, theme and security.</p></div></div>
      <div className="two-col">
        <Card>
          <span className="label">PROFILE</span><h2>Account details</h2>
          <div className="account-profile">
            {avatar ? <img src={avatar} alt={name} className="account-avatar" /> : <div className="account-avatar-fallback">{name.slice(0,1).toUpperCase()}</div>}
            <div><strong>{name}</strong><p className="muted">{provider === "discord" ? "Discord account" : "Email account"}</p></div>
          </div>
          <div className="form-grid">
            <label>Name<input value={name} onChange={(e: ChangeEvent<HTMLInputElement>)=>setName(e.target.value)} disabled={loading || saving} /></label>
            <label>Email<input value={email} onChange={(e: ChangeEvent<HTMLInputElement>)=>setEmail(e.target.value)} disabled={loading || saving} /></label>
            <label>Trading experience<select value={experience} onChange={(e: ChangeEvent<HTMLSelectElement>)=>setExperience(e.target.value)} disabled={loading || saving}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
            <label>Provider<input value={provider} disabled readOnly /></label>
          </div>
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}><button className="glass-btn" onClick={saveProfile} disabled={loading || saving}>{saving ? "Saving..." : "Save profile"}</button><button className="chip" onClick={updateEmail} disabled={loading || saving}>Update email</button></div>
        </Card>

        <Card>
          <span className="label">IDENTITIES</span><h2>Discord</h2>
          <p className="muted">{discordConnected ? "Discord is connected to this account." : "Discord is not linked to this account."}</p>
          {discordConnected ? <button className="chip" onClick={disconnectDiscord} disabled={identityLoading}>{identityLoading ? "Working..." : "Disconnect Discord"}</button> : <button className="glass-btn" onClick={connectDiscord} disabled={identityLoading}>{identityLoading ? "Working..." : "Connect Discord"}</button>}
          <div className="setting-row" style={{ marginTop:"18px" }}><span>Theme</span><button className="icon-btn" onClick={()=>setDark((v: boolean)=>!v)} type="button" aria-label="Toggle theme">{dark ? <Moon size={17}/> : <Sun size={17}/>}</button></div>
          <div className="setting-row"><span>Session alerts</span><button className="chip" type="button" onClick={()=>{const next=localStorage.getItem("predator-alerts") !== "on"; localStorage.setItem("predator-alerts", next?"on":"off"); setStatus(`Session alerts ${next ? "enabled" : "disabled"}.`)}}>Toggle</button></div>
          <button className="glass-btn logout-btn" onClick={onLogout}><LogOut size={16}/> Logout</button>
          <button className="danger" type="button" onClick={deleteAccount} disabled={saving}>Delete account</button>
        </Card>
      </div>
      {status && <p className="muted" style={{ marginTop:"12px" }}>{status}</p>}
    </div>
  );
}

function ThemeToggle(){const [dark,setDark]=useState(true);useEffect(()=>{const saved=typeof window!=="undefined"?localStorage.getItem("predator-theme"):null;const next=saved? saved==="dark" : true;setDark(next);document.documentElement.dataset.theme=next?"dark":"light"},[]);useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";if(typeof window!=="undefined")localStorage.setItem("predator-theme",dark?"dark":"light")},[dark]);return <button className="icon-btn" onClick={()=>setDark((v: boolean)=>!v)}>{dark?<Moon size={17}/>:<Sun size={17}/>}</button>}

const TAB_HASH: Record<Tab, string> = {
  "Dashboard": "dashboard",
  "Signal": "signal",
  "Volume Spike": "volume-spike",
  "BTC Report": "btc-report",
  "Portfolio": "portfolio",
  "Calculator": "calculator",
  "Settings": "settings",
};

function tabFromHash(hash: string): Tab {
  const normalized = hash.replace(/^#/, "").toLowerCase();
  const match = (Object.entries(TAB_HASH) as Array<[Tab, string]>).find(([, value]) => value === normalized);
  return match?.[0] ?? "Dashboard";
}

export default function PredatorApp({ user }: { user: User }){
  const [tab,setTab]=useState<Tab>(() =>
    typeof window === "undefined" ? "Dashboard" : tabFromHash(window.location.hash),
  );
  const [collapsed,setCollapsed]=useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(() => getDisplayName(user));
  const [navigationBusy, setNavigationBusy] = useState(false);
  const navigationTimer = useRef<number | null>(null);
  const displayName = profileName;
  const avatar = getAvatar(user);

  const clearNavigationTimer = useCallback(() => {
    if (navigationTimer.current !== null) {
      window.clearTimeout(navigationTimer.current);
      navigationTimer.current = null;
    }
  }, []);

  const navigateTo = useCallback((nextTab: Tab, options?: { replace?: boolean }) => {
    if (nextTab === tab) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("predator-last-tab", nextTab);
      }
      return;
    }

    clearNavigationTimer();
    setNavigationBusy(true);

    navigationTimer.current = window.setTimeout(() => {
      setTab(nextTab);

      if (typeof window !== "undefined") {
        const nextHash = `#${TAB_HASH[nextTab]}`;
        const method = options?.replace ? "replaceState" : "pushState";
        window.history[method]({ tab: nextTab }, "", nextHash);
        window.sessionStorage.setItem("predator-last-tab", nextTab);
      }

      navigationTimer.current = window.setTimeout(() => {
        setNavigationBusy(false);
        navigationTimer.current = null;
      }, 180);
    }, 85);
  }, [clearNavigationTimer, tab]);

  useEffect(() => {
    const onPopState = () => {
      const nextTab = tabFromHash(window.location.hash);
      clearNavigationTimer();
      setNavigationBusy(true);
      window.setTimeout(() => {
        setTab(nextTab);
        window.sessionStorage.setItem("predator-last-tab", nextTab);
        window.setTimeout(() => setNavigationBusy(false), 180);
      }, 70);
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      clearNavigationTimer();
    };
  }, [clearNavigationTimer]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("predator-last-tab", tab);
    if (!window.location.hash) {
      window.history.replaceState({ tab }, "", `#${TAB_HASH[tab]}`);
    }
  }, [tab]);

  useEffect(() => {
    // Subtle press/hover feedback for all interactive buttons and the home logo.
    // This is intentionally global so existing buttons across every tab feel consistent.
    const root = document.querySelector(".app");
    if (!root) return;

    const onPointerDown = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const control = target?.closest("button, .logo-link") as HTMLElement | null;
      if (!control || (control instanceof HTMLButtonElement && control.disabled)) return;
      control.classList.add("predator-press");
    };

    const onPointerUp = () => {
      root.querySelectorAll(".predator-press").forEach((node) => node.classList.remove("predator-press"));
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerUp);
    root.addEventListener("pointerleave", onPointerUp, true);

    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerUp);
      root.removeEventListener("pointerleave", onPointerUp, true);
    };
  }, []);

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const openCoin = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
  }, []);

  const content=useMemo(()=>{switch(tab){case"Dashboard":return <Dashboard go={navigateTo} onCoinClick={openCoin}/>;case"Signal":return <Signals user={user} onCoinClick={openCoin}/>;case"Volume Spike":return <VolumeSpike onCoinClick={openCoin}/>;case"BTC Report":return <BTCReport onCoinClick={openCoin}/>;case"Portfolio":return <Portfolio user={user}/>;case"Calculator":return <CalculatorPage/>;case"Settings":return <SettingsPage user={user} onLogout={logout} onProfileNameChange={setProfileName}/>;default:return <Dashboard go={navigateTo} onCoinClick={openCoin}/>}},[navigateTo, openCoin, tab, user]);

  return <div className={"app "+(collapsed?"collapsed":"")}>
    <style>{`
      .app button, .app .logo-link {
        transition: transform 170ms cubic-bezier(.2,.8,.2,1), filter 170ms ease, opacity 170ms ease, box-shadow 170ms ease, background-color 170ms ease, border-color 170ms ease;
        will-change: transform;
      }
      .app button:not(:disabled):hover, .app .logo-link:hover {
        filter: brightness(1.06);
      }
      .app button.predator-press, .app .logo-link.predator-press {
        transform: translateY(1px) scale(.975);
        filter: brightness(.96);
      }
      .predator-page-frame {
        animation: predatorPageIn 280ms cubic-bezier(.22,.61,.36,1) both;
        transform-origin: top center;
      }
      .predator-content-wrap {
        position: relative;
        transition: opacity 180ms ease, transform 220ms ease, filter 180ms ease;
      }
      .predator-content-wrap.is-transitioning {
        opacity: .56;
        transform: translateY(4px) scale(.998);
        filter: blur(.2px);
      }
      .predator-route-indicator {
        position: fixed;
        top: 0;
        left: 50%;
        width: 110px;
        height: 2px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, rgba(255,72,92,.95), transparent);
        box-shadow: 0 0 16px rgba(255,72,92,.35);
        animation: predatorRoutePulse 1s ease-in-out infinite;
        z-index: 9999;
        pointer-events: none;
      }
      @keyframes predatorPageIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes predatorRoutePulse {
        0%, 100% { opacity: .35; width: 80px; }
        50% { opacity: 1; width: 150px; }
      }
      .signal-card-grid { width: 100%; }
      @media (max-width: 1180px) {
        .signal-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
      }
      @media (max-width: 700px) {
        .signal-card-grid { grid-template-columns: 1fr !important; }
      }
      @media (prefers-reduced-motion: reduce) {
        .app button, .app .logo-link, .predator-content-wrap, .predator-page-frame, .predator-route-indicator {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
    {navigationBusy ? <div className="predator-route-indicator" aria-hidden="true" /> : null}
    <aside className="sidebar"><div onClick={()=>navigateTo("Dashboard")} className="logo-link" role="button" tabIndex={0}><Logo/></div><nav>{tabs.map(({name,icon:Icon})=><button key={name} className={tab===name?"nav-item active":"nav-item"} onClick={()=>navigateTo(name)}><Icon size={18}/><span>{name}</span></button>)}</nav><div className="side-bottom"><div className="user-mini">{avatar ? <img src={avatar} alt={displayName} className="mini-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<div><b>{displayName}</b><span>{user.email || "Authenticated user"}</span></div></div></div></aside>
    <main><header className="topbar"><button className="icon-btn" onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={18}/></button><SessionBar/><div className="top-actions"><div className="profile">{avatar ? <img src={avatar} alt={displayName} className="top-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<span>{displayName}</span></div><ThemeToggle/></div></header><div className={"content predator-content-wrap "+(navigationBusy?"is-transitioning":"")}><div key={tab} className="predator-page-frame">{content}</div></div></main>{selectedSymbol ? <CoinDetails symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} /> : null}
  </div>
}
