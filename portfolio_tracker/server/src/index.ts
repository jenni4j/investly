import express from "express";
import cors from "cors";
import YahooFinance from "yahoo-finance2";

const app = express();
const yf = new YahooFinance();

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

    if (period === "1d") {
      const result = await yf.chart(ticker, { interval: "5m", range: "1d" });
      const timestamps = result.timestamp ?? [];
      const closes = result.indicators?.quote?.[0]?.close ?? [];
      const data = timestamps
        .map((ts, i) => ({
          date: new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          close: closes[i] ?? null,
        }))
        .filter((d) => d.close !== null);
      return res.json(data);
    }

    let period1: Date;
    let interval: "1d" | "1wk" | "1mo";

    switch (period) {
      case "1m":
        period1 = new Date(now);
        period1.setMonth(now.getMonth() - 1);
        interval = "1d";
        break;
      case "6m":
        period1 = new Date(now);
        period1.setMonth(now.getMonth() - 6);
        interval = "1d";
        break;
      case "1y":
        period1 = new Date(now);
        period1.setFullYear(now.getFullYear() - 1);
        interval = "1wk";
        break;
      case "5y":
        period1 = new Date(now);
        period1.setFullYear(now.getFullYear() - 5);
        interval = "1mo";
        break;
      default:
        period1 = new Date(now);
        period1.setMonth(now.getMonth() - 1);
        interval = "1d";
    }

    const result = await yf.historical(ticker, { period1, interval });
    const data = result.map((r) => ({
      date: r.date.toISOString().split("T")[0],
      close: r.adjClose ?? r.close ?? 0,
    }));

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to fetch historical data" });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const query = req.query.q?.toString();
    if (!query) return res.json([]);

    const results = await yf.search(query);

    const stocks =
      results.quotes
        ?.filter(q => q.symbol && q.shortname)
        .slice(0, 10)
        .map(q => ({
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

export default app;
