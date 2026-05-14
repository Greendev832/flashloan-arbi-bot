# Ethereum Flash Arbitrage Bot

Prototype Uniswap v3 + Aave flash-loan + Flashbots searcher.

## Install

```bash
npm install
cp .env.example .env
nano .env
npx hardhat compile
```

## Generate Flashbots auth key

```bash
node scripts/generate_flashbots_key.js
```

## Find routes

```bash
node scripts/find_routes.js
node scripts/prefilter_routes.js
node scripts/rank_routes.js
```

## Start local fork

```bash
./run_anvil.sh
```

## Start continuous scanner

```bash
node scripts/continuous_scanner.js
```

## Start pending watcher

```bash
node scripts/watch_pending.js
```

## Status

```bash
node scripts/status.js
```

## Live safety

Keep this while testing:

```env
LIVE_MODE=false
PAPER_MODE=true
```

Only use live after repeated successful simulations.
