require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
const QUOTER_V2 = "0x61fFE014bA17989E743c5F6cB21bF9697530B21e";
const QUOTER_ABI = ["function quoteExactInput(bytes path,uint256 amountIn) external returns (uint256 amountOut)"];

const TOKENS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

const quoter = new ethers.Contract(QUOTER_V2, QUOTER_ABI, provider);

function encodePath(symbolPath, fees) {
  const addrs = symbolPath.map((s) => TOKENS[s]);
  let path = "0x";
  for (let i = 0; i < fees.length; i++) {
    path += addrs[i].slice(2);
    path += fees[i].toString(16).padStart(6, "0");
  }
  path += addrs[addrs.length - 1].slice(2);
  return path.toLowerCase();
}

async function quote(route, amountIn) {
  try {
    const path = encodePath(route.path, route.fees);
    const amountOut = await quoter.quoteExactInput.staticCall(path, amountIn);
    const grossProfit = amountOut - amountIn;
    const minQuoteProfit = ethers.parseEther(process.env.MIN_QUOTE_PROFIT_WETH || "0.001");
    if (grossProfit < minQuoteProfit) return null;
    return { ...route, pathEncoded: path, amountIn: amountIn.toString(), amountOut: amountOut.toString(), grossProfit: grossProfit.toString(), grossProfitWETH: ethers.formatEther(grossProfit) };
  } catch {
    return null;
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let i = 0;
  async function runner() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: limit }, runner));
  return results;
}

async function main() {
  const routes = JSON.parse(fs.readFileSync("routes.json", "utf8"));
  const amountIn = ethers.parseEther("0.1");
  const results = await runWithConcurrency(routes, Number(process.env.QUOTE_CONCURRENCY || "3"), (r) => quote(r, amountIn));
  const candidates = results.filter(Boolean);
  candidates.sort((a, b) => (BigInt(b.grossProfit) > BigInt(a.grossProfit) ? 1 : -1));
  const top = candidates.slice(0, Number(process.env.TOP_CANDIDATES || "3"));
  fs.writeFileSync("candidate-routes.json", JSON.stringify(top, null, 2));
  console.log("Candidates:", candidates.length, "Saved:", top.length);
}

main().catch(console.error);
