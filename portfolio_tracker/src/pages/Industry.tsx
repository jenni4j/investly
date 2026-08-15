import { useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { supabase } from "../lib/supabaseClient";
import { BASE_URL } from "../lib/api";

interface Holding {
  ticker: string;
  shares: number;
  portfolio_id: number;
}

interface PortfolioBreakdown {
  id: number;
  name: string;
  industries: { name: string; value: number; percentage: number }[];
  totalValue: number;
  holdingCount: number;
}

interface Quote {
  ticker: string;
  lastPrice?: number;
  industry?: string;
  description?: string;
}

const COLORS = [
  "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#ca8a04",
  "#16a34a", "#0891b2", "#4f46e5", "#9333ea", "#dc2626",
  "#65a30d", "#0d9488",
];

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export default function Industry() {
  const [portfolios, setPortfolios] = useState<PortfolioBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadBreakdowns = async () => {
      setLoading(true);
      setError("");

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) return;

        const { data: portfolioData, error: portfolioError } = await supabase
          .from("portfolios")
          .select("id, name")
          .eq("user_id", userData.user.id);
        if (portfolioError) throw portfolioError;

        if (!portfolioData?.length) {
          setPortfolios([]);
          return;
        }

        const { data: holdings, error: holdingsError } = await supabase
          .from("stocks")
          .select("ticker, shares, portfolio_id")
          .in("portfolio_id", portfolioData.map((portfolio) => portfolio.id));
        if (holdingsError) throw holdingsError;

        const typedHoldings = (holdings ?? []) as Holding[];
        const tickers = [...new Set(typedHoldings.map((holding) => holding.ticker))];
        let quotes: Quote[] = [];

        if (tickers.length) {
          const response = await fetch(`${BASE_URL}/api/quotes?tickers=${encodeURIComponent(tickers.join(","))}`);
          if (!response.ok) throw new Error("Could not load industry data.");
          const result = await response.json();
          quotes = Array.isArray(result) ? result : [];
        }

        const quoteMap = new Map(quotes.map((quote) => [quote.ticker, quote]));

        setPortfolios(portfolioData.map((portfolio) => {
          const portfolioHoldings = typedHoldings.filter((holding) => holding.portfolio_id === portfolio.id);
          const totals = new Map<string, number>();

          portfolioHoldings.forEach((holding) => {
            const quote = quoteMap.get(holding.ticker);
            const industry = quote?.industry || quote?.description || "Unknown";
            const value = Math.max(0, holding.shares ?? 0) * Math.max(0, quote?.lastPrice ?? 0);
            totals.set(industry, (totals.get(industry) ?? 0) + value);
          });

          const totalValue = [...totals.values()].reduce((sum, value) => sum + value, 0);
          const industries = [...totals.entries()]
            .map(([name, value]) => ({
              name,
              value,
              percentage: totalValue ? (value / totalValue) * 100 : 0,
            }))
            .filter((industry) => industry.value > 0)
            .sort((a, b) => b.value - a.value);

          return {
            id: portfolio.id,
            name: portfolio.name,
            industries,
            totalValue,
            holdingCount: portfolioHoldings.length,
          };
        }));
      } catch (err) {
        console.error(err);
        setError("We couldn't load your industry breakdown. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadBreakdowns();
  }, []);

  return (
    <div className="max-w-5xl mx-auto mt-10 pb-16 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Industry</h1>
        <p className="text-sm text-gray-500 mt-2">
          See how each portfolio is allocated by industry, based on current market value.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading industry breakdowns...</p>}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!loading && !error && portfolios.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Create a portfolio and add holdings to see an industry breakdown.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {portfolios.map((portfolio) => (
          <section key={portfolio.id} className="rounded-xl border border-gray-200 shadow-sm bg-white overflow-hidden">
            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-base font-bold text-gray-800">{portfolio.name}</h2>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-700">{currency.format(portfolio.totalValue)}</p>
                  <p className="text-xs text-gray-400">{portfolio.holdingCount} {portfolio.holdingCount === 1 ? "holding" : "holdings"}</p>
                </div>
              </div>
            </div>

            {portfolio.industries.length ? (
              <div className="px-3 py-5">
                <div className="h-80" aria-label={`${portfolio.name} industry allocation chart`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={portfolio.industries}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="43%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {portfolio.industries.map((industry, index) => (
                          <Cell key={industry.name} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => currency.format(Number(value))}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        formatter={(value) => {
                          const industry = portfolio.industries.find((item) => item.name === value);
                          return `${value} ${industry?.percentage.toFixed(1) ?? "0.0"}%`;
                        }}
                        wrapperStyle={{ fontSize: 11, lineHeight: "20px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-gray-500">
                Add holdings with available market data to see this chart.
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
