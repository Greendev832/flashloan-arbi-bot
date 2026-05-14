#!/bin/bash
node scripts/validate_env.js || exit 1
node scripts/health_check.js || exit 1
echo "Checking local fork age..."
node scripts/check_fork_age.js || exit 1
echo "Starting continuous scanner..."
node scripts/continuous_scanner.js
