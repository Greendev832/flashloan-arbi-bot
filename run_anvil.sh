#!/bin/bash
source .env

if [ -z "$FORK_BLOCK_NUMBER" ]; then
  anvil --fork-url $MAINNET_RPC --host 127.0.0.1 --port 8545
else
  anvil --fork-url $MAINNET_RPC --fork-block-number $FORK_BLOCK_NUMBER --host 127.0.0.1 --port 8545
fi
