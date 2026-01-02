#!/bin/bash
# Script to run join-circle.yaml spell check

# Change to project root directory
cd "$(dirname "$0")/.." || exit 1

# Bitcoin CLI command (use -testnet4 for testnet, remove for mainnet)
BTC_CLI="${BTC_CLI:-bitcoin-cli} -testnet4"

# Load wallet if needed
if ! ${BTC_CLI} listwallets 2>/dev/null | grep -q "charmcircle-dev"; then
    echo "Loading wallet..."
    ${BTC_CLI} loadwallet charmcircle-dev >/dev/null 2>&1 || true
fi

# Build WASM binary for spell check
echo "Building WASM binary for spell check..."
app_bin=$(charms app build 2>&1 | tail -1)
if [ -z "$app_bin" ] || [ ! -f "$app_bin" ]; then
    echo "Error: Failed to build WASM binary or binary not found"
    echo "Trying alternative path..."
    app_bin="./target/wasm32-wasip1/release/charmcircle.wasm"
    if [ ! -f "$app_bin" ]; then
        echo "Error: WASM binary not found at $app_bin"
        exit 1
    fi
fi
export app_bin
echo "Using WASM app_bin: ${app_bin}"

# Get verification key
export app_vk=$(charms app vk)

# Set input UTXO (circle state UTXO from previous transaction)
# Can be provided via environment variable or will use default
if [ -z "$circle_utxo" ]; then
    export circle_utxo="REPLACE_WITH_CIRCLE_UTXO"  # Format: txid:index
fi

# Validate circle_utxo is not a placeholder
if [ "$circle_utxo" = "REPLACE_WITH_CIRCLE_UTXO" ]; then
    echo "Error: circle_utxo is still set to placeholder value"
    echo ""
    echo "Please provide a valid circle UTXO in one of these ways:"
    echo "  1. Set environment variable: export circle_utxo='txid:index'"
    echo "  2. Edit the script and replace REPLACE_WITH_CIRCLE_UTXO"
    echo ""
    echo "To find circle UTXOs, you can:"
    echo "  - Check recent transactions: ${BTC_CLI} listtransactions"
    echo "  - List unspent outputs: ${BTC_CLI} listunspent"
    echo ""
    exit 1
fi

# Validate circle_utxo format (should be txid:index)
if ! echo "$circle_utxo" | grep -qE '^[a-f0-9]{64}:[0-9]+$'; then
    echo "Error: Invalid circle_utxo format: $circle_utxo"
    echo "Expected format: txid:index (e.g., abc123...def:0)"
    exit 1
fi

# Calculate app_id
export app_id=$(echo -n "${circle_utxo}" | sha256sum | cut -d' ' -f1)

# Get previous transaction for circle_utxo
txid=$(echo "${circle_utxo}" | cut -d':' -f1)
echo "Fetching transaction: ${txid}"

# Try gettransaction first (for wallet transactions)
echo "Trying gettransaction (for wallet transactions)..."
tx_info=$(${BTC_CLI} gettransaction "${txid}" 2>&1)
tx_info_error=$?

