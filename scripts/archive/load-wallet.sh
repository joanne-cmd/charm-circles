#!/bin/bash
# Helper script to load the Bitcoin wallet

WALLET_NAME="charmcircle-dev"

# Check if wallet is already loaded
if bitcoin-cli -testnet4 listwallets 2>/dev/null | grep -q "\"${WALLET_NAME}\""; then
    echo "Wallet '${WALLET_NAME}' is already loaded"
    exit 0
fi

# Load the wallet
echo "Loading wallet '${WALLET_NAME}'..."
result=$(bitcoin-cli -testnet4 loadwallet "${WALLET_NAME}" 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ Wallet loaded successfully"
    echo "Wallet name: ${WALLET_NAME}"
else
    echo "❌ Failed to load wallet:"
    echo "${result}"
    exit 1
fi

