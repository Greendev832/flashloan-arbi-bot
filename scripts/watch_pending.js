require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");
const { exec } = require("child_process");
const { exceedsDailyLoss } = require("./risk");

const provider = new ethers.WebSocketProvider(process.env.WS_RPC);
const ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564".toLowerCase();
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2".toLowerCase();
const MIN = ethers.parseEther(process.env.MIN_PENDING_SWAP_WETH || "2");

const ABI = [
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum)) payable returns (uint256 amountOut)"
];
const iface = new ethers.Interface(ABI);

let running = false;
let lastTriggerTime = 0;
let triggerHistory = [];
const COOLDOWN = Number(process.env.TRIGGER_COOLDOWN_MS || "3000");

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

async function triggerSearch(reason, txHash) {
  if (running) return;
  const now = Date.now();
  if (now - lastTriggerTime < COOLDOWN) return;
  triggerHistory = triggerHistory.filter((t) => now - t < 60000);
  if (triggerHistory.length >= Number(process.env.MAX_TRIGGERS_PER_MINUTE || "6")) return;
  if (exceedsDailyLoss(process.env.MAX_DAILY_LOSS_WETH || "0.05")) return;

  triggerHistory.push(now);
  lastTriggerTime = now;
  running = true;

  try {
    console.log("Trigger:", reason, txHash);
    await runCommand("node scripts/prefilter_routes.js");
    await runCommand("node scripts/rank_routes.js");
    await runCommand("npx hardhat run scripts/simulate_routes.js --network localhost");

    if (fs.existsSync("profitable-route.json")) {
      await runCommand(`node scripts/backrun_bundle.js ${txHash}`);
      if (process.env.LIVE_MODE === "true") {
        await runCommand("node scripts/send_profitable_route.js");
      }
    }
  } finally {
    running = false;
  }
}

function decodeV3Path(path) {
  let offset = 2;
  const parts = [];
  while (offset < path.length) {
    const token = "0x" + path.slice(offset, offset + 40);
    offset += 40;
    parts.push({ token });
    if (offset >= path.length) break;
    const fee = parseInt(path.slice(offset, offset + 6), 16);
    offset += 6;
    parts.push({ fee });
  }
  return parts;
}

provider.on("pending", async (txHash) => {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx || !tx.to || tx.to.toLowerCase() !== ROUTER) return;
    const decoded = iface.parseTransaction({ data: tx.data, value: tx.value || 0n });

    if (decoded.name === "exactInputSingle") {
      const p = decoded.args[0];
      if (p.tokenIn.toLowerCase() !== WETH || p.amountIn < MIN) return;
      console.log("Large pending exactInputSingle:", txHash, ethers.formatEther(p.amountIn));
      await triggerSearch("large exactInputSingle", txHash);
    }

    if (decoded.name === "exactInput") {
      const p = decoded.args[0];
      const path = decodeV3Path(p.path);
      if (path[0].token.toLowerCase() !== WETH || p.amountIn < MIN) return;
      console.log("Large pending exactInput:", txHash, ethers.formatEther(p.amountIn));
      await triggerSearch("large exactInput", txHash);
    }
  } catch {}
});

console.log("Watching pending Uniswap v3 swaps...");
