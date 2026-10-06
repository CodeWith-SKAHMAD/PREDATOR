 "use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  BarChart3, Bell, Calculator as CalculatorIcon, ChevronRight, Clock3,
  LayoutDashboard, LogOut, Moon, Newspaper, PanelLeft, RefreshCw, Settings,
  Sun, Wallet, Zap
} from "lucide-react";
import { supabase } from "@/lib/supabase";

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

function Card({children,className=""}:{children:React.ReactNode,className?:string}) {
  return <div className={"glass-card "+className}>{children}</div>
}

function Dashboard({go}:{go:(t:Tab)=>void}) {
  return <div className="page">
    <div className="page-head"><div><p className="eyebrow">OVERVIEW</p><h1>Dashboard</h1><p className="muted">Market intelligence at a glance.</p></div><button className="glass-btn"><RefreshCw size={15}/> Live</button></div>
    <div className="stats-grid">
      <Card><span className="label">BTC</span><strong className="price">$121,840</strong><span className="up">+2.84%</span><div className="mini-line"/></Card>
      <Card><span className="label">MARKET STATUS</span><strong>Risk-On</strong><span className="up">Bullish structure</span><div className="status-dot"/></Card>
      <Card><span className="label">ACTIVE SIGNALS</span><strong>12</strong><span className="muted">4 Strong · 5 Valid</span></Card>
      <Card><span className="label">VOLUME</span><strong>High</strong><span className="muted">+38% vs average</span></Card>
    </div>
    <div className="two-col">
      <Card><div className="card-head"><div><span className="label">MARKET MOVERS</span><h2>Top movement</h2></div><button className="text-btn" onClick={()=>go("Volume Spike")}>View all <ChevronRight size={14}/></button></div>
        {spikes.map((x,i)=><div className="row" key={i}><div><b>{x[0]}</b><span className="muted">{x[5]} activity</span></div><span className="up">+{i+2}.4%</span><span className="mono">{x[1]}</span></div>)}
      </Card>
      <Card><div className="card-head"><div><span className="label">SIGNAL SUMMARY</span><h2>Latest scanner</h2></div><button className="text-btn" onClick={()=>go("Signal")}>Open <ChevronRight size={14}/></button></div>
        {signals.slice(0,3).map((s,i)=><div className="signal-row" key={i}><div className={"badge "+(s[1]==="LONG"?"long":"short")}>{s[1]}</div><div><b>{s[0]}</b><span className="muted">{s[3]}</span></div><strong className="mono">{s[2]}/150</strong></div>)}
      </Card>
    </div>
  </div>
}

