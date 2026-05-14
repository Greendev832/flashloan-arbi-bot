const fs = require("fs");
const FILE = "risk-state.json";
function loadState() {
  const today = new Date().toISOString().slice(0, 10);
  if (!fs.existsSync(FILE)) return { date: today, dailyLossWETH: 0 };
  const s = JSON.parse(fs.readFileSync(FILE, "utf8"));
  if (s.date !== today) return { date: today, dailyLossWETH: 0 };
  return s;
}
function saveState(s) { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); }
function addLoss(x) { const s = loadState(); s.dailyLossWETH += Number(x); saveState(s); }
function exceedsDailyLoss(limit) { return loadState().dailyLossWETH >= Number(limit); }
module.exports = { addLoss, exceedsDailyLoss };
