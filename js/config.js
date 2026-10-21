/**
 * InvestWise - Shared Frontend Configuration & API Client
 * Provides centralized backend endpoint URL, request helpers, and consistent data accessors.
 */

(function (window) {
    "use strict";

    // Auto-detect API base URL.
    // If running from port 5000 (Express static server), use relative origin.
    // If running from port 3000 (Vite / Live Server) or file://, target backend port 5000.
    const getApiBaseUrl = () => {
        if (window.INVESTWISE_API_URL) {
            return window.INVESTWISE_API_URL;
        }

        const port = window.location.port;
        const hostname = window.location.hostname;

        if (port === "5000") {
            return window.location.origin;
        }

        if (hostname === "localhost" || hostname === "127.0.0.1") {
            return "http://localhost:5000";
        }

        return window.location.origin || "http://localhost:5000";
    };

    const INVESTWISE_CONFIG = {
        API_BASE_URL: getApiBaseUrl(),
        DEFAULT_BALANCE: 1000000, // ₹10,00,000 virtual cash
        STORAGE_KEYS: {
            USER: "investWiseUser",
            LOGGED_IN_USER: "loggedInUser",
            IS_LOGGED_IN: "isLoggedIn",
            BALANCE: "virtualBalance",
            PORTFOLIO: "portfolio",
            TRANSACTIONS: "transactions",
            WATCHLIST: "investWiseWatchlist",
            GOAL: "investmentGoal"
        }
    };

    /**
     * Standardized fetch helper with timeout and JSON parsing.
     */
    async function apiFetch(endpoint, options = {}, timeoutMs = 12000) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
        const url = `${INVESTWISE_CONFIG.API_BASE_URL}${cleanEndpoint}`;

        try {
            const fetchOptions = {
                ...options,
                signal: controller.signal,
                headers: {
                    Accept: "application/json",
                    ...(options.headers || {})
                }
            };

            const response = await fetch(url, fetchOptions);

            if (!response.ok) {
                let errorData = null;
                try {
                    errorData = await response.json();
                } catch (_) {}

                const message =
                    errorData?.error ||
                    errorData?.message ||
                    `Server returned HTTP ${response.status} (${response.statusText})`;

                const err = new Error(message);
                err.status = response.status;
                err.data = errorData;
                throw err;
            }

            return await response.json();
        } catch (error) {
            if (error.name === "AbortError") {
                const timeoutErr = new Error("Request timed out. Please verify your connection.");
                timeoutErr.status = 504;
                throw timeoutErr;
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Format a numeric value in Indian Rupees (INR)
     */
    function formatINR(value, decimals = 2) {
        const num = Number(value);
        if (Number.isNaN(num)) return "₹0.00";

        return "₹" + num.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    /**
     * Account Storage Helpers
     */
    function getStoredBalance() {
        const raw = localStorage.getItem(INVESTWISE_CONFIG.STORAGE_KEYS.BALANCE);
        if (raw === null || raw === undefined || raw === "") {
            localStorage.setItem(
                INVESTWISE_CONFIG.STORAGE_KEYS.BALANCE,
                String(INVESTWISE_CONFIG.DEFAULT_BALANCE)
            );
            return INVESTWISE_CONFIG.DEFAULT_BALANCE;
        }
        const val = Number(raw);
        return Number.isNaN(val) ? INVESTWISE_CONFIG.DEFAULT_BALANCE : val;
    }

    function setStoredBalance(balance) {
        const val = Math.max(0, Number(balance) || 0);
        localStorage.setItem(INVESTWISE_CONFIG.STORAGE_KEYS.BALANCE, String(val));
        return val;
    }

    function getStoredPortfolio() {
        try {
            const raw = localStorage.getItem(INVESTWISE_CONFIG.STORAGE_KEYS.PORTFOLIO);
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function setStoredPortfolio(portfolio) {
        const valid = Array.isArray(portfolio) ? portfolio : [];
        localStorage.setItem(
            INVESTWISE_CONFIG.STORAGE_KEYS.PORTFOLIO,
            JSON.stringify(valid)
        );
        return valid;
    }

    function getStoredTransactions() {
        try {
            const raw = localStorage.getItem(INVESTWISE_CONFIG.STORAGE_KEYS.TRANSACTIONS);
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function addStoredTransaction(tx) {
        const list = getStoredTransactions();
        list.push({
            id: tx.id || Date.now().toString(),
            date: tx.date || new Date().toISOString(),
            ...tx
        });
        localStorage.setItem(
            INVESTWISE_CONFIG.STORAGE_KEYS.TRANSACTIONS,
            JSON.stringify(list)
        );
        return list;
    }

    function getStoredUser() {
        try {
            const raw =
                localStorage.getItem(INVESTWISE_CONFIG.STORAGE_KEYS.LOGGED_IN_USER) ||
                localStorage.getItem(INVESTWISE_CONFIG.STORAGE_KEYS.USER);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function setStoredUser(user) {
        if (!user) return;
        localStorage.setItem(INVESTWISE_CONFIG.STORAGE_KEYS.USER, JSON.stringify(user));
        localStorage.setItem(INVESTWISE_CONFIG.STORAGE_KEYS.LOGGED_IN_USER, JSON.stringify(user));
    }

    // Export globally
    window.INVESTWISE = {
        CONFIG: INVESTWISE_CONFIG,
        apiFetch,
        formatINR,
        getBalance: getStoredBalance,
        setBalance: setStoredBalance,
        getPortfolio: getStoredPortfolio,
        setPortfolio: setStoredPortfolio,
        getTransactions: getStoredTransactions,
        addTransaction: addStoredTransaction,
        getUser: getStoredUser,
        setUser: setStoredUser
    };
})(window);
