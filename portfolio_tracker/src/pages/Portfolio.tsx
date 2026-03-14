import { useEffect, useState } from "react";
import PortfolioTable from "../components/PortfolioTable";
import type { Stock } from "../types/Stock";
import { supabase } from "../lib/supabaseClient";

interface Portfolio {
  id: number;
  name: string;
  stocks?: Stock[];
}

export default function Portfolio() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPortfolios = async () => {
    setLoading(true);
  
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
  
    const { data: portfolioData, error: portfolioError } = await supabase
      .from("portfolios")
      .select("id, name")
      .eq("user_id", userData.user.id);
  
    if (portfolioError) {
      console.error(portfolioError);
      setLoading(false);
      return;
    }
  
    const { data: allStocks } = await supabase
      .from("stocks")
      .select("*") /* optimize query later */
      .in("portfolio_id", portfolioData.map((p) => p.id));
  
    if (!allStocks) {
      setPortfolios(portfolioData.map((p) => ({ ...p, stocks: [] })));
      setLoading(false);
      return;
    }
  
    const allTickers = Array.from(new Set(allStocks.map((s) => s.ticker)));
  
    const res = await fetch(
      `https://portfolio-tracker-server-ten.vercel.app/api/quotes?tickers=${allTickers.join(",")}`
    );
    const yahooData = await res.json();
  
    const yahooMap = Object.fromEntries(yahooData.map((x: any) => [x.ticker, x]));
  
    const enrichedStocks = allStocks.map((s) => {
      const y = yahooMap[s.ticker];
      return {
        ...s,
        name: y?.name ?? "",
        description: y?.description ?? "",
        lastPrice: y?.lastPrice ?? 0,
        initialPrice: s.initial_price,
        value: (s.shares ?? 0) * (y?.lastPrice ?? 0),
        pnl: ((y?.lastPrice ?? 0) - (s.initial_price ?? 0)) * (s.shares ?? 0),
        returnPct:
          ((y?.lastPrice ?? 0) - (s.initial_price ?? 0)) /
          (s.initial_price ?? 1) *
          100,
      };
    });
  
    const portfoliosWithStocks = portfolioData.map((p) => ({
      ...p,
      stocks: enrichedStocks.filter((s) => s.portfolio_id === p.id),
    }));
  
    setPortfolios(portfoliosWithStocks);
    setLoading(false);
  };

  useEffect(() => {
    fetchPortfolios();

    const channel = supabase
      .channel("stocks-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "stocks" }, fetchPortfolios)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const deletePortfolio = async (id: number) => {
    if (!confirm("Delete this portfolio and all its stocks?")) return;
    await supabase.from("stocks").delete().eq("portfolio_id", id);
    await supabase.from("portfolios").delete().eq("id", id);
    fetchPortfolios();
  };

  const createPortfolio = async () => {
    const name = prompt("Enter a name for your new portfolio:");
    if (!name) return;

    const user = await supabase.auth.getUser();
    const userId = user.data.user?.id;
    if (!userId) return;

    const { data, error } = await supabase
      .from("portfolios")
      .insert([{ name, user_id: userId }])
      .select()
      .single();

    if (error) return console.error(error);

    setPortfolios((prev) => [...prev, data]);
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 pb-16">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Portfolios</h1>
        <button
          onClick={createPortfolio}
          className="px-3 py-2 text-sm font-semibold border border-gray-300 rounded-md bg-white shadow-sm hover:bg-[#eef4ff]"
        >
          + New Portfolio
        </button>
      </div>

      {loading && <p>Loading portfolios...</p>}

      {portfolios.map((p) => (
        <PortfolioTable
          key={p.id}
          portfolio={p}
          refresh={fetchPortfolios}
          onDelete={() => deletePortfolio(p.id)}
        />
      ))}
    </div>
  );
}
