require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
const FACTORY = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
const FACTORY_ABI = ["function getPool(address tokenA,address tokenB,uint24 fee) external view returns (address)"];
const POOL_ABI = ["function liquidity() external view returns(uint128)"];

const TOKENS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

const feeTiers = [100, 500, 3000, 10000];
const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);

function pairs(tokens) {
  const keys = Object.keys(tokens);
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) out.push([keys[i], keys[j]]);
  }
  return out;
}

async function findPools() {
  const out = [];
  for (const [a, b] of pairs(TOKENS)) {
    for (const fee of feeTiers) {
      try {
        const pool = await factory.getPool(TOKENS[a], TOKENS[b], fee);
        if (pool === ethers.ZeroAddress) continue;
        const pc = new ethers.Contract(pool, POOL_ABI, provider);
        const liquidity = await pc.liquidity();
        if (liquidity === 0n) continue;
        out.push({ pair: `${a}/${b}`, tokenA: a, tokenB: b, fee, pool });
        console.log("Pool:", a, b, fee, pool);
      } catch {}
    }
  }
  return out;
}

function buildRoutes(pools, start = "WETH") {
  const routes = [];
  for (const p1 of pools) {
    if (p1.tokenA !== start && p1.tokenB !== start) continue;
    const b = p1.tokenA === start ? p1.tokenB : p1.tokenA;
    for (const p2 of pools) {
      if (p2.tokenA !== b && p2.tokenB !== b) continue;
      const c = p2.tokenA === b ? p2.tokenB : p2.tokenA;
      if (c === start) continue;
      for (const p3 of pools) {
        const back =
          (p3.tokenA === c && p3.tokenB === start) ||
          (p3.tokenB === c && p3.tokenA === start);
        if (!back) continue;
        routes.push({
          path: [start, b, c, start],
          fees: [p1.fee, p2.fee, p3.fee],
          pools: [p1.pool, p2.pool, p3.pool],
        });
      }
    }
  }
  return routes;
}

async function main() {
  const pools = await findPools();
  const routes = buildRoutes(pools);
  fs.writeFileSync("routes.json", JSON.stringify(routes, null, 2));
  console.log("Saved routes.json:", routes.length);
}

main().catch(console.error);