if [ $tx_info_error -eq 0 ]; then
    if command -v jq &> /dev/null; then
        prev_txs=$(echo "${tx_info}" | jq -r '.hex // empty' 2>/dev/null)
    else
        prev_txs=$(echo "${tx_info}" | sed -n 's/.*"hex"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
    fi
    if [ -n "$prev_txs" ] && [ "$prev_txs" != "null" ]; then
        echo "Successfully got transaction from wallet"
    else
        prev_txs=""
    fi
fi

# If gettransaction didn't work, try getrawtransaction with block hash
if [ -z "$prev_txs" ] || [ "$prev_txs" = "null" ]; then
    echo "Trying getrawtransaction with block hash..."
    tx_verbose=$(${BTC_CLI} getrawtransaction "${txid}" true 2>&1)
    if [ $? -eq 0 ]; then
        if command -v jq &> /dev/null; then
            blockhash=$(echo "${tx_verbose}" | jq -r '.blockhash // empty' 2>/dev/null)
        else
            blockhash=$(echo "${tx_verbose}" | sed -n 's/.*"blockhash"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
        fi
        if [ -n "$blockhash" ] && [ "$blockhash" != "null" ]; then
            echo "Found block hash: ${blockhash}"
            prev_txs=$(${BTC_CLI} getrawtransaction "${txid}" false "${blockhash}" 2>&1)
            if [ $? -ne 0 ]; then
                prev_txs=""
            else
                if echo "${prev_txs}" | grep -q "error"; then
                    prev_txs=""
                fi
            fi
        fi
    fi
fi

# If still no luck, try getrawtransaction directly (may require -txindex)
if [ -z "$prev_txs" ] || [ "$prev_txs" = "null" ]; then
    echo "Trying getrawtransaction directly (may require -txindex)..."
    prev_txs=$(${BTC_CLI} getrawtransaction "${txid}" false 2>&1)
    prev_txs_error=$?
    
    if [ $prev_txs_error -ne 0 ]; then
        echo "ERROR: Could not fetch transaction ${txid}"
        echo "Error output: ${prev_txs}"
        echo ""
        echo "Possible solutions:"
        echo "  1. Enable -txindex in your bitcoin.conf and reindex"
        echo "  2. Make sure the transaction is in your wallet"
        echo "  3. Verify the transaction ID is correct: ${txid}"
        echo "  4. Check if the transaction has been confirmed"
        exit 1
    fi
fi

prev_txs=$(echo -n "${prev_txs}" | tr -d '\n\r ')

if [ -z "$prev_txs" ] || [ "$prev_txs" = "null" ]; then
    echo "ERROR: Transaction is empty or null"
    echo "Transaction ID: ${txid}"
    echo "Make sure the transaction exists and is accessible"
    exit 1
fi

echo "Successfully fetched transaction (length: ${#prev_txs} chars)"

export prev_txs
echo "prev_txs length: ${#prev_txs}"

# Set circle address (where updated state will go)
export circle_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"  # TODO: Change to your address

# Build update_state helper if needed
if [ ! -f "./target/release/update_state" ]; then
    echo "Building update_state helper..."
    cargo build --release --bin update_state
fi

# Get previous circle state data from the UTXO
# Can be provided via environment variable or will use default
if [ -z "$prev_circle_state_data" ]; then
    export prev_circle_state_data="REPLACE_WITH_PREV_CIRCLE_STATE_HEX"
fi

# Validate prev_circle_state_data is not a placeholder
if [ "$prev_circle_state_data" = "REPLACE_WITH_PREV_CIRCLE_STATE_HEX" ]; then
    echo "Error: prev_circle_state_data is still set to placeholder value"
    echo ""
    echo "Please provide the previous circle state data in one of these ways:"
    echo "  1. Set environment variable: export prev_circle_state_data='hex_data'"
    echo "  2. Edit the script and replace REPLACE_WITH_PREV_CIRCLE_STATE_HEX"
    echo ""
    echo "To get the previous state data:"
    echo "  - Extract it from the circle UTXO's app data"
    echo "  - Or use the output from a previous serialize_state command"
    echo ""
    exit 1
fi

# Set new member parameters
# NOTE: This must be a DIFFERENT pubkey than the creator's pubkey
# The creator's pubkey is: 023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281
# Use a different pubkey for the new member!
export new_member_pubkey_hex="02ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"  # TODO: Change to new member's pubkey (must be different from creator)
export payout_round=1  # TODO: Set appropriate payout round
export joined_at_timestamp=$(date +%s)

# Update state: add new member
echo "Adding new member with pubkey: ${new_member_pubkey_hex}"
updated_circle_state_data=$(./target/release/update_state add_member \
    "${prev_circle_state_data}" \
    "${new_member_pubkey_hex}" \
    "${payout_round}" \
    "${joined_at_timestamp}" 2>&1)
exit_code=$?

# Check for errors (panics print to stderr, which we captured)
if [ $exit_code -ne 0 ] || echo "$updated_circle_state_data" | grep -qiE "(error|panic|failed|already exists)"; then
    echo "Error: Failed to add member to circle state"
    echo "Error output: ${updated_circle_state_data}"
    echo ""
    echo "Common issues:"
    echo "  - Member already exists (use a different pubkey)"
    echo "  - Invalid payout round (must be less than total members + 1)"
    echo "  - Circle has already started (cannot add members after round 0)"
    exit 1
fi

if [ -z "$updated_circle_state_data" ]; then
    echo "Error: update_state returned empty output"
    exit 1
fi

export updated_circle_state_data
echo "updated_circle_state_data length: ${#updated_circle_state_data}"
echo "✅ Member successfully added to circle state!"

# Run spell check
echo ""
echo "Running spell check for join-circle..."
echo "This validates your Rust logic and state transitions work correctly."
echo ""

cat ./spells/join-circle.yaml | envsubst | charms spell check \
  --prev-txs="${prev_txs}" \
  --app-bins="${app_bin}" || {
    echo ""
    echo "❌ Spell check failed."
    echo "Note: If you see a WASI random_get error, this is a known Charms SDK issue."
    echo "The member addition logic itself worked correctly (see updated_circle_state_data above)."
    echo ""
    exit 1
}

