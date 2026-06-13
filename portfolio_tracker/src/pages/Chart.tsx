import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import { supabase } from "../lib/supabaseClient";
import { BASE_URL } from "../lib/api";
import { timeAgo, todayString, type NewsItem } from "../lib/utils";

type Period = "1d" | "1m" | "6m" | "1y" | "5y";

interface DataPoint {
  date: string;
  close: number;
}

interface Metrics {
  description: string | null;
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
  const { ticker: urlTicker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedTicker, setSelectedTicker] = useState<{ symbol: string; name: string } | null>(null);
  const [period, setPeriod] = useState<Period>("1y");
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [watchlistDuplicate, setWatchlistDuplicate] = useState(false);

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

  const fetchNews = async (ticker: string) => {
    setNewsLoading(true);
    setNews([]);
    try {
      const res = await fetch(`${BASE_URL}/api/news?tickers=${ticker}&limit=5`);
      if (!res.ok) return;
      setNews(await res.json());
    } catch {
      // news is optional — fail silently
    } finally {
      setNewsLoading(false);
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

  const addToWatchlist = async () => {
    if (!selectedTicker) return;
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data: existing } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("ticker", selectedTicker.symbol)
      .maybeSingle();

    if (existing) {
      setWatchlistDuplicate(true);
      setTimeout(() => setWatchlistDuplicate(false), 2500);
      return;
    }

    const res = await fetch(`${BASE_URL}/api/quotes?tickers=${selectedTicker.symbol}`);
    const quotes = await res.json();
    const lastPrice: number = quotes[0]?.lastPrice ?? 0;

    await supabase.from("watchlist").insert([{
      user_id: userData.user.id,
      ticker: selectedTicker.symbol,
      name: selectedTicker.name,
      price_at_entry: lastPrice,
      date_added: todayString(),
    }]);

    setWatchlistAdded(true);
    setTimeout(() => setWatchlistAdded(false), 2000);
  };

  useEffect(() => {
    if (urlTicker) {
      const name = (location.state as { name?: string } | null)?.name ?? urlTicker;
      setSelectedTicker({ symbol: urlTicker.toUpperCase(), name });
    } else {
      setSelectedTicker(null);
    }
  }, [urlTicker]);

  useEffect(() => {
    setWatchlistAdded(false);
  }, [selectedTicker]);

  useEffect(() => {
    if (selectedTicker) {
      fetchHistory(selectedTicker.symbol, period);
    }
  }, [selectedTicker, period]);

  useEffect(() => {
    if (selectedTicker) {
      fetchMetrics(selectedTicker.symbol);
      fetchNews(selectedTicker.symbol);
    } else {
      setMetrics(null);
      setNews([]);
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
    <div className="max-w-5xl mx-auto mt-10 px-4 pb-16">
      <h1 className="text-3xl font-bold mb-6">Charts</h1>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="w-full sm:w-72">
          {!selectedTicker ? (
            <StockSearch onSelect={(r) => navigate(`/charts/${r.symbol}`, { state: { name: r.name } })} />
          ) : (
            <div
              className="border rounded px-3 py-2 bg-[#eef4ff] text-sm cursor-pointer"
              onClick={() => navigate("/charts")}
              title="Click to change stock"
            >
              {selectedTicker.symbol} — {selectedTicker.name}
            </div>
          )}
        </div>

        {selectedTicker && (
          <button
            onClick={addToWatchlist}
            className={`px-3 py-1.5 text-sm font-semibold border rounded-md transition ${
              watchlistDuplicate
                ? "bg-red-50 border-red-300 text-red-600"
                : watchlistAdded
                ? "bg-green-50 border-green-300 text-green-700"
                : "bg-white border-gray-300 hover:bg-[#eef4ff] text-gray-600"
            }`}
          >
            {watchlistDuplicate ? "Already in watchlist" : watchlistAdded ? "Added!" : "+ Watchlist"}
          </button>
        )}

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
        <div className="mt-6 pb-16">
          <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-base font-bold text-gray-800">Key Metrics</h2>
            </div>
            {metricsLoading && <p className="text-gray-500 text-sm px-5 py-6">Loading metrics...</p>}
            {!metricsLoading && metrics && (
              <div className="divide-y divide-gray-100">
                {metricRows.map((row, ri) => (
                  <div key={ri} className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100">
                    {row.map((cell) => (
                      <div key={cell.label} className="px-4 py-3 bg-white hover:bg-gray-50 transition-colors">
                        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">{cell.label}</div>
                        <div className="text-sm font-semibold text-gray-700">{cell.value}</div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {!metricsLoading && metrics?.description && (
            <div className="rounded-xl border border-gray-200 shadow-sm mt-4">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-800">About</h2>
              </div>
              <p className="px-5 py-4 text-sm text-gray-600 leading-relaxed">{metrics.description}</p>
            </div>
          )}

          {(newsLoading || news.length > 0) && (
            <div className="rounded-xl border border-gray-200 shadow-sm mt-4">
              <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-base font-bold text-gray-800">Recent News</h2>
              </div>
              {newsLoading && <p className="text-gray-500 text-sm px-5 py-6">Loading news...</p>}
              {!newsLoading && (
                <ul className="divide-y divide-gray-100">
                  {news.map((item) => (
                    <li key={item.uuid} className="px-5 py-4 bg-white hover:bg-gray-50 transition-colors">
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-gray-800 hover:text-blue-600 leading-snug block mb-1.5"
                      >
                        {item.title}
                      </a>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>{item.publisher}</span>
                        <span>·</span>
                        <span>{timeAgo(item.publishedAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
