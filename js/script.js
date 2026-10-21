// ===============================
// API CONFIGURATION HELPER
// ===============================

const getScriptApiBase = () => {
    if (window.INVESTWISE && window.INVESTWISE.CONFIG && window.INVESTWISE.CONFIG.API_BASE_URL) {
        return window.INVESTWISE.CONFIG.API_BASE_URL;
    }
    if (window.location.port === "5000") {
        return window.location.origin;
    }
    return "http://localhost:5000";
};

// ===============================
// CREATE ACCOUNT
// ===============================

const form = document.getElementById("registerForm");

if (form) {

    form.addEventListener("submit", function(event) {

        event.preventDefault();

        // Get form values
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const experience = document.getElementById("experience").value;
        const risk = document.getElementById("risk").value;
        const terms = document.getElementById("terms");

        // Check Terms
        if (!terms.checked) {
            alert("Please accept the Terms & Conditions.");
            return;
        }

        // Check password
        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        // Create user object
        const user = {
            name: name,
            email: email,
            phone: phone,
            password: password,
            experience: experience,
            risk: risk
        };

        // Save user across storage formats for consistency
        localStorage.setItem("investWiseUser", JSON.stringify(user));
        localStorage.setItem("loggedInUser", JSON.stringify(user));

        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const filteredUsers = users.filter(u => u.email !== email);
        filteredUsers.push(user);
        localStorage.setItem("users", JSON.stringify(filteredUsers));

        // Initialize virtual balance (₹10,00,000)
        if (!localStorage.getItem("virtualBalance")) {
            localStorage.setItem("virtualBalance", "1000000");
        }
        if (!localStorage.getItem("portfolio")) {
            localStorage.setItem("portfolio", JSON.stringify([]));
        }
        if (!localStorage.getItem("transactions")) {
            localStorage.setItem("transactions", JSON.stringify([]));
        }

        // Show success message
        alert("Account created successfully! 🎉");

        // Go to login page
        window.location.href = "login.html";

    });

}


// ===============================
// AI RECOMMENDATION
// ===============================

