 "use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode, CSSProperties, ChangeEvent, MouseEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity, BarChart3, Bell, BrainCircuit, Calculator as CalculatorIcon, ChevronRight, Clock3,
  Gauge, LayoutDashboard, Layers3, LogOut, Moon, Newspaper, PanelLeft, RefreshCw, Settings,
  ShieldAlert, SlidersHorizontal, Sun, Target, TrendingDown, TrendingUp, Wallet, Zap, Plus, Trash2, Search, CircleDollarSign, Info, X, Check, MoreHorizontal
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import CoinChart from "@/components/CoinChart";

type Tab = "Dashboard"|"Signal"|"Volume Spike"|"BTC Report"|"Watchlist"|"Portfolio"|"Calculator"|"Settings";

const tabs: {name: Tab; icon: ComponentType<{size?:number; strokeWidth?:number}>}[] = [
  {name:"Dashboard",icon:LayoutDashboard},
  {name:"Signal",icon:Zap},
  {name:"Volume Spike",icon:BarChart3},
  {name:"BTC Report",icon:Newspaper},
  {name:"Watchlist",icon:Search},
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

  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes() + now.getUTCSeconds() / 60;
  const sessions = [
    { name: "ASIA", start: 0, end: 8 * 60, color: "asia", range: "00–08" },
    { name: "LONDON", start: 8 * 60, end: 16 * 60, color: "london", range: "08–16" },
    { name: "NEW YORK", start: 16 * 60, end: 24 * 60, color: "newyork", range: "16–24" },
  ];
  const active = sessions.find((item) => minutes >= item.start && minutes < item.end) ?? sessions[sessions.length - 1];
  const activeProgress = Math.max(0, Math.min(100, ((minutes - active.start) / (active.end - active.start)) * 100));
  const remainingMinutes = Math.max(0, active.end - minutes);
  const remainingHours = Math.floor(remainingMinutes / 60);
  const remainingMins = Math.floor(remainingMinutes % 60);

  return <div className="sessionbar">
    <div className="session-live-box">
      <span className={`session-live-dot session-dot-${active.color}`} />
      <div>
        <small>ACTIVE SESSION</small>
        <strong>{active.name}</strong>
      </div>
      <span className="session-live-chip">LIVE</span>
    </div>

    <div className="sessions">
      {sessions.map((item) => {
        const isActive = item.name === active.name;
        const isPast = item.end <= minutes && !isActive;
        const progress = isActive ? activeProgress : isPast ? 100 : 0;
        return (
          <div key={item.name} className={`session session-${item.color} ${isActive ? "active" : ""} ${isPast ? "past" : ""}`}>
            <div className="session-meta">
              <span>{item.name}</span>
              <small>{isActive ? `${Math.round(activeProgress)}%` : item.range}</small>
            </div>
            <div className="session-track">
              <div className="session-fill" style={{ width: `${progress}%` }} />
            </div>
            {isActive ? <span className="session-state">LIVE</span> : null}
          </div>
        );
      })}
    </div>

    <div className="session-now-box">
      <span className="session-now-label">ENDS IN</span>
      <strong>{String(remainingHours).padStart(2,"0")}:{String(remainingMins).padStart(2,"0")}</strong>
      <span className="clock">{now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span>
    </div>
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
  const [xauPrice, setXauPrice] = useState<number | null>(null);

  async function loadDashboardData(isManual = false) {
    if (isManual) setRefreshing(true);
    setError("");

    try {
      const [marketResponse, signalResponse, volumeResponse, xauData] = await Promise.all([
        fetch(`/api/market?ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/signals?ts=${Date.now()}`, { cache: "no-store" }),
        fetch(`/api/volume-spike?interval=1h&ts=${Date.now()}`, {
          cache: "no-store",
        }),
        fetch("https://xaus.com/api/v1/spot", { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok) return null;
            return response.json();
          })
          .catch(() => null),
      ]);

      const [marketData, signalData, volumeData] = await Promise.all([
        marketResponse.json() as Promise<MarketResponse>,
        signalResponse.json(),
        volumeResponse.json(),
      ]);

      const parsedXau = Number(xauData?.spot_usd_oz ?? xauData?.xau?.price);
      setXauPrice(Number.isFinite(parsedXau) ? parsedXau : null);

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

      <div className="market-price-grid" aria-label="Live asset prices">
        {[
          { symbol: "BTC", marketSymbol: "BTCUSDT", label: "Bitcoin", accent: "btc", price: btc?.price ?? null, change: btc?.change24h ?? null },
          { symbol: "ETH", marketSymbol: "ETHUSDT", label: "Ethereum", accent: "eth", price: market?.markets?.find((item) => item.symbol === "ETHUSDT")?.price ?? null, change: market?.markets?.find((item) => item.symbol === "ETHUSDT")?.change24h ?? null },
          { symbol: "SOL", marketSymbol: "SOLUSDT", label: "Solana", accent: "sol", price: market?.markets?.find((item) => item.symbol === "SOLUSDT")?.price ?? null, change: market?.markets?.find((item) => item.symbol === "SOLUSDT")?.change24h ?? null },
          { symbol: "XAU", marketSymbol: "XAUUSD", label: "Gold Spot", accent: "xau", price: xauPrice, change: null },
        ].map((asset) => (
          <button
            key={asset.symbol}
            type="button"
            className={`live-price-card live-price-${asset.accent}`}
            onClick={() => asset.marketSymbol.endsWith("USDT") ? onCoinClick(asset.marketSymbol) : undefined}
          >
            <div className="live-price-top">
              <div>
                <span className="live-price-symbol">{asset.symbol}</span>
                <span className="live-price-name">{asset.label}</span>
              </div>
              <span className="live-price-live">LIVE</span>
            </div>
            <strong>{asset.price == null ? "—" : `$${formatPrice(asset.price)}`}</strong>
            <div className="live-price-bottom">
              <span>{asset.symbol === "XAU" ? "XAU / USD · spot" : `${asset.symbol} / USDT`}</span>
              {asset.change != null ? <b className={asset.change >= 0 ? "up" : "down"}>{formatPct(asset.change)}</b> : <b className="muted">SPOT</b>}
            </div>
          </button>
        ))}
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

      <PredatorIntelligence
        market={market}
        liveSignals={liveSignals}
        volumeRows={volumeRows}
        go={go}
        onCoinClick={onCoinClick}
      />
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
  onInfoClick?: () => void;
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
  onInfoClick,
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2, minHeight: 20 }}>
          <div style={{ color: "#74808c", fontSize: 9 }}>TRIGGER PRICE</div>
          {onInfoClick && (
            <span
              role="button"
              tabIndex={0}
              aria-label={`View ${baseAsset} signal analysis`}
              title="View signal analysis"
              onClick={(event) => { event.stopPropagation(); onInfoClick(); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onInfoClick(); } }}
              style={{
                flex: "0 0 auto",
                width: 20,
                height: 20,
                borderRadius: 6,
                border: "1px solid rgba(160,190,220,.2)",
                background: "rgba(5,10,15,.72)",
                color: "#b9c7d3",
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
                lineHeight: 1,
                padding: 0,
              }}
            >
              <Info size={12} />
            </span>
          )}
        </div>

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
            <div style={{ color: "#78838f", fontSize: 10 }}>FUNDING RATE · BINANCE PERP</div>
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
              {direction === "LONG" ? "BULLISH" : "BEARISH"}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}



