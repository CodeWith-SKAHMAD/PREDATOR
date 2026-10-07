import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BINANCE_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://data-api.binance.vision",
];
const ALLOWED_INTERVALS = new Set(["1h", "4h", "1d"]);
const stableAssets = new Set(["USDT", "USDC", "FDUSD", "TUSD", "USDE", "DAI", "BUSD"]);

const headers = { "Cache-Control": "no-store, max-age=0" };

type SymbolInfo = { symbol: string; status: string; baseAsset: string; quoteAsset: string; isSpotTradingAllowed?: boolean };
type Ticker = { symbol: string; quoteVolume: string; lastPrice: string };
type Kline = [number,string,string,string,string,string,number,string,number,string,string,string];
type Row = {
  symbol: string; baseAsset: string; price: number; quoteVolume24h: number; volume: number; averageVolume: number; spike: number;
  rsi: number | null; change1h: number | null; change4h: number | null; change1d: number | null;
  level: "Extreme" | "High" | "Moderate" | "Normal";
};

async function fetchJson<T>(path: string, ms = 6500): Promise<T> {
  let lastError = "Binance market data unavailable";

  for (const host of BINANCE_HOSTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      const r = await fetch(`${host}${path}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { accept: "application/json" },
      });

      if (!r.ok) {
        lastError = `Request failed: ${r.status}`;
        continue;
      }

      return await r.json() as T;
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length <= period) return null;
  let gains = 0, losses = 0;
  for (let i=1;i<=period;i++) { const d=closes[i]-closes[i-1]; if (d>=0) gains+=d; else losses+=Math.abs(d); }
  let ag=gains/period, al=losses/period;
  for (let i=period+1;i<closes.length;i++) { const d=closes[i]-closes[i-1]; const g=d>0?d:0; const l=d<0?Math.abs(d):0; ag=(ag*(period-1)+g)/period; al=(al*(period-1)+l)/period; }
  if (al===0) return 100;
  return 100 - 100/(1+ag/al);
}

function level(spike:number): Row["level"] {
  if (spike>=4) return "Extreme";
  if (spike>=3) return "High";
  if (spike>=2) return "Moderate";
  return "Normal";
}

async function concurrency<T,U>(items:T[], limit:number, fn:(item:T)=>Promise<U>):Promise<U[]> {
  const out: U[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({length: Math.min(limit, items.length)}, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      try { out[idx] = await fn(items[idx]); } catch { out[idx] = undefined as U; }
    }
  });
  await Promise.all(workers);
  return out;
}

function pctFromKlines(k: Kline[]): number | null {
  if (k.length < 2) return null;
  const a = Number(k.at(-2)?.[4]);
  const b = Number(k.at(-1)?.[4]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b-a)/a)*100;
}

export async function GET(request: Request) {
  const interval = new URL(request.url).searchParams.get("interval") || "1h";
  if (!ALLOWED_INTERVALS.has(interval)) return NextResponse.json({ok:false,error:"Invalid interval"},{status:400,headers});

  try {
    const [exchangeInfo, tickers] = await Promise.all([
      fetchJson<{symbols:SymbolInfo[]}>(`/api/v3/exchangeInfo`),
      fetchJson<Ticker[]>(`/api/v3/ticker/24hr`),
    ]);

    const allowed = new Map(exchangeInfo.symbols
      .filter(s => s.status === "TRADING" && s.quoteAsset === "USDT" && s.isSpotTradingAllowed !== false && !stableAssets.has(s.baseAsset))
      .map(s => [s.symbol, s.baseAsset]));

    // Keep every Binance-listed USDT market eligible; use a modest 24h-liquidity floor only to avoid dust/illiquid markets.
    const candidates = tickers
      .filter(t => allowed.has(t.symbol))
      .map(t => ({symbol:t.symbol, baseAsset:allowed.get(t.symbol)!, quoteVolume24h:Number(t.quoteVolume), price:Number(t.lastPrice)}))
      .filter(x => Number.isFinite(x.quoteVolume24h) && x.quoteVolume24h >= 1_000_000 && Number.isFinite(x.price) && x.price > 0);

    const primary = await concurrency(candidates, 24, async (c) => {
      const k = await fetchJson<Kline[]>(`/api/v3/klines?symbol=${encodeURIComponent(c.symbol)}&interval=${interval}&limit=24`);
      if (k.length < 16) return null;
      const vols = k.slice(0,-1).map(x => Number(x[7])).filter(Number.isFinite);
      const current = Number(k.at(-1)?.[7]);
      if (!Number.isFinite(current) || vols.length < 10) return null;
      const avg = vols.reduce((a,b)=>a+b,0)/vols.length;
      if (!(avg > 0)) return null;
      const spike = current/avg;
      if (spike < 1.30) return null;
      const closes = k.map(x=>Number(x[4]));
      return { ...c, volume:current, averageVolume:avg, spike, rsi:rsi(closes) };
    });

    const baseRows = primary.filter((x): x is NonNullable<typeof x> => Boolean(x)).sort((a,b)=>b.spike-a.spike).slice(0,80);

    const rows = await concurrency(baseRows, 18, async (c) => {
      const [k1h,k4h,k1d] = await Promise.all([
        fetchJson<Kline[]>(`/api/v3/klines?symbol=${encodeURIComponent(c.symbol)}&interval=1h&limit=2`),
        fetchJson<Kline[]>(`/api/v3/klines?symbol=${encodeURIComponent(c.symbol)}&interval=4h&limit=2`),
        fetchJson<Kline[]>(`/api/v3/klines?symbol=${encodeURIComponent(c.symbol)}&interval=1d&limit=2`),
      ]);
      return {
        ...c,
        change1h:pctFromKlines(k1h),
        change4h:pctFromKlines(k4h),
        change1d:pctFromKlines(k1d),
        level:level(c.spike),
      } satisfies Row;
    });

    const clean = rows.filter((x): x is Row => Boolean(x)).sort((a,b)=>b.spike-a.spike).slice(0,40);
    return NextResponse.json({ok:true, interval, updatedAt:new Date().toISOString(), rows:clean}, {headers});
  } catch (e) {
    return NextResponse.json({ok:false,error:e instanceof Error ? e.message : "Volume data unavailable"},{status:502,headers});
  }
}
