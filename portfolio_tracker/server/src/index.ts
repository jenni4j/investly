import "dotenv/config";
import express from "express";
import cors from "cors";
import YahooFinance from "yahoo-finance2";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const app = express();
const yf = new YahooFinance();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

app.get("/api/quotes", async (req, res) => {
  try {
    const tickers = req.query.tickers?.toString();
    if (!tickers) return res.status(400).json({ error: "tickers required" });

    const symbols = tickers.split(",");

    const mapped = await Promise.all(
      symbols.map(async (ticker) => {
        const summary = await yf.quoteSummary(ticker, {
          modules: ["assetProfile", "price"],
        });

        return {
          ticker,
          name: summary.price?.longName ?? ticker,
          description: summary.assetProfile?.industry ?? "",
          lastPrice: summary.price?.regularMarketPrice ?? 0,
        };
      })
    );

    res.json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch yahoo finance data" });
  }
});

app.get("/api/history", async (req, res) => {
  try {
    const ticker = req.query.ticker?.toString();
    const period = req.query.period?.toString() ?? "1m";

    if (!ticker) return res.status(400).json({ error: "ticker required" });

    const now = new Date();
    const period1 = new Date(now);
    let interval: "5m" | "1d" | "1wk" | "1mo";
    let dateFormatter: (d: Date) => string;

    switch (period) {
      case "1d":
        period1.setDate(now.getDate() - 1);
        interval = "5m";
        dateFormatter = (d) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        break;
      case "6m":
        period1.setMonth(now.getMonth() - 6);
        interval = "1d";
        dateFormatter = (d) => d.toISOString().slice(0, 10);
        break;
      case "1y":
        period1.setFullYear(now.getFullYear() - 1);
        interval = "1wk";
        dateFormatter = (d) => d.toISOString().slice(0, 10);
        break;
      case "5y":
        period1.setFullYear(now.getFullYear() - 5);
        interval = "1mo";
        dateFormatter = (d) => d.toISOString().slice(0, 10);
        break;
      default: // 1m
        period1.setMonth(now.getMonth() - 1);
        interval = "1d";
        dateFormatter = (d) => d.toISOString().slice(0, 10);
    }

    const result = await yf.chart(ticker, { interval, period1, period2: now });
    const data = result.quotes
      .filter((q) => q.close != null)
      .map((q) => ({
        date: dateFormatter(q.date),
        close: q.close as number,
      }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch historical data" });
  }
});

app.get("/api/metrics", async (req, res) => {
  try {
    const ticker = req.query.ticker?.toString();
    if (!ticker) return res.status(400).json({ error: "ticker required" });

    const summary = await yf.quoteSummary(ticker, {
      modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "price"],
    });

    const sd = summary.summaryDetail;
    const ks = summary.defaultKeyStatistics;
    const fd = summary.financialData;
    const pr = summary.price;

    res.json({
      marketCap: pr?.marketCap ?? sd?.marketCap ?? null,
      trailingPE: sd?.trailingPE ?? null,
      forwardPE: sd?.forwardPE ?? null,
      priceToBook: ks?.priceToBook ?? null,
      evToEbitda: ks?.enterpriseToEbitda ?? null,
      eps: ks?.trailingEps ?? null,
      dividendYield: sd?.dividendYield ?? null,
      beta: sd?.beta ?? null,
      fiftyTwoWeekHigh: sd?.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: sd?.fiftyTwoWeekLow ?? null,
      avgVolume: sd?.averageVolume ?? null,
      shortRatio: ks?.shortRatio ?? null,
      revenue: fd?.totalRevenue ?? null,
      profitMargin: fd?.profitMargins ?? null,
      returnOnEquity: fd?.returnOnEquity ?? null,
      debtToEquity: fd?.debtToEquity ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch metrics" });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q?.toString();
    if (!query) return res.json([]);

    const results = await yf.search(query, {}, { validateResult: false }) as any;

    const stocks =
      results.quotes
        ?.filter((q: any) => q.symbol && q.shortname)
        .slice(0, 10)
        .map((q: any) => ({
          symbol: q.symbol,
          name: q.shortname,
          exchange: q.exchange
        })) ?? [];

    res.json(stocks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "search failed" });
  }
});

// --- Agent tools ---

const agentTools: Anthropic.Tool[] = [
  {
    name: "get_portfolio",
    description: "Get the user's portfolio: all holdings with entry price, current price, shares, value, P&L, and return %.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_watchlist",
    description: "Get the user's watchlist with entry price, current price, and change % since added.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

async function fetchQuoteMap(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  const results = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const s = await yf.quoteSummary(ticker, { modules: ["price"] });
        return [ticker, s.price?.regularMarketPrice ?? 0] as [string, number];
      } catch {
        return [ticker, 0] as [string, number];
      }
    })
  );
  return Object.fromEntries(results);
}