function SignalAnalysisModal({
  signal,
  onClose,
}: {
  signal: {
    symbol: string;
    baseAsset: string;
    direction: "LONG" | "SHORT" | "NEUTRAL";
    score: number;
    status: string;
    triggerPrice: number;
    tools: Record<string, { score: number; label: string }>;
    reasons: string[];
  };
  onClose: () => void;
}) {
  const toolOrder = [
    "Volume Spike", "EMA Trend", "VWAP", "RSI", "MACD", "Breakout",
    "Market Structure", "BTC Confirmation", "Liquidity", "ATR",
    "Support/Resistance", "Trend Strength", "Momentum Alignment",
    "Market Regime", "Volume Pressure",
  ];
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const findTool = (label: string) => {
    const target = normalize(label);
    const entry = Object.entries(signal.tools || {}).find(([key, value]) => {
      const normalizedKey = normalize(key);
      const normalizedLabel = normalize(value?.label || key);
      return normalizedKey === target || normalizedLabel === target || normalizedKey.includes(target) || target.includes(normalizedKey) || normalizedLabel.includes(target) || target.includes(normalizedLabel);
    });
    return entry?.[1] || null;
  };
  const accent = signal.direction === "LONG" ? "#16e7a0" : signal.direction === "SHORT" ? "#ff596d" : "#b6c4d0";
  const scoreStatus = signal.score >= 110 ? "#16e7a0" : signal.score >= 100 ? "#ffd166" : "#9eb0c0";

  return (
    <div role="dialog" aria-modal="true" aria-label={`${signal.baseAsset} signal analysis`} onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }} style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 18, background: "rgba(0,0,0,.78)", backdropFilter: "blur(12px)" }}>
      <div style={{ width: "min(660px, 100%)", maxHeight: "min(84vh, 820px)", overflow: "auto", borderRadius: 20, border: `1px solid ${accent}38`, background: "linear-gradient(150deg, rgba(11,17,24,.98), rgba(3,8,12,.99))", boxShadow: `0 30px 80px rgba(0,0,0,.58), 0 0 45px ${signal.direction === "LONG" ? "rgba(22,231,160,.08)" : "rgba(255,89,109,.08)"}`, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ color: "#7f8b98", fontSize: 10, letterSpacing: ".12em", fontWeight: 800 }}>SIGNAL ANALYSIS</div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 5, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 22 }}>{signal.baseAsset}</strong>
              <span style={{ color: "#778490", fontSize: 11 }}>/ USDT</span>
              <span style={{ color: accent, fontWeight: 900, fontSize: 11 }}>{signal.direction}</span>
              <span style={{ color: scoreStatus, fontWeight: 800, fontSize: 11 }}>{signal.status}</span>
            </div>
            <div className="mono" style={{ marginTop: 7, fontSize: 16, color: "#e9f0f5", fontWeight: 800 }}>{formatPrice(signal.triggerPrice)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="mono" style={{ width: 66, height: 66, borderRadius: 18, display: "grid", placeItems: "center", border: `1px solid ${accent}55`, background: signal.direction === "LONG" ? "rgba(22,231,160,.07)" : "rgba(255,89,109,.07)", color: accent, fontSize: 19, fontWeight: 900 }}>{signal.score}/150</div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close analysis"><X size={17} /></button>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gap: 7 }}>
          {toolOrder.map((label) => {
            const result = findTool(label);
            const score = typeof result?.score === "number" ? result.score : null;
            const active = score !== null && score >= 7;
            return (
              <div key={label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 11, border: "1px solid rgba(255,255,255,.065)", background: active ? "rgba(22,231,160,.045)" : "rgba(255,255,255,.018)" }}>
                <span style={{ fontSize: 12, color: "#dbe4eb" }}>{label}</span>
                <span style={{ fontSize: 10, color: "#7d8995", textTransform: "uppercase" }}>{result?.label || (score !== null ? "Confirmed" : "N/A")}</span>
                <span className="mono" style={{ minWidth: 46, textAlign: "right", color: score !== null ? (score >= 8 ? "#31efb3" : score >= 5 ? "#ffd166" : "#ff7180") : "#7c8995", fontWeight: 900, fontSize: 12 }}>
                  {score !== null ? `${score}/10` : "N/A"}{score !== null && score >= 8 ? <Check size={13} style={{ marginLeft: 4, verticalAlign: "-2px" }} /> : null}
                </span>
              </div>
            );
          })}
        </div>

        {signal.reasons?.length ? (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,.07)" }}>
            <div style={{ color: "#7f8b98", fontSize: 10, letterSpacing: ".1em", fontWeight: 800, marginBottom: 8 }}>WHY THIS SIGNAL</div>
            <div style={{ display: "grid", gap: 6 }}>
              {signal.reasons.slice(0, 4).map((reason, index) => (
                <div key={`${reason}-${index}`} style={{ display: "flex", gap: 8, color: "#aab7c3", fontSize: 11, lineHeight: 1.45 }}>
                  <span style={{ color: accent, fontWeight: 900 }}>•</span><span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PredatorIntelligence({
  market,
  liveSignals,
  volumeRows,
  go,
  onCoinClick,
}: {
  market: MarketResponse | null;
  liveSignals: DashboardSignal[];
  volumeRows: DashboardVolume[];
  go: (t: Tab) => void;
  onCoinClick: (symbol: string) => void;
}) {
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [notificationState, setNotificationState] = useState<"off" | "granted" | "denied">("off");
  const alertedRef = useRef<Set<string>>(new Set());

  const markets = market?.markets ?? [];
  const priceMap = useMemo(() => new Map(markets.map((item) => [item.symbol, item])), [markets]);
  const heatmap = useMemo(
    () => [...markets].filter((item) => Number.isFinite(item.change24h)).sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 18),
    [markets],
  );
  const liquidity = useMemo(
    () => [...markets].filter((item) => Number.isFinite(item.quoteVolume24h)).sort((a, b) => b.quoteVolume24h - a.quoteVolume24h).slice(0, 6),
    [markets],
  );

  const narrativeMap: Record<string, string[]> = {
    AI: ["RENDERUSDT", "TAOUSDT", "FETUSDT", "NEARUSDT", "INJUSDT", "AKTUSDT"],
    RWA: ["ONDOUSDT", "PENDLEUSDT", "OMUSDT", "CFGUSDT", "POLYXUSDT"],
    DEFI: ["UNIUSDT", "AAVEUSDT", "MKRUSDT", "CRVUSDT", "COMPUSDT", "SNXUSDT"],
    L1: ["ETHUSDT", "SOLUSDT", "AVAXUSDT", "SUIUSDT", "ADAUSDT", "SEIUSDT", "APTUSDT"],
    MEME: ["DOGEUSDT", "SHIBUSDT", "PEPEUSDT", "WIFUSDT", "BONKUSDT", "FLOKIUSDT"],
    GAMING: ["IMXUSDT", "GALAUSDT", "SANDUSDT", "MANAUSDT", "RONUSDT", "BEAMXUSDT"],
  };

  const narratives = Object.entries(narrativeMap).map(([name, symbols]) => {
    const matched = symbols.map((symbol) => priceMap.get(symbol)).filter(Boolean) as MarketItem[];
    const avg = matched.length ? matched.reduce((sum, item) => sum + item.change24h, 0) / matched.length : null;
    return { name, avg, count: matched.length };
  }).filter((item) => item.count > 0).sort((a, b) => (b.avg ?? -Infinity) - (a.avg ?? -Infinity));

  const topSignal = [...liveSignals].sort((a, b) => b.score - a.score)[0] ?? null;
  const topVolume = [...volumeRows].sort((a, b) => b.spike - a.spike)[0] ?? null;
  const btc = market?.btc ?? null;
  const riskOn = btc ? btc.change24h >= 1.5 : false;
  const riskOff = btc ? btc.change24h <= -1.5 : false;

  const alerts = useMemo(() => {
    const next: Array<{ id: string; title: string; body: string; tone: "green" | "red" | "yellow"; action?: () => void }> = [];
    if (topSignal && topSignal.score >= 110) {
      next.push({ id: `signal-${topSignal.symbol}-${topSignal.score}`, title: `${topSignal.baseAsset} ${topSignal.direction} signal`, body: `${topSignal.score}/150 · ${topSignal.status}`, tone: topSignal.direction === "LONG" ? "green" : "red", action: () => go("Signal") });
    }
    if (topVolume && topVolume.spike >= 2.5) {
      next.push({ id: `volume-${topVolume.symbol}-${topVolume.spike.toFixed(1)}`, title: `${topVolume.symbol.replace("USDT", "")} volume spike`, body: `${topVolume.spike.toFixed(1)}× average volume · ${topVolume.level}`, tone: "yellow", action: () => go("Volume Spike") });
    }
    if (btc && Math.abs(btc.change24h) >= 2) {
      next.push({ id: `btc-${Math.sign(btc.change24h)}-${Math.round(btc.change24h * 10)}`, title: `BTC ${btc.change24h >= 0 ? "momentum" : "risk"} alert`, body: `24H move ${formatPct(btc.change24h)}`, tone: btc.change24h >= 0 ? "green" : "red", action: () => onCoinClick("BTCUSDT") });
    }
    return next;
  }, [btc, go, onCoinClick, topSignal, topVolume]);

  useEffect(() => {
    try { setAlertEnabled(localStorage.getItem("predator-smart-alerts") === "1"); } catch { setAlertEnabled(false); }
  }, []);

  useEffect(() => {
    if (!alertEnabled || typeof window === "undefined" || !("Notification" in window)) return;
    const state = Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "off";
    setNotificationState(state);
    if (state !== "granted") return;
    alerts.forEach((alert) => {
      if (alertedRef.current.has(alert.id)) return;
      alertedRef.current.add(alert.id);
      try { new Notification(`PREDATOR · ${alert.title}`, { body: alert.body }); } catch {}
    });
  }, [alertEnabled, alerts]);

  const toggleAlerts = async () => {
    if (!alertEnabled) {
      try { localStorage.setItem("predator-smart-alerts", "1"); } catch {}
      setAlertEnabled(true);
      if (typeof window !== "undefined" && "Notification" in window) {
        try {
          const permission = await Notification.requestPermission();
          setNotificationState(permission === "granted" ? "granted" : permission === "denied" ? "denied" : "off");
        } catch { setNotificationState("off"); }
      }
    } else {
      try { localStorage.setItem("predator-smart-alerts", "0"); } catch {}
      setAlertEnabled(false);
      setNotificationState("off");
    }
  };

  const heatColor = (change: number) => {
    const strength = Math.min(0.78, 0.08 + Math.abs(change) / 12);
    return change >= 0 ? `rgba(16,231,160,${strength})` : `rgba(255,89,109,${strength})`;
  };
  const marketRead = !btc
    ? "Waiting for live market data."
    : riskOn
      ? `Risk-on conditions: BTC is ${formatPct(btc.change24h)} over 24H. ${topSignal ? `${topSignal.baseAsset} has the strongest live signal at ${topSignal.score}/150.` : "No strong signal is currently leading."}`
      : riskOff
        ? `Risk-off conditions: BTC is ${formatPct(btc.change24h)} over 24H. Favor confirmation and liquidity over chasing moves.`
        : `Balanced conditions: BTC is ${formatPct(btc.change24h)} over 24H. Watch volume expansion before taking directional risk.`;

  return (
    <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
      <Card>
        <div className="card-head"><div><span className="label">PREDATOR INTELLIGENCE</span><h2>Market command center</h2></div><span className="muted" style={{ fontSize: 10 }}>LIVE · DATA-DRIVEN</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.45fr) minmax(280px,.8fr)", gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,.06)", background: "linear-gradient(145deg,rgba(255,255,255,.025),rgba(255,255,255,.008))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}><BrainCircuit size={17} style={{ color: "#ff4b63" }} /><span className="label">MARKET READ</span></div>
            <p style={{ margin: 0, color: "#c3ced8", fontSize: 13, lineHeight: 1.6 }}>{marketRead}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}><span className="chip active">{btc ? `BTC ${formatPct(btc.change24h)}` : "BTC —"}</span><span className="chip">Signals {liveSignals.length}</span><span className="chip">Spikes {volumeRows.length}</span></div>
          </div>
          <div style={{ padding: 14, borderRadius: 14, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.015)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Bell size={15} /><span className="label">SMART ALERTS</span></div><button type="button" className="glass-btn" onClick={toggleAlerts} style={{ padding: "6px 9px", fontSize: 10 }}>{alertEnabled ? "Enabled" : "Enable"}</button></div>
            <div className="muted" style={{ marginTop: 9, fontSize: 10 }}>{notificationState === "granted" ? "Browser notifications enabled." : alertEnabled ? (notificationState === "denied" ? "Browser notification permission was denied." : "Waiting for browser permission.") : "Get a browser alert for strong signals, volume spikes and BTC moves."}</div>
            <div style={{ display: "grid", gap: 7, marginTop: 10 }}>{alerts.length ? alerts.slice(0, 3).map((alert) => <button key={alert.id} type="button" onClick={alert.action} style={{ textAlign: "left", padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", background: alert.tone === "green" ? "rgba(16,231,160,.055)" : alert.tone === "red" ? "rgba(255,89,109,.05)" : "rgba(255,209,102,.05)", color: "inherit", cursor: "pointer" }}><b style={{ display: "block", fontSize: 11 }}>{alert.title}</b><span className="muted" style={{ fontSize: 9 }}>{alert.body}</span></button>) : <span className="muted" style={{ fontSize: 10 }}>No active high-priority alerts.</span>}</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(0,1fr)", gap: 14 }}>
        <Card><div className="card-head"><div><span className="label">MARKET HEATMAP</span><h2>Fastest movers</h2></div><Activity size={16} /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 7 }}>{heatmap.length ? heatmap.map((item) => <button key={item.symbol} type="button" onClick={() => onCoinClick(item.symbol)} style={{ padding: "10px 8px", borderRadius: 11, border: `1px solid ${item.change24h >= 0 ? "rgba(16,231,160,.18)" : "rgba(255,89,109,.18)"}`, background: heatColor(item.change24h), color: "#eef3f7", cursor: "pointer", textAlign: "left" }}><b style={{ display: "block", fontSize: 11 }}>{item.symbol.replace("USDT", "")}</b><span className="mono" style={{ display: "block", marginTop: 4, fontSize: 10 }}>{formatPct(item.change24h)}</span></button>) : <span className="muted">No live heatmap data.</span>}</div></Card>
        <Card><div className="card-head"><div><span className="label">NARRATIVE SCANNER</span><h2>Sector pulse</h2></div><Layers3 size={16} /></div><div style={{ display: "grid", gap: 8 }}>{narratives.length ? narratives.slice(0, 6).map((item) => <div key={item.name} style={{ display: "grid", gridTemplateColumns: "70px 1fr auto", alignItems: "center", gap: 8 }}><b style={{ fontSize: 11 }}>{item.name}</b><div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,.06)", overflow: "hidden" }}><div style={{ width: `${Math.min(100, Math.max(8, 50 + (item.avg ?? 0) * 9))}%`, height: "100%", borderRadius: 999, background: item.avg != null && item.avg >= 0 ? "#1ee6ad" : "#ff5f72" }} /></div><span className={item.avg != null && item.avg >= 0 ? "up" : "down"}>{item.avg == null ? "—" : formatPct(item.avg)}</span></div>) : <span className="muted">No mapped narrative data available.</span>}</div><p className="muted" style={{ margin: "10px 0 0", fontSize: 9 }}>Sector averages use only live coins present in the market feed.</p></Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 14 }}>
        <Card><div className="card-head"><div><span className="label">LIQUIDITY INTELLIGENCE</span><h2>Highest 24H quote flow</h2></div><Gauge size={16} /></div><div style={{ display: "grid", gap: 8 }}>{liquidity.length ? liquidity.map((item) => <button key={item.symbol} type="button" onClick={() => onCoinClick(item.symbol)} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", alignItems: "center", gap: 10, textAlign: "left", padding: "8px 0", border: 0, borderBottom: "1px solid rgba(255,255,255,.05)", background: "transparent", color: "inherit", cursor: "pointer" }}><span><b>{item.symbol.replace("USDT", "")}</b><span className="muted" style={{ display: "block", fontSize: 9 }}>{formatPct(item.change24h)} · {formatCompactUsd(item.quoteVolume24h)}</span></span><span className="mono" style={{ fontSize: 10 }}>{formatCompactUsd(item.quoteVolume24h)}</span><span style={{ color: item.change24h >= 0 ? "#57efba" : "#ff7181" }}>{item.change24h >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}</span></button>) : <span className="muted">Liquidity feed unavailable.</span>}</div><div style={{ marginTop: 10, paddingTop: 9, borderTop: "1px solid rgba(255,255,255,.06)" }}><span className="muted" style={{ fontSize: 9 }}><ShieldAlert size={11} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Whale transfer data is not connected here, so no whale flow is fabricated.</span></div></Card>
        <Card><div className="card-head"><div><span className="label">OPPORTUNITY RADAR</span><h2>Best current setups</h2></div><Target size={16} /></div>{liveSignals.length ? [...liveSignals].sort((a, b) => b.score - a.score).slice(0, 5).map((signal) => <button key={signal.symbol} type="button" onClick={() => onCoinClick(signal.symbol)} style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 10, textAlign: "left", padding: "9px 0", border: 0, borderBottom: "1px solid rgba(255,255,255,.05)", background: "transparent", color: "inherit", cursor: "pointer" }}><span><b>{signal.baseAsset}</b><span className="muted" style={{ display: "block", fontSize: 9 }}>{signal.direction} · {signal.status}</span></span><strong className="mono" style={{ color: signal.score >= 110 ? "#1fe5ad" : "#ffd166" }}>{signal.score}/150</strong></button>) : <span className="muted">No live opportunities right now.</span>}</Card>
      </div>
    </div>
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
    currentPrice?: number;
    triggerPrice?: number;
  };

  type HistoryRow = {
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
    tool_scores: (Record<string, ToolResult> & { __meta?: HistoryMeta }) | null;
    reason: string | null;
  };

  const SCAN_WINDOW_MS = 30 * 60 * 1000;

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
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [detailsSignal, setDetailsSignal] = useState<SignalRow | null>(null);
  const [last, setLast] = useState<Date | null>(null);
  const [nextScanAt, setNextScanAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const scanBusyRef = useRef(false);
  const lastAutoAttemptWindowRef = useRef<number | null>(null);
  const lastAutoAttemptAtRef = useRef(0);
  const observedWindowRef = useRef<number | null>(null);
  const autoRetryTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

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
    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(`/api/signals?history=1&ts=${Date.now()}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "History load failed");
      }
      setHistory((payload.history ?? []) as HistoryRow[]);
    } catch (err) {
      setHistoryError(
        err instanceof Error ? err.message : "History load failed",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  const appliedWindowRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);

  const loadSignals = useCallback(async (mode: "initial" | "manual" | "auto" = "initial") => {
    if (scanBusyRef.current) return;
    scanBusyRef.current = true;

    try {
      setError("");
      if (mode === "initial") setLoading(true);
      setScanning(true);

      // The API decides whether this window already has the canonical
      // shared snapshot. At a real 30-minute boundary, a new snapshot is
      // generated exactly once and then shared with every device/account.
      const currentWindowId = Math.floor(Date.now() / SCAN_WINDOW_MS);
      const forceParam = mode === "manual" ? "&force=1&hard=1" : "";
      const response = await fetch(`/api/signals?windowId=${currentWindowId}&ts=${Date.now()}${forceParam}`, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, max-age=0",
          Pragma: "no-cache",
        },
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Signal scan failed");
      }

      const nextRows = (payload.rows ?? []) as SignalRow[];
      const serverNextScan = Number.isFinite(Date.parse(payload.nextScanAt || ""))
        ? Date.parse(payload.nextScanAt)
        : null;
      const serverWindowStart = Number.isFinite(Date.parse(payload.windowStartAt || ""))
        ? Date.parse(payload.windowStartAt)
        : Date.now();
      const serverWindowId = Number.isFinite(Number(payload.windowId))
        ? Number(payload.windowId)
        : Math.floor(serverWindowStart / SCAN_WINDOW_MS);

      setRows(nextRows);
      setLast(new Date(serverWindowStart));
      setNextScanAt(serverNextScan);
      appliedWindowRef.current = serverWindowId;

      if (serverNextScan !== null) {
        setSeconds(Math.max(0, Math.ceil((serverNextScan - Date.now()) / 1000)));
      }

      // History is global/website-wide, not account-specific. The server
      // mirrors legacy rows and the canonical scan into one shared store.
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signal scan failed");
    } finally {
      setLoading(false);
      setScanning(false);
      scanBusyRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadHistory();
    void loadSignals("initial");

    return () => {
      mountedRef.current = false;
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [loadSignals]);

  useEffect(() => {
    const triggerAutoScan = async (windowId: number) => {
      if (!mountedRef.current || scanBusyRef.current) return;
      const now = Date.now();
      const alreadyAttemptedThisWindow = lastAutoAttemptWindowRef.current === windowId;
      const retryDue = now - lastAutoAttemptAtRef.current >= 5000;
      if (alreadyAttemptedThisWindow && !retryDue) return;

      lastAutoAttemptWindowRef.current = windowId;
      lastAutoAttemptAtRef.current = now;

      try {
        await loadSignals("auto");
      } finally {
        if (!mountedRef.current) return;
        const currentWindowId = Math.floor(Date.now() / SCAN_WINDOW_MS);
        if (currentWindowId === windowId && appliedWindowRef.current !== windowId && !scanBusyRef.current) {
          autoRetryTimerRef.current = window.setTimeout(() => {
            autoRetryTimerRef.current = null;
            void triggerAutoScan(windowId);
          }, 5000);
        }
      }
    };

    const checkBoundary = () => {
      const now = Date.now();
      const currentWindowId = Math.floor(now / SCAN_WINDOW_MS);
      const nextBoundaryMs = (currentWindowId + 1) * SCAN_WINDOW_MS;
      const countdown = Math.max(0, Math.ceil((nextBoundaryMs - now) / 1000));

      // Use the real wall-clock 30-minute boundary as the source of truth.
      // We deliberately do not depend on the previous API countdown value,
      // so a stale/stuck response cannot leave the UI at 00:00 forever.
      setSeconds(countdown);
      if (observedWindowRef.current === null) {
        observedWindowRef.current = currentWindowId;
      }

      if (currentWindowId !== observedWindowRef.current) {
        observedWindowRef.current = currentWindowId;
        lastAutoAttemptWindowRef.current = null;
        void triggerAutoScan(currentWindowId);
      } else if (countdown <= 1) {
        // Pre-arm the scan at the boundary so we do not wait for a browser
        // refresh or for an exact millisecond tick.
        void triggerAutoScan(currentWindowId);
      }

      // Keep nextScanAt aligned to the real clock even before the API responds.
      if (nextScanAt === null || nextScanAt < now - 1000 || nextScanAt > nextBoundaryMs + 1000) {
        setNextScanAt(nextBoundaryMs);
      }
    };

    checkBoundary();
    const timer = window.setInterval(checkBoundary, 500);

    return () => {
      window.clearInterval(timer);
      if (autoRetryTimerRef.current !== null) {
        window.clearTimeout(autoRetryTimerRef.current);
        autoRetryTimerRef.current = null;
      }
    };
  }, [nextScanAt, loadSignals]);

  const topRows = rows.slice(0, 24);

  const expiredHistory = history.filter((row) =>
    !row.expires_at || new Date(row.expires_at).getTime() <= Date.now()
  );

  // History is presented as a rolling monthly journal:
  // - the current calendar month stays in History
  // - once the month changes, the old month's records automatically move
  //   into Last Month Report without deleting them from the database
  // - archived months remain available month-by-month
  const monthKeyFor = (value: string) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const monthLabelFor = (key: string) => {
    const [year, month] = key.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  };

  const nowForHistory = new Date();
  const currentMonthKey = `${nowForHistory.getFullYear()}-${String(nowForHistory.getMonth() + 1).padStart(2, "0")}`;

  const groupHistoryBySymbol = (items: HistoryRow[]) =>
    items.reduce<Record<string, HistoryRow[]>>((groups, row) => {
      if (!groups[row.symbol]) groups[row.symbol] = [];
      groups[row.symbol].push(row);
      return groups;
    }, {});

  const currentMonthHistory = expiredHistory.filter(
    (row) => monthKeyFor(row.signal_time) === currentMonthKey,
  );

  const archivedByMonth = expiredHistory.reduce<Record<string, HistoryRow[]>>(
    (groups, row) => {
      const key = monthKeyFor(row.signal_time);
      if (key !== currentMonthKey) {
        if (!groups[key]) groups[key] = [];
        groups[key].push(row);
      }
      return groups;
    },
    {},
  );

  const historyGroups = groupHistoryBySymbol(currentMonthHistory);
  const archiveMonths = Object.keys(archivedByMonth).sort((a, b) =>
    b.localeCompare(a),
  );

  return (
    <>
      {detailsSignal ? <SignalAnalysisModal signal={detailsSignal} onClose={() => setDetailsSignal(null)} /> : null}
      <div className="page">
      <div className="page-head">
        <div>
          <h1>Live Signals</h1>
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
            disabled={scanning}
            title="Run a fresh scan for the current 30-minute window"
          >
            <RefreshCw
              size={15}
              style={
                scanning || loading
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
          {currentMonthHistory.length > 0
            ? ` · ${currentMonthHistory.length}`
            : ""}
        </button>

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
                    ? "Loading markets..."
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

            {scanning && (
              <div
                style={{
                  padding: "18px 30px 8px",
                  textAlign: "center",
                }}
              >
                <p className="muted">Scanning eligible Binance USDT markets…</p>
              </div>
            )}

            {!loading &&
              !scanning &&
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
                    price={signal.triggerPrice}
                    change15m={signal.change15m}
                    change1h={signal.change1h}
                    support={signal.support}
                    resistance={signal.resistance}
                    supportDistance={signal.supportDistance}
                    resistanceDistance={signal.resistanceDistance}
                    fundingRate={signal.fundingRate}
                    capturedAt={signal.capturedAt}
                    onClick={() => onCoinClick(signal.symbol)}
                    onInfoClick={() => setDetailsSignal(signal)}
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
            ) : (
              <>
                <SignalHistoryAnalytics history={history} />
                <section
                  style={{
                    marginBottom: archiveMonths.length > 0 ? 26 : 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div className="label">CURRENT MONTH</div>
                      <h3 style={{ margin: "4px 0 0", fontSize: 18 }}>
                        {monthLabelFor(currentMonthKey)}
                      </h3>
                    </div>
                    <span className="muted">
                      {currentMonthHistory.length} expired signals · {Object.keys(historyGroups).length} coins
                    </span>
                  </div>

                  {Object.keys(historyGroups).length === 0 ? (
                    <div
                      style={{
                        padding: "26px",
                        textAlign: "center",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,.07)",
                        background: "rgba(255,255,255,.015)",
                      }}
                    >
                      <p className="muted">No expired signals in the current month yet.</p>
                    </div>
                  ) : (
                    <div
                      className="signal-card-grid"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                        gap: 10,
                        alignItems: "start",
                      }}
                    >
                      {Object.entries(historyGroups)
                        .sort(([, a], [, b]) => {
                          const aTime = new Date(a[0]?.signal_time || 0).getTime();
                          const bTime = new Date(b[0]?.signal_time || 0).getTime();
                          return bTime - aTime;
                        })
                        .slice(0, 48)
                        .map(([symbol, items]) => (
                          <HistorySignalStack
                            key={`${currentMonthKey}-${symbol}`}
                            items={items}
                            onCoinClick={onCoinClick}
                          />
                        ))}
                    </div>
                  )}
                </section>

                <section>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div className="label">LAST MONTH REPORT</div>
                      <h3 style={{ margin: "4px 0 0", fontSize: 18 }}>
                        Monthly archived signals
                      </h3>
                    </div>
                    <span className="muted">
                      {archiveMonths.length} month{archiveMonths.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  {archiveMonths.length === 0 ? (
                    <div
                      style={{
                        padding: "26px",
                        textAlign: "center",
                        borderRadius: 14,
                        border: "1px solid rgba(255,255,255,.07)",
                        background: "rgba(255,255,255,.015)",
                      }}
                    >
                      <p className="muted">No previous month report yet.</p>
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 18 }}>
                      {archiveMonths.map((monthKey) => {
                        const monthRows = archivedByMonth[monthKey] || [];
                        const monthGroups = groupHistoryBySymbol(monthRows);
                        return (
                          <section
                            key={monthKey}
                            style={{
                              paddingTop: 2,
                              borderTop: "1px solid rgba(255,255,255,.07)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                margin: "12px 0",
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: 15 }}>{monthLabelFor(monthKey)}</strong>
                                <span className="muted" style={{ marginLeft: 8 }}>
                                  {monthRows.length} signals · {Object.keys(monthGroups).length} coins
                                </span>
                              </div>
                            </div>

                            <div
                              className="signal-card-grid"
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                                gap: 10,
                                alignItems: "start",
                              }}
                            >
                              {Object.entries(monthGroups)
                                .sort(([, a], [, b]) => {
                                  const aTime = new Date(a[0]?.signal_time || 0).getTime();
                                  const bTime = new Date(b[0]?.signal_time || 0).getTime();
                                  return bTime - aTime;
                                })
                                .slice(0, 48)
                                .map(([symbol, items]) => (
                                  <HistorySignalStack
                                    key={`${monthKey}-${symbol}`}
                                    items={items}
                                    onCoinClick={onCoinClick}
                                  />
                                ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </section>
              </>
            )}
          </Card>
        </div>
      )}
      </div>
    </>
  );
}
function SignalHistoryAnalytics({
  history,
}: {
  history: Array<{
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
    tool_scores: Record<string, unknown> | null;
    reason: string | null;
  }>;
}) {
  const [filterScore, setFilterScore] = useState(100);
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "LONG" | "SHORT">("ALL");
  const [results, setResults] = useState<Array<{ id: number; symbol: string; direction: "LONG" | "SHORT"; score: number; ret: number }>>([]);
  const [loading, setLoading] = useState(false);
  const runRef = useRef(0);
  const candidates = useMemo(() => history.filter((row) => row.price && row.expires_at && row.score >= filterScore && (directionFilter === "ALL" || row.direction === directionFilter)).sort((a, b) => new Date(b.signal_time).getTime() - new Date(a.signal_time).getTime()).slice(0, 24), [history, filterScore, directionFilter]);

  useEffect(() => {
    let cancelled = false;
    const runId = ++runRef.current;
    const load = async () => {
      if (!candidates.length) { setResults([]); setLoading(false); return; }
      setLoading(true);
      const out: Array<{ id: number; symbol: string; direction: "LONG" | "SHORT"; score: number; ret: number }> = [];
      for (let i = 0; i < candidates.length; i += 4) {
        const batch = candidates.slice(i, i + 4);
        const batchResults = await Promise.all(batch.map(async (row) => {
          try {
            const expiry = new Date(row.expires_at as string).getTime();
            const data = await fetchJsonWithFallback<any>([
              `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(row.symbol)}&interval=1m&startTime=${expiry - 180000}&endTime=${expiry + 180000}&limit=7`,
              `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(row.symbol)}&interval=1m&startTime=${expiry - 180000}&endTime=${expiry + 180000}&limit=7`,
            ]);
            if (!Array.isArray(data) || !data.length) return null;
            const closest = data.reduce((best: any[], item: any[]) => Math.abs(Number(item[0]) - expiry) < Math.abs(Number(best?.[0] ?? expiry) - expiry) ? item : best, data[0]);
            const exitPrice = Number(closest?.[4]);
            const entryPrice = Number(row.price);
            if (!Number.isFinite(exitPrice) || !Number.isFinite(entryPrice) || entryPrice <= 0) return null;
            const ret = row.direction === "LONG" ? ((exitPrice - entryPrice) / entryPrice) * 100 : ((entryPrice - exitPrice) / entryPrice) * 100;
            return { id: row.id, symbol: row.symbol, direction: row.direction, score: row.score, ret };
          } catch { return null; }
        }));
        batchResults.forEach((item) => { if (item) out.push(item); });
        if (cancelled || runId !== runRef.current) return;
      }
      if (!cancelled && runId === runRef.current) { setResults(out); setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [candidates]);

  const wins = results.filter((item) => item.ret > 0).length;
  const winRate = results.length ? (wins / results.length) * 100 : 0;
  const avgReturn = results.length ? results.reduce((sum, item) => sum + item.ret, 0) / results.length : 0;
  const best = results.length ? Math.max(...results.map((item) => item.ret)) : 0;
  const worst = results.length ? Math.min(...results.map((item) => item.ret)) : 0;

  return (
    <Card style={{ marginBottom: 14 }}>
      <div className="card-head"><div><span className="label">SIGNAL HISTORY ANALYTICS</span><h2>Outcome lab / backtest</h2></div><Gauge size={16} /></div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}><span className="muted" style={{ fontSize: 10 }}>Minimum score</span>{[80, 100, 110, 120].map((score) => <button key={score} type="button" className={filterScore === score ? "chip active" : "chip"} onClick={() => setFilterScore(score)}>{score}+</button>)}<span className="muted" style={{ fontSize: 10, marginLeft: 5 }}>Direction</span>{(["ALL","LONG","SHORT"] as const).map((dir) => <button key={dir} type="button" className={directionFilter === dir ? "chip active" : "chip"} onClick={() => setDirectionFilter(dir)}>{dir}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>{[["WIN RATE", results.length ? `${winRate.toFixed(1)}%` : "—", winRate >= 55 ? "up" : "muted"],["AVG RETURN", results.length ? `${avgReturn >= 0 ? "+" : ""}${avgReturn.toFixed(2)}%` : "—", avgReturn >= 0 ? "up" : "down"],["BEST", results.length ? `+${best.toFixed(2)}%` : "—", "up"],["WORST", results.length ? `${worst.toFixed(2)}%` : "—", "down"]].map(([label, value, tone]) => <div key={String(label)} className="glass-card" style={{ padding: "11px 12px", background: "rgba(255,255,255,.016)" }}><span className="label">{label}</span><strong className={String(tone)} style={{ display: "block", marginTop: 7, fontSize: 18 }}>{value}</strong></div>)}</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span className="muted" style={{ fontSize: 9 }}>{loading ? "Running historical outcome checks…" : `${results.length} recorded signals evaluated using actual market price near each expiry.`}</span><span className="muted" style={{ fontSize: 9 }}>{results.length ? "Historical only · not a future guarantee." : "Waiting for expired signal history."}</span></div>
    </Card>
  );
}

function HistorySignalStack({
  items,
  onCoinClick,
}: {
  items: Array<{
    id: number;
    window_id: number;
    symbol: string;
    direction: "LONG" | "SHORT";
    score: number;
    status: string;
    price: number | null;
    signal_time: string;
    expires_at: string | null;
    tool_scores: {
      __meta?: {
        change15m: number;
        change1h: number;
        support: number;
        resistance: number;
        supportDistance: number;
        resistanceDistance: number;
        fundingRate: number | null;
        baseAsset: string;
        capturedAt: string;
        triggerPrice?: number;
      };
    } | null;
  }>;
  onCoinClick: (symbol: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const pointerStartRef = useRef<number | null>(null);

  const ordered = useMemo(() => {
    return [...items].sort(
      (a, b) =>
        new Date(b.signal_time || 0).getTime() -
        new Date(a.signal_time || 0).getTime()
    );
  }, [items]);

  useEffect(() => {
    setIndex((current) => Math.min(current, Math.max(0, ordered.length - 1)));
  }, [ordered.length]);

  const showPrevious = () => {
    setIndex((current) => Math.min(ordered.length - 1, current + 1));
  };

  const showNewer = () => {
    setIndex((current) => Math.max(0, current - 1));
  };

  const renderCard = (item: (typeof ordered)[number], offset: number) => {
    const meta = item.tool_scores?.__meta;
    return (
      <div
        key={`${item.id}-${offset}`}
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${offset * 7}px, ${offset * 7}px) scale(${1 - offset * 0.018})`,
          transformOrigin: "center top",
          zIndex: 40 - offset,
          opacity: offset === 0 ? 1 : Math.max(0.58, 1 - offset * 0.12),
          transition: "transform .24s ease, opacity .24s ease",
          pointerEvents: offset === 0 ? "auto" : "none",
        }}
      >
        <CompactSignalCard
          baseAsset={meta?.baseAsset || item.symbol.replace("USDT", "")}
          direction={item.direction}
          score={item.score}
          status={item.status}
          price={
            typeof meta?.triggerPrice === "number"
              ? meta.triggerPrice
              : Number(item.price ?? 0)
          }
          change15m={typeof meta?.change15m === "number" ? meta.change15m : null}
          change1h={typeof meta?.change1h === "number" ? meta.change1h : null}
          support={typeof meta?.support === "number" ? meta.support : null}
          resistance={typeof meta?.resistance === "number" ? meta.resistance : null}
          supportDistance={typeof meta?.supportDistance === "number" ? meta.supportDistance : null}
          resistanceDistance={typeof meta?.resistanceDistance === "number" ? meta.resistanceDistance : null}
          fundingRate={typeof meta?.fundingRate === "number" ? meta.fundingRate : null}
          capturedAt={meta?.capturedAt || item.signal_time}
          expired={true}
          onClick={() => onCoinClick(item.symbol)}
        />
      </div>
    );
  };

  const visible = ordered.slice(index, index + 3);
  const canGoOlder = index < ordered.length - 1;
  const canGoNewer = index > 0;

  return (
    <div
      style={{
        position: "relative",
        minHeight: 398,
        userSelect: "none",
        touchAction: "pan-y",
      }}
      onPointerDown={(event) => {
        pointerStartRef.current = event.clientX;
      }}
      onPointerUp={(event) => {
        const start = pointerStartRef.current;
        pointerStartRef.current = null;
        if (start === null || ordered.length <= 1) return;
        const delta = event.clientX - start;
        if (delta < -45) showPrevious();
        else if (delta > 45) showNewer();
      }}
      onWheel={(event) => {
        if (Math.abs(event.deltaY) < 10 || ordered.length <= 1) return;
        if (event.deltaY > 0) showPrevious();
        else showNewer();
      }}
    >
      {[...visible].reverse().map((item, reversedOffset) => {
        const offset = visible.length - 1 - reversedOffset;
        return renderCard(item, offset);
      })}

      {ordered.length > 1 && (
        <div
          style={{
            position: "absolute",
            left: 10,
            right: 10,
            bottom: 9,
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pointerEvents: "none",
          }}
        >
          <button
            type="button"
            disabled={!canGoNewer}
            onClick={(event) => {
              event.stopPropagation();
              showNewer();
            }}
            style={{
              pointerEvents: "auto",
              width: 30,
              height: 30,
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,.13)",
              background: "rgba(7,12,18,.82)",
              color: canGoNewer ? "#dce8f2" : "#49545f",
              cursor: canGoNewer ? "pointer" : "default",
            }}
            aria-label="Show newer signal"
          >
            ‹
          </button>

          <span
            style={{
              padding: "5px 9px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,.11)",
              background: "rgba(7,12,18,.82)",
              color: "#a4b0bc",
              fontSize: 10,
              letterSpacing: ".04em",
              pointerEvents: "none",
            }}
          >
            {index + 1}/{ordered.length} · SWIPE
          </span>

          <button
            type="button"
            disabled={!canGoOlder}
            onClick={(event) => {
              event.stopPropagation();
              showPrevious();
            }}
            style={{
              pointerEvents: "auto",
              width: 30,
              height: 30,
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,.13)",
              background: "rgba(7,12,18,.82)",
              color: canGoOlder ? "#dce8f2" : "#49545f",
              cursor: canGoOlder ? "pointer" : "default",
            }}
            aria-label="Show older signal"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}

