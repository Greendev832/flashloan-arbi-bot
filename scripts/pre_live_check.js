require("dotenv").config();
const fs = require("fs");
const required = ["routes.json", "candidate-routes.json", "contracts/ArbExecutor.sol", "scripts/watch_pending.js", "scripts/send_profitable_route.js"];
let ok = true;
for (const f of required) if (!fs.existsSync(f)) { console.error("Missing file:", f); ok = false; }
if (process.env.LIVE_MODE !== "true") { console.error("LIVE_MODE is not true"); ok = false; }
if (process.env.PAPER_MODE === "true") { console.error("PAPER_MODE must be false for live"); ok = false; }
for (const k of ["EXECUTOR_ADDRESS", "PRIVATE_KEY", "FLASHBOTS_AUTH_KEY"]) if (!process.env[k]) { console.error("Missing", k); ok = false; }
if (!ok) process.exit(1);
console.log("Pre-live check passed");
