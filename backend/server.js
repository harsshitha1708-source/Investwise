const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files from parent directory
app.use(express.static(path.join(__dirname, "..")));

const PORT = process.env.PORT || 5000;

// ==========================================
// IN-MEMORY CACHE
// ==========================================
const cache = {
    stock: new Map(), // symbol -> { data, expiresAt }
    history: new Map(), // symbol -> { data, expiresAt }
    news: new Map() // topic -> { data, expiresAt }
};

// ==========================================
// UTILITIES
// ==========================================

async function fetchWithTimeout(url, timeoutMs = 10000, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/xml, */*",
                ...(options.headers || {})
            }
        });
    } finally {
        clearTimeout(timeout);
    }
}

// Convert frontend symbol to active Yahoo Finance format
function getYahooSymbol(symbol) {
    if (!symbol) return "";
    const clean = String(symbol).trim().toUpperCase();

    // Tata Motors demerger handling
    if (
        clean === "TMPV.BSE" ||
        clean === "TMPV" ||
        clean === "TATAMOTORS.BSE" ||
        clean === "TATAMOTORS" ||
        clean === "TATAMOTORS.NS"
    ) {
        return "TMPV.NS";
    }

    if (clean === "TMCV.BSE" || clean === "TMCV") {
        return "TMCV.NS";
    }

    // Mahindra & Mahindra handling
    if (clean === "M&M.BSE" || clean === "M&M") {
        return "M&M.NS";
    }

    // BSE to NSE translation
    if (clean.endsWith(".BSE")) {
        return clean.replace(".BSE", ".NS");
    }

    // Keep BSE .BO format if requested
    if (clean.endsWith(".BO")) {
        return clean;
    }

    // Default to NSE
    return clean.includes(".") ? clean : `${clean}.NS`;
}

// ==========================================
// 1. LIVE STOCK PRICE API
// ==========================================

app.get("/api/stock/:symbol", async (req, res) => {
    try {
        const rawSymbol = req.params.symbol;
        if (!rawSymbol || rawSymbol.trim() === "") {
            return res.status(400).json({ error: "Stock symbol is required" });
        }

        const cacheKey = rawSymbol.trim().toUpperCase();
        const cached = cache.stock.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return res.json(cached.data);
        }

        const yahooSymbol = getYahooSymbol(rawSymbol);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1d&interval=1m`;

        const response = await fetchWithTimeout(url, 10000);

        if (!response.ok) {
            return res.status(response.status === 404 ? 404 : 502).json({
                error: `Stock data provider error: ${response.status}`,
                status: response.status,
                symbol: rawSymbol,
                yahooSymbol
            });
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result?.meta) {
            return res.status(404).json({
                error: "Stock data not found",
                symbol: rawSymbol
            });
        }

        const meta = result.meta;
        const price = meta.regularMarketPrice ?? meta.previousClose;

        if (price == null || Number.isNaN(Number(price))) {
            return res.status(404).json({
                error: "Stock price unavailable",
                symbol: rawSymbol
            });
        }

        const previousClose =
            meta.chartPreviousClose ??
            meta.previousClose ??
            price;

        const change = Number(price) - Number(previousClose);
        const changePercent = previousClose !== 0
            ? (change / Number(previousClose)) * 100
            : 0;

        const responsePayload = {
            symbol: rawSymbol,
            price: Number(Number(price).toFixed(2)),
            change: Number(change.toFixed(2)),
            changePercent: `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
            rawChangePercent: Number(changePercent.toFixed(2)),
            "Global Quote": {
                "01. symbol": rawSymbol,
                "05. price": Number(price).toFixed(2),
                "09. change": (change >= 0 ? "+" : "") + change.toFixed(2),
                "10. change percent": `${changePercent.toFixed(2)}%`
            }
        };

        // Cache for 20 seconds
        cache.stock.set(cacheKey, {
            data: responsePayload,
            expiresAt: Date.now() + 20000
        });

        return res.json(responsePayload);

    } catch (error) {
        console.error("Stock API error:", req.params.symbol, error.message);

        return res.status(error.name === "AbortError" ? 504 : 502).json({
            error: error.name === "AbortError"
                ? "Stock provider timed out"
                : "Unable to fetch stock data"
        });
    }
});

// ==========================================
// 2. HISTORICAL STOCK DATA API
// ==========================================

app.get("/api/history/:symbol", async (req, res) => {
    try {
        const rawSymbol = req.params.symbol;
        if (!rawSymbol || rawSymbol.trim() === "") {
            return res.status(400).json({ error: "Stock symbol is required" });
        }

        const cacheKey = rawSymbol.trim().toUpperCase();
        const cached = cache.history.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return res.json(cached.data);
        }

        const yahooSymbol = getYahooSymbol(rawSymbol);
        const now = Math.floor(Date.now() / 1000);
        const start = now - 90 * 24 * 60 * 60; // 90 days

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?period1=${start}&period2=${now}&interval=1d`;

        const response = await fetchWithTimeout(url, 12000);

        if (!response.ok) {
            return res.status(502).json({
                error: "Historical data provider unavailable",
                status: response.status,
                symbol: rawSymbol
            });
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result) {
            return res.status(404).json({
                error: "No historical data found",
                symbol: rawSymbol
            });
        }

        const timestamps = result.timestamp || [];
        const quote = result.indicators?.quote?.[0];

        if (!quote) {
            return res.status(404).json({
                error: "No historical quote data",
                symbol: rawSymbol
            });
        }

        const candles = [];

        for (let i = 0; i < timestamps.length; i++) {
            const time = Number(timestamps[i]);
            const open = Number(quote.open?.[i]);
            const high = Number(quote.high?.[i]);
            const low = Number(quote.low?.[i]);
            const close = Number(quote.close?.[i]);
            const volume = Number(quote.volume?.[i] || 0);

            if (
                Number.isFinite(time) &&
                Number.isFinite(open) &&
                Number.isFinite(high) &&
                Number.isFinite(low) &&
                Number.isFinite(close)
            ) {
                candles.push({ time, open, high, low, close, volume });
            }
        }

        const responsePayload = {
            symbol: rawSymbol,
            yahooSymbol,
            candles
        };

        // Cache for 60 seconds
        cache.history.set(cacheKey, {
            data: responsePayload,
            expiresAt: Date.now() + 60000
        });

        return res.json(responsePayload);

    } catch (error) {
        console.error("History API error:", req.params.symbol, error.message);

        return res.status(error.name === "AbortError" ? 504 : 502).json({
            error: error.name === "AbortError"
                ? "Historical data request timed out"
                : "Unable to fetch historical data"
        });
    }
});

// ==========================================
// 3. MARKET NEWS API
// ==========================================

function decodeHtmlEntities(str) {
    if (!str) return "";
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ");
}

function parseGoogleNewsRss(xmlText, topic) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xmlText)) !== null && items.length < 25) {
        const itemContent = match[1];
        const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(itemContent);
        const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i.exec(itemContent);
        const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i.exec(itemContent);
        const sourceMatch = /<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/i.exec(itemContent);
        const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i.exec(itemContent);

        let rawTitle = titleMatch ? titleMatch[1] : "";
        let cleanTitle = decodeHtmlEntities(rawTitle.replace(/<[^>]+>/g, "").trim());

        let rawSource = sourceMatch ? sourceMatch[1] : "";
        let cleanSource = decodeHtmlEntities(rawSource.replace(/<[^>]+>/g, "").trim()) || "Financial News";

        let link = linkMatch ? linkMatch[1].trim() : "";

        let rawDesc = descMatch ? descMatch[1] : "";
        let cleanDesc = decodeHtmlEntities(rawDesc.replace(/<[^>]+>/g, "").trim()) || cleanTitle;

        if (cleanTitle) {
            items.push({
                title: cleanTitle,
                summary: cleanDesc,
                source: cleanSource,
                publisher: cleanSource,
                url: link,
                link: link,
                time_published: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                publishedAt: pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString(),
                topics: [{ topic }]
            });
        }
    }

    return items;
}

app.get("/api/news", async (req, res) => {
    const topic = req.query.topic || "financial_markets";

    const cached = cache.news.get(topic);
    if (cached && cached.expiresAt > Date.now()) {
        return res.json(cached.data);
    }

    // Effective search terms for Yahoo Finance
    const topicQueries = {
        financial_markets: "markets",
        technology: "technology",
        banking: "banking",
        pharma: "pharma",
        automobile: "automobile",
        ai: "artificial intelligence",
        earnings: "earnings"
    };

    const query = topicQueries[topic] || topicQueries.financial_markets;
    let newsArticles = [];

    // Attempt 1: Yahoo Finance Search
    try {
        const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&newsCount=25`;
        const response = await fetchWithTimeout(yahooUrl, 6000);

        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.news) && data.news.length > 0) {
                newsArticles = data.news.map(article => ({
                    title: article.title || "Market News",
                    summary: article.summary || article.title || "Open article to read more.",
                    source: article.publisher || "Yahoo Finance",
                    publisher: article.publisher || "Yahoo Finance",
                    url: article.link || "",
                    link: article.link || "",
                    time_published: article.providerPublishTime
                        ? new Date(article.providerPublishTime * 1000).toISOString()
                        : new Date().toISOString(),
                    publishedAt: article.providerPublishTime
                        ? new Date(article.providerPublishTime * 1000).toISOString()
                        : new Date().toISOString(),
                    topics: [{ topic }]
                }));
            }
        }
    } catch (yahooErr) {
        console.warn("Yahoo news attempt failed, using fallback:", yahooErr.message);
    }

    // Attempt 2: Fallback to Google News Indian Business RSS if Yahoo returned 0 articles
    if (newsArticles.length === 0) {
        try {
            const rssUrl = "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-IN&gl=IN&ceid=IN:en";
            const rssResponse = await fetchWithTimeout(rssUrl, 6000);

            if (rssResponse.ok) {
                const xmlText = await rssResponse.text();
                newsArticles = parseGoogleNewsRss(xmlText, topic);
            }
        } catch (rssErr) {
            console.error("RSS news fallback failed:", rssErr.message);
        }
    }

    const payload = { feed: newsArticles };

    // Cache successful news for 3 minutes (180 seconds)
    if (newsArticles.length > 0) {
        cache.news.set(topic, {
            data: payload,
            expiresAt: Date.now() + 180000
        });
    }

    return res.json(payload);
});

// ==========================================
// 4. BACKEND HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        status: "ok",
        service: "investwise-backend",
        backend: "InvestWise",
        port: PORT,
        timestamp: new Date().toISOString(),
        message: "InvestWise backend is healthy and running"
    });
});

// ==========================================
// 5. START SERVER
// ==========================================

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`===============================================`);
        console.log(` InvestWise Backend Server Running`);
        console.log(` Port: ${PORT}`);
        console.log(` URL:  http://localhost:${PORT}`);
        console.log(`===============================================`);
    });
}

module.exports = app;
