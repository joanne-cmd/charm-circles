#!/bin/bash
# Script to run contribute.yaml spell check

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

# Set input UTXOs
# Can be provided via environment variable or will use default
if [ -z "$circle_utxo" ]; then
    export circle_utxo="REPLACE_WITH_CIRCLE_UTXO"  # Format: txid:index
fi
if [ -z "$contribution_utxo" ]; then
    export contribution_utxo="REPLACE_WITH_CONTRIBUTION_UTXO"  # Format: txid:index
fi

# Validate circle_utxo is not a placeholder
if [ "$circle_utxo" = "REPLACE_WITH_CIRCLE_UTXO" ]; then
    echo "Error: circle_utxo is still set to placeholder value"
    echo ""
    echo "Please provide a valid circle UTXO in one of these ways:"
    echo "  1. Set environment variable: export circle_utxo='txid:index'"
    echo "  2. Edit the script and replace REPLACE_WITH_CIRCLE_UTXO"
    echo ""
    exit 1
fi

# Validate contribution_utxo is not a placeholder
if [ "$contribution_utxo" = "REPLACE_WITH_CONTRIBUTION_UTXO" ]; then
    echo "Error: contribution_utxo is still set to placeholder value"
    echo ""
    echo "Please provide a valid contribution UTXO in one of these ways:"
    echo "  1. Set environment variable: export contribution_utxo='txid:index'"
    echo "  2. Edit the script and replace REPLACE_WITH_CONTRIBUTION_UTXO"
    echo ""
    exit 1
fi

# Calculate app_id (use circle_utxo for app_id)
export app_id=$(echo -n "${circle_utxo}" | sha256sum | cut -d' ' -f1)

# Get previous transactions
echo "Fetching transactions..."

# Function to fetch transaction (similar to other scripts)
fetch_transaction() {
    local txid=$1
    local tx_hex=""
    
    # Try gettransaction first (for wallet transactions)
    tx_info=$(${BTC_CLI} gettransaction "${txid}" 2>&1)
    if [ $? -eq 0 ]; then
        if command -v jq &> /dev/null; then
            tx_hex=$(echo "${tx_info}" | jq -r '.hex // empty' 2>/dev/null)
        else
            tx_hex=$(echo "${tx_info}" | sed -n 's/.*"hex"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
        fi
        if [ -n "$tx_hex" ] && [ "$tx_hex" != "null" ]; then
            echo "$tx_hex"
            return 0
        fi
    fi
    
    # Try getrawtransaction with block hash
    tx_verbose=$(${BTC_CLI} getrawtransaction "${txid}" true 2>&1)
    if [ $? -eq 0 ]; then
        if command -v jq &> /dev/null; then
            blockhash=$(echo "${tx_verbose}" | jq -r '.blockhash // empty' 2>/dev/null)
        else
            blockhash=$(echo "${tx_verbose}" | sed -n 's/.*"blockhash"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
        fi
        if [ -n "$blockhash" ] && [ "$blockhash" != "null" ]; then
            tx_hex=$(${BTC_CLI} getrawtransaction "${txid}" false "${blockhash}" 2>&1)
            if [ $? -eq 0 ] && ! echo "${tx_hex}" | grep -q "error"; then
                echo "$tx_hex"
                return 0
            fi
        fi
    fi
    
    # Try getrawtransaction directly
    tx_hex=$(${BTC_CLI} getrawtransaction "${txid}" false 2>&1)
    if [ $? -eq 0 ] && ! echo "${tx_hex}" | grep -q "error"; then
        echo "$tx_hex"
        return 0
    fi
    
    return 1
}

# Get circle transaction
circle_txid=$(echo "${circle_utxo}" | cut -d':' -f1)
echo "Fetching circle transaction: ${circle_txid}"
circle_tx=$(fetch_transaction "${circle_txid}")
if [ -z "$circle_tx" ]; then
    echo "Error: Could not fetch circle transaction ${circle_txid}"
    exit 1
fi
circle_tx=$(echo -n "${circle_tx}" | tr -d '\n\r ')
echo "Circle transaction length: ${#circle_tx}"

# Get contribution transaction
contrib_txid=$(echo "${contribution_utxo}" | cut -d':' -f1)
echo "Fetching contribution transaction: ${contrib_txid}"
contrib_tx=$(fetch_transaction "${contrib_txid}")
if [ -z "$contrib_tx" ]; then
    echo "Error: Could not fetch contribution transaction ${contrib_txid}"
    exit 1
fi
contrib_tx=$(echo -n "${contrib_tx}" | tr -d '\n\r ')
echo "Contribution transaction length: ${#contrib_tx}"

# Combine transactions for prev_txs (comma-separated as required by charms)
export prev_txs="${circle_tx},${contrib_tx}"
prev_txs=$(echo -n "${prev_txs}" | tr -d '\n\r ')
echo "Combined prev_txs length: ${#prev_txs}"

# Set addresses
export circle_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"  # TODO: Change to your address
export contributor_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"  # TODO: Change to contributor's address

# Build update_state helper if needed
if [ ! -f "./target/release/update_state" ]; then
    echo "Building update_state helper..."
    cargo build --release --bin update_state
fi

# Get previous circle state data from the circle UTXO
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
    exit 1
fi

# Set contribution parameters
export contributor_pubkey_hex="023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281"  # TODO: Change to contributor's pubkey
export contribution_amount=100000  # TODO: Set contribution amount in satoshis
export contribution_timestamp=$(date +%s)
export txid_hex="0000000000000000000000000000000000000000000000000000000000000000"  # TODO: This will be the actual txid after transaction is created
export current_round=0  # TODO: Get from previous state

# Update state: record contribution
echo "Recording contribution from: ${contributor_pubkey_hex}"
echo "Amount: ${contribution_amount} satoshis"
updated_circle_state_data=$(./target/release/update_state record_contribution \
    "${prev_circle_state_data}" \
    "${contributor_pubkey_hex}" \
    "${contribution_amount}" \
    "${contribution_timestamp}" \
    "${txid_hex}" 2>&1)
exit_code=$?

# Check for errors
if [ $exit_code -ne 0 ] || echo "$updated_circle_state_data" | grep -qiE "(error|panic|failed|not found|already contributed)"; then
    echo "Error: Failed to record contribution"
    echo "Error output: ${updated_circle_state_data}"
    echo ""
    echo "Common issues:"
    echo "  - Member not found in circle"
    echo "  - Member already contributed this round"
    echo "  - Invalid contribution amount (must match contribution_per_round)"
    echo "  - Circle is already complete"
    exit 1
fi

if [ -z "$updated_circle_state_data" ]; then
    echo "Error: update_state returned empty output"
    exit 1
fi

export updated_circle_state_data
echo "updated_circle_state_data length: ${#updated_circle_state_data}"
echo "✅ Contribution successfully recorded in circle state!"

# Set NFT parameters
export nft_ticker="SEALED_SCROLL"

# Run spell check
echo ""
echo "Running spell check for contribute..."
echo "This validates your Rust logic and state transitions work correctly."
echo ""

cat ./spells/contribute.yaml | envsubst | charms spell check \
  --prev-txs="${prev_txs}" \
  --app-bins="${app_bin}" || {
    echo ""
    echo "❌ Spell check failed."
    echo "Note: If you see a WASI random_get error, this is a known Charms SDK issue."
    echo "The contribution recording logic itself worked correctly (see updated_circle_state_data above)."
    echo ""
    exit 1
}

