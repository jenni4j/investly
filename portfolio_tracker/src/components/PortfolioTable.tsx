import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Pencil, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import type { Stock } from "../types/Stock";
import StockSearch from "./StockSearch";
import { supabase } from "../lib/supabaseClient";
import EditStockModal from "./EditStockModal";
import MomentumBadge from "./MomentumBadge";

interface PortfolioTableProps {
  portfolio: {
    id: number;
    name: string;
    stocks?: Stock[];
  };
  refresh: () => void;
  onDelete: () => void;
}

export default function PortfolioTable({ portfolio, refresh, onDelete }: PortfolioTableProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [shares, setShares] = useState("");
  const [initialPrice, setInitialPrice] = useState("");
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [portfolioName, setPortfolioName] = useState(portfolio.name);
  const [savingName, setSavingName] = useState(false);
  const [selectedStock, setSelectedStock] = useState<{ symbol: string; name: string } | null>(null);

  const stocks = portfolio.stocks || [];
  const [sortField, setSortField] = useState<"returnPct" | "pnl">("returnPct");
  const [sortDesc, setSortDesc] = useState(true);

  const sortedStocks = [...stocks].sort((a, b) =>
    sortDesc ? b[sortField] - a[sortField] : a[sortField] - b[sortField]
  );

  const handleSort = (field: "returnPct" | "pnl") => {
    if (sortField === field) setSortDesc(!sortDesc);
    else { setSortField(field); setSortDesc(true); }
  };

  const deleteStock = async (id: number) => {
    if (!confirm("Delete this stock?")) return;
    await supabase.from("stocks").delete().eq("id", id);
    refresh();
  };

  const cancelNameEdit = () => {
    setPortfolioName(portfolio.name);
    setEditingName(false);
  };

  const savePortfolioName = async () => {
    const name = portfolioName.trim();
    if (!name || name === portfolio.name) {
      cancelNameEdit();
      return;
    }

    setSavingName(true);
    const { error } = await supabase
      .from("portfolios")
      .update({ name })
      .eq("id", portfolio.id);
    setSavingName(false);

    if (error) {
      console.error(error);
      alert("Could not rename the portfolio. Please try again.");
      return;
    }

    setPortfolioName(name);
    setEditingName(false);
    refresh();
  };

  const saveNewStock = async () => {
    if (!selectedStock) return;
    const parsedShares = parseFloat(shares);
    const parsedInitial = parseFloat(initialPrice);
    if (!parsedShares || !parsedInitial) { alert("Enter valid numbers"); return; }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    await supabase.from("stocks").insert([{
      user_id: userData.user.id,
      portfolio_id: portfolio.id,
      ticker: selectedStock.symbol,
      shares: parsedShares,
      initial_price: parsedInitial,
    }]);

    setSelectedStock(null);
    setShares("");
    setInitialPrice("");
    setAdding(false);
    refresh();
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full mx-auto mt-8 rounded-xl border border-gray-200 shadow-sm">

      {/* Card header */}
      <div className="flex items-center justify-between rounded-t-xl px-5 py-4 bg-gray-50 border-b border-gray-200">
        {editingName ? (
          <div className="flex min-w-0 items-center gap-2">
            <input
              autoFocus
              value={portfolioName}
              onChange={(event) => setPortfolioName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") savePortfolioName();
                if (event.key === "Escape") cancelNameEdit();
              }}
              disabled={savingName}
              className="min-w-0 w-64 max-w-full rounded-md border border-blue-300 bg-white px-2.5 py-1 text-base font-bold tracking-wide text-gray-800 outline-none focus:ring-2 focus:ring-blue-200"
              aria-label="Portfolio name"
            />
            <button
              onClick={savePortfolioName}
              disabled={savingName || !portfolioName.trim()}
              className="text-green-600 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Save portfolio name"
              aria-label="Save portfolio name"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelNameEdit}
              disabled={savingName}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
              title="Cancel renaming"
              aria-label="Cancel renaming"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="group/name flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-bold tracking-wide text-gray-800">{portfolio.name}</h2>
            <button
              onClick={() => {
                setPortfolioName(portfolio.name);
                setEditingName(true);
              }}
              className="text-gray-400 opacity-60 transition hover:text-blue-500 sm:opacity-0 sm:group-hover/name:opacity-100 focus:opacity-100"
              title="Rename portfolio"
              aria-label={`Rename ${portfolio.name}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          onClick={onDelete}
          className="text-gray-400 hover:text-red-500 hover:scale-110 transition cursor-pointer"
          title="Delete portfolio"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] table-auto text-sm">
        <thead className="bg-[#e9ecf1] text-xs uppercase tracking-wider font-bold border-b border-gray-200">
          <tr>
            <th className="px-4 py-3 text-left">Ticker</th>
            <th className="px-4 py-3 text-left whitespace-nowrap">Industry</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">Last Price</th>
            <th className="px-4 py-3 text-right whitespace-nowrap">Entry Price</th>
            <th className="px-4 py-3 text-right">Shares</th>
            <th className="px-4 py-3 text-right">Value</th>
            <th className="px-4 py-3 text-right cursor-pointer" onClick={() => handleSort("pnl")}>
              <div className="flex items-center justify-end gap-1">
                P/L
                {sortField === "pnl"
                  ? (sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)
                  : <ChevronDown className="w-4 h-4 opacity-25" />}
              </div>
            </th>
            <th className="px-4 py-3 text-right whitespace-nowrap cursor-pointer" onClick={() => handleSort("returnPct")}>
              <div className="flex items-center justify-end gap-1">
                Return %
                {sortField === "returnPct"
                  ? (sortDesc ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />)
                  : <ChevronDown className="w-4 h-4 opacity-25" />}
              </div>
            </th>
            <th className="px-4 py-3 text-left whitespace-nowrap">Momentum</th>
            <th className="px-4 py-3 text-left">Currency</th>
            <th className="px-4 py-3 w-[56px]"></th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {sortedStocks.map((s) => (
            <tr key={s.id} className="group/row bg-white hover:bg-gray-50 transition-colors">
              <td
                className="px-4 py-3 font-semibold whitespace-nowrap relative group/ticker cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => navigate(`/charts/${s.ticker}`, { state: { name: s.name ?? s.ticker } })}
              >
                {s.ticker}
                {s.name && (
                  <div className="absolute left-0 bottom-full mb-1 px-2 py-1 text-xs bg-gray-800 text-white rounded shadow-lg z-10 whitespace-nowrap hidden group-hover/ticker:block pointer-events-none">
                    {s.name}
                  </div>
                )}
              </td>

              <td className="px-4 py-3 text-left text-xs text-gray-500 whitespace-nowrap">
                {s.industry || s.description || "Unknown"}
              </td>

              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-700">${fmt(s.lastPrice)}</td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-500">${fmt(s.initialPrice)}</td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-700">{s.shares}</td>
              <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-gray-700">${fmt(s.value)}</td>

              <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${s.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                {s.pnl >= 0 ? "+" : ""}${fmt(s.pnl)}
              </td>

              <td className={`px-4 py-3 text-right tabular-nums whitespace-nowrap ${s.returnPct >= 0 ? "text-green-600" : "text-red-600"}`}>
                {s.returnPct >= 0 ? "+" : ""}{s.returnPct.toFixed(2)}%
              </td>

              <td className="px-4 py-3">
                <MomentumBadge momentum={s.momentum} />
              </td>

              <td className="px-4 py-3 text-xs text-gray-400 font-semibold">{s.currency ?? "USD"}</td>

              <td className="px-4 py-3">
                <div className="flex justify-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <button onClick={() => setEditingStock(s)} className="cursor-pointer text-gray-400 hover:text-blue-500 hover:scale-110 transition">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteStock(s.id)} className="cursor-pointer text-gray-400 hover:text-red-500 hover:scale-110 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {/* Card footer — add entry */}
      <div className="relative z-10 rounded-b-xl border-t border-gray-200 px-4 py-3 bg-gray-50 flex flex-col items-center gap-3">
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            + Add
          </button>
        )}

        {adding && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="w-56">
              {!selectedStock ? (
                <StockSearch onSelect={(stock) => setSelectedStock(stock)} />
              ) : (
                <div className="border rounded px-3 py-2 bg-[#eef4ff] text-sm">
                  {selectedStock.symbol} — {selectedStock.name}
                </div>
              )}
            </div>

            <input
              type="number"
              placeholder="Shares"
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              className="border px-2 py-1.5 rounded w-24 text-sm"
            />

            <input
              type="number"
              placeholder="Initial Price"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              className="border px-2 py-1.5 rounded w-28 text-sm"
            />

            <button
              onClick={saveNewStock}
              className="px-3 py-1.5 border rounded bg-white hover:bg-[#eef4ff] text-sm font-semibold transition"
            >
              Save
            </button>

            <button
              onClick={() => { setAdding(false); setSelectedStock(null); }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {editingStock && (
        <EditStockModal
          stock={editingStock}
          onClose={() => setEditingStock(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
