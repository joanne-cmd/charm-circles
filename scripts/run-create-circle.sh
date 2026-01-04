#!/bin/bash
# Simplified command to run create-circle.yaml - run this step by step to debug

# Change to project root directory
cd "$(dirname "$0")/.." || exit 1

# Bitcoin CLI command (use -testnet4 for testnet, remove for mainnet)
BTC_CLI="bitcoin-cli -testnet4"

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

# Set input UTXO
export in_utxo_0="85c17708ba4923f90bdffd43d07c69ac93529514a2ee99fa236ccddffab6cc48:1"

# Calculate app_id
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)

# Get previous transaction - this is the critical part
txid=$(echo "${in_utxo_0}" | cut -d':' -f1)
echo "Fetching transaction: ${txid}"

# Try gettransaction first (for wallet transactions)
echo "Trying gettransaction (for wallet transactions)..."
tx_info=$(${BTC_CLI} gettransaction "${txid}" 2>&1)
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
    prev_txs=$(${BTC_CLI} getrawtransaction "${txid}" false 2>&1)
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

# Run spell check
echo ""
echo "Running spell check..."
echo ""

cat ./spells/create-circle.yaml | envsubst | charms spell check \
  --prev-txs="${prev_txs}" \
  --app-bins="${app_bin}" || {
    echo ""
    echo "❌ Spell check failed."
    echo "Note: If you see a WASI random_get error, this is a known Charms SDK issue."
    echo ""
    exit 1
}

