const fs = require("fs");
const FILE = "inclusion-stats.json";
function loadStats() {
  if (!fs.existsSync(FILE)) return { sent: 0, included: 0, missed: 0, retriesIncluded: 0 };
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
}
function saveStats(s) { fs.writeFileSync(FILE, JSON.stringify(s, null, 2)); }
function recordIncluded() { const s = loadStats(); s.sent++; s.included++; saveStats(s); }
function recordMissed() { const s = loadStats(); s.sent++; s.missed++; saveStats(s); }
function recordRetryIncluded() { const s = loadStats(); s.retriesIncluded++; saveStats(s); }
module.exports = { recordIncluded, recordMissed, recordRetryIncluded };
