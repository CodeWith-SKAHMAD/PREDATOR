import { NextResponse } from "next/server";

const API_BASE = "https://api.binance.com";

type ExchangeSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  isSpotTradingAllowed?: boolean;
};

type Ticker24h = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  volume: string;
  highPrice: string;
  lowPrice: string;
};

export async function GET() {
  try {
    const [exchangeResponse, tickerResponse] = await Promise.all([
      fetch(`${API_BASE}/api/v3/exchangeInfo`, {
        cache: "no-store",
      }),
      fetch(`${API_BASE}/api/v3/ticker/24hr`, {
        cache: "no-store",
      }),
    ]);

    if (!exchangeResponse.ok) {
      throw new Error(
        `Market metadata request failed: ${exchangeResponse.status}`
      );
    }

    if (!tickerResponse.ok) {
      throw new Error(
        `Ticker request failed: ${tickerResponse.status}`
      );
    }

    const exchangeData = (await exchangeResponse.json()) as {
      symbols: ExchangeSymbol[];
    };

    const tickers = (await tickerResponse.json()) as Ticker24h[];

    const allowedSymbols = new Set(
      exchangeData.symbols
        .filter(
          (item) =>
            item.status === "TRADING" &&
            item.quoteAsset === "USDT" &&
            item.isSpotTradingAllowed !== false
        )
        .map((item) => item.symbol)
    );

    const markets = tickers
      .filter((item) => allowedSymbols.has(item.symbol))
      .map((item) => ({
        symbol: item.symbol,
        price: Number(item.lastPrice),
        change24h: Number(item.priceChangePercent),
        volume24h: Number(item.volume),
        quoteVolume24h: Number(item.quoteVolume),
        high24h: Number(item.highPrice),
        low24h: Number(item.lowPrice),
      }))
      .filter(
        (item) =>
          Number.isFinite(item.price) &&
          Number.isFinite(item.change24h) &&
          Number.isFinite(item.quoteVolume24h)
      )
      .sort((a, b) => b.quoteVolume24h - a.quoteVolume24h);

    const btc = markets.find(
      (item) => item.symbol === "BTCUSDT"
    );

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      btc: btc ?? null,
      markets: markets.slice(0, 100),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Market data unavailable",
      },
      { status: 502 }
    );
  }
}
