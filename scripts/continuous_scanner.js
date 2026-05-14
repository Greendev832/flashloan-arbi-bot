require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");
const { exec } = require("child_process");

const provider = new ethers.WebSocketProvider(process.env.WS_RPC);
let running = false;
let lastScanTime = 0;
const SCAN_COOLDOWN_MS = Number(process.env.SCAN_COOLDOWN_MS || "24000");

function runCommand(cmd, timeout = 120000) {
  return new Promise((resolve) => {
    exec(cmd, { timeout }, (error, stdout, stderr) => {
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      if (error) console.error("Command failed:", cmd, error.message);
      resolve(!error);
    });
  });
}

async function scan(reason) {
  if (running) return;
  const now = Date.now();
  if (now - lastScanTime < SCAN_COOLDOWN_MS) return;
  lastScanTime = now;
  running = true;
  try {
    console.log("Scanning:", reason);
    await runCommand("node scripts/prefilter_routes.js");
    await runCommand("node scripts/rank_routes.js");
    await runCommand("npx hardhat run scripts/simulate_routes.js --network localhost");
    if (fs.existsSync("profitable-route.json")) {
      if (process.env.LIVE_MODE !== "true") {
        console.log("Profitable route found, LIVE_MODE=false. Not sending.");
        return;
      }
      await runCommand("node scripts/send_profitable_route.js");
      fs.unlinkSync("profitable-route.json");
    }
  } finally {
    running = false;
  }
}

provider.on("block", async (blockNumber) => {
  console.log("New block:", blockNumber);
  await scan("new block");
});

console.log("Continuous scanner running...");
