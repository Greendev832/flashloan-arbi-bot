const fs = require("fs");

if (!fs.existsSync("stats.json")) {
  console.log("No stats.json");
  process.exit(0);
}

const stats = JSON.parse(
  fs.readFileSync("stats.json", "utf8")
);

let triangle = {
  tracked: 0,
  profitable: 0,
};

let feeTier = {
  tracked: 0,
  profitable: 0,
};

for (const [key, value] of Object.entries(
  stats.routes || {}
)) {
  const path = key.split("|")[0];
  const hops = path.split(" -> ");

  const isProfitable =
    (value.profitable || 0) > 0;

  if (hops.length === 3) {
    feeTier.tracked++;

    if (isProfitable) {
      feeTier.profitable++;
    }
  }

  if (hops.length === 4) {
    triangle.tracked++;

    if (isProfitable) {
      triangle.profitable++;
    }
  }
}

console.log("\nTriangle routes:");
console.log(triangle);

console.log("\nFee-tier routes:");
console.log(feeTier);

const triangleRate =
  triangle.tracked > 0
    ? ((triangle.profitable / triangle.tracked) * 100).toFixed(2)
    : "0.00";

const feeTierRate =
  feeTier.tracked > 0
    ? ((feeTier.profitable / feeTier.tracked) * 100).toFixed(2)
    : "0.00";

console.log("\nTriangle success rate:", triangleRate + "%");
console.log("Fee-tier success rate:", feeTierRate + "%");
