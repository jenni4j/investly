import { useState, useEffect } from "react";
import { Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import type { Stock } from "../types/Stock";
import StockSearch from "./StockSearch";
import { supabase } from "../lib/supabaseClient";
import EditStockModal from "./EditStockModal";

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
  const [openName, setOpenName] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [shares, setShares] = useState("");
  const [initialPrice, setInitialPrice] = useState("");
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [selectedStock, setSelectedStock] = useState<{symbol: string; name: string;} | null>(null);

  const stocks = portfolio.stocks || [];
  const [sortDesc, setSortDesc] = useState(true);

  const sortedStocks = [...stocks].sort((a, b) =>
    sortDesc ? b.returnPct - a.returnPct : a.returnPct - b.returnPct
  ); 

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenName(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const deleteStock = async (id: number) => {
    if (!confirm("Delete this stock?")) return;

    await supabase.from("stocks").delete().eq("id", id);
    refresh();
  };

  const saveNewStock = async () => {
    if (!selectedStock) return;

    const parsedShares = parseFloat(shares);
    const parsedInitial = parseFloat(initialPrice);

    if (!parsedShares || !parsedInitial) {
      alert("Enter valid numbers");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    await supabase.from("stocks").insert([
      {
        user_id: userData.user.id,
        portfolio_id: portfolio.id,
        ticker: selectedStock.symbol,
        shares: parsedShares,
        initial_price: parsedInitial,
      },
    ]);

    setSelectedStock(null);
    setShares("");
    setInitialPrice("");
    setAdding(false);
    refresh();
  };



  return (
    <div className="w-full max-w-5xl mx-auto mt-10">
      <div className="flex items-center gap-3 mb-4">
        <h2 className="text-2xl font-bold tracking-wide">{portfolio.name}</h2>
        <button onClick={onDelete} className="hover:scale-110 cursor-pointer text-gray-400 hover:text-red-500" title="Delete portfolio">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <table className="w-full table-fixed text-sm border-collapse shadow-lg">
        <thead className="bg-[#e9ecf1] text-left uppercase text-xs tracking-wider font-bold">
          <tr>
            <th className="p-3 w-1/8">Ticker</th>
            <th className="p-3 w-1/8">Company</th>
            <th className="p-3 w-1/8 text-center">Last Price</th>
            <th className="p-3 w-1/8 text-center">Initial Price</th>
            <th className="p-3 w-1/8 text-center">Shares</th>
            <th className="p-3 w-1/8 text-center">Value</th>
            <th className="p-3 w-1/8 text-center cursor-pointer" onClick={() => setSortDesc(!sortDesc)}>
              <div className="flex items-center justify-center gap-1">
                Return %
                {sortDesc ? (<ChevronDown className="w-4 h-4" />) : (<ChevronUp className="w-4 h-4" />)}
              </div>
            </th>
            <th className="p-3 w-1/8 text-center">P/L</th>
            <th className="p-3 w-[60px] text-center"></th>
          </tr>
        </thead>

        <tbody>
          {sortedStocks.map((s, i) => (
            <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-[#eef4ff]"}>
              <td className="p-3 font-semibold">{s.ticker}</td>

              <td className="p-3 relative">
                <span
                  className="underline cursor-pointer"
                  onClick={() => setOpenName(openName === s.name ? null : s.name)}
                >
                  {s.name}
                </span>

                {openName === s.name && (
                  <div className="absolute left-0 top-full mt-1 w-64 p-3 text-sm bg-white rounded shadow-lg z-10 border border-gray-300">
                    {s.description}
                  </div>
                )}
              </td>

              <td className="p-3 text-center">{s.lastPrice}</td>
              <td className="p-3 text-center">{s.initialPrice}</td>
              <td className="p-3 text-center">{s.shares}</td>
              <td className="p-3 text-center">${s.value.toLocaleString()}</td>

              <td
                className={`p-3 text-center font-bold ${
                  s.returnPct >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {s.returnPct.toFixed(2)}%
              </td>

              <td
                className={`p-3 text-center font-bold ${
                  s.pnl >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                ${s.pnl.toLocaleString()}
              </td>

              <td className="p-3 text-center">
                <div className="flex justify-center gap-3">
                  <button onClick={() => setEditingStock(s)} className="hover:scale-110 cursor-pointer">
                    <Pencil className="w-5 h-4" />
                  </button>

                  <button onClick={() => deleteStock(s.id)} className="hover:scale-110 cursor-pointer">
                    <Trash2 className="w-5 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="w-full flex flex-col items-center mt-3 gap-3">
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-md bg-white shadow-sm hover:bg-[#eef4ff]"
          >
            + Add Entry
          </button>
        )}

        {adding && (
          <div className="flex items-center gap-3">

            <div className="w-64">
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
              className="border px-2 py-1 rounded w-24"
            />

            <input
              type="number"
              placeholder="Initial Price"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              className="border px-2 py-1 rounded w-28"
            />

            <button
              onClick={saveNewStock}
              className="px-3 py-1 border rounded bg-white hover:bg-[#eef4ff] text-sm font-semibold"
            >
              Save
            </button>

            <button
              onClick={() => {
                setAdding(false);
                setSelectedStock(null);
              }}
              className="text-sm text-gray-500"
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
