require("dotenv").config();
function fail(msg) { console.error("ENV VALIDATION FAILED:", msg); process.exit(1); }
const LIVE = process.env.LIVE_MODE === "true";
const PAPER = process.env.PAPER_MODE === "true";
if (LIVE && PAPER) fail("LIVE_MODE and PAPER_MODE cannot both be true");
if (LIVE && !process.env.EXECUTOR_ADDRESS) fail("Missing EXECUTOR_ADDRESS in live mode");
if (LIVE && !process.env.PRIVATE_KEY) fail("Missing PRIVATE_KEY in live mode");
if (LIVE && !process.env.FLASHBOTS_AUTH_KEY) fail("Missing FLASHBOTS_AUTH_KEY in live mode");
console.log("Environment validation passed");
