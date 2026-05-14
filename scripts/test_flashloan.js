const { ethers } = require("hardhat");
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const AAVE_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e";
async function main() {
  const ArbExecutor = await ethers.getContractFactory("ArbExecutor");
  const executor = await ArbExecutor.deploy(AAVE_PROVIDER);
  await executor.waitForDeployment();
  console.log("Executor:", await executor.getAddress());
  console.log("Flashloan contract deployed for test.");
}
main().catch(console.error);
