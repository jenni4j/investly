import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, ChevronUp, ChevronDown, StickyNote } from "lucide-react";
import StockSearch from "../components/StockSearch";
import { supabase } from "../lib/supabaseClient";
import { BASE_URL } from "../lib/api";
import { todayString } from "../lib/utils";

interface WatchlistEntry {
  id: number;
  ticker: string;
  name: string | null;
  price_at_entry: number;
  date_added: string;
  notes?: string | null;
  currentPrice?: number;
  currency?: string;
  industry?: string;
}

export default function Watchlist() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [sortDesc, setSortDesc] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      `${BASE_URL}/api/quotes?tickers=${tickers}`
    );
    const quotes = await res.json();
    const quoteMap: Record<string, { lastPrice: number; currency: string; industry: string }> = Object.fromEntries(
      quotes.map((q: { ticker: string; lastPrice: number; currency: string; industry?: string; description?: string }) => [
        q.ticker,
        {
          lastPrice: q.lastPrice,
          currency: q.currency ?? "USD",
          industry: q.industry || q.description || "Unknown",
        },
      ])
    );

    setEntries(
      data.map((e) => ({
        ...e,
        currentPrice: quoteMap[e.ticker]?.lastPrice ?? undefined,
        currency: quoteMap[e.ticker]?.currency ?? "USD",
        industry: quoteMap[e.ticker]?.industry ?? "Unknown",
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

  useEffect(() => {
    if (editingNoteId !== null) {
      textareaRef.current?.focus();
    }
  }, [editingNoteId]);

  const addToWatchlist = async (stock: { symbol: string; name: string }) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const res = await fetch(
      `${BASE_URL}/api/quotes?tickers=${stock.symbol}`
    );
    const quotes = await res.json();
    const lastPrice: number = quotes[0]?.lastPrice ?? 0;

    await supabase.from("watchlist").insert([
      {
        user_id: userData.user.id,
        ticker: stock.symbol,
        name: stock.name,
        price_at_entry: lastPrice,
        date_added: todayString(),
      },
    ]);

    setAdding(false);
    fetchWatchlist();
  };

  const deleteEntry = async (id: number) => {
    if (!confirm("Remove from watchlist?")) return;
    if (editingNoteId === id) setEditingNoteId(null);
    await supabase.from("watchlist").delete().eq("id", id);
    fetchWatchlist();
  };

  const openNote = (e: WatchlistEntry) => {
    if (editingNoteId === e.id) {
      setEditingNoteId(null);
      return;
    }
    setDraftNote(e.notes ?? "");
    setEditingNoteId(e.id);
  };

  const saveNote = async (id: number) => {
    const trimmed = draftNote.trim();
    await supabase
      .from("watchlist")
      .update({ notes: trimmed || null })
      .eq("id", id);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, notes: trimmed || null } : e))
    );
    setEditingNoteId(null);
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 pb-16 px-4">
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
            <div className="overflow-x-auto">
            <table className="w-full table-auto text-sm">
              <thead className="bg-[#e9ecf1] text-xs uppercase tracking-wider font-bold border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">Ticker</th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">Industry</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Entry Price</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Current Price</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer" onClick={() => setSortDesc((d) => !d)}>
                    <div className="flex items-center justify-end gap-1">
                      Change %
                      {sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Date Added</th>
                  <th className="px-4 py-3 text-left">Currency</th>
                  <th className="px-4 py-3 w-[80px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...entries]
                  .map((e) => ({
                    ...e,
                    changePct: e.currentPrice !== undefined
                      ? ((e.currentPrice - e.price_at_entry) / e.price_at_entry) * 100
                      : null,
                  }))
                  .sort((a, b) => {
                    if (a.changePct === null) return 1;
                    if (b.changePct === null) return -1;
                    return sortDesc ? b.changePct - a.changePct : a.changePct - b.changePct;
                  })
                  .flatMap((e) => {
                    const isEditing = editingNoteId === e.id;
                    const hasNote = !!e.notes;
                    return [
                      <tr key={e.id} className="group/row bg-white hover:bg-gray-50 transition-colors">
                        <td
                          className="px-4 py-3 font-semibold whitespace-nowrap relative group/ticker cursor-pointer hover:text-blue-600 transition-colors"
                          onClick={() => navigate(`/charts/${e.ticker}`, { state: { name: e.name ?? e.ticker } })}
                        >
                          {e.ticker}
                          {e.name && (
                            <div className="absolute left-0 bottom-full mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg z-10 whitespace-nowrap hidden group-hover/ticker:block pointer-events-none">
                              {e.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-left text-xs text-gray-500 whitespace-nowrap">
                          {e.industry ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-500">
                          ${e.price_at_entry.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-700">
                          {e.currentPrice !== undefined ? `$${e.currentPrice.toFixed(2)}` : "—"}
                        </td>
                        <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${
                          e.changePct === null ? "text-gray-400" : (e.changePct ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {e.changePct !== null ? `${(e.changePct ?? 0) >= 0 ? "+" : ""}${e.changePct?.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-500">
                          {e.date_added}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 font-semibold">{e.currency ?? "USD"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <button
                              onClick={() => openNote(e)}
                              className={`cursor-pointer transition hover:scale-110 relative ${
                                isEditing ? "text-blue-500" : hasNote ? "text-blue-400" : "text-gray-400 hover:text-blue-400"
                              }`}
                              title={hasNote ? "Edit note" : "Add note"}
                            >
                              <StickyNote className="w-4 h-4" />
                              {hasNote && !isEditing && (
                                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteEntry(e.id)}
                              className="cursor-pointer text-gray-400 hover:text-red-500 hover:scale-110 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>,
                      isEditing && (
                        <tr key={`note-${e.id}`} className="bg-blue-50 border-t-0">
                          <td colSpan={8} className="px-4 pb-3 pt-2">
                            <textarea
                              ref={textareaRef}
                              value={draftNote}
                              onChange={(ev) => setDraftNote(ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Escape") setEditingNoteId(null);
                                if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) saveNote(e.id);
                              }}
                              placeholder="Add a note for this stock..."
                              rows={2}
                              className="w-full text-sm text-gray-700 bg-white border border-blue-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                            />
                            <div className="flex gap-2 mt-1.5 justify-end">
                              <button
                                onClick={() => setEditingNoteId(null)}
                                className="text-xs text-gray-400 hover:text-gray-600 transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => saveNote(e.id)}
                                className="text-xs bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition"
                              >
                                Save
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    ].filter(Boolean);
                  })}
              </tbody>
            </table>
            </div>
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
