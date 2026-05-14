require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");
const { logEvent } = require("./logger");
const { recordIncluded, recordMissed, recordRetryIncluded } = require("./inclusion_stats");

const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const ABI = ["function startFlashLoanArb(address asset,uint256 amount,address[] targets,bytes[] calldatas,uint256 minProfit) external"];

async function main() {
  const route = JSON.parse(fs.readFileSync("profitable-route.json", "utf8"));

  if (process.env.PAPER_MODE === "true") {
    console.log("PAPER_MODE enabled. Would send:", route.result);
    return;
  }

  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const auth = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY, provider);

  const currentBlock = await provider.getBlockNumber();
  if (route.blockNumber && currentBlock > route.blockNumber + 1) {
    console.log("Route stale. Not sending.");
    return;
  }

  const fb = await FlashbotsBundleProvider.create(provider, auth, "https://relay.flashbots.net");
  const executor = new ethers.Contract(process.env.EXECUTOR_ADDRESS, ABI, wallet);

  const txRequest = await executor.startFlashLoanArb.populateTransaction(
    WETH,
    BigInt(route.amountIn),
    [ROUTER],
    [route.calldata],
    BigInt(route.minProfit)
  );

  const feeData = await provider.getFeeData();

  const tx = {
    ...txRequest,
    chainId: 1,
    type: 2,
    gasLimit: 1200000,
    maxFeePerGas: feeData.maxFeePerGas + ethers.parseUnits("2", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
    nonce: await provider.getTransactionCount(wallet.address),
  };

  const signed = await fb.signBundle([{ signer: wallet, transaction: tx }]);
  const targetBlock = (await provider.getBlockNumber()) + 1;
  const simulation = await fb.simulate(signed, targetBlock);

  if ("error" in simulation) {
    console.error("Flashbots simulation failed:", simulation.error.message);
    logEvent({ type: "flashbots_simulation_failed", error: simulation.error.message, route: route.route });
    return;
  }

  if (!simulation.results || simulation.results.length === 0 || simulation.results[0].error) {
    console.error("Tx would revert or no results. Not sending.");
    return;
  }

  const response = await fb.sendRawBundle(signed, targetBlock);
  if ("error" in response) {
    console.error("Bundle send failed:", response.error.message);
    return;
  }

  const result = await response.wait();
  console.log("Bundle result:", result);

  if (result === 0) recordIncluded();
  if (result === 1) recordMissed();

  if (result === 1) {
    const maxRetries = Number(process.env.BUNDLE_RETRIES || "2");
    for (let retry = 1; retry <= maxRetries; retry++) {
      const currentBlockNow = await provider.getBlockNumber();
      if (route.blockNumber && currentBlockNow > route.blockNumber + 2) break;
      const retryResponse = await fb.sendRawBundle(signed, targetBlock + retry);
      if ("error" in retryResponse) continue;
      const retryResult = await retryResponse.wait();
      if (retryResult === 0) {
        recordRetryIncluded();
        break;
      }
    }
  }
}

main().catch(console.error);
