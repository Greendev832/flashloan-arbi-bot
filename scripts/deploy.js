require("dotenv").config();
const { ethers } = require("hardhat");
const AAVE_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";

async function main() {
  const fee = await ethers.provider.getFeeData();
  const ArbExecutor = await ethers.getContractFactory("ArbExecutor");
  const executor = await ArbExecutor.deploy(AAVE_PROVIDER, {
    maxFeePerGas: fee.maxFeePerGas + ethers.parseUnits("5", "gwei"),
    maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
    gasLimit: 800000,
  });
  await executor.waitForDeployment();
  console.log("ArbExecutor deployed to:", await executor.getAddress());
}
main().catch((e) => { console.error(e); process.exit(1); });
