const fs = require("fs");
const file = "execution-log.jsonl";
if (!fs.existsSync(file)) { console.log("No execution-log.jsonl found"); process.exit(0); }
const raw = fs.readFileSync(file, "utf8").trim();
if (!raw) { console.log("execution-log.jsonl is empty"); process.exit(0); }
const stats = { simulationsSuccess: 0, simulationsFailed: 0, bundleResults: 0, routes: {} };
for (const line of raw.split("\n")) {
  try {
    const e = JSON.parse(line);
    if (e.type === "flashbots_simulation_success") stats.simulationsSuccess++;
    if (e.type === "flashbots_simulation_failed") stats.simulationsFailed++;
    if (e.type === "bundle_result") stats.bundleResults++;
    if (e.route) {
      const k = Array.isArray(e.route) ? e.route.join(" -> ") : e.route;
      stats.routes[k] = (stats.routes[k] || 0) + 1;
    }
  } catch {}
}
console.log(stats);
