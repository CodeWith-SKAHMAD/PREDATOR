"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import {
  BarChart3,
  Bell,
  Calculator as CalculatorIcon,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  Moon,
  Newspaper,
  PanelLeft,
  RefreshCw,
  Settings,
  Sun,
  Wallet,
  Zap,
} from "lucide-react";

type Tab =
  | "Dashboard"
  | "Signal"
  | "Volume Spike"
  | "BTC Report"
  | "Portfolio"
  | "Calculator"
  | "Settings";

type IconType = ComponentType<{
  size?: number;
  strokeWidth?: number;
}>;

const tabs: { name: Tab; icon: IconType }[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Signal",
    icon: Zap,
  },
  {
    name: "Volume Spike",
    icon: BarChart3,
  },
  {
    name: "BTC Report",
    icon: Newspaper,
  },
  {
    name: "Portfolio",
    icon: Wallet,
  },
  {
    name: "Calculator",
    icon: CalculatorIcon,
  },
  {
    name: "Settings",
    icon: Settings,
  },
];

const signals = [
  ["BTC/USDT", "LONG", "112", "Strong", "$121,840", "1.9x", "62"],
  ["ETH/USDT", "LONG", "104", "Valid", "$4,520", "1.6x", "59"],
  ["SOL/USDT", "SHORT", "97", "Observe", "$214.30", "2.3x", "43"],
  ["XRP/USDT", "LONG", "83", "Observe", "$2.74", "1.8x", "57"],
];

const spikes = [
  ["BTC", "1.9x", "$84.2B", "62", "High", "1H"],
  ["SOL", "3.4x", "$9.8B", "71", "Extreme", "4H"],
  ["DOGE", "2.8x", "$5.1B", "68", "High", "1H"],
  ["LINK", "2.1x", "$1.7B", "54", "Moderate", "1D"],
];

function Logo() {
  return (
    <div className="brand" title="Home">
      <div className="brand-mark">P</div>
      <span>PREDATOR</span>
    </div>
  );
}

function SessionBar() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const hour = now.getUTCHours();

  let currentSession = "ASIA";

  if (hour >= 7 && hour < 13) {
    currentSession = "LONDON";
  } else if (hour >= 13 && hour < 21) {
    currentSession = "NEW YORK";
  }

  return (
    <div className="sessionbar">
      <div className="session-title">
        <Clock3 size={15} />
        <span>MARKET SESSION</span>
      </div>

      <div className="sessions">
        {["ASIA", "LONDON", "NEW YORK"].map((session) => (
          <div
            key={session}
            className={
              "session " +
              (session === currentSession ? "active" : "")
            }
          >
            {session}
          </div>
        ))}
      </div>

      <div className="clock">
        {now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={"glass-card " + className}>
      {children}
    </div>
  );
}

