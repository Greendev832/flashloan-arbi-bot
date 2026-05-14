function shortHex(data, length = 80) {
  if (!data) return "";
  return data.length > length ? data.slice(0, length) + "..." : data;
}
function logRouteFailure({ amountText, route, error, calldata }) {
  console.log("\n--- ROUTE FAILED ---");
  console.log("Amount:", amountText, "WETH");
  console.log("Path:", route.path.join(" -> "));
  console.log("Fees:", route.fees);
  console.log("Error:", error.shortMessage || error.message);
  console.log("Calldata:", shortHex(calldata));
  console.log("--------------------\n");
}
module.exports = { logRouteFailure };
