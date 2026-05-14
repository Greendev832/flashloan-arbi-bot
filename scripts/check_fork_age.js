require("dotenv").config();
const { ethers } = require("ethers");
async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const block = await provider.getBlock("latest");
  const age = Math.floor(Date.now() / 1000) - Number(block.timestamp);
  console.log("Fork block:", block.number);
  console.log("Fork age seconds:", age);
  const max = Number(process.env.MAX_FORK_AGE_SECONDS || "300");
  if (age > max) { console.error("Fork too old. Refusing startup."); process.exit(1); }
  console.log("Fork is fresh");
}
main().catch((e) => { console.error(e.message); process.exit(1); });
