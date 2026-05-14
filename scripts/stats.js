require("dotenv").config();
const fs = require("fs");
const FILE = "stats.json";

function blank() {
  return { tested: 0, profitable: 0, bestNetProfitWETH: "0", lastNetProfitWETH: "0", bestAmountInWETH: "0", lastFailedAt: 0, profitStreak: 0, failureStreak: 0, profitSamples: [] };
}
function loadStats() {
  if (!fs.existsSync(FILE)) return { totalSimulations: 0, profitableRoutes: 0, routes: {} };
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
function saveStats(s) { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); }
function keyRoute(route) { return `${route.path.join(" -> ")}|${route.fees.join("-")}`; }
function keyResult(result) { return `${result.path}|${result.fees.join("-")}`; }

function recordRoute(result, profitable) {
  const s = loadStats();
  s.totalSimulations++;
  if (profitable) s.profitableRoutes++;
  const k = keyResult(result);
  if (!s.routes[k]) s.routes[k] = blank();
  const r = s.routes[k];
  r.tested++;
  r.lastNetProfitWETH = result.netProfitWETH;
  if (profitable) {
    r.profitable++;
    r.profitStreak++;
    r.failureStreak = 0;
    r.profitSamples.push(Number(result.netProfitWETH));
    r.profitSamples = r.profitSamples.slice(-20);
    if (Number(result.netProfitWETH) > Number(r.bestNetProfitWETH)) {
      r.bestNetProfitWETH = result.netProfitWETH;
      r.bestAmountInWETH = result.amountInWETH;
    }
  } else {
    r.profitStreak = 0;
    r.failureStreak++;
  }
  saveStats(s);
}

function shouldSkipRoute(route) {
  const s = loadStats();
  const k = keyRoute(route);
  const r = s.routes[k];
  if (!r) return false;
  const cooldown = Number(process.env.ROUTE_FAILURE_COOLDOWN_MS || "300000");
  if (r.lastFailedAt && Date.now() - r.lastFailedAt < cooldown) return true;
  if (r.tested >= 5 && r.profitable === 0) return true;
  return false;
}
function getBestAmount(route) {
  const r = loadStats().routes[keyRoute(route)];
  return r && Number(r.bestAmountInWETH) > 0 ? r.bestAmountInWETH : null;
}
function markRouteFailed(route) {
  const s = loadStats();
  const k = keyRoute(route);
  if (!s.routes[k]) s.routes[k] = blank();
  s.routes[k].lastFailedAt = Date.now();
  saveStats(s);
}
module.exports = { recordRoute, shouldSkipRoute, getBestAmount, markRouteFailed };
