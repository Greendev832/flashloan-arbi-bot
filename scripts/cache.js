const seen = new Set();
function routeHash(route) {
  return JSON.stringify({ path: route.path, fees: route.fees, calldata: route.calldata, amountIn: route.amountIn });
}
function alreadySeen(route) {
  const h = routeHash(route);
  if (seen.has(h)) return true;
  seen.add(h);
  return false;
}
module.exports = { alreadySeen };
