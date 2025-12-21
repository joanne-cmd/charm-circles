#!/bin/bash
# Simplified command to run create-circle.yaml - run this step by step to debug

# Change to project root directory
cd "$(dirname "$0")/.." || exit 1

# Build app binary
app_bin=$(charms app build 2>&1 | tail -1)
if [ -z "$app_bin" ] || [ ! -f "$app_bin" ]; then
    echo "Error: Failed to build app binary or binary not found"
    echo "Trying alternative path..."
    app_bin="./target/wasm32-wasip1/release/charmcircle.wasm"
    if [ ! -f "$app_bin" ]; then
        echo "Error: App binary not found at $app_bin"
        exit 1
    fi
fi
export app_bin
echo "Using app_bin: ${app_bin}"

# Get verification key
export app_vk=$(charms app vk)

# Set input UTXO
export in_utxo_0="85c17708ba4923f90bdffd43d07c69ac93529514a2ee99fa236ccddffab6cc48:1"

# Calculate app_id
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)

# Get previous transaction - this is the critical part
txid=$(echo "${in_utxo_0}" | cut -d':' -f1)
echo "Fetching transaction: ${txid}"

# Try gettransaction first (for wallet transactions)
echo "Trying gettransaction (for wallet transactions)..."
tx_info=$(bitcoin-cli gettransaction "${txid}" 2>&1)
tx_info_error=$?

if [ $tx_info_error -eq 0 ]; then
    # Extract hex from JSON - try jq first, then fallback to sed
    if command -v jq &> /dev/null; then
        prev_txs=$(echo "${tx_info}" | jq -r '.hex // empty' 2>/dev/null)
    else
        # Fallback: extract hex field from JSON using sed
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
    
    # Get transaction info to find block hash
    tx_verbose=$(bitcoin-cli getrawtransaction "${txid}" true 2>&1)
    if [ $? -eq 0 ]; then
        if command -v jq &> /dev/null; then
            blockhash=$(echo "${tx_verbose}" | jq -r '.blockhash // empty' 2>/dev/null)
        else
            blockhash=$(echo "${tx_verbose}" | sed -n 's/.*"blockhash"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
        fi
        if [ -n "$blockhash" ] && [ "$blockhash" != "null" ]; then
            echo "Found block hash: ${blockhash}"
            prev_txs=$(bitcoin-cli getrawtransaction "${txid}" false "${blockhash}" 2>&1)
            if [ $? -ne 0 ]; then
                prev_txs=""
            else
                # Remove any error messages
                if echo "${prev_txs}" | grep -q "error"; then
                    prev_txs=""
                fi
            fi
        fi
    fi
fi

# If still no luck, try getrawtransaction with -txindex (if available)
if [ -z "$prev_txs" ] || [ "$prev_txs" = "null" ]; then
    echo "Trying getrawtransaction directly (may require -txindex)..."
    prev_txs=$(bitcoin-cli getrawtransaction "${txid}" false 2>&1)
    prev_txs_error=$?
    
    if [ $prev_txs_error -ne 0 ]; then
        echo "ERROR: Could not fetch transaction ${txid}"
        echo "Error: ${prev_txs}"
        echo ""
        echo "Possible solutions:"
        echo "  1. Enable -txindex in your bitcoin.conf and reindex"
        echo "  2. Use gettransaction if the transaction is in your wallet"
        echo "  3. Provide the block hash manually"
        exit 1
    fi
fi

# Remove any whitespace/newlines
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
echo "prev_txs preview: ${prev_txs:0:200}..."

# Set circle address
export circle_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"

# Build serialization helper if needed
if [ ! -f "./target/release/serialize_state" ]; then
    echo "Building serialize_state helper..."
    cargo build --release --bin serialize_state
fi

# Serialize CircleState
circle_id_hex=$(openssl rand -hex 32)
contribution_per_round=100000
round_duration=2592000
created_at=$(date +%s)
creator_pubkey_hex="023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281"

export circle_state_serialized=$(./target/release/serialize_state \
    "${circle_id_hex}" \
    "${contribution_per_round}" \
    "${round_duration}" \
    "${created_at}" \
    "${creator_pubkey_hex}")

echo "circle_state_serialized length: ${#circle_state_serialized}"
echo "circle_state_serialized preview: ${circle_state_serialized:0:200}..."

# Get funding UTXO and change address for spell prove
funding_utxo="${in_utxo_0}"

# Try to get UTXO value from listunspent
funding_utxo_value=$(bitcoin-cli listunspent | \
    grep -A5 "${funding_utxo}" | \
    grep '"amount"' | \
    sed 's/.*"amount"[[:space:]]*:[[:space:]]*\([0-9.]*\).*/\1/' | \
    awk '{printf "%.0f", $1 * 100000000}' 2>/dev/null || echo "5000")

if [ -z "$funding_utxo_value" ] || [ "$funding_utxo_value" = "0" ]; then
    funding_utxo_value="5000"  # Fallback value
fi

change_address=$(bitcoin-cli getrawchangeaddress 2>/dev/null || echo "${circle_address}")

# Run spell prove (instead of spell check)
echo ""
echo "Running spell prove (this will generate ZK proof and may take ~5 minutes)..."
echo "Funding UTXO: ${funding_utxo}"
echo "Funding value: ${funding_utxo_value} satoshis"
echo "Change address: ${change_address}"
echo ""

# Debug: Verify app_bin is set
if [ -z "${app_bin}" ]; then
    echo "ERROR: app_bin is empty! Trying to set it manually..."
    app_bin="./target/wasm32-wasip1/release/charmcircle.wasm"
    if [ ! -f "${app_bin}" ]; then
        echo "ERROR: Cannot find app binary at ${app_bin}"
        exit 1
    fi
    export app_bin
fi

echo "Debug: app_bin = [${app_bin}]"
echo "Debug: app_bin exists = $([ -f "${app_bin}" ] && echo "yes" || echo "no")"
echo ""

cat ./spells/create-circle.yaml | envsubst | charms spell prove \
  --app-bins="${app_bin}" \
  --prev-txs="${prev_txs}" \
  --funding-utxo="${funding_utxo}" \
  --funding-utxo-value="${funding_utxo_value}" \
  --change-address="${change_address}"

