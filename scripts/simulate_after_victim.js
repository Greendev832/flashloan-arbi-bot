require("dotenv").config();
const fs = require("fs");
const { ethers } = require("ethers");

const LOCAL_RPC = "http://127.0.0.1:8545";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
const ABI = ["function startFlashLoanArb(address asset,uint256 amount,address[] targets,bytes[] calldatas,uint256 minProfit) external"];

async function main() {
  const victimHash = process.argv[2];
  if (!victimHash) throw new Error("Usage: node scripts/simulate_after_victim.js 0xVictimTxHash");

  const mainnet = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const local = new ethers.JsonRpcProvider(LOCAL_RPC);
  const route = JSON.parse(fs.readFileSync("profitable-route.json", "utf8"));
  const victimTx = await mainnet.getTransaction(victimHash);
  if (!victimTx) throw new Error("Victim tx not found");

  const snap = await local.send("evm_snapshot", []);
  await local.send("hardhat_impersonateAccount", [victimTx.from]);
  await local.send("hardhat_setBalance", [victimTx.from, "0x56BC75E2D63100000"]);
  const victim = await local.getSigner(victimTx.from);

  console.log("Replaying victim...");
  const replay = await victim.sendTransaction({
    to: victimTx.to,
    data: victimTx.data,
    value: victimTx.value,
    gasLimit: victimTx.gasLimit || 1000000n,
  });
  await replay.wait();

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, local);
  const executor = new ethers.Contract(process.env.EXECUTOR_ADDRESS, ABI, wallet);

  console.log("Running arb after victim...");
  const tx = await executor.startFlashLoanArb(
    WETH,
    BigInt(route.amountIn),
    [ROUTER],
    [route.calldata],
    BigInt(route.minProfit),
    { gasLimit: 1200000 }
  );
  const receipt = await tx.wait();
  console.log("Post-victim arb success. Gas:", receipt.gasUsed.toString());

  await local.send("hardhat_stopImpersonatingAccount", [victimTx.from]);
  await local.send("evm_revert", [snap]);
}
main().catch(console.error);
