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

export default function Watchlists() {
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

  useEffect(() => { fetchWatchlist(); }, []);

  const addToWatchlist = async (stock: { symbol: string; name: string }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const res = await fetch(
      `https://portfolio-tracker-server-ten.vercel.app/api/quotes?tickers=${stock.symbol}`
    );
    const quotes = await res.json();
    const lastPrice: number = quotes[0]?.lastPrice ?? 0;
    const today = new Date().toISOString().split("T")[0];

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
    <div className="max-w-5xl mx-auto mt-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Watchlist</h1>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-md bg-white shadow-sm hover:bg-[#eef4ff]"
          >
            + Add to Watchlist
          </button>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-72">
            <StockSearch onSelect={addToWatchlist} />
          </div>
          <button
            onClick={() => setAdding(false)}
            className="text-sm text-gray-500"
          >
            Cancel
          </button>
        </div>
      )}

      {loading && <p className="text-gray-500">Loading watchlist...</p>}

      {!loading && entries.length === 0 && (
        <p className="text-gray-500 mt-10 text-center">
          Your watchlist is empty. Add a stock to get started.
        </p>
      )}

      {!loading && entries.length > 0 && (
        <table className="w-full table-fixed text-sm border-collapse shadow-lg">
          <thead className="bg-[#e9ecf1] text-left uppercase text-xs tracking-wider font-bold">
            <tr>
              <th className="p-3 w-1/7">Ticker</th>
              <th className="p-3 w-2/7">Company</th>
              <th className="p-3 w-1/7 text-center">Entry Price</th>
              <th className="p-3 w-1/7 text-center">Current Price</th>
              <th className="p-3 w-1/7 text-center">Change %</th>
              <th className="p-3 w-1/7 text-center">Date Added</th>
              <th className="p-3 w-[60px] text-center"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const changePct =
                e.currentPrice !== undefined
                  ? ((e.currentPrice - e.price_at_entry) / e.price_at_entry) * 100
                  : null;

              return (
                <tr key={e.id} className={i % 2 === 0 ? "bg-white" : "bg-[#eef4ff]"}>
                  <td className="p-3 font-semibold">{e.ticker}</td>
                  <td className="p-3">{e.name ?? "—"}</td>
                  <td className="p-3 text-center">${e.price_at_entry.toFixed(2)}</td>
                  <td className="p-3 text-center">
                    {e.currentPrice !== undefined ? `$${e.currentPrice.toFixed(2)}` : "—"}
                  </td>
                  <td
                    className={`p-3 text-center font-bold ${
                      changePct === null
                        ? "text-gray-500"
                        : changePct >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {changePct !== null ? `${changePct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="p-3 text-center">{e.date_added}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => deleteEntry(e.id)}
                      className="hover:scale-110 cursor-pointer"
                    >
                      <Trash2 className="w-5 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
