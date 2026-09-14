const express = require("express");
const cors = require("cors");
require("dotenv").config({ path: __dirname + "/.env" });
const path = require("path");
const app = express();
app.use(express.static(path.join(__dirname, "..")));
app.use(cors());
app.use(express.json());


// ==========================================
// LIVE STOCK PRICE API
// ==========================================

app.get("/api/stock/:symbol", async (req, res) => {
    try {
        const symbol = req.params.symbol;

        // Convert BSE symbols to Yahoo Finance NSE symbols
        let yahooSymbol = symbol;

        if (symbol.endsWith(".BSE")) {
            yahooSymbol = symbol.replace(".BSE", ".NS");
        }

        // Yahoo Finance chart API
        const url =
            `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1m`;

        const response = await fetch(url);
        const data = await response.json();

        const result = data.chart?.result?.[0];

        if (!result || !result.meta) {
            return res.status(404).json({
                error: "Stock data not found",
                symbol: symbol
            });
        }

        const meta = result.meta;

        const price =
            meta.regularMarketPrice ??
            meta.previousClose;

        const previousClose =
            meta.previousClose ??
            meta.chartPreviousClose ??
            price;

        const change = price - previousClose;

        const changePercent =
            previousClose !== 0
                ? (change / previousClose) * 100
                : 0;

        // Return Alpha Vantage-compatible format
        // so the existing frontend does not need to change
        res.json({
            "Global Quote": {
                "01. symbol": symbol,
                "05. price": String(price),
                "09. change": String(change),
                "10. change percent": `${changePercent.toFixed(2)}%`
            }
        });

    } catch (error) {
        console.log("Stock API error:", error);

        res.status(500).json({
            error: "Unable to fetch stock data"
        });
    }
});

// ==========================================
// MARKET NEWS API
// ==========================================

app.get("/api/news", async (req, res) => {
    try {
        const topic = req.query.topic || "financial_markets";

        const topicQueries = {
            financial_markets: "stock market finance",
            technology: "technology stocks",
            earnings: "company earnings stocks"
        };

        const query =
            topicQueries[topic] || topicQueries.financial_markets;

        const url =
            `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=20`;

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0"
            }
        });

        const data = await response.json();

        const news = (data.news || []).map(article => ({
            title: article.title,
            summary: article.publisher || "Yahoo Finance",
            source: article.publisher || "Yahoo Finance",
            url: article.link,
            time_published: article.providerPublishTime
                ? new Date(article.providerPublishTime * 1000)
                    .toISOString()
                    .replace(/[-:TZ]/g, "")
                    .substring(0, 15)
                : "",
            topics: [
                {
                    topic: topic
                }
            ]
        }));

        res.json({
            feed: news
        });

    } catch (error) {
        console.log("News error:", error);

        res.status(500).json({
            error: "Unable to fetch market news",
            feed: []
        });
    }
});
// ==========================================
// BACKEND HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        backend: "InvestWise",
        message: "Backend is running"
    });
});
// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`InvestWise server running on port ${PORT}`);
});