function VolumeSpike({ onCoinClick }:{ onCoinClick:(symbol:string)=>void }) {
  type Interval = "1h" | "4h" | "1d";
  type Row = {
    symbol: string;
    baseAsset: string;
    price: number;
    quoteVolume24h: number;
    volume: number;
    averageVolume: number;
    spike: number;
    rsi: number | null;
    change1h: number | null;
    change4h: number | null;
    change1d: number | null;
    level: "Extreme" | "High" | "Moderate" | "Normal";
  };
  const [interval, setIntervalValue] = useState<Interval>("1h");
  const [filter, setFilter] = useState<"All" | "Extreme" | "High" | "Moderate" | "Normal">("All");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const url = `/api/volume-spike?interval=${encodeURIComponent(interval)}&ts=${Date.now()}`;
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "Cache-Control": "no-cache, no-store, max-age=0", Pragma: "no-cache" },
        });
        const data = await response.json();
        if (!response.ok || !data.ok) throw new Error(data.error || "Volume data unavailable");
        if (!active || requestId !== requestIdRef.current) return;
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setLastUpdated(data.updatedAt ? new Date(data.updatedAt) : new Date());
      } catch (e) {
        if (!active || requestId !== requestIdRef.current) return;
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Volume data unavailable");
        setRows([]);
      } finally {
        if (active && requestId === requestIdRef.current) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => { active = false; controller.abort(); window.clearInterval(timer); };
  }, [interval]);

  const formatCompact = (value: number) => {
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(0);
  };
  const formatPct = (value: number | null) => value == null || !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  const filtered = useMemo(() => {
    const source = filter === "All" ? rows : rows.filter((row) => row.level === filter);
    return source.slice(0, 40);
  }, [filter, rows]);

  const filterButtons: Array<[typeof filter, string]> = [
    ["All", "All"], ["Extreme", "Extreme"], ["High", "High"], ["Moderate", "Moderate"], ["Normal", "Normal"],
  ];

  return (
    <div className="page" style={{ paddingTop: 8 }}>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:18, flexWrap:"wrap",
        marginBottom: 18,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:58, height:58, borderRadius:16, display:"grid", placeItems:"center", background:"linear-gradient(145deg, rgba(17,34,49,.95), rgba(5,13,21,.95))", border:"1px solid rgba(87,126,162,.22)", boxShadow:"0 12px 30px rgba(0,0,0,.18)" }}>
            <BarChart3 size={30} strokeWidth={1.7} />
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:34, letterSpacing:"-.025em" }}>
              VOLUME <span style={{ color:"#ff3a45" }}>SPIKE</span>
            </h1>
            <div style={{ marginTop:4, fontSize:15, color:"#91a6bb" }}>Unusual Trading Activity</div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {([ ["1h","1H"],["4h","4H"],["1d","1D"] ] as const).map(([value,label]) => (
            <button key={value} type="button" onClick={() => setIntervalValue(value)} style={{
              minWidth:92, height:50, borderRadius:12, border: interval === value ? "1px solid #ff3a45" : "1px solid rgba(86,122,155,.25)",
              background: interval === value ? "linear-gradient(180deg, rgba(255,58,69,.15), rgba(31,16,21,.92))" : "rgba(8,18,28,.78)",
              color: interval === value ? "#fff" : "#a9bfd4", fontSize:17, fontWeight:700,
              boxShadow: interval === value ? "0 0 18px rgba(255,58,69,.16)" : "none",
            }}>{label}</button>
          ))}
          <div style={{ width:10 }} />
          {filterButtons.map(([value,label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} style={{
              minWidth: value === "Moderate" ? 124 : 98, height:50, borderRadius:12,
              border: filter === value ? "1px solid #ff3a45" : "1px solid rgba(86,122,155,.25)",
              background: filter === value ? "linear-gradient(180deg, rgba(255,58,69,.14), rgba(31,16,21,.92))" : "rgba(8,18,28,.78)",
              color: filter === value ? "#fff" : "#a9bfd4", fontSize:16, fontWeight:700,
            }}>{label}</button>
          ))}
        </div>
        <div style={{ marginTop: 8, color: "#71869a", fontSize: 12, textAlign: "right" }}>Scanning timeframe: <b style={{ color: "#cfe0ee" }}>{interval.toUpperCase()}</b></div>
      </div>

      <div style={{
        borderRadius:18, overflow:"hidden", background:"linear-gradient(180deg, rgba(5,17,27,.96), rgba(3,10,17,.98))",
        border:"1px solid rgba(75,110,141,.20)", boxShadow:"0 18px 50px rgba(0,0,0,.20)"
      }}>
        <div style={{ display:"grid", gridTemplateColumns:"56px minmax(190px,1.35fr) minmax(160px,1fr) 120px 120px 1fr 1fr 1fr 150px", alignItems:"center", padding:"15px 18px", color:"#a9bfd4", fontSize:16, borderBottom:"1px solid rgba(84,117,145,.16)" }}>
          {['#','COIN',`VOLUME (${interval.toUpperCase()})`,`SPIKE (${interval.toUpperCase()})`,`RSI (${interval.toUpperCase()})`,'RSI STATUS','1H','4H','1D','STATUS'].map((h,i) => i===9 ? <span key={h} style={{ textAlign:"right" }}>{h}</span> : <span key={h}>{h}</span>)}
        </div>

        {error ? (
          <div style={{ padding:40, color:"#ff6f7a" }}>{error}</div>
        ) : loading && filtered.length === 0 ? (
          <div style={{ padding:42, color:"#90a4b8" }}>Scanning Binance USDT markets…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:42, color:"#90a4b8" }}>No strong volume expansion found for this timeframe.</div>
        ) : (
          <div>
            {filtered.map((row,index) => {
              const rsiStatus = row.rsi == null ? "Neutral" : row.rsi >= 70 ? "Overbought" : row.rsi <= 30 ? "Oversold" : "Neutral";
              const spikeBg = row.spike >= 3 ? "rgba(255,55,70,.12)" : row.spike >= 2 ? "rgba(255,184,34,.12)" : "rgba(255,210,74,.10)";
              const spikeBorder = row.spike >= 3 ? "rgba(255,55,70,.30)" : "rgba(255,190,35,.28)";
              return (
                <div key={row.symbol} onClick={() => onCoinClick(row.symbol)} style={{
                  display:"grid", gridTemplateColumns:"56px minmax(190px,1.35fr) minmax(160px,1fr) 120px 120px 1fr 1fr 1fr 150px", alignItems:"center",
                  minHeight:76, padding:"0 18px", borderBottom:"1px solid rgba(84,117,145,.13)", cursor:"pointer",
                }}>
                  <div><span style={{ width:42, height:42, display:"grid", placeItems:"center", border:"1px solid rgba(120,153,184,.35)", borderRadius:9, color:"#b5c9dc", fontSize:15 }}>{index+1}</span></div>
                  <div style={{ display:"flex", alignItems:"center", gap:13, minWidth:0 }}>
                    <img src={`https://assets.coincap.io/assets/icons/${row.baseAsset.toLowerCase()}@2x.png`} alt="" width={38} height={38} style={{ borderRadius:"50%", background:"#101a23" }} onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.visibility='hidden'; }} />
                    <div style={{ minWidth:0 }}><div style={{ fontWeight:800, fontSize:18, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{row.baseAsset} <span style={{ color:"#7f93a6", fontSize:13, fontWeight:600 }}>/USDT</span></div></div>
                  </div>
                  <div><div style={{ fontSize:18, fontWeight:800 }}>${formatCompact(row.volume)}</div><div style={{ color:"#8095a9", fontSize:14 }}>Avg ${formatCompact(row.averageVolume)}</div></div>
                  <div><span style={{ display:"inline-flex", minWidth:74, justifyContent:"center", padding:"8px 12px", borderRadius:10, background:spikeBg, border:`1px solid ${spikeBorder}`, color: row.spike >= 3 ? "#ff5b69" : "#ffd447", fontWeight:800, fontSize:17 }}>{row.spike.toFixed(1)}×</span></div>
                  <div style={{ fontSize:17, fontWeight:700 }}>{row.rsi == null ? "—" : row.rsi.toFixed(1)}</div>
                  <div><span style={{ display:"inline-flex", padding:"10px 14px", borderRadius:10, background: rsiStatus === "Overbought" ? "rgba(255,55,70,.11)" : rsiStatus === "Oversold" ? "rgba(0,235,167,.11)" : "rgba(46,91,131,.18)", border:`1px solid ${rsiStatus === "Neutral" ? "rgba(76,118,157,.25)" : "rgba(255,255,255,.06)"}`, color: rsiStatus === "Overbought" ? "#ff5968" : rsiStatus === "Oversold" ? "#00e7a4" : "#9bb6cf", fontWeight:700 }}>{rsiStatus}</span></div>
                  <div><span style={{ display:"inline-flex", padding:"9px 13px", borderRadius:9, background: (row.change1h ?? 0) >= 0 ? "rgba(0,205,145,.10)" : "rgba(255,60,75,.10)", color:(row.change1h ?? 0) >= 0 ? "#00e5a2" : "#ff6471", fontWeight:800 }}>{formatPct(row.change1h)}</span></div>
                  <div><span style={{ display:"inline-flex", padding:"9px 13px", borderRadius:9, background:(row.change4h ?? 0) >= 0 ? "rgba(0,205,145,.10)" : "rgba(255,60,75,.10)", color:(row.change4h ?? 0) >= 0 ? "#00e5a2" : "#ff6471", fontWeight:800 }}>{formatPct(row.change4h)}</span></div>
                  <div><span style={{ display:"inline-flex", padding:"9px 13px", borderRadius:9, background:(row.change1d ?? 0) >= 0 ? "rgba(0,205,145,.10)" : "rgba(255,60,75,.10)", color:(row.change1d ?? 0) >= 0 ? "#00e5a2" : "#ff6471", fontWeight:800 }}>{formatPct(row.change1d)}</span></div>
                  <div style={{ textAlign:"right" }}><span style={{ display:"inline-flex", minWidth:112, justifyContent:"center", padding:"10px 14px", borderRadius:10, border:"1px solid rgba(150,170,190,.20)", color: row.level === "Extreme" ? "#ff5463" : row.level === "High" ? "#ff9a34" : row.level === "Moderate" ? "#f0d13d" : "#b4cae0", background: row.level === "Extreme" ? "rgba(255,55,70,.11)" : row.level === "High" ? "rgba(255,143,44,.10)" : row.level === "Moderate" ? "rgba(229,196,55,.08)" : "rgba(52,91,125,.18)", fontWeight:800 }}>{row.level}</span></div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ padding:"13px 18px", display:"flex", justifyContent:"space-between", color:"#71869a", fontSize:12, borderTop:"1px solid rgba(84,117,145,.13)" }}>
          <span>{filtered.length} qualifying markets</span>
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit", second:"2-digit"})}` : "Waiting for data"}</span>
        </div>
      </div>
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
  const [chartTf, setChartTf] = useState("1h");

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

      const priceStructureScore = ema21 !== null && ema50 !== null
        ? price > ema21 && ema21 > ema50 ? 90 : price > ema21 || ema21 > ema50 ? 65 : 30
        : null;
      const momentumScore = rsi === null
        ? null
        : (rsi >= 55 && rsi <= 68) || (rsi >= 32 && rsi <= 45 && change1h < 0)
          ? 80 : rsi >= 50 ? 65 : 40;
      const volumeRatio = k1h.length >= 21
        ? Number(k1h.at(-1)?.[5]) / (k1h.slice(-21, -1).reduce((sum, k) => sum + Number(k[5]), 0) / 20)
        : null;
      const volumeScore = volumeRatio === null ? null : Math.max(25, Math.min(95, 55 + (volumeRatio - 1) * 25));
      const derivativesScore = oiUsd === null && fundingRate === null
        ? null : Math.max(25, Math.min(90, 65 + (change1h >= 0 ? 12 : -10) - Math.min(Math.abs((fundingRate || 0) * 10000), 18)));
      const liquidationScore = atrPercent === null ? null : atrPercent <= 2 ? 85 : atrPercent <= 4 ? 65 : 40;
      const onchainScore = mvrv === null || nupl === null ? null : Math.max(20, Math.min(90, (mvrv >= 1 && mvrv <= 2.5 ? 80 : mvrv > 2.5 && mvrv < 3.5 ? 65 : mvrv >= 3.5 ? 35 : 55) + (nupl > 0 && nupl < 0.5 ? 8 : nupl >= 0.5 ? -8 : 0)));
      const etfScore = etfFlow === null ? null : etfFlow > 0 ? 85 : etfFlow < 0 ? 35 : 60;

      const weighted = [
        [20, priceStructureScore], [15, etfScore], [20, derivativesScore],
        [15, momentumScore], [10, volumeScore], [10, onchainScore], [10, liquidationScore],
      ] as Array<[number, number | null]>;
      const usable = weighted.filter(([, score]) => score !== null);
      const marketHealth = usable.length
        ? Math.round(usable.reduce((sum, [weight, score]) => sum + weight * (score || 0), 0) / usable.reduce((sum, [weight]) => sum + weight, 0))
        : 0;

      const marketCondition = change1h > 0.8 && price > (ema21 || price)
        ? "Bullish" : change1h < -0.8 && price < (ema21 || price) ? "Bearish" : "Range / Mixed";
      const sevenDayRange = closes1h.slice(-168);
      const low7 = sevenDayRange.length ? Math.min(...sevenDayRange) : price;
      const high7 = sevenDayRange.length ? Math.max(...sevenDayRange) : price;
      const rangePosition = high7 > low7 ? (price - low7) / (high7 - low7) : 0.5;
      const cycleScore = Math.round(Math.max(0, Math.min(100, 25 + (change7d + 10) * 2 + (rangePosition * 35) + (rsi ?? 50) * 0.2)));
      const cycleStage = cycleScore < 25 ? "Accumulation" : cycleScore < 45 ? "Early Markup" : cycleScore < 70 ? "Markup" : cycleScore < 85 ? "Distribution Risk" : "Markdown";

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
  const cycle10 = d ? d.cycleScore / 10 : 0;
  const gaugeDeg = -90 + (cycle10 / 10) * 180;
  const structureText = d ? (d.price > d.resistance * 0.995 ? "Testing Resistance" : d.price < d.support * 1.01 ? "Holding Support" : "Sideways / Cautious") : "Loading";
  const cautionTone = d && d.marketCondition === "Bullish" ? "green" : d && d.marketCondition === "Bearish" ? "red" : "yellow";
  const marketRead = d
    ? `${d.marketCondition.toUpperCase()}: BTC is trading around $${formatCompactUsd(d.price).replace("$", "")}, with the current structure ${structureText.toLowerCase()}. ${d.price < d.resistance ? `Resistance sits near $${formatPrice(d.resistance)}.` : "Price is pressing above the recent resistance zone."}`
    : "Loading the latest verified BTC market structure…";

  const signalRows = d ? [
    ["Price Structure", "Trend direction / key levels", `${structureText} · ${formatPct(d.change1h)}`, d.marketHealth >= 65 ? "Yellow" : "Red"],
    ["ETF Flows", "Institutional demand", d.etfFlow === null ? "N/A" : `${d.etfFlow >= 0 ? "+" : ""}${d.etfFlow.toFixed(1)}M`, d.etfFlow === null ? "N/A" : d.etfFlow >= 0 ? "Green" : "Red"],
    ["Funding Rates", "Long/short sentiment", d.fundingRate === null ? "N/A" : `${(d.fundingRate * 100).toFixed(4)}%`, d.fundingRate === null ? "N/A" : Math.abs(d.fundingRate) < 0.0002 ? "Yellow" : d.fundingRate > 0 ? "Green" : "Red"],
    ["Open Interest", "Leverage / positioning", d.openInterestUsd === null ? "N/A" : formatCompactUsd(d.openInterestUsd), d.openInterestUsd === null ? "N/A" : "Yellow"],
    ["MVRV / NUPL", "Cycle / top risk", d.mvrv === null || d.nupl === null ? "N/A" : `${d.mvrv.toFixed(2)} / ${d.nupl.toFixed(3)}`, d.mvrv === null ? "N/A" : d.mvrv > 3 ? "Red" : "Yellow"],
    ["Liquidation Risk", "Forced longs / shorts", `${formatCompactUsd(d.longLiquidationUsd || 0)} / ${formatCompactUsd(d.shortLiquidationUsd || 0)}`, "Yellow"],
    ["Volatility", "Short-term price swings", d.atrPercent === null ? "N/A" : `${d.atrPercent.toFixed(2)}% ATR`, d.atrPercent === null ? "N/A" : d.atrPercent > 4 ? "Red" : "Yellow"],
  ] : [];

  return (
    <div className="btc-report-v2">
      <style>{`
        .btc-report-v2{--btc-bg:#02070b;--btc-panel:rgba(6,17,25,.82);--btc-border:rgba(53,221,206,.28);--btc-green:#12e5a6;--btc-red:#ff4b64;--btc-yellow:#ffd22e;--btc-blue:#48b9ff;--btc-muted:#8ea4b7;color:#eff7fb;padding:4px 0 34px}
        .btc-report-v2 *{box-sizing:border-box}.btc-r-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:12px 0 16px}.btc-r-brand{display:flex;gap:16px;align-items:center}.btc-logo{width:72px;height:72px;border-radius:22px;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#ffb52e,#f58c06 52%,#c96200);color:#fff;font-size:43px;font-weight:900;box-shadow:0 0 34px rgba(244,141,23,.18);border:1px solid rgba(255,255,255,.14)}.btc-r-kicker{font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:#7d94a8;font-weight:800}.btc-r-title{font-size:34px;line-height:1;font-weight:900;margin:2px 0 6px;letter-spacing:-.04em}.btc-r-price{font-size:36px;font-weight:900;letter-spacing:-.03em}.btc-r-price-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.btc-badge{padding:7px 11px;border-radius:9px;border:1px solid rgba(255,77,100,.38);background:rgba(255,77,100,.08);color:var(--btc-red);font-weight:800;font-size:12px}.btc-range{font-size:12px;color:#a1b3c1}.btc-r-actions{display:flex;gap:8px;align-items:center}.btc-mini-btn{border:1px solid rgba(117,168,201,.18);background:rgba(8,20,29,.82);color:#dceaf2;padding:9px 12px;border-radius:10px;display:flex;align-items:center;gap:7px;cursor:pointer}.btc-mini-btn:hover{border-color:rgba(72,185,255,.45);background:rgba(72,185,255,.08)}.btc-top-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.btc-top-card{padding:12px 14px;border:1px solid rgba(83,157,194,.22);border-radius:12px;background:linear-gradient(180deg,rgba(9,23,33,.78),rgba(5,14,21,.94));min-height:76px}.btc-top-card .k{font-size:10px;color:#9bb1bf}.btc-top-card .v{font-size:19px;font-weight:800;margin-top:4px}.btc-top-card .s{font-size:11px;margin-top:3px}.btc-green{color:var(--btc-green)}.btc-red{color:var(--btc-red)}.btc-yellow{color:var(--btc-yellow)}.btc-muted{color:var(--btc-muted)}
        .btc-main-grid{display:grid;grid-template-columns:1.2fr .95fr .82fr;gap:9px;margin-top:10px}.btc-panel{border:1px solid var(--btc-border);border-radius:12px;background:linear-gradient(180deg,rgba(7,21,31,.78),rgba(3,10,16,.96));overflow:hidden;box-shadow:inset 0 0 24px rgba(20,184,170,.025)}.btc-panel-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:12px 14px 8px}.btc-section-title{display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px;letter-spacing:.01em}.btc-section-title .accent{color:var(--btc-green)}.btc-sub{font-size:10px;color:#7891a5}.btc-tf{display:flex;gap:5px}.btc-tf button{padding:6px 9px;border:1px solid rgba(94,157,210,.14);border-radius:7px;background:rgba(6,18,27,.78);color:#92a8b8;cursor:pointer;font-size:10px}.btc-tf button.active{color:#fff;border-color:rgba(72,185,255,.6);background:rgba(72,185,255,.14)}.btc-chart{height:275px;padding:0 10px 10px}.btc-chart-surface{height:100%;border-radius:8px;background:linear-gradient(180deg,rgba(7,19,28,.96),rgba(4,13,19,.95));overflow:hidden;border:1px solid rgba(82,140,176,.1)}.btc-chart-footer{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 10px 10px}.btc-foot{padding:8px 10px;border-radius:8px;background:rgba(10,27,38,.62);border:1px solid rgba(90,148,181,.12)}.btc-foot .k{font-size:9px;color:#7790a3}.btc-foot .v{font-weight:900;font-size:16px;margin-top:2px}
        .btc-read{padding:10px 14px 15px}.btc-read-hero{padding:13px;border-radius:10px;border:1px solid rgba(255,221,57,.2);background:linear-gradient(145deg,rgba(81,63,5,.18),rgba(4,14,19,.38))}.btc-read-state{font-size:18px;font-weight:900;letter-spacing:.02em;line-height:1.05}.btc-read-state span{display:block}.btc-read-copy{font-size:11px;line-height:1.55;color:#9fb2bf;margin-top:9px}.btc-level-strip{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.btc-level{padding:9px;border-radius:8px;border:1px solid rgba(94,157,210,.14);background:rgba(6,18,27,.58)}.btc-level .k{font-size:9px;color:#7b93a7}.btc-level .v{font-weight:900;font-size:13px;margin-top:3px}.btc-structure{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px}.btc-structure .box{padding:9px;border-radius:8px;background:rgba(7,20,29,.6);border:1px solid rgba(86,157,192,.12)}.btc-structure b{display:block;margin-top:3px;font-size:13px}
        .btc-gauge{padding:14px}.btc-gauge-wrap{position:relative;height:172px;display:grid;place-items:center}.btc-gauge-ring{width:150px;height:150px;border-radius:50%;background:conic-gradient(from 270deg,#12dca6 0 25%,#ffd52e 25% 50%,#ff8d22 50% 75%,#ff475d 75% 100%);mask:radial-gradient(circle 50px,transparent 98%,#000 101%);-webkit-mask:radial-gradient(circle 50px,transparent 98%,#000 101%)}.btc-gauge-needle{position:absolute;bottom:50%;left:50%;width:3px;height:60px;background:#fff;border-radius:2px;transform-origin:50% 100%;box-shadow:0 0 12px rgba(255,255,255,.2)}.btc-gauge-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-36%);text-align:center}.btc-gauge-center .n{font-size:26px;font-weight:900}.btc-gauge-center .s{font-size:10px;color:#96a9b6}.btc-stage{padding:10px;border:1px solid rgba(18,229,166,.25);border-radius:9px;background:rgba(18,229,166,.04);font-size:10px;color:#9fb2bf}.btc-stage b{display:block;font-size:14px;color:#ffd33a;margin-top:3px}.btc-cycle-legend{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:9px;font-size:8px;color:#8499aa}.btc-cycle-legend span{padding:5px 4px;border-radius:6px;background:rgba(8,21,31,.6);text-align:center}
        .btc-signal-panel{margin-top:9px}.btc-table-wrap{overflow:auto}.btc-signal-table{width:100%;border-collapse:collapse;font-size:10px}.btc-signal-table th,.btc-signal-table td{padding:8px 9px;border-top:1px solid rgba(89,146,177,.1);text-align:left;white-space:nowrap}.btc-signal-table th{font-size:9px;color:#7791a4;text-transform:uppercase;letter-spacing:.06em}.btc-status-dot{display:inline-flex;align-items:center;gap:6px}.btc-status-dot i{width:8px;height:8px;border-radius:50%;display:inline-block}.dot-green{background:var(--btc-green)}.dot-yellow{background:var(--btc-yellow)}.dot-red{background:var(--btc-red)}.dot-na{background:#687885}
        .btc-bottom-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:9px;margin-top:9px}.btc-metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;padding:10px 12px 12px}.btc-metric{padding:10px;border-radius:8px;background:rgba(7,21,31,.58);border:1px solid rgba(84,149,183,.1)}.btc-metric .k{font-size:9px;color:#7d95a6}.btc-metric .v{font-size:16px;font-weight:900;margin-top:3px}.btc-mini-bars{display:flex;align-items:flex-end;gap:4px;height:36px;margin-top:5px}.btc-mini-bars i{display:block;width:7px;border-radius:2px 2px 0 0;background:linear-gradient(180deg,#28c7ff,#126ea8);opacity:.86}.btc-mini-bars.green i{background:linear-gradient(180deg,#14e4a6,#14795e)}.btc-mini-bars.yellow i{background:linear-gradient(180deg,#ffdd2f,#9c7e12)}
        .btc-cycle-map{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:11px}.btc-cycle-node{padding:11px 6px;border-radius:10px;text-align:center;border:1px solid rgba(89,150,184,.12);background:rgba(7,20,29,.6)}.btc-cycle-node .icon{font-size:20px}.btc-cycle-node .lbl{font-size:9px;color:#91a6b5;margin-top:5px}.btc-cycle-node.active{border-color:rgba(255,210,47,.45);background:rgba(255,210,47,.06)}.btc-takeaways,.btc-alerts,.btc-statement,.btc-watch{padding:10px 12px}.btc-list{display:grid;gap:7px;margin:7px 0 0;padding:0;list-style:none}.btc-list li{font-size:10px;color:#9eb0bd;display:flex;gap:8px;line-height:1.45}.btc-list b{color:#f2f7fa}.btc-rule{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-top:1px solid rgba(90,144,173,.1);font-size:10px;color:#a2b4bf}.btc-rule:first-child{border-top:0}.btc-rule-dot{width:9px;height:9px;border-radius:50%;margin-top:3px;flex:none}.btc-rule.green .btc-rule-dot{background:var(--btc-green)}.btc-rule.yellow .btc-rule-dot{background:var(--btc-yellow)}.btc-rule.red .btc-rule-dot{background:var(--btc-red)}.btc-statement-text{font-size:11px;line-height:1.6;color:#a1b3bf}.btc-watch-row{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(90,144,173,.1);font-size:10px}.btc-watch-row:first-child{border-top:0}.btc-watch-row b{font-size:11px}
        @media(max-width:1100px){.btc-main-grid{grid-template-columns:1fr}.btc-top-stats{grid-template-columns:repeat(2,1fr)}.btc-bottom-grid{grid-template-columns:1fr}}@media(max-width:760px){.btc-r-head{flex-direction:column}.btc-top-stats{grid-template-columns:1fr 1fr}.btc-chart{height:230px}.btc-metric-grid{grid-template-columns:1fr 1fr}.btc-cycle-map{grid-template-columns:1fr 1fr}.btc-price{font-size:27px}.btc-r-title{font-size:26px}}
      `}</style>

      <div className="btc-r-head">
        <div className="btc-r-brand">
          <div className="btc-logo">₿</div>
          <div>
            <div className="btc-r-kicker">Bitcoin market intelligence</div>
            <div className="btc-r-price-row"><div className="btc-r-title">BITCOIN</div><span className="btc-badge">{d ? `${d.change24h >= 0 ? "▲" : "▼"} ${formatPct(d.change24h)} (24H)` : "Loading"}</span></div>
            <div className="btc-r-price">{d ? `$${formatPrice(d.price)}` : "—"}</div>
            <div className="btc-range">24h Range: {d ? `$${formatPrice(d.low24h)} – $${formatPrice(d.high24h)}` : "—"}</div>
          </div>
        </div>
        <div className="btc-r-actions">
          <button className="btc-mini-btn" type="button" onClick={() => onCoinClick("BTCUSDT")}><ChevronRight size={14} /> Chart</button>
          <button className="btc-mini-btn" type="button" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={14} /> {refreshing ? "Refreshing" : "Refresh"}</button>
        </div>
      </div>

      {error && <div className="btc-panel" style={{ padding: "10px 12px", color: "#ff7180", marginBottom: 9 }}>{error}</div>}

      <div className="btc-top-stats">
        <div className="btc-top-card"><div className="k">MARKET CAP</div><div className="v">N/A</div><div className="s btc-muted">Verified supply data unavailable</div></div>
        <div className="btc-top-card"><div className="k">24h VOLUME</div><div className="v">{d ? formatCompactUsd(d.volume24h) : "—"}</div><div className={d && d.volume24h > 0 ? "s btc-green" : "s btc-muted"}>Spot market volume</div></div>
        <div className="btc-top-card"><div className="k">DOMINANCE</div><div className="v">N/A</div><div className="s btc-muted">Verified global dominance unavailable</div></div>
        <div className="btc-top-card"><div className="k">OPEN INTEREST</div><div className="v">{d?.openInterestUsd == null ? "N/A" : formatCompactUsd(d.openInterestUsd)}</div><div className={d?.openInterestUsd != null ? "s btc-yellow" : "s btc-muted"}>BTC futures</div></div>
      </div>

      <div className="btc-main-grid">
        <div className="btc-panel">
          <div className="btc-panel-head"><div><div className="btc-section-title"><span className="accent">↗</span> PRICE ACTION <span className="btc-sub">(Live)</span></div><div className="btc-sub">BTC / USDT</div></div><div className="btc-tf">{["1m","5m","15m","1h","4h","1d"].map(tf=><button key={tf} type="button" className={chartTf===tf?"active":""} onClick={()=>setChartTf(tf)}>{tf}</button>)}</div></div>
          <div className="btc-chart"><div className="btc-chart-surface"><CoinChart symbol="BTCUSDT" /></div></div>
          <div className="btc-chart-footer"><div className="btc-foot"><div className="k">15M</div><div className={(d?.change15m ?? 0)>=0?"v btc-green":"v btc-red"}>{d ? formatPct(d.change15m) : "—"}</div></div><div className="btc-foot"><div className="k">1H</div><div className={(d?.change1h ?? 0)>=0?"v btc-green":"v btc-red"}>{d ? formatPct(d.change1h) : "—"}</div></div><div className="btc-foot"><div className="k">7D</div><div className={(d?.change7d ?? 0)>=0?"v btc-green":"v btc-red"}>{d ? formatPct(d.change7d) : "—"}</div></div></div>
        </div>

        <div className="btc-panel">
          <div className="btc-panel-head"><div className="btc-section-title"><span className="accent btc-yellow">⚠</span> CURRENT MARKET READ</div><div className="btc-sub">Derived from latest verified data</div></div>
          <div className="btc-read">
            <div className="btc-read-hero"><div className={`btc-read-state ${cautionTone}`}>{d ? d.marketCondition.toUpperCase() : "LOADING"}<span>{structureText.toUpperCase()}</span></div><div className="btc-read-copy">{marketRead}</div></div>
            <div className="btc-level-strip"><div className="btc-level"><div className="k">KEY SUPPORT</div><div className="v btc-green">{d ? `$${formatPrice(d.support)}` : "—"}</div></div><div className="btc-level"><div className="k">KEY RESISTANCE</div><div className="v btc-red">{d ? `$${formatPrice(d.resistance)}` : "—"}</div></div></div>
            <div className="btc-structure"><div className="box"><span className="btc-muted">Structure</span><b className={cautionTone === "green" ? "btc-green" : cautionTone === "red" ? "btc-red" : "btc-yellow"}>{structureText}</b></div><div className="box"><span className="btc-muted">Simple Read</span><b>{d ? (d.marketCondition === "Bullish" ? "Momentum favorable above support." : d.marketCondition === "Bearish" ? "Risk rises below support." : "Neutral until resistance breaks.") : "Loading…"}</b></div></div>
          </div>
        </div>

        <div className="btc-panel">
          <div className="btc-panel-head"><div className="btc-section-title"><span className="accent">◉</span> MARKET CYCLE SCORE <span className="btc-sub">(Analytical)</span></div><div className="btc-r-price">{d ? `${d.cycleScore}/100` : "—"}</div></div>
          <div className="btc-gauge"><div className="btc-gauge-wrap"><div className="btc-gauge-ring"/><div className="btc-gauge-needle" style={{transform:`translateX(-50%) rotate(${gaugeDeg}deg)`}}/><div className="btc-gauge-center"><div className="n">{d ? Math.round(cycle10) : "—"}</div><div className="s">/ 10</div></div></div><div className="btc-stage">Cycle Stage <b>{d ? d.cycleStage : "Loading"}</b></div><div className="btc-cycle-legend"><span>Accumulation</span><span>Markup</span><span>Distribution</span><span>Markdown</span></div></div>
        </div>
      </div>

      <div className="btc-panel btc-signal-panel">
        <div className="btc-panel-head"><div className="btc-section-title"><span className="accent">▤</span> SIGNAL TABLE <span className="btc-sub">(Based on latest verified data)</span></div></div>
        <div className="btc-table-wrap"><table className="btc-signal-table"><thead><tr><th>#</th><th>Signal</th><th>What to Watch</th><th>Current Read (Latest)</th><th>Status</th></tr></thead><tbody>{signalRows.map((row,i)=><tr key={row[0]}><td>{i+1}</td><td><b>{row[0]}</b></td><td className="btc-muted">{row[1]}</td><td>{row[2]}</td><td><span className="btc-status-dot"><i className={row[3]==="Green"?"dot-green":row[3]==="Yellow"?"dot-yellow":row[3]==="Red"?"dot-red":"dot-na"}/>{row[3]}</span></td></tr>)}</tbody></table></div>
      </div>

      <div className="btc-bottom-grid">
        <div className="btc-panel"><div className="btc-panel-head"><div className="btc-section-title"><span className="accent">▥</span> ETF / DERIVATIVES SNAPSHOT</div></div><div className="btc-metric-grid"><div className="btc-metric"><div className="k">US SPOT BTC ETF FLOWS</div><div className={d?.etfFlow == null ? "v btc-muted" : d.etfFlow >= 0 ? "v btc-green" : "v btc-red"}>{d?.etfFlow == null ? "N/A" : `${d.etfFlow >= 0?"+":""}$${d.etfFlow.toFixed(1)}M`}</div></div><div className="btc-metric"><div className="k">BTC SPOT VOLUME (24h)</div><div className="v btc-blue">{d ? formatCompactUsd(d.volume24h) : "—"}</div><div className="btc-mini-bars blue">{[25,38,27,44,34,51,48,64].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></div><div className="btc-metric"><div className="k">BTC FUTURES OPEN INTEREST</div><div className="v btc-yellow">{d?.openInterestUsd == null ? "N/A" : formatCompactUsd(d.openInterestUsd)}</div><div className="btc-mini-bars yellow">{[28,35,30,41,38,52,49,67].map((h,i)=><i key={i} style={{height:`${h}%`}}/>)}</div></div><div className="btc-metric"><div className="k">FUNDING RATE</div><div className={d?.fundingRate == null ? "v btc-muted" : d.fundingRate >= 0 ? "v btc-green" : "v btc-red"}>{d?.fundingRate == null ? "N/A" : `${(d.fundingRate*100).toFixed(4)}%`}</div><div className="btc-muted" style={{fontSize:9,marginTop:4}}>BTC perpetual</div></div></div></div>
        <div className="btc-panel"><div className="btc-panel-head"><div className="btc-section-title"><span className="accent">◫</span> KEY TAKEAWAYS</div></div><div className="btc-takeaways"><ul className="btc-list"><li><span className="btc-green">●</span><span>BTC is {d ? d.marketCondition.toLowerCase() : "loading"} with price near <b>{d ? `$${formatPrice(d.price)}` : "—"}</b>.</span></li><li><span className="btc-yellow">●</span><span>Price is {d ? (d.price < d.resistance ? "below" : "above") : "near"} the current resistance zone.</span></li><li><span className="btc-yellow">●</span><span>Cycle stage is <b>{d?.cycleStage || "Loading"}</b> with a score of <b>{d ? d.cycleScore : "—"}/100</b>.</span></li><li><span className="btc-muted">●</span><span>Funding, MVRV/NUPL or ETF flow may be <b>N/A</b> when latest verified public data is unavailable.</span></li></ul></div></div>
      </div>

      <div className="btc-bottom-grid">
        <div className="btc-panel"><div className="btc-panel-head"><div className="btc-section-title"><span className="accent btc-yellow">●</span> TOP ALERT RULES</div></div><div className="btc-alerts"><div className="btc-rule green"><span className="btc-rule-dot"/><span><b>GREEN (Healthy):</b> Price holds support and market health remains above 70.</span></div><div className="btc-rule yellow"><span className="btc-rule-dot"/><span><b>YELLOW (Caution):</b> Sideways structure, elevated leverage or resistance nearby.</span></div><div className="btc-rule red"><span className="btc-rule-dot"/><span><b>RED (Risk):</b> Price loses support or market health falls below 45.</span></div></div></div>
        <div className="btc-panel"><div className="btc-panel-head"><div className="btc-section-title"><span className="accent">▤</span> MARKET CONDITION STATEMENT</div><div className="btc-sub">Last updated {d ? new Date(d.updatedAt).toLocaleString([], {month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"}</div></div><div className="btc-statement"><div className="btc-statement-text">{d ? `BTC remains in a ${d.marketCondition.toLowerCase()} state. Price is ${d.price < d.resistance ? "below" : "above"} the current resistance area, while the key support sits near $${formatPrice(d.support)}. ${d.fundingRate == null ? "Funding data is unavailable from the latest verified endpoint." : `Funding is ${(d.fundingRate*100).toFixed(4)}%, providing a live derivatives sentiment read.`}` : "Loading statement…"}</div></div></div>
      </div>

      <div className="btc-panel" style={{marginTop:9}}><div className="btc-panel-head"><div className="btc-section-title"><span className="accent">◌</span> CYCLE MAP <span className="btc-sub">(Analytical)</span></div></div><div className="btc-cycle-map">{["Accumulation","Markup","Distribution","Markdown"].map((name,idx)=>{const active = d ? (d.cycleStage.includes("Accumulation")?idx===0:d.cycleStage.includes("Markup")?idx===1:d.cycleStage.includes("Distribution")?idx===2:idx===3) : false; return <div key={name} className={`btc-cycle-node ${active?"active":""}`}><div className="icon">{["◉","↗","◌","↘"][idx]}</div><div className="lbl">{name}</div></div>})}</div></div>

      <div className="btc-panel" style={{marginTop:9}}><div className="btc-panel-head"><div className="btc-section-title"><span className="accent">◎</span> KEY LEVELS TO WATCH <span className="btc-sub">(Analysis)</span></div></div><div className="btc-watch"><div className="btc-watch-row"><span>Resistance 2</span><b className="btc-red">{d ? `$${formatPrice(d.resistance * 1.03)}` : "—"}</b></div><div className="btc-watch-row"><span>Resistance 1</span><b className="btc-red">{d ? `$${formatPrice(d.resistance)}` : "—"}</b></div><div className="btc-watch-row"><span>Support 1</span><b className="btc-green">{d ? `$${formatPrice(d.support)}` : "—"}</b></div><div className="btc-watch-row"><span>Support 2</span><b className="btc-green">{d ? `$${formatPrice(d.support * 0.97)}` : "—"}</b></div><div className="btc-watch-row"><span>EMA 21 / 50</span><b>{d?.ema21 == null || d?.ema50 == null ? "N/A" : `$${formatPrice(d.ema21)} / $${formatPrice(d.ema50)}`}</b></div></div></div>

      {sourceNote && <div className="btc-sub" style={{ marginTop: 7 }}>{sourceNote}</div>}
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

  type PortfolioTab = "Overview" | "Holdings" | "Performance" | "History" | "Notes";

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
  const [quantityInput, setQuantityInput] = useState("");
  const [entryPriceInput, setEntryPriceInput] = useState("");
  const [investedInput, setInvestedInput] = useState("");
  const [plan, setPlan] = useState("Scalp");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<PortfolioTab>("Overview");
  const [chartRange, setChartRange] = useState("1M");
  const [showForm, setShowForm] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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
      setLastUpdated(new Date());
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

  const formatInputNumber = (value: number) => Number.isFinite(value) ? String(Number(value.toFixed(12))) : "";

  const resetForm = () => {
    setEditingId(null);
    setSymbol("BTCUSDT");
    setQuantity(0);
    setEntryPrice(0);
    setInvested(0);
    setQuantityInput("");
    setEntryPriceInput("");
    setInvestedInput("");
    setPlan("Scalp");
    setNotes("");
  };

  const startEdit = (h: Holding) => {
    setEditingId(h.id);
    setSymbol(h.symbol);
    setQuantity(h.quantity);
    setEntryPrice(h.entryPrice);
    setInvested(h.invested);
    setQuantityInput(formatInputNumber(h.quantity));
    setEntryPriceInput(formatInputNumber(h.entryPrice));
    setInvestedInput(formatInputNumber(h.invested));
    setPlan(h.plan);
    setNotes(h.notes);
    setShowForm(true);
    setActiveTab("Holdings");
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
    setSaving(true);
    setMessage("");
    try {
      await saveToSupabase(next);
      setHoldings(next);
      setMessage(editingId ? "Position updated." : "Position saved.");
      resetForm();
      setShowForm(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not save position");
    } finally {
      setSaving(false);
    }
  };

  const deleteHolding = async (id: string) => {
    if (!window.confirm("Delete this portfolio position?")) return;
    const next = holdings.filter((h) => h.id !== id);
    setSaving(true);
    setMessage("");
    try {
      await saveToSupabase(next);
      setHoldings(next);
      setMessage("Position deleted.");
      if (editingId === id) resetForm();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not delete position");
    } finally {
      setSaving(false);
    }
  };

  const parsePositive = (raw: string) => {
    if (raw === "" || raw === ".") return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  };

  const recomputeFromAnyTwo = (changed: "quantity" | "entry" | "invested", rawOverride?: string) => {
    const qRaw = changed === "quantity" ? (rawOverride ?? quantityInput) : quantityInput;
    const eRaw = changed === "entry" ? (rawOverride ?? entryPriceInput) : entryPriceInput;
    const iRaw = changed === "invested" ? (rawOverride ?? investedInput) : investedInput;

    const q = parsePositive(qRaw);
    const e = parsePositive(eRaw);
    const i = parsePositive(iRaw);

    if (changed === "quantity") {
      if (q > 0 && e > 0) {
        const next = q * e;
        setInvested(next);
        setInvestedInput(formatInputNumber(next));
      } else if (q > 0 && i > 0) {
        const next = i / q;
        setEntryPrice(next);
        setEntryPriceInput(formatInputNumber(next));
      }
      return;
    }

    if (changed === "entry") {
      if (e > 0 && q > 0) {
        const next = q * e;
        setInvested(next);
        setInvestedInput(formatInputNumber(next));
      } else if (e > 0 && i > 0) {
        const next = i / e;
        setQuantity(next);
        setQuantityInput(formatInputNumber(next));
      }
      return;
    }

    // Total invested changed: use the actual current entry or quantity value.
    if (i > 0 && e > 0) {
      const next = i / e;
      setQuantity(next);
      setQuantityInput(formatInputNumber(next));
    } else if (i > 0 && q > 0) {
      const next = i / q;
      setEntryPrice(next);
      setEntryPriceInput(formatInputNumber(next));
    }
  };

  const updateQuantityInput = (raw: string) => {
    setQuantityInput(raw);
    setQuantity(parsePositive(raw));
    recomputeFromAnyTwo("quantity", raw);
  };

  const updateEntryInput = (raw: string) => {
    setEntryPriceInput(raw);
    setEntryPrice(parsePositive(raw));
    recomputeFromAnyTwo("entry", raw);
  };

  const updateInvestedInput = (raw: string) => {
    setInvestedInput(raw);
    setInvested(parsePositive(raw));
    recomputeFromAnyTwo("invested", raw);
  };

  const calcInvestment = () => {
    const total = quantity * entryPrice;
    setInvested(total);
    setInvestedInput(formatInputNumber(total));
  };
  const calcQuantity = () => {
    if (entryPrice > 0 && invested > 0) {
      const next = invested / entryPrice;
      setQuantity(next);
      setQuantityInput(formatInputNumber(next));
    } else {
      setMessage("Enter Entry price and Total invested first.");
    }
  };
  const calcEntry = () => {
    if (quantity > 0 && invested > 0) {
      const next = invested / quantity;
      setEntryPrice(next);
      setEntryPriceInput(formatInputNumber(next));
    } else {
      setMessage("Enter Quantity and Total invested first.");
    }
  };

  const investedTotal = holdings.reduce((sum, h) => sum + h.invested, 0);
  const currentTotal = holdings.reduce((sum, h) => sum + h.quantity * (prices[h.symbol] || h.entryPrice), 0);
  const pnl = currentTotal - investedTotal;
  const pnlPct = investedTotal > 0 ? pnl / investedTotal * 100 : 0;

  const rows = useMemo(() => holdings.map((h) => {
    const current = prices[h.symbol] || h.entryPrice;
    const value = h.quantity * current;
    const hpnl = value - h.invested;
    const hpnlPct = h.invested > 0 ? hpnl / h.invested * 100 : 0;
    return { ...h, current, value, hpnl, hpnlPct };
  }), [holdings, prices]);

  const allocation = useMemo(() => rows
    .map((r) => ({ symbol: r.symbol, value: r.value }))
    .sort((a, b) => b.value - a.value), [rows]);

  const maxAbsPnl = Math.max(1, ...rows.map((r) => Math.abs(r.hpnl)));
  const topPnL = [...rows].sort((a, b) => Math.abs(b.hpnl) - Math.abs(a.hpnl)).slice(0, 7);

  const avatarFor = (sym: string) => sym.replace("USDT", "").slice(0, 3).toUpperCase();
  const formatMoney = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatQty = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 8 });

  const allocationTotal = Math.max(currentTotal, 1);
  const allocationStops = allocation.map((item, i) => {
    const start = allocation.slice(0, i).reduce((sum, a) => sum + a.value, 0) / allocationTotal * 100;
    const end = (start + item.value / allocationTotal * 100);
    return `${i % 4 === 0 ? "#13c8ff" : i % 4 === 1 ? "#7b61ff" : i % 4 === 2 ? "#11d7a0" : "#f5bb1f"} ${start}% ${end}%`;
  }).slice(0, 6);

  const chartPoints = useMemo(() => {
    const base = Math.max(1, investedTotal || currentTotal);
    const rangeConfig: Record<string, { bars: number; start: number; end: number; wave: number; label: string }> = {
      "1D": { bars: 12, start: 0.98, end: 1.02, wave: 0.018, label: "Today" },
      "1W": { bars: 14, start: 0.94, end: 1.06, wave: 0.028, label: "7D" },
      "1M": { bars: 18, start: 0.78, end: 1.18, wave: 0.045, label: "1M" },
      "3M": { bars: 20, start: 0.72, end: 1.24, wave: 0.052, label: "3M" },
      "1Y": { bars: 24, start: 0.62, end: 1.34, wave: 0.065, label: "1Y" },
      "ALL": { bars: 28, start: 0.5, end: 1.42, wave: 0.08, label: "ALL" },
    };
    const cfg = rangeConfig[chartRange] || rangeConfig["1M"];
    const trend = pnlPct / 100;
    return Array.from({ length: cfg.bars }, (_, i) => {
      const phase = i / Math.max(1, cfg.bars - 1);
      const drift = cfg.start + (cfg.end - cfg.start) * phase;
      const wave = Math.sin(i * 1.25 + chartRange.length) * cfg.wave + Math.cos(i * 0.47) * cfg.wave * 0.55;
      const pnlBias = trend * (phase - 0.5) * 0.6;
      return Math.max(0.25, base * (drift + wave + pnlBias));
    });
  }, [investedTotal, currentTotal, pnlPct, chartRange]);

  const chartMax = Math.max(...chartPoints, 1);
  const chartMin = Math.min(...chartPoints, chartMax - 1);
  const chartPath = chartPoints.map((v, i) => {
    const x = 8 + (i / (chartPoints.length - 1)) * 92;
    const y = 92 - ((v - chartMin) / Math.max(1, chartMax - chartMin)) * 68;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const chartArea = `${chartPath} L 100 96 L 8 96 Z`;

  const form = (
    <div className="pred-portfolio-form">
      <div className="pred-form-head">
        <div>
          <div className="pred-eyebrow">{editingId ? "EDIT POSITION" : "ADD TRADE"}</div>
          <h3>{editingId ? "Update holding" : "New holding"}</h3>
        </div>
        <button className="pred-icon-btn" onClick={() => { setShowForm(false); if (editingId) resetForm(); }} aria-label="Close">×</button>
      </div>
      <div className="pred-form-grid">
        <label>Coin<input list="portfolio-coins" value={symbol.replace("USDT", "")} onChange={(e: ChangeEvent<HTMLInputElement>) => setSymbol(e.target.value)} placeholder="BTC" /><datalist id="portfolio-coins">{marketSymbols.map((s) => <option key={s} value={s.replace("USDT", "")} />)}</datalist></label>
        <label>Quantity<input type="text" inputMode="decimal" value={quantityInput} onChange={(e: ChangeEvent<HTMLInputElement>) => updateQuantityInput(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.01" /></label>
        <label>Avg. entry price<input type="text" inputMode="decimal" value={entryPriceInput} onChange={(e: ChangeEvent<HTMLInputElement>) => updateEntryInput(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" /></label>
        <label>Total invested<input type="text" inputMode="decimal" value={investedInput} onChange={(e: ChangeEvent<HTMLInputElement>) => updateInvestedInput(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" /></label>
        <label>Plan<input value={plan} onChange={(e: ChangeEvent<HTMLInputElement>) => setPlan(e.target.value)} placeholder="Scalp / Swing / Long-term" /></label>
        <label>Notes<input value={notes} onChange={(e: ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} placeholder="Why / thesis / risk" /></label>
      </div>
      <div className="pred-form-actions">
        <button className="pred-secondary" type="button" onClick={calcInvestment}>Auto investment</button>
        <button className="pred-secondary" type="button" onClick={calcQuantity}>Auto quantity</button>
        <button className="pred-secondary" type="button" onClick={calcEntry}>Auto entry</button>
        <button className="pred-primary" type="button" onClick={saveHolding} disabled={saving}>{saving ? "Saving..." : editingId ? "Update position" : "Add trade"}</button>
      </div>
      {message && <div className="pred-inline-message">{message}</div>}
    </div>
  );

  return (
    <div className="pred-portfolio-page">
      <style>{`
        .pred-portfolio-page{--p-bg:#030a11;--p-panel:rgba(6,18,29,.78);--p-panel2:rgba(7,23,37,.86);--p-border:rgba(94,157,210,.22);--p-text:#eaf4ff;--p-muted:#8ea5ba;--p-cyan:#48d7ff;--p-green:#12e4a1;--p-red:#ff556d;--p-blue:#4baeff;max-width:1500px;margin:0 auto;padding:22px 0 36px;color:var(--p-text)}
        .pred-portfolio-page *{box-sizing:border-box}.pred-portfolio-page button,.pred-portfolio-page input{font:inherit}.pred-portfolio-head{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px}.pred-portfolio-brand{display:flex;align-items:center;gap:15px}.pred-portfolio-mark{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;background:linear-gradient(145deg,rgba(17,222,204,.24),rgba(29,100,188,.13));border:1px solid rgba(73,210,255,.18);box-shadow:inset 0 0 28px rgba(17,219,202,.08)}.pred-portfolio-title{margin:0;font-size:31px;letter-spacing:-.04em}.pred-portfolio-sub{margin:3px 0 0;color:var(--p-muted);font-size:14px}.pred-portfolio-actions{display:flex;align-items:center;gap:10px}.pred-currency{position:relative}.pred-currency-btn{min-width:150px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 15px;border-radius:11px;border:1px solid var(--p-border);background:rgba(8,20,32,.8);color:var(--p-text);cursor:pointer}.pred-currency-menu{position:absolute;right:0;top:calc(100% + 6px);z-index:10;min-width:150px;padding:6px;border:1px solid var(--p-border);border-radius:11px;background:#07111b;box-shadow:0 20px 50px rgba(0,0,0,.4)}.pred-currency-menu button{display:block;width:100%;padding:9px 10px;text-align:left;border:0;border-radius:7px;background:transparent;color:var(--p-text);cursor:pointer}.pred-currency-menu button:hover{background:rgba(72,215,255,.09)}.pred-last{color:var(--p-muted);font-size:12px;white-space:nowrap;text-align:right}.pred-refresh{width:42px;height:42px;border-radius:11px;border:1px solid var(--p-border);background:rgba(8,20,32,.8);color:var(--p-cyan);display:grid;place-items:center;cursor:pointer}.pred-refresh:disabled{opacity:.5;cursor:not-allowed}
        .pred-tabs{display:flex;gap:0;align-items:center;margin-bottom:18px;border:1px solid var(--p-border);background:rgba(8,20,32,.62);border-radius:12px;overflow:hidden;max-width:680px}.pred-tab{flex:1;padding:12px 18px;background:transparent;border:0;border-right:1px solid rgba(94,157,210,.12);color:#9fb3c7;cursor:pointer}.pred-tab:last-child{border-right:0}.pred-tab.active{color:#eaf8ff;background:linear-gradient(180deg,rgba(34,128,186,.33),rgba(24,95,141,.16));box-shadow:inset 0 -1px 0 rgba(72,215,255,.38)}
        .pred-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.pred-stat{min-height:102px;padding:16px 18px;border:1px solid var(--p-border);border-radius:13px;background:linear-gradient(180deg,rgba(9,26,40,.78),rgba(4,14,23,.82));box-shadow:inset 0 0 22px rgba(50,190,255,.025)}.pred-stat.green{border-color:rgba(18,228,161,.28);box-shadow:inset 0 0 24px rgba(18,228,161,.045)}.pred-stat.blue{border-color:rgba(66,173,255,.3)}.pred-stat-label{color:#9ab1c5;font-size:12px;margin-bottom:10px}.pred-stat-value{font-size:25px;font-weight:800;letter-spacing:-.03em}.pred-stat-note{margin-top:8px;color:var(--p-muted);font-size:12px}.pred-up{color:var(--p-green)}.pred-down{color:var(--p-red)}
        .pred-main-grid{display:grid;grid-template-columns:1.55fr 1.15fr 1.15fr;gap:12px;margin-top:14px}.pred-panel{border:1px solid var(--p-border);border-radius:13px;background:linear-gradient(180deg,rgba(7,22,35,.77),rgba(3,12,20,.9));overflow:hidden}.pred-panel-head{display:flex;align-items:center;justify-content:space-between;padding:15px 16px 8px}.pred-panel-title{font-size:16px;font-weight:700}.pred-range{display:flex;gap:5px}.pred-range button{padding:7px 10px;border-radius:7px;border:1px solid rgba(94,157,210,.14);background:rgba(8,20,32,.6);color:#90a7bb;cursor:pointer}.pred-range button.active{color:#fff;border-color:rgba(72,215,255,.6);background:rgba(29,130,189,.18)}.pred-chart-wrap{padding:5px 12px 13px}.pred-chart{width:100%;height:200px;display:block}.pred-chart-grid{stroke:rgba(122,165,196,.08);stroke-width:.35}.pred-chart-line{fill:none;stroke:var(--p-green);stroke-width:1.25}.pred-chart-fill{fill:url(#predPortfolioFill)}.pred-chart-labels{display:flex;justify-content:space-between;padding:0 12px 12px;color:#6f879e;font-size:10px}.pred-donut-wrap{padding:6px 16px 15px;display:grid;grid-template-columns:150px 1fr;align-items:center;gap:18px}.pred-donut{width:150px;height:150px;border-radius:50%;position:relative;background:conic-gradient(${allocationStops.length?allocationStops.join(","):"#243c51 0 100%"})}.pred-donut:after{content:"";position:absolute;inset:31px;border-radius:50%;background:#07131f;border:1px solid rgba(93,154,202,.12)}.pred-donut-center{position:absolute;inset:0;display:grid;place-items:center;text-align:center;z-index:1}.pred-donut-value{font-size:20px;font-weight:800}.pred-donut-sub{font-size:11px;color:#839db1;margin-top:-42px}.pred-legend{display:flex;flex-direction:column;gap:10px;max-height:160px;overflow:auto}.pred-legend-row{display:flex;align-items:center;gap:8px;font-size:13px}.pred-dot{width:9px;height:9px;border-radius:50%}.pred-legend-row span:last-child{margin-left:auto;color:#a8bacb}.pred-pnl-list{padding:5px 15px 14px;display:flex;flex-direction:column;gap:10px}.pred-pnl-row{display:grid;grid-template-columns:78px 1fr auto;gap:10px;align-items:center;font-size:12px}.pred-pnl-name{display:flex;align-items:center;gap:7px}.pred-pnl-bar{height:10px;border-radius:999px;background:#081522;overflow:hidden;border:1px solid rgba(95,159,207,.1)}.pred-pnl-fill{height:100%;border-radius:999px}.pred-pnl-fill.up{background:linear-gradient(90deg,#0ed497,#18b8c6)}.pred-pnl-fill.down{background:linear-gradient(90deg,#ff526a,#cc354f)}.pred-pnl-value{white-space:nowrap;font-weight:700}.pred-pnl-value.up{color:var(--p-green)}.pred-pnl-value.down{color:var(--p-red)}
        .pred-holdings-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0 10px}.pred-holdings-title{font-size:20px;font-weight:800}.pred-holdings-tools{display:flex;align-items:center;gap:8px}.pred-search{min-width:220px;padding:11px 12px;border-radius:10px;border:1px solid var(--p-border);background:rgba(7,18,29,.7);color:var(--p-text);outline:none}.pred-search:focus{border-color:rgba(72,215,255,.5)}.pred-add{padding:11px 16px;border-radius:10px;border:1px solid rgba(18,228,161,.42);background:linear-gradient(180deg,rgba(17,195,151,.33),rgba(11,114,94,.24));color:#dffff5;font-weight:800;cursor:pointer}.pred-add:hover{filter:brightness(1.08)}
        .pred-table-panel{overflow:hidden}.pred-table-wrap{overflow:auto}.pred-table{width:100%;border-collapse:collapse;min-width:1050px}.pred-table th,.pred-table td{padding:12px 10px;border-bottom:1px solid rgba(95,158,206,.1);text-align:left;white-space:nowrap}.pred-table th{color:#7790a5;font-size:11px;text-transform:uppercase;letter-spacing:.08em;background:rgba(8,22,34,.72);position:sticky;top:0;z-index:1}.pred-table td{font-size:13px;color:#dfeaf4}.pred-coin{display:flex;align-items:center;gap:9px}.pred-coin-badge{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:900;background:radial-gradient(circle at 30% 25%,#f5fbff,#577289 42%,#162b3a 100%);color:#0d1822;border:1px solid rgba(255,255,255,.17)}.pred-symbol{font-weight:800}.pred-symbol-sub{display:block;color:#6f879b;font-size:10px;margin-top:2px}.pred-plan{display:inline-flex;padding:6px 9px;border-radius:7px;border:1px solid rgba(72,215,255,.22);background:rgba(26,107,150,.12);color:#a8d6ef;font-size:11px;font-weight:800}.pred-note{max-width:160px;overflow:hidden;text-overflow:ellipsis;color:#8ba1b4}.pred-action{display:flex;gap:6px}.pred-row-btn{padding:7px 9px;border-radius:7px;border:1px solid rgba(92,157,205,.16);background:rgba(9,23,35,.8);color:#9ec4df;cursor:pointer}.pred-row-btn.danger{color:#ff8192;border-color:rgba(255,85,109,.18)}
        .pred-form{margin-top:14px}.pred-portfolio-form{border:1px solid rgba(72,215,255,.22);border-radius:13px;background:linear-gradient(180deg,rgba(8,26,42,.95),rgba(3,13,23,.97));padding:16px}.pred-form-head{display:flex;align-items:flex-start;justify-content:space-between}.pred-eyebrow{font-size:10px;color:#7f98ad;letter-spacing:.08em}.pred-form-head h3{margin:5px 0 0;font-size:17px}.pred-icon-btn{width:32px;height:32px;border-radius:8px;border:1px solid rgba(94,157,210,.18);background:rgba(8,21,32,.7);color:#93a9bb;cursor:pointer;font-size:18px}.pred-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.pred-form-grid label{display:flex;flex-direction:column;gap:6px;color:#8fa7bb;font-size:11px}.pred-form-grid input{padding:11px 12px;border-radius:9px;border:1px solid rgba(94,157,210,.18);background:#071521;color:#e8f4ff;outline:none}.pred-form-grid input:focus{border-color:rgba(72,215,255,.48)}.pred-form-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.pred-primary,.pred-secondary{padding:10px 13px;border-radius:9px;cursor:pointer}.pred-primary{border:1px solid rgba(18,228,161,.4);background:linear-gradient(180deg,rgba(18,228,161,.25),rgba(9,113,86,.22));color:#e2fff7;font-weight:800}.pred-secondary{border:1px solid rgba(94,157,210,.17);background:rgba(9,23,35,.75);color:#9eb5c8}.pred-inline-message{margin-top:9px;color:#9ac0d8;font-size:12px}
        .pred-empty{padding:32px;color:#7890a4;text-align:center}.pred-view{margin-top:14px}.pred-mini-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pred-mini{padding:16px;border:1px solid var(--p-border);border-radius:12px;background:rgba(7,21,33,.76)}.pred-mini-title{font-size:12px;color:#8fa7bc}.pred-mini-value{font-size:21px;font-weight:800;margin-top:7px}.pred-note-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.pred-note-card{padding:15px;border:1px solid var(--p-border);border-radius:12px;background:rgba(7,21,33,.76)}.pred-note-card strong{display:block;margin-bottom:8px}.pred-note-card p{margin:0;color:#8aa0b4;font-size:13px;line-height:1.5}
        @media (max-width:1100px){.pred-stat-grid{grid-template-columns:repeat(2,1fr)}.pred-main-grid{grid-template-columns:1fr}.pred-form-grid{grid-template-columns:repeat(2,1fr)}}
        @media (max-width:760px){.pred-portfolio-page{padding:14px}.pred-portfolio-head{align-items:flex-start;flex-direction:column}.pred-portfolio-actions{width:100%;flex-wrap:wrap}.pred-stat-grid{grid-template-columns:1fr 1fr}.pred-tabs{max-width:none;overflow:auto}.pred-tab{min-width:110px}.pred-donut-wrap{grid-template-columns:1fr}.pred-holdings-head{align-items:flex-start;flex-direction:column}.pred-holdings-tools{width:100%;flex-wrap:wrap}.pred-search{min-width:0;flex:1;width:100%}.pred-form-grid{grid-template-columns:1fr}.pred-mini-grid,.pred-note-grid{grid-template-columns:1fr}.pred-last{text-align:left}}
      `}</style>

      <div className="pred-portfolio-head">
        <div className="pred-portfolio-brand">
          <div className="pred-portfolio-mark"><Wallet size={28} /></div>
          <div><h1 className="pred-portfolio-title">Portfolio</h1><p className="pred-portfolio-sub">Track Your Investments</p></div>
        </div>
        <div className="pred-portfolio-actions">
          <div className="pred-currency">
            <button className="pred-currency-btn" onClick={() => setCurrencyOpen((v) => !v)}><span>USD ($)</span><ChevronRight size={16} style={{ transform: currencyOpen ? "rotate(90deg)" : "rotate(0deg)" }} /></button>
            {currencyOpen && <div className="pred-currency-menu"><button onClick={() => setCurrencyOpen(false)}>USD ($)</button></div>}
          </div>
          <div className="pred-last">Last Update<br /><strong>{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</strong></div>
          <button className="pred-refresh" title="Refresh prices" onClick={refreshPrices} disabled={loading}><RefreshCw size={19} /></button>
        </div>
      </div>

      <div className="pred-tabs">
        {(["Overview", "Holdings", "Performance", "History", "Notes"] as PortfolioTab[]).map((tab) => (
          <button key={tab} className={`pred-tab${activeTab === tab ? " active" : ""}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      {activeTab !== "Overview" && activeTab !== "Holdings" && (
        <div className="pred-view">
          {activeTab === "Performance" && <div className="pred-mini-grid"><div className="pred-mini"><div className="pred-mini-title">Total P&amp;L</div><div className={`pred-mini-value ${pnl >= 0 ? "pred-up" : "pred-down"}`}>{pnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(pnl))}</div></div><div className="pred-mini"><div className="pred-mini-title">Return</div><div className={`pred-mini-value ${pnlPct >= 0 ? "pred-up" : "pred-down"}`}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</div></div><div className="pred-mini"><div className="pred-mini-title">Open Positions</div><div className="pred-mini-value">{holdings.length}</div></div></div>}
          {activeTab === "History" && <div className="pred-panel pred-table-panel"><div className="pred-panel-head"><span className="pred-panel-title">Position History</span><span className="pred-last">Saved in your Supabase portfolio</span></div><div className="pred-table-wrap"><table className="pred-table"><thead><tr><th>COIN</th><th>DATE</th><th>INVESTED</th><th>PLAN</th></tr></thead><tbody>{[...holdings].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(h=><tr key={h.id}><td><span className="pred-symbol">{h.symbol.replace("USDT","")}</span></td><td>{new Date(h.createdAt).toLocaleString()}</td><td className="mono">{formatMoney(h.invested)}</td><td><span className="pred-plan">{h.plan}</span></td></tr>)}</tbody></table></div></div>}
          {activeTab === "Notes" && <div className="pred-note-grid">{holdings.filter(h=>h.notes).map(h=><div key={h.id} className="pred-note-card"><strong>{h.symbol.replace("USDT","")}</strong><p>{h.notes}</p></div>)}{holdings.filter(h=>h.notes).length === 0 && <div className="pred-note-card"><strong>No notes yet</strong><p>Add notes to your positions and they will appear here.</p></div>}</div>}
        </div>
      )}

      {(activeTab === "Overview" || activeTab === "Holdings") && <>
        <div className="pred-stat-grid">
          <div className="pred-stat"><div className="pred-stat-label">TOTAL INVESTED</div><div className="pred-stat-value">{formatMoney(investedTotal)}</div></div>
          <div className="pred-stat green"><div className="pred-stat-label">CURRENT VALUE</div><div className="pred-stat-value">{formatMoney(currentTotal)} <span className={pnlPct >= 0 ? "pred-up" : "pred-down"} style={{ fontSize: 16 }}>{pnlPct >= 0 ? "↑" : "↓"} {Math.abs(pnlPct).toFixed(2)}%</span></div></div>
          <div className="pred-stat green"><div className="pred-stat-label">TOTAL P&amp;L</div><div className="pred-stat-value pred-up">{pnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(pnl))} <span className={pnlPct >= 0 ? "pred-up" : "pred-down"} style={{ fontSize: 16 }}>{pnlPct >= 0 ? "↑" : "↓"} {Math.abs(pnlPct).toFixed(2)}%</span></div></div>
          <div className="pred-stat blue"><div className="pred-stat-label">TOTAL COINS</div><div className="pred-stat-value">{holdings.length}</div></div>
        </div>

        {activeTab === "Overview" && <div className="pred-main-grid">
          <div className="pred-panel">
            <div className="pred-panel-head"><div className="pred-panel-title">Portfolio Chart</div><div className="pred-range">{["1D", "1W", "1M", "3M", "1Y", "ALL"].map((r) => <button type="button" key={r} className={r === chartRange ? "active" : ""} onClick={() => setChartRange(r)}>{r}</button>)}</div></div>
            <div className="pred-chart-wrap"><svg className="pred-chart" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="predPortfolioFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#13d8a4" stopOpacity=".33"/><stop offset="100%" stopColor="#13d8a4" stopOpacity="0"/></linearGradient></defs>{[18,34,50,66,82].map(y=><line key={y} x1="8" y1={y} x2="98" y2={y} className="pred-chart-grid"/>)}<path d={chartArea} className="pred-chart-fill"/><path d={chartPath} className="pred-chart-line"/></svg></div>
            <div className="pred-chart-labels"><span>{chartRange === "1D" ? "Open" : chartRange === "1W" ? "7D Start" : chartRange === "1M" ? "Month Start" : chartRange === "3M" ? "3M Start" : chartRange === "1Y" ? "Year Start" : "All Time Start"}</span><span>Recent</span><span>Current</span></div>
          </div>

          <div className="pred-panel">
            <div className="pred-panel-head"><div className="pred-panel-title">Allocation</div><span className="pred-last">{formatMoney(currentTotal)}</span></div>
            <div className="pred-donut-wrap">
              <div className="pred-donut" style={{ background: allocationStops.length ? `conic-gradient(${allocationStops.join(",")})` : "conic-gradient(#243c51 0 100%)" }}><div className="pred-donut-center"><div><div className="pred-donut-value">{formatMoney(currentTotal).replace(".00","")}</div><div className="pred-donut-sub">Total Value</div></div></div></div>
              <div className="pred-legend">{allocation.slice(0,6).map((a,i)=><div className="pred-legend-row" key={a.symbol}><span className="pred-dot" style={{ background: ["#13c8ff","#7b61ff","#11d7a0","#f5bb1f"][i%4] }} /> <span>{a.symbol.replace("USDT","")}</span><span>{(a.value / allocationTotal * 100).toFixed(1)}%</span></div>)}{allocation.length > 6 && <div className="pred-legend-row"><span className="pred-dot" style={{ background: "#6c7c8b" }} /><span>Others</span><span>{(allocation.slice(6).reduce((s,a)=>s+a.value,0)/allocationTotal*100).toFixed(1)}%</span></div>}</div>
            </div>
          </div>

          <div className="pred-panel">
            <div className="pred-panel-head"><div className="pred-panel-title">Live P&amp;L (By Coin)</div><span className="pred-last">PNL ($)</span></div>
            <div className="pred-pnl-list">{topPnL.map((r)=>{const up=r.hpnl>=0;const width=Math.max(5,Math.min(100,Math.abs(r.hpnl)/maxAbsPnl*100));return <div className="pred-pnl-row" key={r.id}><div className="pred-pnl-name"><span className="pred-coin-badge">{avatarFor(r.symbol)}</span><span>{r.symbol.replace("USDT","")}</span></div><div className="pred-pnl-bar"><div className={`pred-pnl-fill ${up?"up":"down"}`} style={{width:`${width}%`}} /></div><div className={`pred-pnl-value ${up?"up":"down"}`}>{up?"+":"-"}{formatMoney(Math.abs(r.hpnl))}</div></div>})}</div>
          </div>
        </div>}

        <div className="pred-holdings-head">
          <div className="pred-holdings-title">My Holdings ({holdings.length})</div>
          <div className="pred-holdings-tools"><input className="pred-search" placeholder="Search coin..." /><button className="pred-add" onClick={() => { setShowForm(true); setActiveTab("Holdings"); }}>＋ Add Trade</button></div>
        </div>

        {showForm && <div className="pred-form">{form}</div>}

        <div className="pred-panel pred-table-panel">
          {holdings.length === 0 ? <div className="pred-empty">No holdings yet. Add your first position above.</div> : (
            <div className="pred-table-wrap"><table className="pred-table"><thead><tr><th>#</th><th>COIN</th><th>QUANTITY</th><th>AVG. ENTRY PRICE</th><th>INVESTED</th><th>CURRENT PRICE</th><th>CURRENT VALUE</th><th>P&amp;L</th><th>P&amp;L %</th><th>PLAN</th><th>NOTES</th><th>ACTION</th></tr></thead><tbody>
              {rows.map((r, idx) => <tr key={r.id}><td>{idx+1}</td><td><div className="pred-coin"><span className="pred-coin-badge">{avatarFor(r.symbol)}</span><span><span className="pred-symbol">{r.symbol.replace("USDT","")}</span><span className="pred-symbol-sub">{r.symbol}</span></span></div></td><td className="mono">{formatQty(r.quantity)}</td><td className="mono">${formatPrice(r.entryPrice)}</td><td className="mono">{formatMoney(r.invested)}</td><td className="mono">${formatPrice(r.current)}</td><td className="mono">{formatMoney(r.value)}</td><td className={r.hpnl>=0?"pred-up":"pred-down"}>{r.hpnl>=0?"+":"-"}{formatMoney(Math.abs(r.hpnl))}</td><td className={r.hpnlPct>=0?"pred-up":"pred-down"}>{r.hpnlPct>=0?"+":""}{r.hpnlPct.toFixed(2)}%</td><td><span className="pred-plan">{r.plan}</span></td><td><span className="pred-note" title={r.notes}>{r.notes || "—"}</span></td><td><div className="pred-action"><button className="pred-row-btn" onClick={()=>startEdit(r)}>Edit</button><button className="pred-row-btn danger" onClick={()=>deleteHolding(r.id)}>Delete</button></div></td></tr>)}
            </tbody></table></div>
          )}
        </div>
      </>}
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
  const [quote, setQuote] = useState<MarketItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchJsonWithFallback<any>([
          `/api/market?ts=${Date.now()}`,
          `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
        ]);
        const marketItem = Array.isArray(data?.markets) ? data.markets.find((item: MarketItem) => item.symbol === symbol) : null;
        if (active && marketItem) setQuote(marketItem);
        if (active && !marketItem && data?.lastPrice) {
          const price = Number(data.lastPrice);
          setQuote({ symbol, price, change24h: Number(data.priceChangePercent) || 0, volume24h: Number(data.volume) || 0, quoteVolume24h: Number(data.quoteVolume) || 0, high24h: Number(data.highPrice) || 0, low24h: Number(data.lowPrice) || 0 });
        }
      } catch {
        if (active) setQuote(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [symbol]);

  const stats = [
    { label: "LIVE PRICE", value: quote ? `$${formatPrice(quote.price)}` : "—", tone: "normal" },
    { label: "24H CHANGE", value: quote ? formatPct(quote.change24h) : "—", tone: quote && quote.change24h >= 0 ? "up" : "down" },
    { label: "24H HIGH", value: quote ? `$${formatPrice(quote.high24h)}` : "—", tone: "normal" },
    { label: "24H LOW", value: quote ? `$${formatPrice(quote.low24h)}` : "—", tone: "normal" },
    { label: "QUOTE VOLUME", value: quote ? formatCompactUsd(quote.quoteVolume24h) : "—", tone: "normal" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, padding: 18, background: "rgba(0,0,0,.82)", backdropFilter: "blur(14px)", overflow: "auto" }}>
      <div className="glass-card" style={{ minHeight: "calc(100vh - 36px)", maxWidth: 1500, margin: "0 auto", background: "rgba(7,7,7,.94)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div><p className="eyebrow">COIN INTELLIGENCE</p><h1>{title}</h1><p className="muted">Live metrics + interactive price chart {loading ? "· Updating…" : "· LIVE"}</p></div>
          <button className="glass-btn" onClick={onClose} aria-label={`Close ${title} chart`}><ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /> Back</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
          {stats.map((stat) => <div key={stat.label} className="glass-card" style={{ minHeight: 82, padding: "12px 14px", background: "rgba(255,255,255,.018)" }}><span className="label">{stat.label}</span><strong className={stat.tone === "up" ? "up" : stat.tone === "down" ? "down" : "mono"} style={{ display: "block", marginTop: 8, fontSize: 17 }}>{stat.value}</strong></div>)}
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


type WatchlistQuote = {
  symbol: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  quoteVolume24h: number;
  updatedAt: number;
};

function normalizeWatchSymbol(value: string) {
  const clean = value.trim().toUpperCase().replace(/[\s$]/g, "").replace("/USDT", "").replace("USDT", "");
  if (!clean || !/^[A-Z0-9]{2,20}$/.test(clean)) return "";
  return `${clean}USDT`;
}

function Watchlist({ onCoinClick }: { onCoinClick: (symbol: string) => void }) {
  const [symbols, setSymbols] = useState<string[]>(["BTCUSDT", "ETHUSDT", "SOLUSDT"]);
  const [quotes, setQuotes] = useState<Record<string, WatchlistQuote>>({});
  const quotesRef = useRef<Record<string, WatchlistQuote>>({});
  const [priceDirection, setPriceDirection] = useState<Record<string, "up" | "down" | "flat">>({});
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [marketSymbols, setMarketSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [watchFilter, setWatchFilter] = useState<"all" | "gainers" | "losers" | "volume">("all");

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("predator-watchlist") || "null");
      if (Array.isArray(saved) && saved.length) {
        setSymbols(saved.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      // Keep the default starter watchlist.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("predator-watchlist", JSON.stringify(symbols));
  }, [hydrated, symbols]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await fetchJsonWithFallback<any>([
          "https://data-api.binance.vision/api/v3/exchangeInfo",
          "https://api.binance.com/api/v3/exchangeInfo",
        ]);
        const list = Array.isArray(info?.symbols)
          ? info.symbols
              .filter((item: any) => item?.status === "TRADING" && item?.quoteAsset === "USDT" && item?.baseAsset)
              .map((item: any) => String(item.baseAsset).toUpperCase())
              .filter((item: string, index: number, arr: string[]) => arr.indexOf(item) === index)
              .sort()
          : [];
        if (!cancelled) setMarketSymbols(list);
      } catch {
        if (!cancelled) setMarketSymbols([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadQuotes = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      if (!symbols.length) {
        setQuotes({});
        setLoading(false);
        return;
      }

      const entries = await Promise.all(symbols.map(async (symbol) => {
        try {
          const data = await fetchJsonWithFallback<any>([
            `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
            `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
          ]);
          const price = Number(data?.lastPrice);
          const change24h = Number(data?.priceChangePercent);
          const high24h = Number(data?.highPrice);
          const low24h = Number(data?.lowPrice);
          if (!Number.isFinite(price)) return null;
          return [symbol, {
            symbol,
            price,
            change24h: Number.isFinite(change24h) ? change24h : 0,
            high24h: Number.isFinite(high24h) ? high24h : 0,
            low24h: Number.isFinite(low24h) ? low24h : 0,
            quoteVolume24h: Number.isFinite(Number(data?.quoteVolume)) ? Number(data?.quoteVolume) : 0,
            updatedAt: Date.now(),
          } as WatchlistQuote] as const;
        } catch {
          return null;
        }
      }));

      const next = Object.fromEntries(entries.filter((item): item is [string, WatchlistQuote] => item !== null));
      const nextDirection: Record<string, "up" | "down" | "flat"> = {};
      Object.entries(next).forEach(([symbol, quote]) => {
        const previous = quotesRef.current[symbol]?.price;
        if (Number.isFinite(previous)) {
          nextDirection[symbol] = quote.price > Number(previous) ? "up" : quote.price < Number(previous) ? "down" : "flat";
        } else {
          nextDirection[symbol] = quote.change24h > 0 ? "up" : quote.change24h < 0 ? "down" : "flat";
        }
      });
      quotesRef.current = next;
      setQuotes(next);
      setPriceDirection(nextDirection);
      setLastUpdated(Date.now());
      const missing = symbols.filter((symbol) => !next[symbol]);
      if (missing.length) setError(`Could not load: ${missing.map((symbol) => symbol.replace("USDT", "")).join(", ")}`);
    } catch {
      setError("Live watchlist prices are temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    loadQuotes(true);
    const timer = window.setInterval(() => loadQuotes(false), 30000);
    return () => window.clearInterval(timer);
  }, [loadQuotes]);

  const addCoin = async () => {
    const symbol = normalizeWatchSymbol(input);
    if (!symbol) {
      setError("Enter a valid coin symbol, for example BTC or ETH.");
      return;
    }
    if (symbols.includes(symbol)) {
      setError(`${symbol.replace("USDT", "")} is already in your watchlist.`);
      return;
    }

    setAdding(true);
    setError("");
    try {
      const data = await fetchJsonWithFallback<any>([
        `https://data-api.binance.vision/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
      ]);
      const price = Number(data?.lastPrice);
      if (!Number.isFinite(price)) throw new Error("Coin not found");
      setSymbols((current) => [...current, symbol]);
      setInput("");
    } catch {
      setError(`${symbol.replace("USDT", "")} could not be found as a live USDT market.`);
    } finally {
      setAdding(false);
    }
  };

  const removeCoin = (symbol: string) => {
    setSymbols((current) => current.filter((item) => item !== symbol));
    setQuotes((current) => {
      const next = { ...current };
      delete next[symbol];
      quotesRef.current = next;
      return next;
    });
    setPriceDirection((current) => {
      const next = { ...current };
      delete next[symbol];
      return next;
    });
  };

  const visibleSymbols = [...symbols].filter((symbol) => {
    const quote = quotes[symbol];
    if (!quote) return watchFilter === "all";
    if (watchFilter === "gainers") return quote.change24h > 0;
    if (watchFilter === "losers") return quote.change24h < 0;
    return true;
  }).sort((a, b) => watchFilter === "volume" ? (quotes[b]?.quoteVolume24h ?? 0) - (quotes[a]?.quoteVolume24h ?? 0) : 0);

  return (
    <div className="page">
      <div className="page-head pred-watchlist-head">
        <div>
          <p className="eyebrow">MARKET TOOLS</p>
          <h1>Watchlist</h1>
          <p className="muted">Track your coins with live prices and 24H movement.</p>
        </div>
        <div className="pred-watchlist-updated">
          <span className="pred-live-dot" /> LIVE
          <span>{lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Updating..."}</span>
        </div>
      </div>

      <Card className="pred-watchlist-add-card">
        <div className="pred-watchlist-add-row">
          <div className="pred-watchlist-input-wrap">
            <Search size={16} />
            <input
              value={input}
              onFocus={() => setShowSuggestions(true)}
              onChange={(event) => {
                const value = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setInput(value);
                const matches = value && marketSymbols.length
                  ? marketSymbols.filter((symbol) => symbol.startsWith(value)).slice(0, 8)
                  : [];
                setSuggestions(matches);
                setShowSuggestions(Boolean(value && matches.length));
              }}
              onKeyDown={(event) => { if (event.key === "Enter") addCoin(); if (event.key === "Escape") setShowSuggestions(false); }}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 140)}
              placeholder="Add coin — BTC, ETH, SOL, DOGE..."
              aria-label="Add coin to watchlist"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="pred-watchlist-suggestions">
                {suggestions.map((symbol) => {
                  const base = symbol.replace("USDT", "");
                  return (
                    <button
                      key={symbol}
                      type="button"
                      className="pred-watchlist-suggestion"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { setInput(base); setShowSuggestions(false); }}
                    >
                      <span className="pred-watchlist-suggestion-icon"><img src={`https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/128/color/${base.toLowerCase()}.png`} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /></span>
                      <span>{base}</span><span className="muted">/ USDT</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button className="glass-btn pred-watchlist-add-btn" onClick={addCoin} disabled={adding}>
            <Plus size={15} /> {adding ? "Checking..." : "Add coin"}
          </button>
        </div>
        {error ? <p className="pred-watchlist-error">{error}</p> : <p className="muted pred-watchlist-hint">Type a symbol and add it. Prices refresh automatically every 30 seconds.</p>}
      </Card>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "12px 0 4px" }}>
        {([['all','All'],['gainers','Gainers'],['losers','Losers'],['volume','Volume']] as Array<[typeof watchFilter, string]>).map(([key, label]) => (
          <button key={key} type="button" className={watchFilter === key ? "chip active" : "chip"} onClick={() => setWatchFilter(key)}><SlidersHorizontal size={12} /> {label}</button>
        ))}
      </div>

      <div className="pred-watchlist-grid">
        {loading && symbols.length > 0 ? (
          visibleSymbols.map((symbol) => (
            <Card key={symbol} className="pred-watchlist-card pred-watchlist-skeleton">
              <span className="label">{symbol.replace("USDT", "")}</span>
              <strong>Loading...</strong>
              <span className="muted">Fetching live price</span>
            </Card>
          ))
        ) : symbols.length === 0 ? (
          <Card className="pred-watchlist-empty">
            <div className="pred-watchlist-empty-icon"><Plus size={18} /></div>
            <strong>Your watchlist is empty</strong>
            <span className="muted">Add your first coin above to start tracking live price.</span>
          </Card>
        ) : (
          visibleSymbols.map((symbol) => {
            const quote = quotes[symbol];
            const base = symbol.replace("USDT", "");
            const direction = priceDirection[symbol] || (quote && quote.change24h >= 0 ? "up" : "down");
            return (
              <Card key={symbol} className={`pred-watchlist-card ${direction === "up" ? "price-up" : direction === "down" ? "price-down" : "price-flat"}`}>
                <div className="pred-watchlist-card-top">
                  <button className="pred-watchlist-coin" onClick={() => onCoinClick(symbol)} title={`Open ${base} chart`}>
                    <span className="pred-watchlist-icon"><img src={`https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/128/color/${base.toLowerCase()}.png`} alt="" onError={(event) => { event.currentTarget.style.display = "none"; const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.display = "block"; }} /><CircleDollarSign className="pred-watchlist-icon-fallback" size={20} /></span>
                    <span className="pred-watchlist-symbol">{base}</span>
                    <span className="pred-watchlist-pair">/ USDT</span>
                  </button>
                  <button className="pred-watchlist-remove" onClick={() => removeCoin(symbol)} aria-label={`Remove ${base}`} title="Remove">
                    <Trash2 size={15} />
                  </button>
                </div>
                <strong className="pred-watchlist-price">{quote ? `$${formatPrice(quote.price)}` : "—"}</strong>
                <div className="pred-watchlist-meta">
                  <span className={quote && quote.change24h >= 0 ? "up" : "down"}>{quote ? formatPct(quote.change24h) : "—"}</span>
                  <span className="muted">24H</span>
                </div>
                <div className="pred-watchlist-range">
                  <span>H {quote ? formatPrice(quote.high24h) : "—"}</span>
                  <span>L {quote ? formatPrice(quote.low24h) : "—"}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

function ThemeToggle(){const [dark,setDark]=useState(true);useEffect(()=>{const saved=typeof window!=="undefined"?localStorage.getItem("predator-theme"):null;const next=saved? saved==="dark" : true;setDark(next);document.documentElement.dataset.theme=next?"dark":"light"},[]);useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light";if(typeof window!=="undefined")localStorage.setItem("predator-theme",dark?"dark":"light")},[dark]);return <button className="icon-btn" onClick={()=>setDark((v: boolean)=>!v)}>{dark?<Moon size={17}/>:<Sun size={17}/>}</button>}

const TAB_HASH: Record<Tab, string> = {
  "Dashboard": "dashboard",
  "Signal": "signal",
  "Volume Spike": "volume-spike",
  "BTC Report": "btc-report",
  "Watchlist": "watchlist",
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
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
    setMobileMoreOpen(false);
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

  const content=useMemo(()=>{switch(tab){case"Dashboard":return <Dashboard go={navigateTo} onCoinClick={openCoin}/>;case"Signal":return <Signals user={user} onCoinClick={openCoin}/>;case"Volume Spike":return <VolumeSpike onCoinClick={openCoin}/>;case"BTC Report":return <BTCReport onCoinClick={openCoin}/>;case"Watchlist":return <Watchlist onCoinClick={openCoin}/>;case"Portfolio":return <Portfolio user={user}/>;case"Calculator":return <CalculatorPage/>;case"Settings":return <SettingsPage user={user} onLogout={logout} onProfileNameChange={setProfileName}/>;default:return <Dashboard go={navigateTo} onCoinClick={openCoin}/>}},[navigateTo, openCoin, tab, user]);

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

      .pred-watchlist-head { align-items: flex-end; gap: 16px; }
      .pred-watchlist-updated { display: flex; align-items: center; gap: 8px; color: #aeb5c0; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; white-space: nowrap; }
      .pred-live-dot { width: 7px; height: 7px; border-radius: 999px; background: #31e981; box-shadow: 0 0 12px rgba(49,233,129,.6); }
      .pred-watchlist-add-card { padding: 16px !important; margin-bottom: 14px; }
      .pred-watchlist-add-row { display:flex; gap:10px; align-items:center; }
      .pred-watchlist-input-wrap { position:relative; flex:1; min-width:0; display:flex; align-items:center; gap:9px; height:44px; padding:0 13px; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.025); border-radius:12px; color:#788291; }
      .pred-watchlist-input-wrap input { flex:1; min-width:0; border:0; outline:0; background:transparent; color:#f4f5f7; font:inherit; font-size:13px; text-transform:uppercase; }
      .pred-watchlist-input-wrap input::placeholder { color:#5e6672; text-transform:none; }
      .pred-watchlist-suggestions { position:absolute; left:0; right:0; top:calc(100% + 7px); z-index:80; padding:5px; border:1px solid rgba(255,255,255,.10); border-radius:12px; background:rgba(12,14,17,.98); box-shadow:0 16px 35px rgba(0,0,0,.42); backdrop-filter:blur(18px); }
      .pred-watchlist-suggestion { width:100%; display:flex; align-items:center; gap:8px; padding:8px 9px; border:0; border-radius:8px; background:transparent; color:#eef1f5; cursor:pointer; text-align:left; font:inherit; font-size:11px; }
      .pred-watchlist-suggestion:hover { background:rgba(255,255,255,.06); }
      .pred-watchlist-suggestion-icon { width:20px; height:20px; display:grid; place-items:center; }
      .pred-watchlist-suggestion-icon img { width:19px; height:19px; object-fit:contain; }
      .pred-watchlist-add-btn { height:44px; }
      .pred-watchlist-hint, .pred-watchlist-error { margin:9px 2px 0; font-size:10px; }
      .pred-watchlist-error { color:#ff6a79; }
      .pred-watchlist-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; }
      .pred-watchlist-card { position:relative; min-height:168px; padding:17px !important; overflow:hidden; }
      .pred-watchlist-card::before { content:""; position:absolute; left:0; top:18px; bottom:18px; width:2px; border-radius:999px; transition:background .35s ease, box-shadow .35s ease, opacity .35s ease; }
      .pred-watchlist-card.price-up::before { background:linear-gradient(180deg, rgba(52,235,137,.95), rgba(52,235,137,.08)); box-shadow:0 0 12px rgba(52,235,137,.18); }
      .pred-watchlist-card.price-down::before { background:linear-gradient(180deg, rgba(255,64,86,.95), rgba(255,64,86,.08)); box-shadow:0 0 12px rgba(255,64,86,.14); }
      .pred-watchlist-card.price-flat::before { background:linear-gradient(180deg, rgba(145,153,166,.55), rgba(145,153,166,.05)); }
      .pred-watchlist-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
      .pred-watchlist-coin { padding:0; border:0; background:none; color:inherit; display:flex; align-items:baseline; gap:5px; cursor:pointer; }
      .pred-watchlist-icon { width:24px; height:24px; flex:0 0 24px; display:grid; place-items:center; color:#8c95a2; }
      .pred-watchlist-icon img { width:22px; height:22px; object-fit:contain; }
      .pred-watchlist-icon-fallback { display:none; }
      .pred-watchlist-symbol { font-family:var(--font-heading, inherit); font-size:18px; font-weight:800; letter-spacing:.04em; }
      .pred-watchlist-pair { color:#747d8a; font-size:10px; }
      .pred-watchlist-remove { width:30px; height:30px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.025); color:#7b8592; border-radius:9px; cursor:pointer; }
      .pred-watchlist-remove:hover { color:#ff6878; border-color:rgba(255,80,100,.35); }
      .pred-watchlist-price { display:block; margin-top:21px; font-family:var(--font-data,ui-monospace); font-size:27px; letter-spacing:.02em; transition:color .35s ease, text-shadow .35s ease, opacity .35s ease; }
      .pred-watchlist-card.price-up .pred-watchlist-price { color:rgba(93,242,189,.92); text-shadow:0 0 18px rgba(49,233,129,.12); }
      .pred-watchlist-card.price-down .pred-watchlist-price { color:rgba(255,106,121,.90); text-shadow:0 0 18px rgba(255,64,86,.10); }
      .pred-watchlist-card.price-flat .pred-watchlist-price { color:#f4f5f7; }
      .pred-watchlist-meta { display:flex; gap:7px; align-items:center; margin-top:6px; font-family:var(--font-data,ui-monospace); font-size:11px; }
      .pred-watchlist-range { display:flex; justify-content:space-between; gap:12px; margin-top:17px; padding-top:11px; border-top:1px solid rgba(255,255,255,.06); color:#8f97a4; font-size:9px; font-family:var(--font-data,ui-monospace); }
      .pred-watchlist-empty { grid-column:1/-1; min-height:190px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:7px; }
      .pred-watchlist-empty-icon { width:38px; height:38px; border-radius:12px; display:grid; place-items:center; border:1px solid rgba(255,255,255,.09); background:rgba(255,255,255,.03); color:#a7afbb; margin-bottom:4px; }
      .pred-watchlist-skeleton { opacity:.78; }
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
      /* Dashboard live asset strip */
      .market-price-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin-top:14px; }
      .live-price-card { position:relative; min-width:0; text-align:left; padding:16px 17px; border:1px solid rgba(255,255,255,.10); border-radius:16px; color:#f4f5f7; background:linear-gradient(145deg,rgba(18,20,23,.96),rgba(8,9,11,.98)); box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 12px 28px rgba(0,0,0,.18); overflow:hidden; }
      .live-price-card::before { content:""; position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--price-accent); box-shadow:0 0 16px var(--price-accent); }
      .live-price-btc { --price-accent:#f7931a; } .live-price-eth { --price-accent:#8b7cff; } .live-price-sol { --price-accent:#22d3ee; } .live-price-xau { --price-accent:#f5c542; }
      .live-price-top,.live-price-bottom { display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .live-price-top>div { display:flex; align-items:baseline; gap:8px; min-width:0; }
      .live-price-symbol { font-size:16px; font-weight:800; letter-spacing:.08em; }
      .live-price-name { color:#8f96a2; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .live-price-live { color:#5df2bd; border:1px solid rgba(93,242,189,.24); background:rgba(93,242,189,.06); border-radius:999px; padding:3px 7px; font-size:8px; font-weight:800; letter-spacing:.12em; }
      .live-price-card>strong { display:block; margin:13px 0 10px; font-family:var(--font-mono,monospace); font-size:clamp(19px,1.55vw,26px); letter-spacing:-.02em; }
      .live-price-bottom { color:#747b86; font-size:10px; } .live-price-bottom b { font-family:var(--font-mono,monospace); font-size:11px; }

      /* Market-session bar: active session is explicit and always visible */
      .app .topbar .sessionbar { display:grid !important; grid-template-columns:minmax(170px,210px) minmax(420px,1fr) minmax(118px,150px) !important; align-items:center !important; gap:12px !important; min-width:0 !important; width:100% !important; }
      .app .topbar .session-live-box { display:flex; align-items:center; gap:9px; min-width:0; padding:9px 12px; border:1px solid rgba(255,255,255,.10); border-radius:12px; background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018)); }
      .app .topbar .session-live-box > div { min-width:0; display:grid; gap:2px; }
      .app .topbar .session-live-box small,.app .topbar .session-now-label { font-size:7px; font-weight:800; letter-spacing:.16em; color:#747c88; }
      .app .topbar .session-live-box strong { font-family:var(--font-mono,monospace); font-size:13px; letter-spacing:.08em; white-space:nowrap; }
      .app .topbar .session-live-chip { margin-left:auto; color:#61f5c0; font-size:7px; font-weight:900; letter-spacing:.14em; padding:3px 6px; border-radius:999px; border:1px solid rgba(97,245,192,.28); background:rgba(97,245,192,.06); }
      .app .topbar .session-live-dot { width:9px; height:9px; flex:0 0 9px; border-radius:50%; box-shadow:0 0 12px currentColor; animation:predatorSessionPulse 1.6s ease-in-out infinite; }
      .session-dot-asia { color:#4ca6ff; background:#4ca6ff; } .session-dot-london { color:#31d99a; background:#31d99a; } .session-dot-newyork { color:#ffc23d; background:#ffc23d; }
      @keyframes predatorSessionPulse { 0%,100%{transform:scale(.92);opacity:.72} 50%{transform:scale(1.12);opacity:1} }
      .app .topbar .sessions { display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; gap:7px !important; min-width:0 !important; }
      .app .topbar .session { position:relative !important; min-width:0 !important; min-height:46px !important; padding:8px 10px 9px !important; border-radius:11px !important; border:1px solid rgba(255,255,255,.09) !important; background:rgba(255,255,255,.018) !important; color:#707783 !important; overflow:hidden !important; transition:border-color .25s ease,background .25s ease,transform .25s ease,opacity .25s ease !important; }
      .app .topbar .session-meta { display:flex; align-items:center; justify-content:space-between; gap:8px; position:relative; z-index:2; }
      .app .topbar .session-meta span { font-family:var(--font-mono,monospace); font-size:9px; font-weight:900; letter-spacing:.12em; }
      .app .topbar .session-meta small { font-size:7px; opacity:.7; }
      .app .topbar .session-track { position:relative; height:6px; margin-top:8px; border-radius:999px; background:rgba(255,255,255,.07); overflow:hidden; }
      .app .topbar .session-fill { height:100%; border-radius:inherit; transition:width 900ms linear; }
      .app .topbar .session-state { position:absolute; right:9px; bottom:5px; font-size:6px; font-weight:900; letter-spacing:.12em; opacity:.75; }
      .app .topbar .session-asia.active { border-color:rgba(76,166,255,.72) !important; background:linear-gradient(180deg,rgba(39,115,215,.18),rgba(16,32,55,.30)) !important; color:#d7ecff !important; transform:translateY(-1px); box-shadow:0 8px 22px rgba(34,118,219,.10); } .app .topbar .session-asia .session-fill { background:linear-gradient(90deg,#3d8dff,#56c7ff); }
      .app .topbar .session-london.active { border-color:rgba(49,217,154,.72) !important; background:linear-gradient(180deg,rgba(30,176,131,.17),rgba(11,46,39,.30)) !important; color:#c7ffeb !important; transform:translateY(-1px); box-shadow:0 8px 22px rgba(21,190,143,.10); } .app .topbar .session-london .session-fill { background:linear-gradient(90deg,#16c995,#66f2c7); }
      .app .topbar .session-newyork.active { border-color:rgba(255,194,61,.78) !important; background:linear-gradient(180deg,rgba(255,169,21,.16),rgba(57,45,8,.27)) !important; color:#fff3b4 !important; transform:translateY(-1px); box-shadow:0 8px 22px rgba(255,176,25,.10); } .app .topbar .session-newyork .session-fill { background:linear-gradient(90deg,#ff9d00,#ffd54a); }
      .app .topbar .session.past { opacity:.38; } .app .topbar .session-live-dot + div + .session-live-chip { opacity:1; }
      .app .topbar .session-now-box { min-width:0; display:grid; justify-items:end; gap:2px; padding-right:2px; }
      .app .topbar .session-now-box strong { font-family:var(--font-mono,monospace); font-size:13px; letter-spacing:.06em; color:#f1f3f6; white-space:nowrap; }
      .app .topbar .session-now-box .clock { margin-top:2px; font-family:var(--font-mono,monospace); font-size:9px; font-weight:800; color:#858d9a; white-space:nowrap; }

      .app .sidebar .mobile-more-trigger { display: none; }
      .app .sidebar .mobile-more-menu { display: none; }
      /* PREDATOR mobile app shell: presentation-only responsive overrides. */
      @media (max-width: 767px) {
        html, body { max-width: 100%; overflow-x: hidden !important; }
        .app { min-height: 100dvh !important; width: 100% !important; min-width: 0 !important; overflow-x: hidden !important; }
        .app main { width: 100% !important; min-width: 0 !important; margin-left: 0 !important; padding-left: 0 !important; }

        /* Desktop sidebar becomes a fixed mobile bottom app bar. */
        .app .sidebar {
          position: fixed !important;
          left: 0 !important;
          right: 0 !important;
          top: auto !important;
          bottom: 0 !important;
          width: 100% !important;
          height: calc(66px + env(safe-area-inset-bottom)) !important;
          min-height: 66px !important;
          max-height: 86px !important;
          z-index: 10050 !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: stretch !important;
          justify-content: center !important;
          padding: 6px 6px env(safe-area-inset-bottom) !important;
          border: 0 !important;
          border-top: 1px solid rgba(255,255,255,.10) !important;
          background: rgba(5,7,11,.96) !important;
          backdrop-filter: blur(18px) !important;
          -webkit-backdrop-filter: blur(18px) !important;
          box-shadow: 0 -10px 36px rgba(0,0,0,.36) !important;
        }
        .app .sidebar .logo-link,
        .app .sidebar .side-bottom { display: none !important; }
        .app .sidebar nav {
          width: 100% !important;
          height: 100% !important;
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          align-items: stretch !important;
          gap: 4px !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .app .sidebar nav > .nav-item:nth-child(n+5):not(.mobile-more-trigger) { display: none !important; }
        .app .sidebar nav > .mobile-more-trigger { display: flex !important; }
        .app .sidebar .mobile-more-trigger span { display: block !important; font-size: 9px !important; line-height: 1 !important; }
        .app .sidebar .mobile-more-trigger svg { width: 21px !important; height: 21px !important; }
        .app .sidebar .mobile-more-menu {
          position: fixed !important;
          z-index: 10070 !important;
          right: 10px !important;
          bottom: calc(74px + env(safe-area-inset-bottom)) !important;
          width: min(235px, calc(100vw - 20px)) !important;
          display: grid !important;
          gap: 4px !important;
          padding: 8px !important;
          border: 1px solid rgba(153,171,195,.25) !important;
          border-radius: 16px !important;
          background: rgba(10,14,21,.98) !important;
          box-shadow: 0 18px 48px rgba(0,0,0,.5) !important;
          backdrop-filter: blur(18px) !important;
          -webkit-backdrop-filter: blur(18px) !important;
        }
        .app .sidebar .mobile-more-item {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          width: 100% !important;
          min-height: 43px !important;
          padding: 10px 12px !important;
          border: 1px solid transparent !important;
          border-radius: 10px !important;
          background: transparent !important;
          color: #c4cedc !important;
          text-align: left !important;
          font-size: 13px !important;
        }
        .app .sidebar .mobile-more-item svg { width: 18px !important; height: 18px !important; flex: 0 0 18px !important; }
        .app .sidebar .mobile-more-item.active { color: #fff !important; border-color: rgba(255,55,80,.42) !important; background: rgba(255,45,70,.12) !important; }
        .app .sidebar .nav-item {
          min-width: 0 !important;
          width: 100% !important;
          height: 100% !important;
          margin: 0 !important;
          padding: 7px 2px !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 3px !important;
          border-radius: 12px !important;
          border: 1px solid transparent !important;
          background: transparent !important;
          color: #8d97a7 !important;
          font-size: 0 !important;
        }
        .app .sidebar .nav-item span { display: none !important; }
        .app .sidebar nav > .nav-item.mobile-more-trigger span { display: block !important; font-size: 9px !important; line-height: 1 !important; }
        .app .sidebar .nav-item svg { width: 22px !important; height: 22px !important; stroke-width: 1.8 !important; }
        .app .sidebar .nav-item.active {
          color: #fff !important;
          border-color: rgba(255,55,80,.42) !important;
          background: linear-gradient(180deg, rgba(255,45,70,.16), rgba(255,45,70,.05)) !important;
          box-shadow: inset 0 0 18px rgba(255,45,70,.06) !important;
        }
        .app .sidebar .nav-item.active svg { filter: drop-shadow(0 0 8px rgba(255,55,80,.28)); }

        .app .topbar {
          position: sticky !important;
          top: 0 !important;
          z-index: 10040 !important;
          display: grid !important;
          grid-template-columns: 38px minmax(0, 1fr) !important;
          grid-template-areas: "menu actions" "session session" !important;
          align-items: center !important;
          row-gap: 9px !important;
          width: 100% !important;
          min-height: 0 !important;
          height: auto !important;
          padding: 9px 10px 10px !important;
          gap: 9px !important;
          overflow: visible !important;
          backdrop-filter: blur(16px) !important;
          -webkit-backdrop-filter: blur(16px) !important;
        }
        .app .topbar > .icon-btn { grid-area: menu !important; justify-self: start !important; flex: 0 0 38px !important; width: 38px !important; height: 38px !important; }
        .app .topbar .top-actions { grid-area: actions !important; justify-self: end !important; min-width: 0 !important; }
        .app .topbar .sessionbar {
          grid-area: session !important;
          display: grid !important;
          grid-template-columns: minmax(0,1fr) 74px !important;
          grid-template-areas: "live now" "sessions sessions" !important;
          align-items: center !important;
          flex: initial !important;
          min-width: 0 !important;
          width: 100% !important;
          gap: 6px !important;
          overflow: visible !important;
        }
        .app .topbar .session-live-box { grid-area: live !important; display:flex !important; min-width:0 !important; min-height:34px !important; padding:6px 8px !important; border-radius:9px !important; gap:7px !important; }
        .app .topbar .session-live-box > div { gap:2px !important; }
        .app .topbar .session-live-box small { font-size:7px !important; } .app .topbar .session-live-box strong { font-size:10px !important; } .app .topbar .session-live-chip { font-size:7px !important; padding:2px 5px !important; }
        .app .topbar .session-live-dot { width:7px !important; height:7px !important; flex-basis:7px !important; }
        .app .topbar .sessions { grid-area: sessions !important; display:grid !important; grid-template-columns:repeat(3,minmax(0,1fr)) !important; min-width:0 !important; gap:5px !important; overflow:visible !important; }
        .app .topbar .session { min-height:39px !important; padding:6px 7px 7px !important; border-radius:9px !important; white-space:nowrap !important; }
        .app .topbar .session-meta span { font-size:8px !important; letter-spacing:.04em !important; } .app .topbar .session-meta small { font-size:7px !important; }
        .app .topbar .session-track { height:4px !important; margin-top:6px !important; } .app .topbar .session-state { display:none !important; }
        .app .topbar .session-now-box { grid-area: now !important; min-width:0 !important; justify-items:end !important; align-self:center !important; padding:0 !important; gap:2px !important; }
        .app .topbar .session-now-label { font-size:7px !important; } .app .topbar .session-now-box strong { font-size:12px !important; } .app .topbar .session-now-box .clock { font-size:8px !important; }
        .market-price-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:9px !important; }
        .pred-watchlist-grid { grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:9px !important; }
        .pred-watchlist-add-row { flex-direction:column !important; align-items:stretch !important; }
        .pred-watchlist-add-btn { width:100% !important; justify-content:center !important; }
        .pred-watchlist-head { align-items:flex-start !important; }
        .pred-watchlist-updated { font-size:8px !important; }
        .pred-watchlist-card { min-height:150px !important; padding:13px !important; }
        .pred-watchlist-price { font-size:20px !important; margin-top:15px !important; }
        .live-price-card { padding:12px 11px !important; border-radius:13px !important; } .live-price-name { display:none !important; } .live-price-symbol { font-size:13px !important; }
        .live-price-card>strong { font-size:16px !important; margin:10px 0 8px !important; } .live-price-bottom { font-size:8px !important; } .live-price-bottom b { font-size:9px !important; }
        .app .top-actions { flex: 0 0 auto !important; gap: 6px !important; }
        .app .top-actions .profile { gap: 0 !important; }
        .app .top-actions .profile span { display: none !important; }
        .app .top-actions .avatar, .app .top-actions .top-avatar-img { width: 34px !important; height: 34px !important; }
        .app .top-actions .theme-toggle, .app .top-actions .theme-btn { width: 38px !important; height: 38px !important; }

        .app .content {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 12px 10px calc(84px + env(safe-area-inset-bottom)) !important;
          overflow-x: hidden !important;
        }
        .app .predator-page-frame,
        .app .predator-content-wrap { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }

        /* Common responsive grids used by the existing desktop pages. */
        .btc-report-v2, .pred-portfolio-page { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
        .btc-main-grid, .btc-bottom-grid, .pred-main-grid { grid-template-columns: 1fr !important; }
        .btc-top-stats { grid-template-columns: 1fr 1fr !important; }
        .btc-metric-grid { grid-template-columns: 1fr 1fr !important; }
        .btc-cycle-map { grid-template-columns: 1fr 1fr !important; }
        .btc-chart-footer { grid-template-columns: 1fr !important; }
        .pred-stat-grid { grid-template-columns: 1fr 1fr !important; }
        .pred-form-grid { grid-template-columns: 1fr !important; }
        .pred-note-grid, .pred-mini-grid { grid-template-columns: 1fr !important; }
        .pred-donut-wrap { grid-template-columns: 1fr !important; }
        .pred-pnl-row { grid-template-columns: 76px minmax(0,1fr) auto !important; }
        .pred-holdings-head { flex-direction: column !important; align-items: stretch !important; }
        .pred-holdings-tools { width: 100% !important; flex-wrap: wrap !important; }
        .pred-search { min-width: 0 !important; width: 100% !important; flex: 1 1 100% !important; }
        .pred-tabs { width: 100% !important; max-width: 100% !important; overflow-x: auto !important; }
        .pred-tab { min-width: 104px !important; }

        /* Calculator has inline desktop grid styles, so override them only on mobile. */
        .page > div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; width: 100% !important; min-width: 0 !important; }
        .page .form-grid { grid-template-columns: 1fr 1fr !important; }
        .calculator-key { min-height: 54px !important; }

        /* Keep wide data tables usable without shrinking the entire app. */
        .pred-table-wrap, .btc-table-wrap { max-width: 100% !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch !important; }
        .pred-table { min-width: 980px !important; }
        .btc-signal-table { min-width: 760px !important; }

        /* Volume Spike: keep controls readable and let the table scroll horizontally. */
        .volume-spike-page, .volume-spike-container { width: 100% !important; max-width: 100% !important; min-width: 0 !important; }

        /* Touch targets and modal widths. */
        .app button, .app input, .app select { touch-action: manipulation; }
        .app [role="dialog"] { max-width: calc(100vw - 20px) !important; }
      }
      /* PREDATOR theme contrast pass — presentation only */
      html[data-theme="dark"] .app {
        color-scheme: dark;
        --bg: #070a0f;
        --panel: rgba(15, 21, 30, .96);
        --line: rgba(155, 178, 204, .20);
        --text: #f2f6fb;
        --muted: #afbdcf;
        background: #070a0f !important;
        color: #f0f5fb !important;
      }
      html[data-theme="dark"] .app .sidebar {
        background: rgba(8, 12, 18, .98) !important;
        border-color: rgba(155, 178, 204, .18) !important;
      }
      html[data-theme="dark"] .app .topbar {
        background: rgba(8, 12, 18, .96) !important;
        border-color: rgba(155, 178, 204, .18) !important;
      }
      html[data-theme="dark"] .app .glass-card {
        background: linear-gradient(145deg, rgba(17, 24, 34, .97), rgba(10, 15, 22, .99)) !important;
        border-color: rgba(151, 177, 205, .20) !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, .30), inset 0 1px 0 rgba(255, 255, 255, .035) !important;
      }
      html[data-theme="dark"] .app .muted,
      html[data-theme="dark"] .app .user-mini span,
      html[data-theme="dark"] .app .page-head .muted { color: #afbdcf !important; }
      html[data-theme="dark"] .app .eyebrow,
      html[data-theme="dark"] .app .label,
      html[data-theme="dark"] .app .form-grid label { color: #a9b8ca !important; }
      html[data-theme="dark"] .app th { color: #aebdce !important; }
      html[data-theme="dark"] .app .chip,
      html[data-theme="dark"] .app .text-btn { color: #d2dce8 !important; }
      html[data-theme="dark"] .app .icon-btn,
      html[data-theme="dark"] .app .glass-btn,
      html[data-theme="dark"] .app .chip {
        border-color: rgba(155, 178, 204, .22) !important;
        background-color: rgba(255, 255, 255, .055) !important;
      }
      html[data-theme="dark"] .app input,
      html[data-theme="dark"] .app select,
      html[data-theme="dark"] .app textarea {
        border-color: rgba(155, 178, 204, .26) !important;
      }
      html[data-theme="dark"] .app input::placeholder,
      html[data-theme="dark"] .app textarea::placeholder { color: #8899ad !important; opacity: 1 !important; }
      html[data-theme="dark"] .app .live-price-card {
        background: linear-gradient(145deg, rgba(18, 25, 35, .98), rgba(9, 14, 21, .99)) !important;
        border-color: rgba(155, 178, 204, .22) !important;
      }
      html[data-theme="dark"] .app .live-price-name { color: #a8b6c7 !important; }
      html[data-theme="dark"] .app .live-price-bottom { color: #9eacbd !important; }
      html[data-theme="dark"] .app .pred-watchlist-pair,
      html[data-theme="dark"] .app .pred-watchlist-range { color: #a7b4c5 !important; }
      html[data-theme="dark"] .app .pred-watchlist-card.price-flat .pred-watchlist-price { color: #f2f6fb !important; }
      html[data-theme="dark"] .app .pred-portfolio-page {
        --p-text: #eef5ff;
        --p-muted: #a8bbd0;
        --p-border: rgba(130, 174, 214, .27);
        color: var(--p-text) !important;
      }
      html[data-theme="dark"] .app .btc-report-v2 {
        --btc-muted: #a8bbcd;
        --btc-border: rgba(73, 220, 210, .32);
      }

      html[data-theme="light"] .app {
        color-scheme: light;
        --bg: #f3f6fa;
        --panel: #ffffff;
        --line: rgba(31, 48, 70, .15);
        --text: #172437;
        --muted: #526277;
        background: #f3f6fa !important;
        color: #1b293b !important;
      }
      html[data-theme="light"] .app main { background: #f3f6fa !important; }
      html[data-theme="light"] .app .sidebar {
        background: rgba(250, 252, 255, .98) !important;
        border-color: #d3dce7 !important;
        box-shadow: 5px 0 24px rgba(24, 39, 59, .045) !important;
      }
      html[data-theme="light"] .app .topbar {
        background: rgba(255, 255, 255, .97) !important;
        border-color: #d7dfe9 !important;
        box-shadow: 0 5px 22px rgba(24, 39, 59, .045) !important;
      }
      html[data-theme="light"] .app .content { color: #1b293b !important; }
      html[data-theme="light"] .app .glass-card {
        color: #1b293b !important;
        background: linear-gradient(145deg, #ffffff, #f8fafd) !important;
        border-color: #d3dce7 !important;
        box-shadow: 0 10px 26px rgba(27, 44, 66, .075), inset 0 1px 0 rgba(255, 255, 255, .9) !important;
      }
      html[data-theme="light"] .app .page-head h1,
      html[data-theme="light"] .app .page-head h2,
      html[data-theme="light"] .app .page-head h3 { color: #172437 !important; }
      html[data-theme="light"] .app .muted,
      html[data-theme="light"] .app .user-mini span,
      html[data-theme="light"] .app .page-head .muted { color: #526277 !important; }
      html[data-theme="light"] .app .eyebrow,
      html[data-theme="light"] .app .label,
      html[data-theme="light"] .app .form-grid label { color: #4f6075 !important; }
      html[data-theme="light"] .app .user-mini {
        background: #ffffff !important;
        border-color: #d3dce7 !important;
      }
      html[data-theme="light"] .app .user-mini b,
      html[data-theme="light"] .app .profile span { color: #1b293b !important; }
      html[data-theme="light"] .app .nav-item { color: #526277 !important; }
      html[data-theme="light"] .app .nav-item:hover { background: #edf2f8 !important; color: #1b293b !important; }
      html[data-theme="light"] .app .nav-item.active {
        background: #fff0f2 !important;
        border-color: #efb7c0 !important;
        color: #b51f38 !important;
        box-shadow: inset 3px 0 0 #dc2d48, 0 4px 12px rgba(220, 45, 72, .06) !important;
      }
      html[data-theme="light"] .app .icon-btn,
      html[data-theme="light"] .app .glass-btn,
      html[data-theme="light"] .app .chip {
        color: #33445a !important;
        background: #ffffff !important;
        border-color: #cbd6e2 !important;
        box-shadow: 0 2px 7px rgba(28, 44, 66, .035) !important;
      }
      html[data-theme="light"] .app .chip.active {
        color: #a51f37 !important;
        background: #fff0f2 !important;
        border-color: #efb7c0 !important;
      }
      html[data-theme="light"] .app .text-btn { color: #465970 !important; }
      html[data-theme="light"] .app th { color: #465970 !important; }
      html[data-theme="light"] .app td { border-color: #e0e6ee !important; }
      html[data-theme="light"] .app .row,
      html[data-theme="light"] .app .signal-row,
      html[data-theme="light"] .app .setting-row { border-color: #dfe6ee !important; }
      html[data-theme="light"] .app input,
      html[data-theme="light"] .app select,
      html[data-theme="light"] .app textarea,
      html[data-theme="light"] .app .form-grid input,
      html[data-theme="light"] .app .form-grid select {
        color: #172437 !important;
        background: #ffffff !important;
        border-color: #c7d3e0 !important;
        box-shadow: inset 0 1px 2px rgba(25, 43, 65, .025) !important;
      }
      html[data-theme="light"] .app input::placeholder,
      html[data-theme="light"] .app textarea::placeholder { color: #68788d !important; opacity: 1 !important; }
      html[data-theme="light"] .app .live-price-card {
        color: #172437 !important;
        background: linear-gradient(145deg, #ffffff, #f2f6fb) !important;
        border-color: #d0dbe7 !important;
        box-shadow: 0 8px 22px rgba(27, 44, 66, .07) !important;
      }
      html[data-theme="light"] .app .live-price-name,
      html[data-theme="light"] .app .live-price-bottom { color: #56677d !important; }
      html[data-theme="light"] .app .live-price-card > strong { color: #172437 !important; }
      html[data-theme="light"] .app .pred-watchlist-input-wrap {
        background: #ffffff !important;
        border-color: #c7d3e0 !important;
        color: #526277 !important;
      }
      html[data-theme="light"] .app .pred-watchlist-input-wrap input {
        background: transparent !important;
        color: #172437 !important;
        border: 0 !important;
      }
      html[data-theme="light"] .app .pred-watchlist-input-wrap input::placeholder { color: #68788d !important; }
      html[data-theme="light"] .app .pred-watchlist-pair,
      html[data-theme="light"] .app .pred-watchlist-range { color: #526277 !important; }
      html[data-theme="light"] .app .pred-watchlist-price { text-shadow: none !important; }
      html[data-theme="light"] .app .pred-watchlist-card.price-flat .pred-watchlist-price { color: #172437 !important; }
      html[data-theme="light"] .app .pred-watchlist-remove {
        color: #526277 !important;
        background: #f4f7fb !important;
        border-color: #d3dce7 !important;
      }
      html[data-theme="light"] .app .sidebar .mobile-more-menu { background: rgba(255,255,255,.99) !important; border-color: #d3dce7 !important; box-shadow: 0 18px 48px rgba(21,34,51,.18) !important; }
      html[data-theme="light"] .app .sidebar .mobile-more-item { color: #26364a !important; }
      html[data-theme="light"] .app .sidebar .mobile-more-item.active { color: #981d32 !important; background: #fff0f2 !important; border-color: #f1b8c2 !important; }
      html[data-theme="light"] .app .session-live-box,
      html[data-theme="light"] .app .session-now-box { color: #172437 !important; }
      html[data-theme="light"] .app .session-live-box { background: #ffffff !important; border-color: #d5dee8 !important; }
      html[data-theme="light"] .app .session-live-box small,
      html[data-theme="light"] .app .session-now-label { color: #526277 !important; }
      html[data-theme="light"] .app .session-now-box strong { color: #172437 !important; }
      html[data-theme="light"] .app .session-now-box .clock { color: #526277 !important; }
      html[data-theme="light"] .app .session-asia.active { color: #174e91 !important; background: #eaf3ff !important; border-color: #9ec7f7 !important; }
      html[data-theme="light"] .app .session-london.active { color: #126448 !important; background: #e6fbf2 !important; border-color: #8bdfbe !important; }
      html[data-theme="light"] .app .session-newyork.active { color: #805500 !important; background: #fff4d4 !important; border-color: #f1ce70 !important; }
      html[data-theme="light"] .app .pred-portfolio-page {
        --p-bg: #f3f6fa;
        --p-panel: #ffffff;
        --p-panel2: #eef3f8;
        --p-border: rgba(31, 48, 70, .16);
        --p-text: #172437;
        --p-muted: #526277;
        color: var(--p-text) !important;
      }
      html[data-theme="light"] .app .pred-portfolio-page .pred-panel,
      html[data-theme="light"] .app .pred-portfolio-page .pred-stat,
      html[data-theme="light"] .app .pred-portfolio-page .pred-mini,
      html[data-theme="light"] .app .pred-portfolio-page .pred-note-card,
      html[data-theme="light"] .app .pred-portfolio-page .pred-form,
      html[data-theme="light"] .app .pred-portfolio-page .pred-panel-head {
        background-color: #ffffff !important;
        color: #172437 !important;
        border-color: #d3dce7 !important;
      }
      html[data-theme="light"] .app .pred-portfolio-page .pred-muted,
      html[data-theme="light"] .app .pred-portfolio-page .pred-last,
      html[data-theme="light"] .app .pred-portfolio-page .pred-stat-label,
      html[data-theme="light"] .app .pred-portfolio-page .pred-mini-title { color: #526277 !important; }
      html[data-theme="light"] .app .pred-portfolio-page .pred-portfolio-title,
      html[data-theme="light"] .app .pred-portfolio-page .pred-panel-title,
      html[data-theme="light"] .app .pred-portfolio-page .pred-stat-value,
      html[data-theme="light"] .app .pred-portfolio-page .pred-mini-value { color: #172437 !important; }
      html[data-theme="light"] .app .pred-portfolio-page input,
      html[data-theme="light"] .app .pred-portfolio-page select,
      html[data-theme="light"] .app .pred-portfolio-page textarea,
      html[data-theme="light"] .app .pred-portfolio-page .pred-search {
        color: #172437 !important;
        background: #ffffff !important;
        border-color: #c7d3e0 !important;
      }


    `}</style>
    {navigationBusy ? <div className="predator-route-indicator" aria-hidden="true" /> : null}
    <aside className="sidebar"><div onClick={()=>navigateTo("Dashboard")} className="logo-link" role="button" tabIndex={0}><Logo/></div><nav>{tabs.map(({name,icon:Icon})=><button key={name} className={tab===name?"nav-item active":"nav-item"} onClick={()=>navigateTo(name)}><Icon size={18}/><span>{name}</span></button>)}<button type="button" className={`nav-item mobile-more-trigger ${mobileMoreOpen || !tabs.slice(0,4).some((item)=>item.name===tab) ? "active" : ""}`} aria-expanded={mobileMoreOpen} onClick={()=>setMobileMoreOpen((open)=>!open)}><MoreHorizontal size={18}/><span>More</span></button></nav>{mobileMoreOpen ? <div className="mobile-more-menu" role="menu">{tabs.slice(4).map(({name,icon:Icon})=><button type="button" role="menuitem" key={name} className={`mobile-more-item ${tab===name?"active":""}`} onClick={()=>navigateTo(name)}><Icon size={18}/><span>{name}</span></button>)}</div> : null}<div className="side-bottom"><div className="user-mini">{avatar ? <img src={avatar} alt={displayName} className="mini-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<div><b>{displayName}</b><span>{user.email || "Authenticated user"}</span></div></div></div></aside>
    <main><header className="topbar"><button className="icon-btn" onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={18}/></button><SessionBar/><div className="top-actions"><div className="profile">{avatar ? <img src={avatar} alt={displayName} className="top-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<span>{displayName}</span></div><ThemeToggle/></div></header><div className={"content predator-content-wrap "+(navigationBusy?"is-transitioning":"")}><div key={tab} className="predator-page-frame">{content}</div></div></main>{selectedSymbol ? <CoinDetails symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} /> : null}
  </div>
}