function Dashboard({
  go,
}: {
  go: (tab: Tab) => void;
}) {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">OVERVIEW</p>
          <h1>Dashboard</h1>
          <p className="muted">
            Market intelligence at a glance.
          </p>
        </div>

        <button className="glass-btn">
          <RefreshCw size={15} />
          Live
        </button>
      </div>

      <div className="stats-grid">
        <Card>
          <span className="label">BTC</span>
          <strong className="price">$121,840</strong>
          <span className="up">+2.84%</span>
          <div className="mini-line" />
        </Card>

        <Card>
          <span className="label">MARKET STATUS</span>
          <strong>Risk-On</strong>
          <span className="up">Bullish structure</span>
          <div className="status-dot" />
        </Card>

        <Card>
          <span className="label">ACTIVE SIGNALS</span>
          <strong>12</strong>
          <span className="muted">4 Strong · 5 Valid</span>
        </Card>

        <Card>
          <span className="label">VOLUME</span>
          <strong>High</strong>
          <span className="muted">+38% vs average</span>
        </Card>
      </div>

      <div className="two-col">
        <Card>
          <div className="card-head">
            <div>
              <span className="label">MARKET MOVERS</span>
              <h2>Top movement</h2>
            </div>

            <button
              className="text-btn"
              onClick={() => go("Volume Spike")}
            >
              View all
              <ChevronRight size={14} />
            </button>
          </div>

          {spikes.map((item, index) => (
            <div className="row" key={index}>
              <div>
                <b>{item[0]}</b>
                <span className="muted">
                  {item[5]} activity
                </span>
              </div>

              <span className="up">
                +{index + 2}.4%
              </span>

              <span className="mono">
                {item[1]}
              </span>
            </div>
          ))}
        </Card>

        <Card>
          <div className="card-head">
            <div>
              <span className="label">SIGNAL SUMMARY</span>
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

          {signals.slice(0, 3).map((signal, index) => (
            <div
              className="signal-row"
              key={index}
            >
              <div
                className={
                  "badge " +
                  (signal[1] === "LONG"
                    ? "long"
                    : "short")
                }
              >
                {signal[1]}
              </div>

              <div>
                <b>{signal[0]}</b>
                <span className="muted">
                  {signal[3]}
                </span>
              </div>

              <strong className="mono">
                {signal[2]}/150
              </strong>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function SignalsPage() {
  const [lastRefresh, setLastRefresh] =
    useState(new Date());

  const [seconds, setSeconds] =
    useState(1800);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((value) =>
        value <= 1 ? 1800 : value - 1
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function forceRefresh() {
    setLastRefresh(new Date());
    setSeconds(1800);
  }

  const minutes = String(
    Math.floor(seconds / 60)
  ).padStart(2, "0");

  const remainingSeconds = String(
    seconds % 60
  ).padStart(2, "0");

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
            NEXT SCAN {minutes}:{remainingSeconds}
          </span>

          <button
            className="glass-btn"
            onClick={forceRefresh}
          >
            <RefreshCw size={15} />
            Force refresh
          </button>
        </div>
      </div>

      <div className="signal-grid">
        {signals.map((signal, index) => (
          <Card
            key={index}
            className="signal-card"
          >
            <div className="signal-top">
              <div
                className={
                  "badge " +
                  (signal[1] === "LONG"
                    ? "long"
                    : "short")
                }
              >
                {signal[1]}
              </div>

              <span className="score mono">
                {signal[2]}
                <small>/150</small>
              </span>
            </div>

            <h2>{signal[0]}</h2>

            <div className="signal-price mono">
              {signal[4]}
            </div>

            <div className="metrics">
              <span>
                Volume
                <b>{signal[5]}</b>
              </span>

              <span>
                RSI
                <b>{signal[6]}</b>
              </span>

              <span>
                Confidence
                <b>{signal[3]}</b>
              </span>
            </div>

            <div className="signal-foot">
              <span className="muted">
                Captured{" "}
                {lastRefresh.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>

              <span className="dot-live" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VolumeSpikePage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            UNUSUAL ACTIVITY
          </p>

          <h1>Volume Spike</h1>

          <p className="muted">
            Activity monitor — not a trade signal.
          </p>
        </div>

        <div className="chips">
          <button className="chip active">
            1H
          </button>

          <button className="chip">
            4H
          </button>

          <button className="chip">
            1D
          </button>
        </div>
      </div>

      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>COIN</th>
                <th>SPIKE</th>
                <th>VOLUME</th>
                <th>RSI</th>
                <th>LEVEL</th>
                <th>TIMEFRAME</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {spikes.map((item, index) => (
                <tr key={index}>
                  <td>
                    <b>{item[0]}</b>
                  </td>

                  <td className="mono">
                    {item[1]}
                  </td>

                  <td className="mono">
                    {item[2]}
                  </td>

                  <td className="mono">
                    {item[3]}
                  </td>

                  <td>
                    <span
                      className={
                        "level " +
                        item[4].toLowerCase()
                      }
                    >
                      {item[4]}
                    </span>
                  </td>

                  <td>{item[5]}</td>

                  <td>
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function BTCReportPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            INTELLIGENCE CENTER
          </p>

          <h1>BTC Report</h1>

          <p className="muted">
            Market health, structure, cycle and key takeaways.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <Card>
          <span className="label">
            MARKET HEALTH
          </span>

          <strong>82 / 100</strong>

          <span className="up">
            Healthy
          </span>
        </Card>

        <Card>
          <span className="label">
            MARKET CONDITION
          </span>

          <strong>Bullish</strong>

          <span className="muted">
            Trend aligned
          </span>
        </Card>

        <Card>
          <span className="label">
            CYCLE SCORE
          </span>

          <strong>74</strong>

          <span className="muted">
            Expansion
          </span>
        </Card>

        <Card>
          <span className="label">
            CYCLE STAGE
          </span>

          <strong>Markup</strong>

          <span className="muted">
            Watch resistance
          </span>
        </Card>
      </div>

      <Card>
        <div className="report-grid">
          <div>
            <span className="label">
              SUPPORT
            </span>

            <h2>$118,400</h2>
          </div>

          <div>
            <span className="label">
              RESISTANCE
            </span>

            <h2>$124,900</h2>
          </div>

          <div>
            <span className="label">
              KEY TAKEAWAYS
            </span>

            <p className="muted">
              Structure remains constructive.
              Confirm strength with volume and
              derivatives context before acting.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PortfolioPage() {
  const [quantity, setQuantity] =
    useState(1);

  const [entryPrice, setEntryPrice] =
    useState(100);

  const invested =
    quantity * entryPrice;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            INVESTMENTS
          </p>

          <h1>Portfolio</h1>

          <p className="muted">
            Track holdings, plan and live P&amp;L.
          </p>
        </div>

        <button className="glass-btn">
          + Add trade
        </button>
      </div>

      <div className="stats-grid">
        <Card>
          <span className="label">
            INVESTED
          </span>

          <strong>
            ${invested.toFixed(2)}
          </strong>
        </Card>

        <Card>
          <span className="label">
            CURRENT VALUE
          </span>

          <strong>$128.40</strong>

          <span className="up">
            +28.40%
          </span>
        </Card>

        <Card>
          <span className="label">
            TOTAL P&amp;L
          </span>

          <strong className="up">
            +$28.40
          </strong>
        </Card>

        <Card>
          <span className="label">
            COINS
          </span>

          <strong>1</strong>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <div>
            <span className="label">
              HOLDINGS
            </span>

            <h2>
              Position tracker
            </h2>
          </div>
        </div>

        <div className="form-grid">
          <label>
            Coin
            <input defaultValue="BTC" />
          </label>

          <label>
            Quantity
            <input
              type="number"
              value={quantity}
              onChange={(event) =>
                setQuantity(
                  Number(event.target.value) || 0
                )
              }
            />
          </label>

          <label>
            Entry price
            <input
              type="number"
              value={entryPrice}
              onChange={(event) =>
                setEntryPrice(
                  Number(event.target.value) || 0
                )
              }
            />
          </label>

          <label>
            Plan
            <input
              placeholder="Long-term / scalp"
            />
          </label>
        </div>
      </Card>
    </div>
  );
}

function CalculatorPage() {
  const [mainData, setMainData] =
    useState(100);

  const [percentage, setPercentage] =
    useState(10);

  const [fromCurrency, setFromCurrency] =
    useState("EUR");

  const [toCurrency, setToCurrency] =
    useState("USD");

  const result =
    (mainData * percentage) / 100;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            TOOLS
          </p>

          <h1>Calculator</h1>

          <p className="muted">
            Quick trading and currency utilities.
          </p>
        </div>
      </div>

      <div className="two-col">
        <Card>
          <span className="label">
            PERCENTAGE
          </span>

          <h2>
            Percentage calculator
          </h2>

          <div className="form-grid">
            <label>
              Main data

              <input
                type="number"
                value={mainData}
                onChange={(event) =>
                  setMainData(
                    Number(event.target.value) || 0
                  )
                }
              />
            </label>

            <label>
              % input

              <input
                type="number"
                value={percentage}
                onChange={(event) =>
                  setPercentage(
                    Number(event.target.value) || 0
                  )
                }
              />
            </label>
          </div>

          <div className="result mono">
            {result.toFixed(2)}
          </div>
        </Card>

        <Card>
          <span className="label">
            CURRENCY
          </span>

          <h2>
            Converter
          </h2>

          <div className="form-grid">
            <label>
              Amount

              <input
                type="number"
                defaultValue="100"
              />
            </label>

            <label>
              From

              <select
                value={fromCurrency}
                onChange={(event) =>
                  setFromCurrency(
                    event.target.value
                  )
                }
              >
                <option value="EUR">
                  EUR
                </option>

                <option value="USD">
                  USD
                </option>

                <option value="BDT">
                  BDT
                </option>
              </select>
            </label>

            <label>
              To

              <select
                value={toCurrency}
                onChange={(event) =>
                  setToCurrency(
                    event.target.value
                  )
                }
              >
                <option value="USD">
                  USD
                </option>

                <option value="EUR">
                  EUR
                </option>

                <option value="BDT">
                  BDT
                </option>
              </select>
            </label>
          </div>

          <p className="muted">
            Live rates will be connected in the
            data integration phase.
          </p>
        </Card>
      </div>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">
            ACCOUNT
          </p>

          <h1>Settings</h1>

          <p className="muted">
            Profile, preferences and security.
          </p>
        </div>
      </div>

      <div className="two-col">
        <Card>
          <span className="label">
            PROFILE
          </span>

          <h2>
            Account details
          </h2>

          <div className="form-grid">
            <label>
              Name
              <input defaultValue="Trader" />
            </label>

            <label>
              Email
              <input defaultValue="user@example.com" />
            </label>

            <label>
              Discord
              <input
                placeholder="Connect Discord"
              />
            </label>

            <label>
              Trading experience

              <select defaultValue="Beginner">
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

          <button className="glass-btn">
            Save profile
          </button>
        </Card>

        <Card>
          <span className="label">
            PREFERENCES
          </span>

          <h2>
            Interface
          </h2>

          <div className="setting-row">
            <span>
              Theme
            </span>

            <ThemeToggle />
          </div>

          <div className="setting-row">
            <span>
              Session alerts
            </span>

            <span className="toggle" />
          </div>

          <div className="danger">
            Delete account
          </div>
        </Card>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] =
    useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme =
      dark ? "dark" : "light";
  }, [dark]);

  return (
    <button
      className="icon-btn"
      onClick={() =>
        setDark((value) => !value)
      }
      aria-label="Toggle theme"
    >
      {dark ? (
        <Moon size={17} />
      ) : (
        <Sun size={17} />
      )}
    </button>
  );
}

export default function PredatorApp() {
  const [tab, setTab] =
    useState<Tab>("Dashboard");

  const [collapsed, setCollapsed] =
    useState(false);

  const content = useMemo(() => {
    switch (tab) {
      case "Dashboard":
        return (
          <Dashboard go={setTab} />
        );

      case "Signal":
        return <SignalsPage />;

      case "Volume Spike":
        return <VolumeSpikePage />;

      case "BTC Report":
        return <BTCReportPage />;

      case "Portfolio":
        return <PortfolioPage />;

      case "Calculator":
        return <CalculatorPage />;

      case "Settings":
        return <SettingsPage />;

      default:
        return (
          <Dashboard go={setTab} />
        );
    }
  }, [tab]);

  return (
    <div
      className={
        "app " +
        (collapsed ? "collapsed" : "")
      }
    >
      <aside className="sidebar">
        <div
          onClick={() =>
            setTab("Dashboard")
          }
          className="logo-link"
        >
          <Logo />
        </div>

        <nav>
          {tabs.map(
            ({ name, icon: Icon }) => (
              <button
                key={name}
                className={
                  tab === name
                    ? "nav-item active"
                    : "nav-item"
                }
                onClick={() =>
                  setTab(name)
                }
              >
                <Icon size={18} />
                <span>{name}</span>
              </button>
            )
          )}
        </nav>

        <div className="side-bottom">
          <div className="user-mini">
            <div className="avatar">
              P
            </div>

            <div>
              <b>
                Predator User
              </b>

              <span>
                Free account
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button
            className="icon-btn"
            onClick={() =>
              setCollapsed(
                (value) => !value
              )
            }
            aria-label="Toggle sidebar"
          >
            <PanelLeft size={18} />
          </button>

          <SessionBar />

          <div className="top-actions">
            <button
              className="icon-btn"
              aria-label="Notifications"
            >
              <Bell size={17} />
            </button>

            <div className="profile">
              <div className="avatar">
                P
              </div>

              <span>
                Predator User
              </span>
            </div>

            <ThemeToggle />
          </div>
        </header>

        <div className="content">
          {content}
        </div>
      </main>
    </div>
  );
}
