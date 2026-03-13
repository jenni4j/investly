import "dotenv/config";
import express from "express";
import cors from "cors";
import YahooFinance from "yahoo-finance2";
import Anthropic from "@anthropic-ai/sdk";

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

app.post("/api/agent", async (req, res) => {
  try {
    const { messages } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages?.length) return res.status(400).json({ error: "messages required" });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: "You are an intelligent investing assistant. You help users understand their portfolio, research stocks, and make informed decisions. Be concise and direct.",
      messages,
    });

    const first = response.content[0];
    const text = first?.type === "text" ? first.text : "";
    res.json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "agent request failed" });
  }
});

export default app;
