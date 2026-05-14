const fs = require("fs");
const ROUTES_FILE = "candidate-routes.json";
const STATS_FILE = "stats.json";

if (!fs.existsSync(ROUTES_FILE)) {
  console.log("Missing candidate-routes.json");
  process.exit(1);
}

const routes = JSON.parse(fs.readFileSync(ROUTES_FILE, "utf8"));

if (!fs.existsSync(STATS_FILE)) {
  fs.writeFileSync("ranked-routes.json", JSON.stringify(routes, null, 2));
  console.log("No stats.json yet. Saved original routes.");
  process.exit(0);
}

const stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf8"));

function key(route) {
  return `${route.path.join(" -> ")}|${route.fees.join("-")}`;
}

function score(route) {
  const item = stats.routes[key(route)];
  if (!item) return 0;
  const successRate = (item.profitable || 0) / (item.tested || 1);
  const bestProfit = Number(item.bestNetProfitWETH || "0");
  return successRate * 100 + bestProfit * 1000;
}

const ranked = routes.map((route) => ({ ...route, score: score(route) })).sort((a, b) => b.score - a.score);
fs.writeFileSync("ranked-routes.json", JSON.stringify(ranked, null, 2));
console.log("Saved ranked-routes.json");
