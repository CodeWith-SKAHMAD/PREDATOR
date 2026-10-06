 "use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode, CSSProperties } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BarChart3, Bell, Calculator as CalculatorIcon, ChevronRight, Clock3,
  LayoutDashboard, LogOut, Moon, Newspaper, PanelLeft, RefreshCw, Settings,
  Sun, Wallet, Zap
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import CoinChart from "@/components/CoinChart";

type Tab = "Dashboard"|"Signal"|"Volume Spike"|"BTC Report"|"Portfolio"|"Calculator"|"Settings";

const tabs: {name: Tab; icon: React.ComponentType<{size?:number; strokeWidth?:number}>}[] = [
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

function Card({children,className="",onClick,style}:{children:ReactNode;className?:string;onClick?:()=>void;style?:CSSProperties}) {
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

function marketTone(change: number) {
  if (change >= 0.5) return "up";
  if (change <= -0.5) return "down";
  return "neutral";
}

function Dashboard({go, onCoinClick}:{go:(t:Tab)=>void; onCoinClick:(symbol:string)=>void}) {
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [liveSignals, setLiveSignals] = useState<any[]>([]);

  async function loadDashboardData(isManual = false) {
    if (isManual) setRefreshing(true);

    try {
      const [marketResponse, signalResponse] = await Promise.all([
        fetch("/api/market", { cache: "no-store" }),
        fetch(`/api/signals?ts=${Date.now()}`, { cache: "no-store" }),
      ]);

      const marketData = (await marketResponse.json()) as MarketResponse;
      const signalData = await signalResponse.json();

      if (!marketResponse.ok || !marketData.ok) {
        throw new Error(marketData.error || "Market data unavailable");
      }

      setMarket(marketData);
      setLiveSignals(signalData?.ok ? (signalData.rows ?? []) : []);

      setLastUpdated(
        marketData.updatedAt
          ? new Date(marketData.updatedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          : ""
      );
    } catch {
      setMarket(null);
      setLiveSignals([]);
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
  const movers = market?.markets?.slice(0, 5) ?? [];

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
      ? "Waiting for market data"
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
          <RefreshCw
            size={15}
            className={refreshing ? "spin" : ""}
          />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="stats-grid">
        <Card
          onClick={() => onCoinClick("BTCUSDT")}
          style={{ cursor: "pointer" }}
        >
          <span className="label">BTC</span>

          <strong className="price">
            {loading || !btc
              ? "—"
              : `$${formatPrice(btc.price)}`}
          </strong>

          <span
            className={
              btc && marketTone(btc.change24h) === "up"
                ? "up"
                : btc && marketTone(btc.change24h) === "down"
                  ? "muted"
                  : "muted"
            }
          >
            {loading || !btc ? "Loading..." : formatPct(btc.change24h)}
          </span>

          {btc && (
            <div className="mini-line" />
          )}
        </Card>

        <Card>
          <span className="label">MARKET STATUS</span>

          <strong>{marketStatus}</strong>

          <span className="muted">
            {marketStatusText}
          </span>

          <div className="status-dot" />
        </Card>

        <Card>
          <span className="label">ACTIVE SIGNALS</span>

          <strong>{liveSignals.length}</strong>

          <span className="muted">
            Live qualifying signals
          </span>
        </Card>

        <Card>
          <span className="label">TOP VOLUME</span>

          <strong>
            {loading || !movers[0]
              ? "—"
              : formatCompactUsd(
                  movers[0].quoteVolume24h
                )}
          </strong>

          <span className="muted">
            {movers[0]
              ? `${movers[0].symbol.replace("USDT", "")} 24H quote volume`
              : "Waiting for market data"}
          </span>
        </Card>
      </div>

      <div className="two-col">
        <Card>
          <div className="card-head">
            <div>
              <span className="label">MARKET MOVERS</span>
              <h2>Highest activity</h2>
            </div>

            <button
              className="text-btn"
              onClick={() => go("Volume Spike")}
            >
              View all
              <ChevronRight size={14} />
            </button>
          </div>

          {loading && (
            <div className="row">
              <span className="muted">Loading live markets...</span>
            </div>
          )}

          {!loading && movers.length === 0 && (
            <div className="row">
              <span className="muted">
                Market data is temporarily unavailable.
              </span>
            </div>
          )}

          {!loading &&
            movers.map((item) => {
              const symbol = item.symbol.replace("USDT", "");
              const changeClass =
                marketTone(item.change24h) === "up"
                  ? "up"
                  : marketTone(item.change24h) === "down"
                    ? "muted"
                    : "muted";

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
                      ${formatPrice(item.price)}
                    </span>
                  </div>

                  <span className={changeClass}>
                    {formatPct(item.change24h)}
                  </span>

                  <span className="mono">
                    {formatCompactUsd(item.quoteVolume24h)}
                  </span>
                </div>
              );
            })}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <span className="label">LIVE SIGNAL SUMMARY</span>
              <h2>Latest scanner</h2>
            </div>

            <button
              className="text-btn"
              onClick={() => go("Signal")}
            >
              Open
              <ChevronRight size={14} />
            </button>
          </div>

          {liveSignals.length === 0 ? (
            <div className="row">
              <span className="muted">
                No qualifying live signals right now.
              </span>
            </div>
          ) : (
            liveSignals.slice(0, 4).map((signal) => (
              <div
                className="signal-row"
                key={signal.symbol}
                onClick={() => onCoinClick(signal.symbol)}
                style={{ cursor: "pointer" }}
              >
                <div
                  className={
                    "badge " +
                    (signal.direction === "LONG" ? "long" : "short")
                  }
                >
                  {signal.direction}
                </div>

                <div>
                  <b>{signal.symbol}</b>
                  <span className="muted">
                    {signal.status}
                  </span>
                </div>

                <strong className="mono">
                  {signal.score}/150
                </strong>
              </div>
            ))
          )}
        </Card>
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
    support: number;
    resistance: number;
    atrPercent: number | null;
    invalidation: number | null;
    riskLevel: "Low" | "Moderate" | "High" | "Extreme";
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
    tool_scores: Record<string, ToolResult> | null;
    reason: string | null;
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
  const [seconds, setSeconds] = useState(1800);

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
          (item) => item.symbol
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

          const expiresAt = new Date(
            signalTime.getTime() +
              30 * 60 * 1000
          );

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
            tool_scores: signal.tools,
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

  async function loadSignals(force = false) {
    try {
      if (force) setLoading(true);

      setError("");

      const response = await fetch(
        `/api/signals?ts=${Date.now()}`,
        {
          cache: "no-store",
        }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "Signal scan failed"
        );
      }

      const nextRows =
        (payload.rows ?? []) as SignalRow[];

      setRows(nextRows);
      setLast(new Date());
      setSeconds(1800);

      await saveNewSignals(nextRows);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Signal scan failed"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSignals(true);
    loadHistory();

    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          loadSignals(true);
          return 1800;
        }

        return value - 1;
      });
    }, 1000);

    return () =>
      window.clearInterval(timer);
  }, []);

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
              loadSignals(true)
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
              <div className="signal-grid">
                {topRows.map((signal) => (
                  <Card
                    key={signal.symbol}
                    className="signal-card"
                    onClick={() =>
                      onCoinClick(signal.symbol)
                    }
                    style={{
                      cursor: "pointer",
                    }}
                  >
                    <div className="signal-top">
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

                      <div
                        style={{
                          textAlign: "right",
                        }}
                      >
                        <div className="score mono">
                          {signal.score}
                          <small>/150</small>
                        </div>

                        <div
                          className="muted"
                          style={{
                            marginTop: "3px",
                            fontSize: "9px",
                          }}
                        >
                          {categoryLabel(
                            signal.score
                          )}
                        </div>
                      </div>
                    </div>

                    <h2
                      style={{
                        marginTop: "10px",
                      }}
                    >
                      {signal.baseAsset}

                      <span
                        className="muted"
                        style={{
                          marginLeft: "5px",
                          fontSize: "11px",
                        }}
                      >
                        /USDT
                      </span>
                    </h2>

                    <div className="signal-price mono">
                      {formatPrice(signal.price)}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "7px",
                        flexWrap: "wrap",
                        marginBottom: "10px",
                      }}
                    >
                      <span
                        className="chip"
                        style={{
                          padding:
                            "5px 7px",
                          fontSize: "9px",
                        }}
                      >
                        Score {signal.score}/150
                      </span>

                      <span
                        className="chip"
                        style={{
                          padding:
                            "5px 7px",
                          fontSize: "9px",
                        }}
                      >
                        24H{" "}
                        {signal.priceChange24h >=
                        0
                          ? "+"
                          : ""}
                        {signal.priceChange24h.toFixed(
                          2
                        )}
                        %
                      </span>

                      <span
                        className="chip"
                        style={{
                          padding:
                            "5px 7px",
                          fontSize: "9px",
                        }}
                      >
                        Vol{" "}
                        {signal.volumeSpike.toFixed(
                          1
                        )}
                        x
                      </span>
                    </div>

                    <div className="metrics">
                      <span>
                        RSI
                        <b>
                          {signal.rsi === null
                            ? "N/A"
                            : signal.rsi.toFixed(
                                1
                              )}
                        </b>
                      </span>

                      <span>
                        Funding
                        <b>
                          {signal.funding === null
                            ? "N/A"
                            : `${(
                                signal.funding *
                                100
                              ).toFixed(
                                3
                              )}%`}
                        </b>
                      </span>

                      <span>
                        OI
                        <b>
                          {signal.openInterestChange ===
                          null
                            ? "N/A"
                            : `${
                                signal.openInterestChange >=
                                0
                                  ? "+"
                                  : ""
                              }${signal.openInterestChange.toFixed(
                                1
                              )}%`}
                        </b>
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop: "12px",
                        padding: "10px",
                        borderRadius:
                          "10px",
                        background:
                          "rgba(255,255,255,.025)",
                        border:
                          "1px solid rgba(255,255,255,.06)",
                      }}
                    >
                      <div
                        style={{
                          color: "#999",
                          fontSize: "9px",
                          textTransform:
                            "uppercase",
                          letterSpacing:
                            "1px",
                          marginBottom:
                            "6px",
                        }}
                      >
                        Why it triggered
                      </div>

                      <div
                        style={{
                          color: "#d2d2d2",
                          fontSize: "11px",
                          lineHeight:
                            1.55,
                        }}
                      >
                        {signal.reasons.join(
                          " · "
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: "12px",
                        padding: "11px",
                        borderRadius: "10px",
                        background: "rgba(239,35,60,.035)",
                        border: "1px solid rgba(239,35,60,.12)",
                      }}
                    >
                      <div
                        style={{
                          color: "#999",
                          fontSize: "9px",
                          textTransform: "uppercase",
                          letterSpacing: "1px",
                          marginBottom: "7px",
                        }}
                      >
                        Trade context · not an entry
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                          gap: "8px",
                        }}
                      >
                        <div>
                          <span className="muted">Current</span>
                          <b className="mono" style={{ display: "block", marginTop: "3px" }}>
                            {formatPrice(signal.price)}
                          </b>
                        </div>

                        <div>
                          <span className="muted">Risk</span>
                          <b
                            style={{
                              display: "block",
                              marginTop: "3px",
                              color: signal.riskLevel === "Extreme" || signal.riskLevel === "High" ? "#ff6476" : signal.riskLevel === "Moderate" ? "#f3b86b" : "#65e397",
                            }}
                          >
                            {signal.riskLevel}
                          </b>
                        </div>

                        <div>
                          <span className="muted">Support</span>
                          <b className="mono" style={{ display: "block", marginTop: "3px" }}>
                            {formatPrice(signal.support)}
                          </b>
                        </div>

                        <div>
                          <span className="muted">Resistance</span>
                          <b className="mono" style={{ display: "block", marginTop: "3px" }}>
                            {formatPrice(signal.resistance)}
                          </b>
                        </div>

                        <div>
                          <span className="muted">Invalidation</span>
                          <b className="mono" style={{ display: "block", marginTop: "3px" }}>
                            {signal.invalidation === null ? "N/A" : formatPrice(signal.invalidation)}
                          </b>
                        </div>

                        <div>
                          <span className="muted">ATR</span>
                          <b className="mono" style={{ display: "block", marginTop: "3px" }}>
                            {signal.atrPercent === null ? "N/A" : `${signal.atrPercent.toFixed(2)}%`}
                          </b>
                        </div>
                      </div>

                      <p
                        className="muted"
                        style={{ margin: "9px 0 0", lineHeight: 1.5 }}
                      >
                        Score measures setup alignment only. It does not create a guaranteed entry.
                      </p>
                    </div>

                    <details
                      style={{
                        marginTop:
                          "10px",
                      }}
                      onClick={(event) =>
                        event.stopPropagation()
                      }
                    >
                      <summary
                        style={{
                          cursor: "pointer",
                          color:
                            "#999",
                          fontSize:
                            "10px",
                        }}
                      >
                        View 15-tool breakdown
                      </summary>

                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "1fr auto",
                          gap: "6px 10px",
                          marginTop:
                            "10px",
                          fontSize:
                            "10px",
                        }}
                      >
                        {Object.entries(
                          signal.tools
                        ).map(
                          ([
                            name,
                            tool,
                          ]) => (
                            <div
                              key={
                                name
                              }
                              style={{
                                display:
                                  "contents",
                              }}
                            >
                              <span
                                style={{
                                  color:
                                    "#777",
                                }}
                              >
                                {
                                  name
                                }
                              </span>

                              <span
                                className="mono"
                                style={{
                                  color:
                                    tool.score >=
                                    8
                                      ? "#65e397"
                                      : tool.score <=
                                          4
                                        ? "#ff6476"
                                        : "#bbb",
                                }}
                              >
                                {
                                  tool.score
                                }
                                /10
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </details>

                    <div className="signal-foot">
                      <span className="muted">
                        Captured{" "}
                        {new Date(
                          signal.capturedAt
                        ).toLocaleTimeString(
                          [],
                          {
                            hour:
                              "2-digit",
                            minute:
                              "2-digit",
                          }
                        )}
                      </span>

                      <span className="dot-live" />
                    </div>
                  </Card>
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
                style={{
                  display: "grid",
                  gap: "14px",
                }}
              >
                {Object.entries(
                  historyGroups
                ).map(
                  ([
                    symbol,
                    items,
                  ]) => (
                    <div
                      key={symbol}
                      className="glass-card"
                      style={{
                        padding: "14px",
                      }}
                    >
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: "10px",
                          marginBottom:
                            "10px",
                        }}
                      >
                        <div>
                          <b>
                            {symbol.replace(
                              "USDT",
                              ""
                            )}
                          </b>

                          <span className="muted">
                            {" "}
                            /USDT ·{" "}
                            {items.length} scan
                            {items.length ===
                            1
                              ? ""
                              : "s"}
                          </span>
                        </div>

                        <span className="muted">
                          Newest first
                        </span>
                      </div>

                      <div
                        style={{
                          display:
                            "flex",
                          gap: "10px",
                          overflowX:
                            "auto",
                          paddingBottom:
                            "4px",
                          scrollbarWidth:
                            "thin",
                        }}
                      >
                        {items.map(
                          (item, index) => {
                            const expired =
                              item.expires_at
                                ? new Date(
                                    item.expires_at
                                  ).getTime() <=
                                  Date.now()
                                : true;

                            return (
                              <button
                                key={
                                  item.id
                                }
                                type="button"
                                onClick={() =>
                                  onCoinClick(
                                    item.symbol
                                  )
                                }
                                style={{
                                  flex:
                                    "0 0 230px",
                                  textAlign:
                                    "left",
                                  border:
                                    "1px solid rgba(255,255,255,.08)",
                                  borderRadius:
                                    "12px",
                                  padding:
                                    "12px",
                                  background:
                                    "rgba(255,255,255,.025)",
                                  color:
                                    "inherit",
                                  cursor:
                                    "pointer",
                                  position:
                                    "relative",
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    gap: "8px",
                                    alignItems:
                                      "center",
                                  }}
                                >
                                  <span
                                    className={
                                      "badge " +
                                      (item.direction ===
                                      "LONG"
                                        ? "long"
                                        : "short")
                                    }
                                  >
                                    {
                                      item.direction
                                    }
                                  </span>

                                  <span className="muted">
                                    {expired
                                      ? "EXPIRED"
                                      : "ACTIVE"}
                                  </span>
                                </div>

                                <div
                                  className="mono"
                                  style={{
                                    marginTop:
                                      "12px",
                                    fontSize:
                                      "20px",
                                  }}
                                >
                                  {
                                    item.score
                                  }
                                  <span className="muted">
                                    /150
                                  </span>
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      "5px",
                                    color:
                                      "#aaa",
                                    fontSize:
                                      "10px",
                                  }}
                                >
                                  {
                                    item.status
                                  }
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      "12px",
                                    display:
                                      "grid",
                                    gap:
                                      "5px",
                                    fontSize:
                                      "10px",
                                  }}
                                >
                                  <span className="muted">
                                    Price{" "}
                                    <b
                                      style={{
                                        color:
                                          "#ddd",
                                      }}
                                    >
                                      {item.price ===
                                      null
                                        ? "—"
                                        : formatPrice(
                                            Number(
                                              item.price
                                            )
                                          )}
                                    </b>
                                  </span>

                                  <span className="muted">
                                    Captured{" "}
                                    {new Date(
                                      item.signal_time
                                    ).toLocaleString(
                                      [],
                                      {
                                        dateStyle:
                                          "short",
                                        timeStyle:
                                          "short",
                                      }
                                    )}
                                  </span>

                                  {item.reason && (
                                    <span
                                      style={{
                                        marginTop:
                                          "4px",
                                        color:
                                          "#999",
                                        lineHeight:
                                          1.45,
                                      }}
                                    >
                                      {
                                        item.reason
                                      }
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )
                )}
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

function BTCReport(){return <div className="page"><div className="page-head"><div><p className="eyebrow">INTELLIGENCE CENTER</p><h1>BTC Report</h1><p className="muted">Market health, structure, cycle and key takeaways.</p></div></div><div className="stats-grid"><Card><span className="label">MARKET HEALTH</span><strong>82 / 100</strong><span className="up">Healthy</span></Card><Card><span className="label">MARKET CONDITION</span><strong>Bullish</strong><span className="muted">Trend aligned</span></Card><Card><span className="label">CYCLE SCORE</span><strong>74</strong><span className="muted">Expansion</span></Card><Card><span className="label">CYCLE STAGE</span><strong>Markup</strong><span className="muted">Watch resistance</span></Card></div><Card><div className="report-grid"><div><span className="label">SUPPORT</span><h2>$118,400</h2></div><div><span className="label">RESISTANCE</span><h2>$124,900</h2></div><div><span className="label">KEY TAKEAWAYS</span><p className="muted">Structure remains constructive. Confirm strength with volume and derivatives context before acting.</p></div></div></Card></div>}

function Portfolio(){const [qty,setQty]=useState(1); const [entry,setEntry]=useState(100); return <div className="page"><div className="page-head"><div><p className="eyebrow">INVESTMENTS</p><h1>Portfolio</h1><p className="muted">Track holdings, plan and live P&amp;L.</p></div><button className="glass-btn">+ Add trade</button></div><div className="stats-grid"><Card><span className="label">INVESTED</span><strong>${(qty*entry).toFixed(2)}</strong></Card><Card><span className="label">CURRENT VALUE</span><strong>$128.40</strong><span className="up">+28.40%</span></Card><Card><span className="label">TOTAL P&amp;L</span><strong className="up">+$28.40</strong></Card><Card><span className="label">COINS</span><strong>1</strong></Card></div><Card><div className="card-head"><div><span className="label">HOLDINGS</span><h2>Position tracker</h2></div></div><div className="form-grid"><label>Coin<input defaultValue="BTC"/></label><label>Quantity<input type="number" value={qty} onChange={e=>setQty(Number(e.target.value)||0)}/></label><label>Entry price<input type="number" value={entry} onChange={e=>setEntry(Number(e.target.value)||0)}/></label><label>Plan<input placeholder="Long-term / scalp"/></label></div></Card></div>}

function CalculatorPage(){const [a,setA]=useState(100);const [p,setP]=useState(10);const [from,setFrom]=useState("EUR");const [to,setTo]=useState("USD");return <div className="page"><div className="page-head"><div><p className="eyebrow">TOOLS</p><h1>Calculator</h1><p className="muted">Quick trading and currency utilities.</p></div></div><div className="two-col"><Card><span className="label">PERCENTAGE</span><h2>Percentage calculator</h2><div className="form-grid"><label>Main data<input type="number" value={a} onChange={e=>setA(Number(e.target.value))}/></label><label>% input<input type="number" value={p} onChange={e=>setP(Number(e.target.value))}/></label></div><div className="result mono">{(a*p/100).toFixed(2)}</div></Card><Card><span className="label">CURRENCY</span><h2>Converter</h2><div className="form-grid"><label>Amount<input defaultValue="100"/></label><label>From<select value={from} onChange={e=>setFrom(e.target.value)}><option>EUR</option><option>USD</option><option>BDT</option></select></label><label>To<select value={to} onChange={e=>setTo(e.target.value)}><option>USD</option><option>EUR</option><option>BDT</option></select></label></div><p className="muted">Live rates will be connected in the data integration phase.</p></Card></div></div>}


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

function SettingsPage({
  user,
  onLogout,
  onProfileNameChange,
}: {
  user: User;
  onLogout: () => void;
  onProfileNameChange: (name: string) => void;
}) {
  const displayNameFromAuth = getDisplayName(user);
  const avatar = getAvatar(user);
  const provider = user.app_metadata?.provider || "email";

  const [name, setName] = useState(displayNameFromAuth);
  const [experience, setExperience] = useState("Beginner");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("display_name, trading_experience")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setStatus(error.message);
      } else {
        const savedName = data?.display_name || displayNameFromAuth;
        setName(savedName);
        setExperience(
          data?.trading_experience || "Beginner"
        );
      }

      setLoading(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user.id, displayNameFromAuth]);

  async function saveProfile() {
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }

    const cleanName = name.trim();

    if (!cleanName) {
      setStatus("Name cannot be empty.");
      return;
    }

    setSaving(true);
    setStatus("");

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: cleanName,
        trading_experience: experience,
      })
      .eq("id", user.id);

    if (error) {
      setStatus(error.message);
    } else {
      setName(cleanName);
      onProfileNameChange(cleanName);
      setStatus("Profile saved successfully.");
    }

    setSaving(false);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h1>Settings</h1>
          <p className="muted">
            Profile, preferences and security.
          </p>
        </div>
      </div>

      <div className="two-col">
        <Card>
          <span className="label">PROFILE</span>
          <h2>Account details</h2>

          <div className="account-profile">
            {avatar ? (
              <img
                src={avatar}
                alt={name}
                className="account-avatar"
              />
            ) : (
              <div className="account-avatar-fallback">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div>
              <strong>{name}</strong>
              <p className="muted">
                {provider === "discord"
                  ? "Discord account"
                  : "Email account"}
              </p>
            </div>
          </div>

          <div className="form-grid">
            <label>
              Name
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                disabled={loading || saving}
              />
            </label>

            <label>
              Email
              <input
                value={user.email || ""}
                disabled
              />
            </label>

            <label>
              Discord
              <input
                value={
                  provider === "discord"
                    ? "Connected"
                    : "Not connected"
                }
                disabled
                readOnly
              />
            </label>

            <label>
              Trading experience
              <select
                value={experience}
                onChange={(event) =>
                  setExperience(event.target.value)
                }
                disabled={loading || saving}
              >
                <option value="Beginner">
                  Beginner
                </option>
                <option value="Intermediate">
                  Intermediate
                </option>
                <option value="Advanced">
                  Advanced
                </option>
              </select>
            </label>
          </div>

          <button
            className="glass-btn"
            onClick={saveProfile}
            disabled={loading || saving}
          >
            {saving ? "Saving..." : "Save profile"}
          </button>

          {status && (
            <p className="muted" style={{ marginTop: "12px" }}>
              {status}
            </p>
          )}
        </Card>

        <Card>
          <span className="label">PREFERENCES</span>
          <h2>Interface</h2>

          <div className="setting-row">
            <span>Theme</span>
            <ThemeToggle />
          </div>

          <div className="setting-row">
            <span>Session alerts</span>
            <span className="toggle" />
          </div>

          <button
            className="glass-btn logout-btn"
            onClick={onLogout}
          >
            <LogOut size={16} />
            Logout
          </button>

          <div className="danger">
            Delete account
          </div>
        </Card>
      </div>
    </div>
  );
}

