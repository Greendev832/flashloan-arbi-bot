require("dotenv").config();
const { ethers } = require("ethers");

async function main() {
  try {
    for (const k of ["ETH_RPC", "PRIVATE_KEY", "FLASHBOTS_AUTH_KEY", "EXECUTOR_ADDRESS"]) {
      if (!process.env[k]) throw new Error(`Missing ${k}`);
    }
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const bal = await provider.getBalance(wallet.address);
    const block = await provider.getBlockNumber();
    const fee = await provider.getFeeData();
    console.log("Wallet:", wallet.address);
    console.log("ETH balance:", ethers.formatEther(bal));
    console.log("Current block:", block);
    console.log("Gas max fee:", ethers.formatUnits(fee.maxFeePerGas, "gwei"), "gwei");
    if (bal < ethers.parseEther("0.01")) throw new Error("Low ETH balance (< 0.01 ETH)");
    console.log("Health check PASSED");
  } catch (e) {
    console.error("Health check FAILED:", e.message);
    process.exit(1);
  }
}
main();
