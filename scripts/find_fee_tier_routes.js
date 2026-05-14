require("dotenv").config();

const fs = require("fs");
const { ethers } = require("ethers");

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);

const FACTORY =
  "0x1F98431c8aD98523631AE4a59f267346ea31F984";

const FACTORY_ABI = [
  "function getPool(address tokenA,address tokenB,uint24 fee) external view returns (address)"
];

const POOL_ABI = [
  "function liquidity() external view returns(uint128)"
];

const TOKENS = {
  WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",

  LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
  UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
  AAVE: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDAE9",
  MKR: "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
  wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
  cbETH: "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704",
};

const FEE_TIERS = [100, 500, 3000, 10000];

const factory = new ethers.Contract(
  FACTORY,
  FACTORY_ABI,
  provider
);

async function poolExists(tokenA, tokenB, fee) {
  try {
    const pool = await factory.getPool(tokenA, tokenB, fee);

    if (pool === ethers.ZeroAddress) return null;

    const poolContract = new ethers.Contract(
      pool,
      POOL_ABI,
      provider
    );

    const liquidity = await poolContract.liquidity();

    if (liquidity === 0n) return null;

    return pool;
  } catch {
    return null;
  }
}

async function main() {
  const routes = [];

  const symbols = Object.keys(TOKENS).filter(
    (s) => s !== "WETH"
  );

  for (const symbol of symbols) {
    const token = TOKENS[symbol];

    const pools = [];

    for (const fee of FEE_TIERS) {
      const pool = await poolExists(
        TOKENS.WETH,
        token,
        fee
      );

      if (pool) {
        pools.push({
          fee,
          pool,
        });
      }
    }

    for (let i = 0; i < pools.length; i++) {
      for (let j = 0; j < pools.length; j++) {
        if (i === j) continue;

        routes.push({
          type: "fee-tier",
          path: ["WETH", symbol, "WETH"],
          fees: [pools[i].fee, pools[j].fee],
          pools: [pools[i].pool, pools[j].pool],
        });
      }
    }
  }

  let existing = [];

  if (fs.existsSync("routes.json")) {
    existing = JSON.parse(
      fs.readFileSync("routes.json", "utf8")
    );
  }

  const combined = [...existing, ...routes];

  fs.writeFileSync(
    "routes.json",
    JSON.stringify(combined, null, 2)
  );

  console.log("Fee-tier routes:", routes.length);
  console.log("Total routes saved:", combined.length);
}

main().catch(console.error);
