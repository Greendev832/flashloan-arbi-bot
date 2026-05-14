#!/bin/bash
echo "LIVE MODE STARTING"
echo "Press CTRL+C now if this is a mistake"
sleep 5
node scripts/validate_env.js || exit 1
node scripts/pre_live_check.js || exit 1
node scripts/health_check.js || exit 1
node scripts/continuous_scanner.js
