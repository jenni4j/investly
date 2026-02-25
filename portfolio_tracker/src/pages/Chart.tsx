import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import StockSearch from "../components/StockSearch";

type Period = "1d" | "1m" | "6m" | "1y" | "5y";

interface DataPoint {
  date: string;
  close: number;
}

interface Metrics {
  marketCap: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  priceToBook: number | null;
  evToEbitda: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  avgVolume: number | null;
  shortRatio: number | null;
  revenue: number | null;
  profitMargin: number | null;
  returnOnEquity: number | null;
  debtToEquity: number | null;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: "1D", value: "1d" },
  { label: "1M", value: "1m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
];

const BASE_URL = "https://portfolio-tracker-server-ten.vercel.app";

function fmtLarge(n: number | null): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(2)}%`;
}

function fmtNum(n: number | null, decimals = 2): string {
  if (n == null) return "—";
  return n.toFixed(decimals);
}

function fmtVol(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toLocaleString();
}

export default function Charts() {
  const [selectedTicker, setSelectedTicker] = useState<{ symbol: string; name: string } | null>(null);
  const [period, setPeriod] = useState<Period>("1m");
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const fetchHistory = async (ticker: string, p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/history?ticker=${ticker}&period=${p}`);
      if (!res.ok) { setChartData([]); return; }
      setChartData(await res.json());
    } catch {
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetrics = async (ticker: string) => {
    setMetricsLoading(true);
    setMetrics(null);
    try {
      const res = await fetch(`${BASE_URL}/api/metrics?ticker=${ticker}`);
      if (!res.ok) return;
      setMetrics(await res.json());
    } catch {
      // metrics are optional — fail silently
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTicker) {
      fetchHistory(selectedTicker.symbol, period);
    }
  }, [selectedTicker, period]);

  useEffect(() => {
    if (selectedTicker) {
      fetchMetrics(selectedTicker.symbol);
    } else {
      setMetrics(null);
    }
  }, [selectedTicker]);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const formatXAxisTick = (value: string): string => {
    if (period === "1d") return value; // already a time string
    const parts = value.split("-");
    const mon = MONTHS[parseInt(parts[1] ?? "1") - 1];
    const day = parseInt(parts[2] ?? "1");
    const yr = (parts[0] ?? "").slice(2);
    if (period === "1m" || period === "6m") return `${mon} ${day}`;
    return `${mon} '${yr}`;
  };

  const xAxisInterval = Math.max(1, Math.floor(chartData.length / 6));

  const minClose = chartData.length ? Math.min(...chartData.map((d) => d.close)) : 0;
  const maxClose = chartData.length ? Math.max(...chartData.map((d) => d.close)) : 0;
  const padding = (maxClose - minClose) * 0.1 || 1;
  const isUp = chartData.length >= 2 && chartData[chartData.length - 1].close >= chartData[0].close;

  const metricRows: { label: string; value: string }[][] = metrics
    ? [
        [
          { label: "Market Cap", value: fmtLarge(metrics.marketCap) },
          { label: "P/E (TTM)", value: fmtNum(metrics.trailingPE) },
          { label: "Forward P/E", value: fmtNum(metrics.forwardPE) },
          { label: "EPS (TTM)", value: metrics.eps != null ? `$${fmtNum(metrics.eps)}` : "—" },
        ],
        [
          { label: "Price / Book", value: fmtNum(metrics.priceToBook) },
          { label: "EV / EBITDA", value: fmtNum(metrics.evToEbitda) },
          { label: "Revenue (TTM)", value: fmtLarge(metrics.revenue) },
          { label: "Profit Margin", value: fmtPct(metrics.profitMargin) },
        ],
        [
          { label: "Return on Equity", value: fmtPct(metrics.returnOnEquity) },
          { label: "Debt / Equity", value: fmtNum(metrics.debtToEquity) },
          { label: "Dividend Yield", value: fmtPct(metrics.dividendYield) },
          { label: "Beta", value: fmtNum(metrics.beta) },
        ],
        [
          { label: "52-Week High", value: metrics.fiftyTwoWeekHigh != null ? `$${fmtNum(metrics.fiftyTwoWeekHigh)}` : "—" },
          { label: "52-Week Low", value: metrics.fiftyTwoWeekLow != null ? `$${fmtNum(metrics.fiftyTwoWeekLow)}` : "—" },
          { label: "Avg Volume", value: fmtVol(metrics.avgVolume) },
          { label: "Short Ratio", value: fmtNum(metrics.shortRatio) },
        ],
      ]
    : [];

  return (
    <div className="max-w-5xl mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-6">Charts</h1>

      <div className="flex items-center gap-4 mb-6">
        <div className="w-72">
          {!selectedTicker ? (
            <StockSearch onSelect={(r) => setSelectedTicker(r)} />
          ) : (
            <div
              className="border rounded px-3 py-2 bg-[#eef4ff] text-sm cursor-pointer"
              onClick={() => setSelectedTicker(null)}
              title="Click to change stock"
            >
              {selectedTicker.symbol} — {selectedTicker.name}
            </div>
          )}
        </div>

        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-sm font-semibold border rounded-md ${
                period === p.value
                  ? "bg-[#eef4ff] border-blue-300"
                  : "bg-white border-gray-300 hover:bg-[#eef4ff]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!selectedTicker && (
        <p className="text-gray-500 mt-10 text-center">Select a stock to view its chart.</p>
      )}

      {selectedTicker && loading && (
        <p className="text-gray-500 mt-10 text-center">Loading chart data...</p>
      )}

      {selectedTicker && !loading && chartData.length > 0 && (
        <div className="border border-gray-200 rounded-lg shadow-sm p-4">
          <div className="flex justify-between items-baseline mb-4">
            <span className="text-xl font-bold">{selectedTicker.symbol}</span>
            <span className={`text-sm font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}>
              ${chartData[chartData.length - 1].close.toFixed(2)}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                interval={xAxisInterval}
                tickFormatter={formatXAxisTick}
              />
              <YAxis
                domain={[minClose - padding, maxClose + padding]}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v.toFixed(0)}`}
                width={60}
              />
              <Tooltip
                formatter={(value: number | undefined) => [value != null ? `$${value.toFixed(2)}` : "—", "Price"]}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
              />
              <Line
                type="monotone"
                dataKey="close"
                stroke={isUp ? "#16a34a" : "#dc2626"}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {selectedTicker && !loading && chartData.length === 0 && (
        <p className="text-gray-500 mt-10 text-center">No data available for this period.</p>
      )}

      {selectedTicker && (
        <div className="mt-6">
          <h2 className="text-lg font-bold mb-3">Key Statistics</h2>
          {metricsLoading && <p className="text-gray-500 text-sm">Loading metrics...</p>}
          {!metricsLoading && metrics && (
            <div className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {metricRows.map((row, ri) => (
                <div
                  key={ri}
                  className={`grid grid-cols-4 divide-x divide-gray-200 ${ri % 2 === 0 ? "bg-white" : "bg-[#eef4ff]"} ${ri > 0 ? "border-t border-gray-200" : ""}`}
                >
                  {row.map((cell) => (
                    <div key={cell.label} className="px-4 py-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{cell.label}</div>
                      <div className="text-sm font-semibold">{cell.value}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
