import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import StockSearch from "../components/StockSearch";
import { supabase } from "../lib/supabaseClient";

interface WatchlistEntry {
  id: number;
  ticker: string;
  name: string | null;
  price_at_entry: number;
  date_added: string;
  currentPrice?: number;
}

export default function Watchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const fetchWatchlist = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) { setLoading(false); return; }

    const { data, error } = await supabase
      .from("watchlist")
      .select("*")
      .eq("user_id", userData.user.id)
      .order("date_added", { ascending: false });

    if (error || !data) { setLoading(false); return; }

    if (data.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    const tickers = [...new Set(data.map((e) => e.ticker))].join(",");
    const res = await fetch(
      `https://portfolio-tracker-server-ten.vercel.app/api/quotes?tickers=${tickers}`
    );
    const quotes = await res.json();
    const quoteMap: Record<string, number> = Object.fromEntries(
      quotes.map((q: { ticker: string; lastPrice: number }) => [q.ticker, q.lastPrice])
    );

    setEntries(
      data.map((e) => ({
        ...e,
        currentPrice: quoteMap[e.ticker] ?? undefined,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchWatchlist();

    const channel = supabase
      .channel("watchlist-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "watchlist" }, fetchWatchlist)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const addToWatchlist = async (stock: { symbol: string; name: string }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const res = await fetch(
      `https://portfolio-tracker-server-ten.vercel.app/api/quotes?tickers=${stock.symbol}`
    );
    const quotes = await res.json();
    const lastPrice: number = quotes[0]?.lastPrice ?? 0;
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    await supabase.from("watchlist").insert([
      {
        user_id: userData.user.id,
        ticker: stock.symbol,
        name: stock.name,
        price_at_entry: lastPrice,
        date_added: today,
      },
    ]);

    setAdding(false);
    fetchWatchlist();
  };

  const deleteEntry = async (id: number) => {
    if (!confirm("Remove from watchlist?")) return;
    await supabase.from("watchlist").delete().eq("id", id);
    fetchWatchlist();
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 pb-16">
      <div className="flex items-center mb-6">
        <h1 className="text-3xl font-bold">My Watchlist</h1>
      </div>

      {loading && <p className="text-gray-500">Loading watchlist...</p>}

      {!loading && (
        <div className="rounded-xl border border-gray-200 shadow-sm">
          {entries.length === 0 && !adding && (
            <p className="text-gray-500 py-10 text-center text-sm">
              Your watchlist is empty. Add a stock to get started.
            </p>
          )}

          {entries.length > 0 && (
            <table className="w-full table-fixed text-sm">
              <thead className="bg-[#e9ecf1] text-xs uppercase tracking-wider font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-1/6">Ticker</th>
                  <th className="px-4 py-3 text-right w-1/6">Entry Price</th>
                  <th className="px-4 py-3 text-right w-1/6">Current Price</th>
                  <th className="px-4 py-3 text-right w-1/6">Change %</th>
                  <th className="px-4 py-3 text-right w-1/6">Date Added</th>
                  <th className="px-4 py-3 w-[56px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((e) => {
                  const changePct =
                    e.currentPrice !== undefined
                      ? ((e.currentPrice - e.price_at_entry) / e.price_at_entry) * 100
                      : null;

                  return (
                    <tr key={e.id} className="group/row bg-white hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold relative group/ticker">
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
                        changePct === null ? "text-gray-400" : changePct >= 0 ? "text-green-600" : "text-red-600"
                      }`}>
                        {changePct !== null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                        {e.date_added}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button
                            onClick={() => deleteEntry(e.id)}
                            className="cursor-pointer text-gray-400 hover:text-red-500 hover:scale-110 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Card footer — add entry */}
          <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex flex-col items-center gap-3">
            {!adding && (
              <button
                onClick={() => setAdding(true)}
                className="text-xs text-gray-400 hover:text-gray-600 transition"
              >
                + Add
              </button>
            )}
            {adding && (
              <div className="flex items-center gap-3">
                <div className="w-72">
                  <StockSearch onSelect={addToWatchlist} />
                </div>
                <button
                  onClick={() => setAdding(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
