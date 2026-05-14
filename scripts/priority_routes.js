const fs = require("fs");
const FILE = "priority-routes.json";

function loadPriorityRoutes() {
  if (!fs.existsSync(FILE)) return [];
  const routes = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const now = Date.now();
  return routes.filter((r) => now - new Date(r.savedAt).getTime() < 24 * 60 * 60 * 1000);
}

function savePriorityRoute(route) {
  const routes = loadPriorityRoutes();
  routes.unshift({
    savedAt: new Date().toISOString(),
    route: route.route,
    fees: route.fees,
    amountIn: route.amountIn,
    netProfitWETH: route.result.netProfitWETH,
    result: route.result,
  });
  fs.writeFileSync(FILE, JSON.stringify(routes.slice(0, 50), null, 2));
}

module.exports = { loadPriorityRoutes, savePriorityRoute };