async function getRecommendation() {

    // Get values from the AI Advisor form
    const amount = document.getElementById("amount").value;
    const duration = document.getElementById("duration").value;
    const sector = document.getElementById("sector").value;

    // selectedRisk comes from ai.html
    const risk = typeof selectedRisk !== "undefined" ? selectedRisk : "Medium";

    // Result section
    const result = document.getElementById("recommendation");

    // Check if all fields are filled
    if (amount === "" || duration === "" || sector === "") {
        alert("Please fill all the details!");
        return;
    }

    // Convert amount to number
    const investmentAmount = parseFloat(amount);

    if (investmentAmount < 1000) {
        alert("Please enter an investment amount of at least ₹1,000.");
        return;
    }


    // ===============================
    // SECTOR STOCKS
    // ===============================
    // EXACTLY 3 STOCKS FOR EACH SECTOR

    const sectorStocks = {

        IT: [
            {
                symbol: "TCS.BSE",
                companyName: "TCS"
            },
            {
                symbol: "INFY.BSE",
                companyName: "Infosys"
            },
            {
                symbol: "HCLTECH.BSE",
                companyName: "HCLTech"
            }
        ],

        Banking: [
            {
                symbol: "HDFCBANK.BSE",
                companyName: "HDFC Bank"
            },
            {
                symbol: "ICICIBANK.BSE",
                companyName: "ICICI Bank"
            },
            {
                symbol: "SBIN.BSE",
                companyName: "SBI"
            }
        ],

        Pharma: [
            {
                symbol: "SUNPHARMA.BSE",
                companyName: "Sun Pharma"
            },
            {
                symbol: "DRREDDY.BSE",
                companyName: "Dr. Reddy's"
            },
            {
                symbol: "CIPLA.BSE",
                companyName: "Cipla"
            }
        ],

        EV: [
            {
                symbol: "TMPV.BSE",
                companyName: "Tata Motors"
            },
            {
                symbol: "M&M.BSE",
                companyName: "Mahindra"
            },
            {
                symbol: "HEROMOTOCO.BSE",
                companyName: "Hero MotoCorp"
            }
        ]

    };


    const selectedStocks = sectorStocks[sector];

    if (!selectedStocks) {
        alert("Please select a sector.");
        return;
    }


    // ===============================
    // LOADING MESSAGE
    // ===============================

    result.innerHTML = `
        <div class="summary-box">
            <h2>📊 Getting Market Data...</h2>
            <p>
                Checking the latest available market information
                for all 3 ${sector} stocks.
            </p>
        </div>
    `;


    try {
        const apiBase = getScriptApiBase();

        // ===============================
        // FETCH ALL 3 STOCKS
        // ===============================

        const stockResults = await Promise.all(

            selectedStocks.map(async function(stock) {

                try {

                    // Encode symbol safely
                    const encodedSymbol = encodeURIComponent(stock.symbol);

                    let data;
                    if (window.INVESTWISE && typeof window.INVESTWISE.apiFetch === "function") {
                        data = await window.INVESTWISE.apiFetch(`/api/stock/${encodedSymbol}`);
                    } else {
                        const response = await fetch(`${apiBase}/api/stock/${encodedSymbol}`);
                        if (!response.ok) {
                            throw new Error("Backend connection failed");
                        }
                        data = await response.json();
                    }

                    console.log("Stock data received:", stock.companyName, data);

                    // ===============================
                    // API ERROR CHECK
                    // ===============================

                    if (data.Information || data.Note || data["Error Message"]) {
                        return {
                            ...stock,
                            price: null,
                            change: "N/A",
                            changePercent: "Market data unavailable",
                            error: data.Information || data.Note || data["Error Message"]
                        };
                    }

                    // ===============================
                    // GLOBAL QUOTE
                    // ===============================

                    const quote = data["Global Quote"];
                    const rawPrice = (quote && quote["05. price"] != null) ? quote["05. price"] : data.price;

                    if (rawPrice == null || isNaN(parseFloat(rawPrice))) {
                        return {
                            ...stock,
                            price: null,
                            change: "N/A",
                            changePercent: "Market data unavailable",
                            error: "No stock data found"
                        };
                    }

                    // ===============================
                    // EXTRACT MARKET DATA
                    // ===============================

                    const price = parseFloat(rawPrice);
                    const change = (quote && quote["09. change"] != null) ? quote["09. change"] : (data.change != null ? data.change : "N/A");
                    const changePercent = (quote && quote["10. change percent"] != null) ? quote["10. change percent"] : (data.changePercent != null ? data.changePercent : "N/A");

                    return {
                        ...stock,
                        price: price,
                        change: change,
                        changePercent: changePercent,
                        error: null
                    };

                } catch (error) {
                    console.error("Error fetching", stock.companyName, error);

                    return {
                        ...stock,
                        price: null,
                        change: "N/A",
                        changePercent: "Market data unavailable",
                        error: "Unable to fetch market data"
                    };
                }

            })

        );

        console.log("ALL 3 STOCK RESULTS:", stockResults);

        // ===============================
        // RISK EXPLANATION
        // ===============================

        let riskMessage;

        if (risk === "Low") {
            riskMessage = "Focus on relatively stable companies and reduce unnecessary risk.";
        } else if (risk === "Medium") {
            riskMessage = "Balance growth opportunities with reasonable market risk.";
        } else {
            riskMessage = "Higher growth potential comes with higher market volatility.";
        }

        // ===============================
        // DURATION EXPLANATION
        // ===============================

        let durationMessage;

        if (duration === "1") {
            durationMessage = "Short-term horizon. Market movements can have a larger impact.";
        } else if (duration === "3") {
            durationMessage = "Medium-term horizon. Consider staying invested through normal fluctuations.";
        } else if (duration === "5") {
            durationMessage = "Long-term horizon. You have more time to handle short-term volatility.";
        } else {
            durationMessage = "Very long-term horizon. Long-term investing can help smooth short-term fluctuations.";
        }

        // ===============================
        // RISK-BASED ALLOCATION
        // ===============================

        let allocations;

        if (risk === "Low") {
            allocations = [50, 30, 20];
        } else if (risk === "Medium") {
            allocations = [40, 35, 25];
        } else {
            allocations = [45, 30, 25];
        }

        // ===============================
        // CREATE STOCK CARDS
        // ===============================

        let stockCards = "";

        stockResults.forEach(function(stock, index) {

            const allocation = allocations[index];

            let shares = 0;
            let investedAmount = 0;
            let remainingAmount = investmentAmount * allocation / 100;

            if (stock.price !== null && !isNaN(stock.price) && stock.price > 0) {
                const allocatedAmount = investmentAmount * allocation / 100;
                shares = Math.floor(allocatedAmount / stock.price);
                investedAmount = shares * stock.price;
                remainingAmount = allocatedAmount - investedAmount;
            }

            let priceDisplay;
            if (stock.price !== null && !isNaN(stock.price)) {
                priceDisplay = `₹${stock.price.toFixed(2)}`;
            } else {
                priceDisplay = "Price unavailable";
            }

            stockCards += `
                <div class="stock-card">
                    <div class="stock-top">
                        <div>
                            <div class="stock-name">
                                ${stock.companyName}
                            </div>
                            <div class="stock-symbol">
                                ${stock.symbol}
                            </div>
                        </div>
                        <div class="stock-icon">
                            📊
                        </div>
                    </div>

                    <div class="stock-price">
                        ${priceDisplay}
                    </div>

                    <div class="stock-change">
                        ${stock.changePercent}
                    </div>

                    <div class="detail-box">
                        <span class="detail-label">
                            Recommended Allocation
                        </span>
                        <span class="detail-value">
                            ${allocation}%
                        </span>
                    </div>

                    <div class="detail-box">
                        <span class="detail-label">
                            Recommended Shares
                        </span>
                        <span class="detail-value">
                            ${shares}
                        </span>
                    </div>

                    <div class="detail-box">
                        <span class="detail-label">
                            Amount Invested
                        </span>
                        <span class="detail-value">
                            ₹${investedAmount.toFixed(2)}
                        </span>
                    </div>

                    <div class="detail-box">
                        <span class="detail-label">
                            Remaining Allocation
                        </span>
                        <span class="detail-value">
                            ₹${remainingAmount.toFixed(2)}
                        </span>
                    </div>

                    <div class="detail-box">
                        <span class="detail-label">
                            Market Change
                        </span>
                        <span class="detail-value">
                            ${stock.change}
                        </span>
                    </div>
                </div>
            `;

        });

        // ===============================
        // DISPLAY RECOMMENDATION
        // ===============================

        result.innerHTML = `
            <h2 class="result-header">
                📈 Your AI Investment Recommendation
            </h2>

            <div class="summary-box">
                <p>
                    Based on your investment amount,
                    risk preference, duration and selected sector,
                    InvestWise has generated this educational
                    investment simulation.
                </p>
                <br>
                <p>
                    <strong>Risk Level:</strong>
                    ${risk}
                </p>
                <p>
                    <strong>Investment Duration:</strong>
                    ${duration} year${duration === "1" ? "" : "s"}
                </p>
                <p>
                    <strong>Preferred Sector:</strong>
                    ${sector}
                </p>
                <p>
                    <strong>Stocks Recommended:</strong>
                    ${stockResults.map(stock => stock.companyName).join(", ")}
                </p>
            </div>

            <div class="stocks-grid">
                ${stockCards}
            </div>

            <div class="summary-box">
                <p>
                    <strong>💡 Risk Strategy</strong>
                </p>
                <p>
                    ${riskMessage}
                </p>
                <br>
                <p>
                    <strong>⏳ Duration Strategy</strong>
                </p>
                <p>
                    ${durationMessage}
                </p>
            </div>

            <div class="market-note">
                ⚠️
                <strong>
                    Educational Simulation:
                </strong>
                This recommendation is generated for educational purposes using available
                market data. It is not personalized financial advice.
            </div>
        `;

        // Scroll to recommendation
        result.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error("Recommendation error:", error);

        result.innerHTML = `
            <div class="summary-box">
                <h2>
                    ❌ Unable to Get Recommendation
                </h2>
                <p>
                    InvestWise could not connect to the backend server.
                </p>
                <br>
                <p>
                    Please make sure your Node.js backend is running on port 5000.
                </p>
            </div>
        `;
    }

}


