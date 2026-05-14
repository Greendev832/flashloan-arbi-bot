const fs = require("fs");
const file = "inclusion-stats.json";
if (!fs.existsSync(file)) { console.log("No inclusion-stats.json found"); process.exit(0); }
const s = JSON.parse(fs.readFileSync(file, "utf8"));
const rate = s.sent > 0 ? (s.included / s.sent * 100).toFixed(2) : "0.00";
console.log("=== Inclusion Stats ===");
console.log("Sent:", s.sent);
console.log("Included:", s.included);
console.log("Missed:", s.missed);
console.log("Retries included:", s.retriesIncluded);
console.log("Inclusion rate:", rate + "%");
