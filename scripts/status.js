const fs = require("fs");
function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}
const stats = readJson("stats.json");
const inclusion = readJson("inclusion-stats.json");
const priority = readJson("priority-routes.json");
const risk = readJson("risk-state.json");
console.log("\n=== BOT STATUS ===\n");
if (stats) {
  console.log("Total simulations:", stats.totalSimulations);
  console.log("Profitable routes:", stats.profitableRoutes);
  console.log("Tracked routes:", Object.keys(stats.routes || {}).length);
} else console.log("No stats.json yet");
console.log("");
if (inclusion) {
  const rate = inclusion.sent > 0 ? ((inclusion.included / inclusion.sent) * 100).toFixed(2) : "0.00";
  console.log("Bundles sent:", inclusion.sent);
  console.log("Bundles included:", inclusion.included);
  console.log("Bundles missed:", inclusion.missed);
  console.log("Inclusion rate:", rate + "%");
} else console.log("No inclusion-stats.json yet");
console.log("");
if (Array.isArray(priority)) {
  console.log("Priority routes:", priority.length);
  if (priority[0]) console.log("Top priority route:", priority[0].route?.join(" -> "), "profit:", priority[0].netProfitWETH);
} else console.log("No priority-routes.json yet");
console.log("");
if (risk) console.log("Risk date:", risk.date, "Daily loss WETH:", risk.dailyLossWETH);
else console.log("No risk-state.json yet");
console.log("\n==================\n");