function ThemeToggle(){const [dark,setDark]=useState(true);useEffect(()=>{document.documentElement.dataset.theme=dark?"dark":"light"},[dark]);return <button className="icon-btn" onClick={()=>setDark(v=>!v)}>{dark?<Moon size={17}/>:<Sun size={17}/>}</button>}

export default function PredatorApp({ user }: { user: User }){
  const [tab,setTab]=useState<Tab>("Dashboard");
  const [collapsed,setCollapsed]=useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [profileName, setProfileName] = useState(() => getDisplayName(user));
  const displayName = profileName;
  const avatar = getAvatar(user);

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };
  const content=useMemo(()=>{switch(tab){case"Dashboard":return <Dashboard go={setTab} onCoinClick={setSelectedSymbol}/>;case"Signal":return <Signals user={user} onCoinClick={setSelectedSymbol}/>;case"Volume Spike":return <VolumeSpike onCoinClick={setSelectedSymbol}/>;case"BTC Report":return <BTCReport/>;case"Portfolio":return <Portfolio/>;case"Calculator":return <CalculatorPage/>;case"Settings":return <SettingsPage user={user} onLogout={logout} onProfileNameChange={setProfileName}/>;default:return <Dashboard go={setTab} onCoinClick={setSelectedSymbol}/>}},[tab]);
  return <div className={"app "+(collapsed?"collapsed":"")}>
    <aside className="sidebar"><div onClick={()=>setTab("Dashboard")} className="logo-link"><Logo/></div><nav>{tabs.map(({name,icon:Icon})=><button key={name} className={tab===name?"nav-item active":"nav-item"} onClick={()=>setTab(name)}><Icon size={18}/><span>{name}</span></button>)}</nav><div className="side-bottom"><div className="user-mini">{avatar ? <img src={avatar} alt={displayName} className="mini-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<div><b>{displayName}</b><span>{user.email || "Authenticated user"}</span></div></div></div></aside>
    <main><header className="topbar"><button className="icon-btn" onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={18}/></button><SessionBar/><div className="top-actions"><button className="icon-btn" aria-label="Notifications"><Bell size={17}/></button><div className="profile">{avatar ? <img src={avatar} alt={displayName} className="top-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<span>{displayName}</span></div><ThemeToggle/></div></header><div className="content">{content}</div></main>{selectedSymbol ? <CoinDetails symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} /> : null}
  </div>
}
