require("dotenv").config();
const { ethers } = require("hardhat");
const fs = require("fs");
const { recordRoute, shouldSkipRoute, getBestAmount, markRouteFailed } = require("./stats");
const { alreadySeen } = require("./cache");
const { logRouteFailure } = require("./debug");
const { loadPriorityRoutes, savePriorityRoute } = require("./priority_routes");

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const AAVE_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";
const WETH_ABI = ["function balanceOf(address) view returns(uint256)"];
const ROUTER_ABI = ["function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum)) payable returns (uint256 amountOut)"];
const TOKENS = {
  WETH,
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
};

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

function priorityScore(route, priorityRoutes) {
  const found = priorityRoutes.find((r) => JSON.stringify(r.route) === JSON.stringify(route.path));
  if (!found) return 0;
  const profit = Math.min(Number(found.netProfitWETH || "0"), 0.1);
  const ageHours = (Date.now() - new Date(found.savedAt).getTime()) / 3600000;
  const freshness = Math.max(0.1, 1 - ageHours / 24);
  return profit * freshness;
}

async function main() {
  const feeData = await ethers.provider.getFeeData();
  if (feeData.maxFeePerGas > ethers.parseUnits(process.env.MAX_GAS_GWEI || "30", "gwei")) {
    console.log("Gas too high. Skipping simulation.");
    return;
  }

  const TX_FEES = {
    maxFeePerGas: feeData.maxFeePerGas + ethers.parseUnits("2", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
  };

  const routeFile = fs.existsSync("ranked-routes.json") ? "ranked-routes.json" : fs.existsSync("candidate-routes.json") ? "candidate-routes.json" : "routes.json";
  const routes = JSON.parse(fs.readFileSync(routeFile, "utf8"));
  const priorityRoutes = loadPriorityRoutes();
  routes.sort((a, b) => priorityScore(b, priorityRoutes) - priorityScore(a, priorityRoutes));

  const ArbExecutor = await ethers.getContractFactory("ArbExecutor");
  const executor = await ArbExecutor.deploy(AAVE_PROVIDER, TX_FEES);
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();

  const weth = await ethers.getContractAt(WETH_ABI, WETH);
  const iface = new ethers.Interface(ROUTER_ABI);
  const defaultAmounts = ["0.01", "0.05", "0.1", "0.5", "1"];
  const minNetProfit = ethers.parseEther(process.env.MIN_NET_PROFIT_WETH || "0.003");

  let globalFoundProfit = false;

  for (const route of routes) {
    if (globalFoundProfit) break;
    if (shouldSkipRoute(route)) continue;

    const learnedAmount = getBestAmount(route);
    const amounts = learnedAmount ? [learnedAmount, ...defaultAmounts.filter((a) => a !== learnedAmount)] : defaultAmounts;

    for (const amountText of amounts) {
      if (globalFoundProfit) break;
      const amountIn = ethers.parseEther(amountText);
      const snapshot = await ethers.provider.send("evm_snapshot", []);
      let calldata = "";
      try {
        const path = encodePath(route.path, route.fees);
        calldata = iface.encodeFunctionData("exactInput", [{
          path,
          recipient: executorAddress,
          deadline: Math.floor(Date.now() / 1000) + 600,
          amountIn,
          amountOutMinimum: 0,
        }]);

        const gas = await executor.startFlashLoanArb.estimateGas(WETH, amountIn, [ROUTER], [calldata], 0);
        const gasCost = gas * TX_FEES.maxFeePerGas;
        const flashLoanFee = (amountIn * 5n) / 10000n;
        const safetyBuffer = (amountIn * 2n) / 10000n;
        const minProfit = gasCost + flashLoanFee + safetyBuffer;

        const tx = await executor.startFlashLoanArb(WETH, amountIn, [ROUTER], [calldata], minProfit, TX_FEES);
        const receipt = await tx.wait();
        const netProfit = await weth.balanceOf(executorAddress);

        const result = {
          amountInWETH: amountText,
          path: route.path.join(" -> "),
          fees: route.fees,
          minProfitWETH: ethers.formatEther(minProfit),
          netProfitWETH: ethers.formatEther(netProfit),
          gasUsed: receipt.gasUsed.toString(),
          estimatedGas: gas.toString(),
        };

        recordRoute(result, netProfit > 0n);

        if (netProfit < minNetProfit) {
          await ethers.provider.send("evm_revert", [snapshot]);
          continue;
        }

        const currentBlock = await ethers.provider.getBlockNumber();
        const profitableRoute = { blockNumber: currentBlock, amountIn: amountIn.toString(), minProfit: minProfit.toString(), calldata, path, route: route.path, fees: route.fees, result };

        if (!alreadySeen(profitableRoute)) {
          fs.writeFileSync("profitable-route.json", JSON.stringify(profitableRoute, null, 2));
          savePriorityRoute(profitableRoute);
          console.log("SAFE PROFITABLE ROUTE:", result);
          globalFoundProfit = true;
        }
      } catch (err) {
        markRouteFailed(route);
        logRouteFailure({ amountText, route, error: err, calldata });
      }
      await ethers.provider.send("evm_revert", [snapshot]);
    }
  }

  if (!globalFoundProfit) console.log("No safe profitable route");
}

main().catch(console.error);
