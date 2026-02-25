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

const PERIODS: { label: string; value: Period }[] = [
  { label: "1D", value: "1d" },
  { label: "1M", value: "1m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "5Y", value: "5y" },
];

export default function Charts() {
  const [selectedTicker, setSelectedTicker] = useState<{ symbol: string; name: string } | null>(null);
  const [period, setPeriod] = useState<Period>("1m");
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = async (ticker: string, p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://portfolio-tracker-server-ten.vercel.app/api/history?ticker=${ticker}&period=${p}`
      );
      if (!res.ok) {
        console.error(`History API returned ${res.status}`);
        setChartData([]);
        return;
      }
      const data = await res.json();
      setChartData(data);
    } catch (err) {
      console.error(err);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTicker) {
      fetchHistory(selectedTicker.symbol, period);
    }
  }, [selectedTicker, period]);

  const minClose = chartData.length ? Math.min(...chartData.map((d) => d.close)) : 0;
  const maxClose = chartData.length ? Math.max(...chartData.map((d) => d.close)) : 0;
  const padding = (maxClose - minClose) * 0.1 || 1;
  const isUp = chartData.length >= 2 && chartData[chartData.length - 1].close >= chartData[0].close;

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
                interval="preserveStartEnd"
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
    </div>
  );
}
