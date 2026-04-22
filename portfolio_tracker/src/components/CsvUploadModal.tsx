import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface Portfolio {
  id: number;
  name: string;
}

interface Props {
  portfolios: Portfolio[];
  onClose: () => void;
  onDone: () => void;
}

interface CsvRow {
  ticker: string;
  shares: number;
  entry_price: number;
}

function parseCsv(text: string): { rows: CsvRow[]; error: string | null } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return { rows: [], error: "CSV must have a header row and at least one data row." };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());

  const symbolIdx       = headers.indexOf("symbol");
  const quantityIdx     = headers.indexOf("quantity");
  const initialPriceIdx  = headers.indexOf("initial_price");

  if (symbolIdx === -1)      return { rows: [], error: 'Missing required column: "symbol".' };
  if (quantityIdx === -1)    return { rows: [], error: 'Missing required column: "quantity".' };
  if (initialPriceIdx === -1) return { rows: [], error: 'Missing required column: "initial_price".' };

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
    const ticker      = cols[symbolIdx]?.toUpperCase();
    const shares      = parseFloat(cols[quantityIdx]);
    const entry_price = parseFloat(cols[initialPriceIdx]);

    if (!ticker || isNaN(shares) || isNaN(entry_price)) continue;
    rows.push({ ticker, shares, entry_price });
  }

  if (rows.length === 0) return { rows: [], error: "No valid rows found. Check that quantity and initial_price are numbers." };
  return { rows, error: null };
}

export default function CsvUploadModal({ portfolios, onClose, onDone }: Props) {
  const [mode, setMode] = useState<"existing" | "new">(portfolios.length > 0 ? "existing" : "new");
  const [selectedId, setSelectedId] = useState<string>(String(portfolios[0]?.id ?? ""));
  const [newName, setNewName] = useState("");
  const [rows, setRows] = useState<CsvRow[] | null>(null);
  const [parseError, setParseError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows: parsed, error } = parseCsv(text);
      setParseError(error ?? "");
      setRows(error ? null : parsed);
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (!rows?.length) return;
    setUploading(true);
    setUploadError("");

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) { setUploadError("Not authenticated."); setUploading(false); return; }

    let portfolioId: string;

    if (mode === "existing") {
      portfolioId = selectedId;
      // Replace: delete existing holdings first
      const { error: delErr } = await supabase.from("stocks").delete().eq("portfolio_id", portfolioId);
      if (delErr) { setUploadError(delErr.message); setUploading(false); return; }
    } else {
      const name = newName.trim();
      if (!name) { setUploadError("Enter a portfolio name."); setUploading(false); return; }
      const { data, error: createErr } = await supabase
        .from("portfolios")
        .insert([{ name, user_id: userId }])
        .select("id")
        .single();
      if (createErr || !data) { setUploadError(createErr?.message ?? "Failed to create portfolio."); setUploading(false); return; }
      portfolioId = String(data.id);
    }

    const inserts = rows.map((r) => ({
      user_id: userId,
      portfolio_id: portfolioId,
      ticker: r.ticker,
      shares: r.shares,
      initial_price: r.entry_price,
    }));

    const { error: insErr } = await supabase.from("stocks").insert(inserts);
    if (insErr) { setUploadError(insErr.message); setUploading(false); return; }

    setUploading(false);
    onDone();
    onClose();
  };

  const selectedPortfolio = portfolios.find((p) => String(p.id) === selectedId);
  const canSubmit = rows !== null && rows.length > 0 && !parseError && (mode === "new" ? newName.trim().length > 0 : true);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">

        <h2 className="text-lg font-bold mb-1">Upload Holdings</h2>
        <p className="text-sm text-gray-500 mb-5">Import holdings from a CSV file into a portfolio.</p>

        {/* Portfolio selection */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Portfolio</label>
          <div className="flex gap-3 mb-3">
            {portfolios.length > 0 && (
              <button
                onClick={() => setMode("existing")}
                className={`px-3 py-1.5 text-sm rounded-lg border transition ${mode === "existing" ? "bg-gray-950 text-white border-gray-950" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}
              >
                Existing
              </button>
            )}
            <button
              onClick={() => setMode("new")}
              className={`px-3 py-1.5 text-sm rounded-lg border transition ${mode === "new" ? "bg-gray-950 text-white border-gray-950" : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"}`}
            >
              Create new
            </button>
          </div>

          {mode === "existing" && (
            <>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {selectedPortfolio && (
                <p className="text-xs text-amber-600 mt-2">
                  ⚠ Existing holdings in <span className="font-semibold">{selectedPortfolio.name}</span> will be replaced.
                </p>
              )}
            </>
          )}

          {mode === "new" && (
            <input
              type="text"
              placeholder="Portfolio name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
          )}
        </div>

        {/* CSV upload */}
        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">CSV File</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-white hover:file:bg-gray-50 file:cursor-pointer"
          />
          <p className="text-xs text-gray-400 mt-2">
            Required columns: <code className="bg-gray-100 px-1 rounded">symbol</code>, <code className="bg-gray-100 px-1 rounded">quantity</code>, <code className="bg-gray-100 px-1 rounded">initial_price</code>
          </p>
        </div>

        {/* Parse result */}
        {parseError && <p className="text-sm text-red-600 mb-4">{parseError}</p>}
        {rows && !parseError && (
          <p className="text-sm text-green-700 mb-4">
            ✓ {rows.length} holding{rows.length !== 1 ? "s" : ""} ready to import
          </p>
        )}

        {uploadError && <p className="text-sm text-red-600 mb-4">{uploadError}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!canSubmit || uploading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gray-950 text-white hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>

      </div>
    </div>
  );
}