// ===============================
// LIVE MARKET DATA (DASHBOARD)
// ===============================

async function loadMarketData() {

    // Only run if the elements actually exist on the current page
    const tcsPrice = document.getElementById("tcs-price");
    if (!tcsPrice) {
        return;
    }

    const apiBase = getScriptApiBase();

    const fetchQuote = async (symbol) => {
        try {
            if (window.INVESTWISE && typeof window.INVESTWISE.apiFetch === "function") {
                return await window.INVESTWISE.apiFetch(`/api/stock/${encodeURIComponent(symbol)}`);
            }
            const res = await fetch(`${apiBase}/api/stock/${encodeURIComponent(symbol)}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (_) {
            return null;
        }
    };

    const updateStockUI = (priceElemId, changeElemId, data) => {
        const pElem = document.getElementById(priceElemId);
        const cElem = document.getElementById(changeElemId);

        if (!pElem) return;

        pElem.classList.remove("loading-price");

        const quote = data && data["Global Quote"];
        if (quote && quote["05. price"]) {
            pElem.innerText = "₹" + Number(quote["05. price"]).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            if (cElem) {
                const changeP = quote["10. change percent"] || "--";
                cElem.innerText = changeP;
                const changeVal = parseFloat(changeP);
                if (!Number.isNaN(changeVal)) {
                    cElem.className = "market-change " + (changeVal >= 0 ? "positive" : "negative");
                }
            }
        } else {
            if (pElem.innerText === "Loading...") {
                pElem.innerText = "--";
            }
            if (cElem && cElem.innerText === "--") {
                cElem.innerText = "Unavailable";
            }
        }
    };

    try {
        // Fetch quotes in parallel
        const [tcsData, hdfcData, sunData, tataData] = await Promise.all([
            fetchQuote("TCS.BSE"),
            fetchQuote("HDFCBANK.BSE"),
            fetchQuote("SUNPHARMA.BSE"),
            fetchQuote("TMPV.BSE")
        ]);

        updateStockUI("tcs-price", "tcs-change", tcsData);
        updateStockUI("hdfc-price", "hdfc-change", hdfcData);
        updateStockUI("sun-price", "sun-change", sunData);
        updateStockUI("tata-price", "tata-change", tataData);

        // Notify dashboard features if available
        if (typeof updateDashboardFeatures === "function") {
            updateDashboardFeatures();
        }

    } catch (error) {
        console.error("Market data error:", error);
    }

}

// Automatically trigger market load if on dashboard
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        if (document.getElementById("tcs-price")) {
            loadMarketData();
        }
    });
} else {
    if (document.getElementById("tcs-price")) {
        loadMarketData();
    }
}


// ===============================
// LOGIN SYSTEM
// ===============================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        if (email === "" || password === "") {
            alert("Please enter email and password.");
            return;
        }

        // Check registered user from single user object or users array
        let matchedUser = null;

        const savedUser = JSON.parse(localStorage.getItem("investWiseUser") || "null");
        if (savedUser && savedUser.email === email && savedUser.password === password) {
            matchedUser = savedUser;
        }

        if (!matchedUser) {
            const users = JSON.parse(localStorage.getItem("users") || "[]");
            matchedUser = users.find(u => u.email === email && u.password === password);
        }

        if (matchedUser) {
            localStorage.setItem("isLoggedIn", "true");
            localStorage.setItem("loggedInUser", JSON.stringify(matchedUser));
            localStorage.setItem("investWiseUser", JSON.stringify(matchedUser));

            // Ensure initial balance exists
            if (!localStorage.getItem("virtualBalance")) {
                localStorage.setItem("virtualBalance", "1000000");
            }

            window.location.href = "dashboard.html";
        } else {
            alert("Incorrect email or password.");
        }

    });

}