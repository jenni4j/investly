import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const BASE_URL = "https://portfolio-tracker-server-ten.vercel.app";

const INDEX_TICKERS = ["^GSPC", "^IXIC", "^DJI", "^RUT"];
const INDEX_LABELS: Record<string, string> = {
  "^GSPC": "S&P 500",
  "^IXIC": "NASDAQ",
  "^DJI": "Dow Jones",
  "^RUT": "Russell 2000",
};

function fmtLarge(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface IndexQuote {
  ticker: string;
  displayName: string;
  lastPrice: number;
  regularMarketChangePercent: number;
}

interface EnrichedHolding {
  id: number;
  ticker: string;
  shares: number;
  currentPrice: number;
  initialPrice: number;
  value: number;
  pnl: number;
  returnPct: number;
}

interface EnrichedWatchEntry {
  id: number;
  ticker: string;
  name: string | null;
  price_at_entry: number;
  currentPrice: number | undefined;
  changePct: number | null;
}

export default function Home() {
  const [displayName, setDisplayName] = useState<string>("");
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [holdings, setHoldings] = useState<EnrichedHolding[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalPnl, setTotalPnl] = useState<number>(0);
  const [totalCost, setTotalCost] = useState<number>(0);
  const [watchlist, setWatchlist] = useState<EnrichedWatchEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // Round 1: user identity + indices in parallel
      const [userRes, indicesRaw] = await Promise.all([
        supabase.auth.getUser(),
        fetch(`${BASE_URL}/api/quotes?tickers=${INDEX_TICKERS.join(",")}`)
          .then((r) => r.json())
          .catch(() => []),
      ]);

      const rawUser = userRes.data?.user;
      const name =
        rawUser?.user_metadata?.full_name ??
        rawUser?.email?.split("@")[0] ??
        "Investor";
      setDisplayName(name);

      const indexQuotes: IndexQuote[] = INDEX_TICKERS.map((t) => {
        const q = (indicesRaw as any[]).find((x: any) => x.ticker === t);
        return {
          ticker: t,
          displayName: INDEX_LABELS[t] ?? t,
          lastPrice: q?.lastPrice ?? 0,
          regularMarketChangePercent: q?.regularMarketChangePercent ?? 0,
        };
      });
      setIndices(indexQuotes);

      if (!rawUser) {
        setLoading(false);
        return;
      }

      // Round 2: portfolio stocks + watchlist in parallel
      const [{ data: allStocksData }, { data: watchlistData }] = await Promise.all([
        supabase.from("stocks").select("*").eq("user_id", rawUser.id),
        supabase
          .from("watchlist")
          .select("*")
          .eq("user_id", rawUser.id)
          .order("date_added", { ascending: false }),
      ]);

      // Round 3: single combined quotes call for all unique tickers
      const stockTickers = [...new Set((allStocksData ?? []).map((s: any) => s.ticker))] as string[];
      const watchTickers = [...new Set((watchlistData ?? []).map((e: any) => e.ticker))] as string[];
      const allTickers = [...new Set([...stockTickers, ...watchTickers])];

      let quoteMap: Record<string, { lastPrice: number }> = {};
      if (allTickers.length) {
        const quotesRaw = await fetch(
          `${BASE_URL}/api/quotes?tickers=${allTickers.join(",")}`
        )
          .then((r) => r.json())
          .catch(() => []);
        quoteMap = Object.fromEntries(
          (quotesRaw as any[]).map((q: any) => [q.ticker, { lastPrice: q.lastPrice ?? 0 }])
        );
      }

      // Enrich holdings
      const enriched: EnrichedHolding[] = (allStocksData ?? []).map((s: any) => {
        const currentPrice = quoteMap[s.ticker]?.lastPrice ?? 0;
        const initialPrice = s.initial_price ?? 0;
        const shares = s.shares ?? 0;
        const value = shares * currentPrice;
        const pnl = (currentPrice - initialPrice) * shares;
        const returnPct = initialPrice > 0 ? ((currentPrice - initialPrice) / initialPrice) * 100 : 0;
        return { id: s.id, ticker: s.ticker, shares, currentPrice, initialPrice, value, pnl, returnPct };
      });
      setHoldings(enriched);

      const tv = enriched.reduce((acc, h) => acc + h.value, 0);
      const tpnl = enriched.reduce((acc, h) => acc + h.pnl, 0);
      const tc = enriched.reduce((acc, h) => acc + h.initialPrice * h.shares, 0);
      setTotalValue(tv);
      setTotalPnl(tpnl);
      setTotalCost(tc);

      // Enrich watchlist
      const enrichedWatch: EnrichedWatchEntry[] = (watchlistData ?? []).map((e: any) => {
        const currentPrice = quoteMap[e.ticker]?.lastPrice;
        const changePct =
          currentPrice !== undefined && e.price_at_entry > 0
            ? ((currentPrice - e.price_at_entry) / e.price_at_entry) * 100
            : null;
        return { id: e.id, ticker: e.ticker, name: e.name, price_at_entry: e.price_at_entry, currentPrice, changePct };
      });
      setWatchlist(enrichedWatch);

      setLoading(false);
    };

    load();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const totalReturnPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto mt-10 pb-16">

      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {greeting}{displayName ? `, ${displayName}` : ""}.
        </h1>
        <p className="text-sm text-gray-500 mt-1">{todayStr}</p>
      </div>

      {/* Market Pulse strip */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {indices.length === 0
          ? INDEX_TICKERS.map((t) => (
              <div key={t} className="rounded-xl border border-gray-200 shadow-sm bg-white px-4 py-3 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-5 bg-gray-200 rounded w-1/2 mb-1" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
              </div>
            ))
          : indices.map((idx) => {
              const pctVal = idx.regularMarketChangePercent * 100;
              const isUp = pctVal >= 0;
              return (
                <div
                  key={idx.ticker}
                  className="rounded-xl border border-gray-200 shadow-sm bg-white px-4 py-3"
                >
                  <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">
                    {idx.displayName}
                  </div>
                  <div className="text-base font-bold tabular-nums text-gray-800">
                    {idx.lastPrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className={`text-sm font-semibold tabular-nums ${isUp ? "text-green-600" : "text-red-600"}`}>
                    {isUp ? "+" : ""}{pctVal.toFixed(2)}%
                  </div>
                </div>
              );
            })}
      </div>

      {/* Portfolio Summary */}
      <div className="rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-baseline justify-between">
          <h2 className="text-base font-bold text-gray-800">Portfolio</h2>
          {!loading && holdings.length > 0 && (
            <div className="flex items-baseline gap-4">
              <span className="text-2xl font-bold tabular-nums text-gray-900">
                {fmtLarge(totalValue)}
              </span>
              <span className={`text-base font-semibold tabular-nums ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                {totalPnl >= 0 ? "+" : ""}{fmtLarge(totalPnl)}{" "}
                ({totalReturnPct >= 0 ? "+" : ""}{totalReturnPct.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>

        {loading && (
          <p className="text-gray-400 text-sm px-5 py-6">Loading portfolio...</p>
        )}

        {!loading && holdings.length === 0 && (
          <p className="text-gray-400 text-sm px-5 py-8 text-center">
            No holdings yet.{" "}
            <Link to="/portfolio" className="text-blue-500 hover:underline">
              Add your first stock
            </Link>
            .
          </p>
        )}

        {!loading && holdings.length > 0 && (
          <table className="w-full table-fixed text-sm">
            <thead className="bg-[#e9ecf1] text-xs uppercase tracking-wider font-bold border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-1/5">Ticker</th>
                <th className="px-4 py-3 text-right w-1/5">Shares</th>
                <th className="px-4 py-3 text-right w-1/5">Value</th>
                <th className="px-4 py-3 text-right w-1/5">P&amp;L</th>
                <th className="px-4 py-3 text-right w-1/5">Return %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holdings.map((h) => (
                <tr key={h.id} className="group/row bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800">{h.ticker}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">{h.shares}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    ${h.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${h.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {h.pnl >= 0 ? "+" : ""}$
                    {Math.abs(h.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${h.returnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {h.returnPct >= 0 ? "+" : ""}{h.returnPct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-end">
          <Link to="/portfolio" className="text-xs text-gray-500 hover:text-gray-800 font-semibold transition">
            View Portfolio →
          </Link>
        </div>
      </div>

      {/* Watchlist Snapshot */}
      <div className="rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-800">Watchlist</h2>
        </div>

        {loading && (
          <p className="text-gray-400 text-sm px-5 py-6">Loading watchlist...</p>
        )}

        {!loading && watchlist.length === 0 && (
          <p className="text-gray-400 text-sm px-5 py-8 text-center">
            Watchlist is empty.{" "}
            <Link to="/watchlist" className="text-blue-500 hover:underline">
              Add a stock
            </Link>
            .
          </p>
        )}

        {!loading && watchlist.length > 0 && (
          <table className="w-full table-fixed text-sm">
            <thead className="bg-[#e9ecf1] text-xs uppercase tracking-wider font-bold border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left w-1/4">Ticker</th>
                <th className="px-4 py-3 text-right w-1/4">Entry Price</th>
                <th className="px-4 py-3 text-right w-1/4">Current Price</th>
                <th className="px-4 py-3 text-right w-1/4">Change %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {watchlist.map((e) => (
                <tr key={e.id} className="group/row bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-gray-800 relative group/ticker">
                    {e.ticker}
                    {e.name && (
                      <div className="absolute left-0 top-full mt-1 px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg z-10 whitespace-nowrap hidden group-hover/ticker:block pointer-events-none">
                        {e.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                    ${e.price_at_entry.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                    {e.currentPrice !== undefined ? `$${e.currentPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${
                    e.changePct === null ? "text-gray-400" : e.changePct >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    {e.changePct !== null
                      ? `${e.changePct >= 0 ? "+" : ""}${e.changePct.toFixed(2)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-end">
          <Link to="/watchlist" className="text-xs text-gray-500 hover:text-gray-800 font-semibold transition">
            View Watchlist →
          </Link>
        </div>
      </div>

    </div>
  );
}