async function toolGetPortfolio(accessToken: string) {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: portfolios } = await sb.from("portfolios").select("id, name");
  if (!portfolios?.length) return { portfolios: [] };

  const { data: stocks } = await sb
    .from("stocks")
    .select("*")
    .in("portfolio_id", portfolios.map((p: any) => p.id));

  const tickers = [...new Set((stocks ?? []).map((s: any) => s.ticker))] as string[];
  const quoteMap = await fetchQuoteMap(tickers);

  return {
    portfolios: portfolios.map((p: any) => ({
      name: p.name,
      holdings: (stocks ?? [])
        .filter((s: any) => s.portfolio_id === p.id)
        .map((s: any) => {
          const current = quoteMap[s.ticker] ?? s.initial_price;
          const value = current * s.shares;
          const pnl = (current - s.initial_price) * s.shares;
          const returnPct = ((current - s.initial_price) / s.initial_price) * 100;
          return {
            ticker: s.ticker,
            name: s.name,
            shares: s.shares,
            entryPrice: s.initial_price,
            currentPrice: +current.toFixed(2),
            value: +value.toFixed(2),
            pnl: +pnl.toFixed(2),
            returnPct: +returnPct.toFixed(2),
          };
        }),
    })),
  };
}

async function toolGetWatchlist(accessToken: string) {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: entries } = await sb.from("watchlist").select("*").order("date_added", { ascending: false });
  if (!entries?.length) return { watchlist: [] };

  const tickers = [...new Set(entries.map((e: any) => e.ticker))] as string[];
  const quoteMap = await fetchQuoteMap(tickers);

  return {
    watchlist: entries.map((e: any) => {
      const current = quoteMap[e.ticker] ?? e.price_at_entry;
      const changePct = ((current - e.price_at_entry) / e.price_at_entry) * 100;
      return {
        ticker: e.ticker,
        name: e.name,
        entryPrice: e.price_at_entry,
        currentPrice: +current.toFixed(2),
        changePct: +changePct.toFixed(2),
        dateAdded: e.date_added,
      };
    }),
  };
}

// --- Agent endpoint ---

app.post("/api/agent", async (req, res) => {
  try {
    const { messages, accessToken } = req.body as {
      messages: Anthropic.MessageParam[];
      accessToken?: string;
    };

    if (!messages?.length) return res.status(400).json({ error: "messages required" });

    const SYSTEM = "You are Benji, an intelligent investing assistant. You have access to the user's portfolio and watchlist via tools. Use them whenever the user asks about their holdings, performance, or watchlist. Be concise and direct.";

    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      tools: agentTools,
      messages,
    });

    // Agentic loop — keep going while Claude wants to call tools
    let currentMessages = [...messages];
    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          let result: unknown;
          try {
            if (block.name === "get_portfolio") result = await toolGetPortfolio(accessToken ?? "");
            else if (block.name === "get_watchlist") result = await toolGetWatchlist(accessToken ?? "");
            else result = { error: "unknown tool" };
          } catch (e: any) {
            result = { error: e?.message ?? "tool error" };
          }
          return { type: "tool_result" as const, tool_use_id: block.id, content: JSON.stringify(result) };
        })
      );

      currentMessages = [
        ...currentMessages,
        { role: "assistant" as const, content: response.content },
        { role: "user" as const, content: toolResults },
      ];

      response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: SYSTEM,
        tools: agentTools,
        messages: currentMessages,
      });
    }

    const first = response.content[0];
    const text = first?.type === "text" ? first.text : "";
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "agent request failed" });
  }
});

export default app;
