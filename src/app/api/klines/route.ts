import { NextResponse } from "next/server";

const API_BASES = [
  "https://data-api.binance.vision",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

const ALLOWED_INTERVALS = new Set([
  "1m",
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
]);

function isSafeSymbol(symbol: string) {
  return /^[A-Z0-9]{4,20}$/.test(symbol);
}

async function fetchJson<T>(path: string) {
  let lastError = "Chart data request failed";

  for (const base of API_BASES) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);

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
      lastError =
        error instanceof Error
          ? error.message
          : "Chart data request failed";
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(lastError);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
  const interval = url.searchParams.get("interval") || "15m";
  const rawLimit = Number(url.searchParams.get("limit") || "500");
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? rawLimit : 500, 100),
    1000
  );

  if (!symbol || !isSafeSymbol(symbol)) {
    return NextResponse.json(
      { ok: false, error: "Invalid symbol" },
      { status: 400 }
    );
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { ok: false, error: "Invalid timeframe" },
      { status: 400 }
    );
  }

  try {
    const rows = await fetchJson<number[][]>(
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`
    );

    return NextResponse.json({
      ok: true,
      symbol,
      interval,
      updatedAt: new Date().toISOString(),
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Chart data unavailable",
      },
      { status: 502 }
    );
  }
}
