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

        // Save user in browser
        localStorage.setItem("investWiseUser", JSON.stringify(user));

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
    const risk = selectedRisk;

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

        // ===============================
        // FETCH ALL 3 STOCKS
        // ===============================

        const stockResults = await Promise.all(

            selectedStocks.map(async function(stock) {

                try {

                    // Encode symbol safely
                    const encodedSymbol =
                        encodeURIComponent(stock.symbol);

                    const response = await fetch(
                        `http://localhost:3000/api/stock/${encodedSymbol}`
                    );

                    if (!response.ok) {

                        throw new Error(
                            "Backend connection failed"
                        );

                    }

                    const data = await response.json();

                    console.log(
                        "Stock data received:",
                        stock.companyName,
                        data
                    );


                    // ===============================
                    // API ERROR
                    // ===============================

                    if (
                        data.Information ||
                        data.Note ||
                        data["Error Message"]
                    ) {

                        return {

                            ...stock,

                            price: null,

                            change: "N/A",

                            changePercent: "Market data unavailable",

                            error:
                                data.Information ||
                                data.Note ||
                                data["Error Message"]

                        };

                    }


                    // ===============================
                    // GLOBAL QUOTE
                    // ===============================

                    const quote =
                        data["Global Quote"];


                    // If quote is missing,
                    // KEEP THE STOCK CARD

                    if (
                        !quote ||
                        !quote["05. price"]
                    ) {

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

                    const price =
                        parseFloat(
                            quote["05. price"]
                        );

                    const change =
                        quote["09. change"] || "N/A";

                    const changePercent =
                        quote["10. change percent"] || "N/A";


                    return {

                        ...stock,

                        price: price,

                        change: change,

                        changePercent: changePercent,

                        error: null

                    };


                } catch (error) {

                    console.error(
                        "Error fetching",
                        stock.companyName,
                        error
                    );


                    // IMPORTANT:
                    // KEEP STOCK EVEN IF API FAILS

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


        console.log(
            "ALL 3 STOCK RESULTS:",
            stockResults
        );


        // ===============================
        // RISK EXPLANATION
        // ===============================

        let riskMessage;

        if (risk === "Low") {

            riskMessage =
                "Focus on relatively stable companies and reduce unnecessary risk.";

        } else if (risk === "Medium") {

            riskMessage =
                "Balance growth opportunities with reasonable market risk.";

        } else {

            riskMessage =
                "Higher growth potential comes with higher market volatility.";

        }


        // ===============================
        // DURATION EXPLANATION
        // ===============================

        let durationMessage;

        if (duration === "1") {

            durationMessage =
                "Short-term horizon. Market movements can have a larger impact.";

        } else if (duration === "3") {

            durationMessage =
                "Medium-term horizon. Consider staying invested through normal fluctuations.";

        } else if (duration === "5") {

            durationMessage =
                "Long-term horizon. You have more time to handle short-term volatility.";

        } else {

            durationMessage =
                "Very long-term horizon. Long-term investing can help smooth short-term fluctuations.";

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

            const allocation =
                allocations[index];


            // ===============================
            // WHEN LIVE PRICE IS AVAILABLE
            // ===============================

            let shares = 0;
            let investedAmount = 0;
            let remainingAmount =
                investmentAmount * allocation / 100;


            if (
                stock.price !== null &&
                !isNaN(stock.price) &&
                stock.price > 0
            ) {

                // Amount allocated
                const allocatedAmount =
                    investmentAmount * allocation / 100;


                // Number of shares
                shares =
                    Math.floor(
                        allocatedAmount / stock.price
                    );


                // Actual amount invested
                investedAmount =
                    shares * stock.price;


                // Remaining amount
                remainingAmount =
                    allocatedAmount - investedAmount;

            }


            // ===============================
            // PRICE DISPLAY
            // ===============================

            let priceDisplay;

            if (
                stock.price !== null &&
                !isNaN(stock.price)
            ) {

                priceDisplay =
                    `₹${stock.price.toFixed(2)}`;

            } else {

                priceDisplay =
                    "Price unavailable";

            }


            // ===============================
            // CREATE CARD
            // ===============================

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

                    ${duration}
                    year${duration === "1" ? "" : "s"}

                </p>


                <p>

                    <strong>Preferred Sector:</strong>

                    ${sector}

                </p>


                <p>

                    <strong>Stocks Recommended:</strong>

                    ${stockResults
                        .map(stock => stock.companyName)
                        .join(", ")}

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

                This recommendation is generated for the
                InvestWise college project using available
                market data. It is not financial advice.

            </div>

        `;


        // Scroll to recommendation
        result.scrollIntoView({

            behavior: "smooth",

            block: "start"

        });


    } catch (error) {

        console.error(
            "Recommendation error:",
            error
        );


        result.innerHTML = `

            <div class="summary-box">

                <h2>
                    ❌ Unable to Get Recommendation
                </h2>


                <p>

                    InvestWise could not connect to the
                    backend server.

                </p>


                <br>


                <p>

                    Please make sure your Node.js backend
                    is running on port 3000.

                </p>

            </div>

        `;

    }

}


// ===============================
// LIVE MARKET DATA
// ===============================

async function loadMarketData() {

    try {

        // Get TCS data
        const tcsResponse = await fetch(
            "http://localhost:3000/api/stock/TCS.BSE"
        );

        const tcsData = await tcsResponse.json();

        // Get TCS price
        if (tcsData["Global Quote"]) {

            const quote =
                tcsData["Global Quote"];

            document.getElementById("tcs-price").innerText =
                "₹" + quote["05. price"];

            document.getElementById("tcs-change").innerText =
                quote["10. change percent"];

        }


        // Get HDFC Bank data
        const hdfcResponse = await fetch(
            "http://localhost:3000/api/stock/HDFCBANK.BSE"
        );

        const hdfcData =
            await hdfcResponse.json();

        if (hdfcData["Global Quote"]) {

            const quote =
                hdfcData["Global Quote"];

            document.getElementById("hdfc-price").innerText =
                "₹" + quote["05. price"];

            document.getElementById("hdfc-change").innerText =
                quote["10. change percent"];

        }


        // Get Sun Pharma data
        const sunResponse = await fetch(
            "http://localhost:3000/api/stock/SUNPHARMA.BSE"
        );

        const sunData =
            await sunResponse.json();

        if (sunData["Global Quote"]) {

            const quote =
                sunData["Global Quote"];

            document.getElementById("sun-price").innerText =
                "₹" + quote["05. price"];

            document.getElementById("sun-change").innerText =
                quote["10. change percent"];

        }


        // Get Tata Motors data
        const tataResponse = await fetch(
            "http://localhost:3000/api/stock/TMPV.BSE"
        );

        const tataData =
            await tataResponse.json();

        if (tataData["Global Quote"]) {

            const quote =
                tataData["Global Quote"];

            document.getElementById("tata-price").innerText =
                "₹" + quote["05. price"];

            document.getElementById("tata-change").innerText =
                quote["10. change percent"];

        }


    } catch (error) {

        console.error(
            "Market data error:",
            error
        );

    }

}


loadMarketData();


// ===============================
// LOGIN SYSTEM
// ===============================

const loginForm =
    document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        function(event) {

            event.preventDefault();

            const email =
                document.getElementById("email")
                    .value.trim();

            const password =
                document.getElementById("password")
                    .value.trim();


            // Check empty fields
            if (
                email === "" ||
                password === ""
            ) {

                alert(
                    "Please enter email and password."
                );

                return;

            }


            // Get registered user
            const savedUser =
                JSON.parse(
                    localStorage.getItem(
                        "investWiseUser"
                    )
                );


            // Check whether account exists
            if (!savedUser) {

                alert(
                    "No account found. Please create an account first."
                );

                return;

            }


            // Check login details
            if (
                email === savedUser.email &&
                password === savedUser.password
            ) {

                // Save login status
                localStorage.setItem(
                    "isLoggedIn",
                    "true"
                );


                // Go to dashboard
                window.location.href =
                    "dashboard.html";


            } else {

                alert(
                    "Incorrect email or password."
                );

            }

        }
    );

}