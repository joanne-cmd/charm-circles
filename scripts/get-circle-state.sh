#!/bin/bash
# Helper script to get or generate circle state data

cd "$(dirname "$0")/.." || exit 1

BTC_CLI="${BTC_CLI:-bitcoin-cli} -testnet4"

# Load wallet if needed
if ! ${BTC_CLI} listwallets 2>/dev/null | grep -q "charmcircle-dev"; then
    echo "Loading wallet..."
    ${BTC_CLI} loadwallet charmcircle-dev >/dev/null 2>&1 || true
fi

# Check if circle_utxo is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <circle_utxo>"
    echo "  circle_utxo format: txid:index"
    echo ""
    echo "Example:"
    echo "  $0 85c17708ba4923f90bdffd43d07c69ac93529514a2ee99fa236ccddffab6cc48:1"
    exit 1
fi

circle_utxo="$1"
txid=$(echo "$circle_utxo" | cut -d':' -f1)
vout=$(echo "$circle_utxo" | cut -d':' -f2)

echo "=== Getting Circle State Data ==="
echo "Circle UTXO: $circle_utxo"
echo ""

# Try to extract state data from transaction
echo "Attempting to extract state data from transaction..."
tx_info=$(${BTC_CLI} gettransaction "$txid" 2>&1)

if [ $? -eq 0 ]; then
    echo "Transaction found in wallet"
    # TODO: Extract charm/app data from transaction output
    # This would require parsing the transaction and extracting the app data
    # For now, we'll generate test data
    echo "Note: Automatic extraction not yet implemented"
    echo "Generating test state data instead..."
else
    echo "Transaction not found in wallet, generating test state data..."
fi

echo ""
echo "=== Generating Test Circle State Data ==="
echo ""

# Build serialize_state if needed
if [ ! -f "./target/release/serialize_state" ]; then
    echo "Building serialize_state helper..."
    cargo build --release --bin serialize_state
fi

# Generate test state with same parameters as create-circle script
circle_id_hex=$(openssl rand -hex 32)
contribution_per_round=100000
round_duration=2592000
created_at=$(date +%s)
creator_pubkey_hex="023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281"

echo "Generating state with:"
echo "  Circle ID: $circle_id_hex"
echo "  Contribution per round: $contribution_per_round satoshis"
echo "  Round duration: $round_duration seconds"
echo "  Created at: $created_at"
echo "  Creator pubkey: $creator_pubkey_hex"
echo ""

circle_state_data=$(./target/release/serialize_state \
    "${circle_id_hex}" \
    "${contribution_per_round}" \
    "${round_duration}" \
    "${created_at}" \
    "${creator_pubkey_hex}")

if [ $? -eq 0 ] && [ -n "$circle_state_data" ]; then
    echo "=== Circle State Data (hex) ==="
    echo "$circle_state_data"
    echo ""
    echo "=== To use this, run: ==="
    echo "export prev_circle_state_data='$circle_state_data'"
    echo "export circle_utxo='$circle_utxo'"
    echo "./scripts/run-join-circle.sh"
    echo ""
    echo "Or copy this value and set it in the script or as an environment variable."
else
    echo "Error: Failed to generate circle state data"
    exit 1
fi