function Signals() {
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

  const [rows, setRows] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [last, setLast] = useState<Date | null>(null);
  const [seconds, setSeconds] = useState(1800);

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

      setRows(payload.rows ?? []);
      setLast(new Date());
      setSeconds(1800);
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

    const timer = window.setInterval(() => {
      setSeconds((value) => {
        if (value <= 1) {
          loadSignals(true);
          return 1800;
        }

        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const categoryLabel = (score: number) => {
    if (score >= 120) return "Extended / Pumped";
    if (score >= 110) return "Strong";
    if (score >= 100) return "Valid";
    if (score >= 80) return "Observe";
    return "Ignore";
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

  const topRows = rows.slice(0, 24);

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
            {String(Math.floor(seconds / 60)).padStart(
              2,
              "0"
            )}
            :
            {String(seconds % 60).padStart(2, "0")}
          </span>

          <button
            className="glass-btn"
            onClick={() => loadSignals(true)}
            disabled={loading}
          >
            <RefreshCw
              size={15}
              style={loading ? { animation: "predator-spin 1s linear infinite" } : undefined}
            />
            Force refresh
          </button>
        </div>
      </div>

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
            <h2 style={{ marginTop: "4px" }}>
              {loading
                ? "Scanning markets..."
                : `${topRows.length} active signals`}
            </h2>
          </div>

          {last && (
            <span className="muted">
              Updated{" "}
              {last.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
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
                style={{ marginTop: "6px" }}
              >
                The scanner only shows coins scoring
                80+.
              </p>
            </div>
          )}
      </Card>

      {!loading && topRows.length > 0 && (
        <div className="signal-grid">
          {topRows.map((signal) => (
            <Card
              key={signal.symbol}
              className="signal-card"
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

                <div style={{ textAlign: "right" }}>
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
                    padding: "5px 7px",
                    fontSize: "9px",
                  }}
                >
                  Score {signal.score}/150
                </span>

                <span
                  className="chip"
                  style={{
                    padding: "5px 7px",
                    fontSize: "9px",
                  }}
                >
                  24H{" "}
                  {signal.priceChange24h >= 0
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
                    padding: "5px 7px",
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
                      : signal.rsi.toFixed(1)}
                  </b>
                </span>

                <span>
                  Funding
                  <b>
                    {signal.funding === null
                      ? "N/A"
                      : `${(
                          signal.funding * 100
                        ).toFixed(3)}%`}
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
                  borderRadius: "10px",
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
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "6px",
                  }}
                >
                  Why it triggered
                </div>

                <div
                  style={{
                    color: "#d2d2d2",
                    fontSize: "11px",
                    lineHeight: 1.55,
                  }}
                >
                  {signal.reasons.join(
                    " · "
                  )}
                </div>
              </div>

              <details
                style={{
                  marginTop: "10px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    color: "#999",
                    fontSize: "10px",
                  }}
                >
                  View 15-tool breakdown
                </summary>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1fr auto",
                    gap: "6px 10px",
                    marginTop: "10px",
                    fontSize: "10px",
                  }}
                >
                  {Object.entries(
                    signal.tools
                  ).map(
                    ([name, tool]) => (
                      <div
                        key={name}
                        style={{
                          display: "contents",
                        }}
                      >
                        <span
                          style={{
                            color: "#777",
                          }}
                        >
                          {name}
                        </span>

                        <span
                          className="mono"
                          style={{
                            color:
                              tool.score >= 8
                                ? "#65e397"
                                : tool.score <=
                                    4
                                  ? "#ff6476"
                                  : "#bbb",
                          }}
                        >
                          {tool.score}/10
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
                  ).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                <span className="dot-live" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function VolumeSpike() {
  return <div className="page"><div className="page-head"><div><p className="eyebrow">UNUSUAL ACTIVITY</p><h1>Volume Spike</h1><p className="muted">Activity monitor — not a trade signal.</p></div><div className="chips"><button className="chip active">1H</button><button className="chip">4H</button><button className="chip">1D</button></div></div>
  <Card><div className="table-wrap"><table><thead><tr><th>COIN</th><th>SPIKE</th><th>VOLUME</th><th>RSI</th><th>LEVEL</th><th>TIMEFRAME</th><th></th></tr></thead><tbody>{spikes.map((x,i)=><tr key={i}><td><b>{x[0]}</b></td><td className="mono">{x[1]}</td><td className="mono">{x[2]}</td><td className="mono">{x[3]}</td><td><span className={"level "+x[4].toLowerCase()}>{x[4]}</span></td><td>{x[5]}</td><td><ChevronRight size={16}/></td></tr>)}</tbody></table></div></Card></div>
}

function BTCReport(){return <div className="page"><div className="page-head"><div><p className="eyebrow">INTELLIGENCE CENTER</p><h1>BTC Report</h1><p className="muted">Market health, structure, cycle and key takeaways.</p></div></div><div className="stats-grid"><Card><span className="label">MARKET HEALTH</span><strong>82 / 100</strong><span className="up">Healthy</span></Card><Card><span className="label">MARKET CONDITION</span><strong>Bullish</strong><span className="muted">Trend aligned</span></Card><Card><span className="label">CYCLE SCORE</span><strong>74</strong><span className="muted">Expansion</span></Card><Card><span className="label">CYCLE STAGE</span><strong>Markup</strong><span className="muted">Watch resistance</span></Card></div><Card><div className="report-grid"><div><span className="label">SUPPORT</span><h2>$118,400</h2></div><div><span className="label">RESISTANCE</span><h2>$124,900</h2></div><div><span className="label">KEY TAKEAWAYS</span><p className="muted">Structure remains constructive. Confirm strength with volume and derivatives context before acting.</p></div></div></Card></div>}

function Portfolio(){const [qty,setQty]=useState(1); const [entry,setEntry]=useState(100); return <div className="page"><div className="page-head"><div><p className="eyebrow">INVESTMENTS</p><h1>Portfolio</h1><p className="muted">Track holdings, plan and live P&amp;L.</p></div><button className="glass-btn">+ Add trade</button></div><div className="stats-grid"><Card><span className="label">INVESTED</span><strong>${(qty*entry).toFixed(2)}</strong></Card><Card><span className="label">CURRENT VALUE</span><strong>$128.40</strong><span className="up">+28.40%</span></Card><Card><span className="label">TOTAL P&amp;L</span><strong className="up">+$28.40</strong></Card><Card><span className="label">COINS</span><strong>1</strong></Card></div><Card><div className="card-head"><div><span className="label">HOLDINGS</span><h2>Position tracker</h2></div></div><div className="form-grid"><label>Coin<input defaultValue="BTC"/></label><label>Quantity<input type="number" value={qty} onChange={e=>setQty(Number(e.target.value)||0)}/></label><label>Entry price<input type="number" value={entry} onChange={e=>setEntry(Number(e.target.value)||0)}/></label><label>Plan<input placeholder="Long-term / scalp"/></label></div></Card></div>}

function CalculatorPage(){const [a,setA]=useState(100);const [p,setP]=useState(10);const [from,setFrom]=useState("EUR");const [to,setTo]=useState("USD");return <div className="page"><div className="page-head"><div><p className="eyebrow">TOOLS</p><h1>Calculator</h1><p className="muted">Quick trading and currency utilities.</p></div></div><div className="two-col"><Card><span className="label">PERCENTAGE</span><h2>Percentage calculator</h2><div className="form-grid"><label>Main data<input type="number" value={a} onChange={e=>setA(Number(e.target.value))}/></label><label>% input<input type="number" value={p} onChange={e=>setP(Number(e.target.value))}/></label></div><div className="result mono">{(a*p/100).toFixed(2)}</div></Card><Card><span className="label">CURRENCY</span><h2>Converter</h2><div className="form-grid"><label>Amount<input defaultValue="100"/></label><label>From<select value={from} onChange={e=>setFrom(e.target.value)}><option>EUR</option><option>USD</option><option>BDT</option></select></label><label>To<select value={to} onChange={e=>setTo(e.target.value)}><option>USD</option><option>EUR</option><option>BDT</option></select></label></div><p className="muted">Live rates will be connected in the data integration phase.</p></Card></div></div>}

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
  const [profileName, setProfileName] = useState(() => getDisplayName(user));
  const displayName = profileName;
  const avatar = getAvatar(user);

  const logout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };
  const content=useMemo(()=>{switch(tab){case"Dashboard":return <Dashboard go={setTab}/>;case"Signal":return <Signals/>;case"Volume Spike":return <VolumeSpike/>;case"BTC Report":return <BTCReport/>;case"Portfolio":return <Portfolio/>;case"Calculator":return <CalculatorPage/>;case"Settings":return <SettingsPage user={user} onLogout={logout} onProfileNameChange={setProfileName}/>;default:return <Dashboard go={setTab}/>}},[tab]);
  return <div className={"app "+(collapsed?"collapsed":"")}>
    <aside className="sidebar"><div onClick={()=>setTab("Dashboard")} className="logo-link"><Logo/></div><nav>{tabs.map(({name,icon:Icon})=><button key={name} className={tab===name?"nav-item active":"nav-item"} onClick={()=>setTab(name)}><Icon size={18}/><span>{name}</span></button>)}</nav><div className="side-bottom"><div className="user-mini">{avatar ? <img src={avatar} alt={displayName} className="mini-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<div><b>{displayName}</b><span>{user.email || "Authenticated user"}</span></div></div></div></aside>
    <main><header className="topbar"><button className="icon-btn" onClick={()=>setCollapsed(v=>!v)}><PanelLeft size={18}/></button><SessionBar/><div className="top-actions"><button className="icon-btn" aria-label="Notifications"><Bell size={17}/></button><div className="profile">{avatar ? <img src={avatar} alt={displayName} className="top-avatar-img"/> : <div className="avatar">{displayName.slice(0,1).toUpperCase()}</div>}<span>{displayName}</span></div><ThemeToggle/></div></header><div className="content">{content}</div></main>
  </div>
}
