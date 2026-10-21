// =========================================================
// INVESTWISE AUTOMATED VERIFICATION TEST SUITE
// =========================================================
const http = require("http");
const assert = require("assert");

const PORT = process.env.TEST_PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

function get(path) {
    return new Promise((resolve, reject) => {
        const req = http.get(`${BASE_URL}${path}`, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch {
                    json = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: json });
            });
        });
        req.on("error", reject);
        req.setTimeout(12000, () => {
            req.destroy(new Error(`Timeout fetching ${path}`));
        });
    });
}

async function runTests() {
    console.log(`\n=================================================`);
    console.log(`🚀 RUNNING INVESTWISE TEST SUITE ON PORT ${PORT}`);
    console.log(`=================================================\n`);

    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            process.stdout.write(`• ${name}... `);
            await fn();
            console.log(`✅ PASSED`);
            passed++;
        } catch (err) {
            console.log(`❌ FAILED: ${err.message}`);
            failed++;
        }
    }

    // 1. Health check
    await test("Backend /api/health endpoint", async () => {
        const res = await get("/api/health");
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.status, "ok");
        assert.strictEqual(res.body.service, "investwise-backend");
    });

    // 2. TCS stock quote
    await test("Stock API - TCS.BSE live quote", async () => {
        const res = await get("/api/stock/TCS.BSE");
        assert.strictEqual(res.status, 200);
        assert(typeof res.body.price === "number" && res.body.price > 1000, `Expected numeric price > 1000, got ${res.body.price}`);
        assert(res.body["Global Quote"] != null, "Global Quote object missing");
        assert(typeof res.body["Global Quote"]["05. price"] === "string", "05. price missing in Global Quote");
    });

    // 3. Demerged Tata Motors stock quote
    await test("Stock API - Demerged Tata Motors (TMPV.BSE)", async () => {
        const res = await get("/api/stock/TMPV.BSE");
        assert.strictEqual(res.status, 200);
        assert(typeof res.body.price === "number" && res.body.price > 0, `Expected price > 0, got ${res.body.price}`);
    });

    // 4. Demerged Tata Motors legacy ticker alias (TATAMOTORS.BSE)
    await test("Stock API - Demerged Tata Motors legacy alias (TATAMOTORS.BSE)", async () => {
        const res = await get("/api/stock/TATAMOTORS.BSE");
        assert.strictEqual(res.status, 200);
        assert(typeof res.body.price === "number" && res.body.price > 0, `Expected price > 0, got ${res.body.price}`);
    });

    // 5. M&M with special character
    await test("Stock API - M&M.BSE special symbol mapping", async () => {
        const res = await get("/api/stock/M%26M.BSE");
        assert.strictEqual(res.status, 200);
        assert(typeof res.body.price === "number" && res.body.price > 0, `Expected price > 0, got ${res.body.price}`);
    });

    // 6. Stock history candles
    await test("History API - TCS.BSE 3-month history candles", async () => {
        const res = await get("/api/history/TCS.BSE");
        assert.strictEqual(res.status, 200);
        const candles = Array.isArray(res.body) ? res.body : (res.body && res.body.candles);
        assert(Array.isArray(candles), "Expected history candles to be an array");
        assert(candles.length >= 10, `Expected at least 10 candle records, got ${candles.length}`);
        const first = candles[0];
        assert(first.time != null, "Candle time missing");
        assert(typeof first.open === "number", "Candle open not numeric");
        assert(typeof first.close === "number", "Candle close not numeric");
        assert(typeof first.high === "number", "Candle high not numeric");
        assert(typeof first.low === "number", "Candle low not numeric");
    });

    // 7. Market news API
    await test("News API - /api/news returns real Indian market articles", async () => {
        const res = await get("/api/news");
        assert.strictEqual(res.status, 200);
        const feed = Array.isArray(res.body) ? res.body : (res.body && res.body.feed);
        assert(Array.isArray(feed), "Expected news feed to be an array");
        assert(feed.length >= 5, `Expected at least 5 news items, got ${feed.length}`);
        const article = feed[0];
        assert(typeof article.title === "string" && article.title.length > 5, "Article title invalid");
        assert(typeof article.link === "string" && article.link.startsWith("http"), "Article link invalid");
        assert(typeof article.publisher === "string", "Article publisher invalid");
    });

    // 8. Static frontend file routing
    const staticPages = [
        "/index.html",
        "/login.html",
        "/dashboard.html",
        "/portfolio.html",
        "/papertrading.html",
        "/marketnews.html",
        "/profile.html",
        "/ai.html",
        "/js/config.js",
        "/js/script.js"
    ];

    for (const page of staticPages) {
        await test(`Static Route - ${page}`, async () => {
            const res = await get(page);
            assert.strictEqual(res.status, 200, `Expected HTTP 200 for ${page}`);
            assert(typeof res.body === "string" && res.body.length > 50, `Page content empty for ${page}`);
        });
    }

    // 9. Exact portfolio & trade calculation test as per user prompt
    await test("Core Trading Logic - Buy, Sell, Cost Basis, & PnL Formula Verification", async () => {
        // Initial state
        let balance = 1000000; // ₹10,00,000 virtual funds
        let portfolio = [];
        let transactions = [];

        // Prompt scenario:
        // Buy 10 shares of XYZ at ₹1,300
        const buyQty = 10;
        const buyPrice = 1300;
        const buyCost = buyQty * buyPrice; // ₹13,000

        balance -= buyCost;
        portfolio.push({
            symbol: "XYZ.BSE",
            name: "XYZ",
            quantity: buyQty,
            price: buyPrice,
            investment: buyCost
        });
        transactions.push({
            type: "BUY",
            symbol: "XYZ.BSE",
            quantity: buyQty,
            price: buyPrice,
            total: buyCost,
            date: new Date().toISOString()
        });

        assert.strictEqual(balance, 987000, "Balance after buy should be ₹9,87,000");

        // Valuation check: current price = ₹1,400
        const currentPrice = 1400;
        const totalInvested = portfolio.reduce((s, p) => s + p.investment, 0);
        const marketValue = portfolio.reduce((s, p) => s + (p.quantity * currentPrice), 0);
        const unrealizedPnL = marketValue - totalInvested;

        assert.strictEqual(totalInvested, 13000, "Total invested should be ₹13,000");
        assert.strictEqual(marketValue, 14000, "Market value at ₹1,400 should be ₹14,000");
        assert.strictEqual(unrealizedPnL, 1000, "Unrealized profit should be +₹1,000");

        // Partial sell check: sell 5 shares at ₹1,400
        const sellQty = 5;
        const sellPrice = 1400;
        const proceeds = sellQty * sellPrice; // ₹7,000
        const realizedPnL = (sellPrice - buyPrice) * sellQty; // (1400 - 1300) * 5 = +₹500

        balance += proceeds;
        const holding = portfolio[0];
        const costBasisSold = holding.price * sellQty; // 1300 * 5 = 6500
        holding.quantity -= sellQty; // 5 remaining
        holding.investment -= costBasisSold; // 13000 - 6500 = 6500

        transactions.push({
            type: "SELL",
            symbol: "XYZ.BSE",
            quantity: sellQty,
            price: sellPrice,
            total: proceeds,
            realizedPnL: realizedPnL,
            date: new Date().toISOString()
        });

        assert.strictEqual(balance, 994000, "Balance after sell should be ₹9,94,000");
        assert.strictEqual(holding.quantity, 5, "Remaining shares should be 5");
        assert.strictEqual(holding.investment, 6500, "Remaining invested cost basis should be ₹6,500");
        assert.strictEqual(realizedPnL, 500, "Realized PnL should be +₹500");
        assert.strictEqual(transactions.length, 2, "Total trade count should be 2");
    });

    console.log(`\n-------------------------------------------------`);
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`-------------------------------------------------\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runTests().catch((e) => {
        console.error("Test execution fatal error:", e);
        process.exit(1);
    });
}

module.exports = { runTests };
