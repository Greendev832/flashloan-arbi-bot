require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");
const { FlashbotsBundleProvider } = require("@flashbots/ethers-provider-bundle");

const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const auth = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY, provider);
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const ABI = ["function startFlashLoanArb(address asset,uint256 amount,address[] targets,bytes[] calldatas,uint256 minProfit) external"];

async function main() {
  const victimHash = process.argv[2];
  if (!victimHash) throw new Error("Usage: node scripts/backrun_bundle.js 0xVictimHash");
  if (!fs.existsSync("profitable-route.json")) throw new Error("Missing profitable-route.json");

  const route = JSON.parse(fs.readFileSync("profitable-route.json", "utf8"));
  const victimTx = await provider.getTransaction(victimHash);
  if (!victimTx) throw new Error("Victim tx not found");

  const fb = await FlashbotsBundleProvider.create(provider, auth, "https://relay.flashbots.net");
  const executor = new ethers.Contract(process.env.EXECUTOR_ADDRESS, ABI, wallet);

  const txRequest = await executor.startFlashLoanArb.populateTransaction(
    WETH, BigInt(route.amountIn), [ROUTER], [route.calldata], BigInt(route.minProfit)
  );

  const feeData = await provider.getFeeData();
  const arbTx = {
    ...txRequest,
    chainId: 1,
    type: 2,
    gasLimit: 1200000,
    maxFeePerGas: feeData.maxFeePerGas + ethers.parseUnits("2", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
    nonce: await provider.getTransactionCount(wallet.address),
  };

  console.log("Backrun simulation note: victim tx raw serialization may not be available for all providers.");
  const signed = await fb.signBundle([{ signer: wallet, transaction: arbTx }]);
  const targetBlock = (await provider.getBlockNumber()) + 1;
  const sim = await fb.simulate(signed, targetBlock);
  if ("error" in sim) {
    console.log("Backrun simulation failed:", sim.error.message);
    return;
  }
  console.log("Backrun simulation success");

  if (process.env.LIVE_MODE !== "true") {
    console.log("LIVE_MODE=false, not sending");
    return;
  }
  const res = await fb.sendRawBundle(signed, targetBlock);
  console.log(await res.wait());
}
main().catch(console.error);
