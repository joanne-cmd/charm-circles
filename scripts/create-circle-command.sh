#!/bin/bash
# Command sequence to run create-circle.yaml spell check

# Step 1: Build the app binary
app_bin=$(charms app build)
export app_bin

# Step 2: Get the verification key
export app_vk=$(charms app vk)

# Step 3: Set the input UTXO (from your listunspent output)
export in_utxo_0="85c17708ba4923f90bdffd43d07c69ac93529514a2ee99fa236ccddffab6cc48:1"

# Step 4: Calculate app_id (SHA256 of the input UTXO)
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)

# Step 5: Get the previous transaction (raw hex)
# Extract txid from UTXO
txid=$(echo "${in_utxo_0}" | cut -d':' -f1)
echo "Fetching transaction ${txid}..."

# Try gettransaction first (for wallet transactions)
tx_info=$(bitcoin-cli gettransaction "${txid}" 2>&1)
if [ $? -eq 0 ]; then
    # Extract hex from JSON - try jq first, then fallback to sed
    if command -v jq &> /dev/null; then
        prev_txs_raw=$(echo "${tx_info}" | jq -r '.hex // empty' 2>/dev/null)
    else
        prev_txs_raw=$(echo "${tx_info}" | sed -n 's/.*"hex"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
    fi
    if [ -n "$prev_txs_raw" ] && [ "$prev_txs_raw" != "null" ]; then
        echo "Got transaction from wallet using gettransaction"
    else
        prev_txs_raw=""
    fi
fi

# If gettransaction didn't work, try getrawtransaction with block hash
if [ -z "$prev_txs_raw" ] || [ "$prev_txs_raw" = "null" ]; then
    tx_verbose=$(bitcoin-cli getrawtransaction "${txid}" true 2>&1)
    if [ $? -eq 0 ]; then
        if command -v jq &> /dev/null; then
            blockhash=$(echo "${tx_verbose}" | jq -r '.blockhash // empty' 2>/dev/null)
        else
            blockhash=$(echo "${tx_verbose}" | sed -n 's/.*"blockhash"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
        fi
        if [ -n "$blockhash" ] && [ "$blockhash" != "null" ]; then
            prev_txs_raw=$(bitcoin-cli getrawtransaction "${txid}" false "${blockhash}" 2>&1)
            if echo "${prev_txs_raw}" | grep -q "error"; then
                prev_txs_raw=""
            fi
        fi
    fi
fi

# Remove any whitespace/newlines
prev_txs_raw=$(echo -n "${prev_txs_raw}" | tr -d '\n\r ')

if [ -z "$prev_txs_raw" ] || [ "$prev_txs_raw" = "null" ]; then
    echo "Error: Could not fetch transaction ${txid}"
    echo "Try: bitcoin-cli gettransaction ${txid}"
    exit 1
fi

export prev_txs="${prev_txs_raw}"
echo "Got prev_txs (length: ${#prev_txs} chars, first 100: ${prev_txs:0:100}...)"

# Step 6: Set circle address (you'll need to provide this)
# For now, using the address from your listunspent output as an example
export circle_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"

# Step 7: Serialize CircleState
# First, build the serialization helper
cargo build --release --bin serialize_state

# Generate circle_id (32 random bytes as hex)
circle_id_hex=$(openssl rand -hex 32)

# Set circle parameters
contribution_per_round=100000  # 0.001 BTC in satoshis
round_duration=2592000  # 30 days in seconds
created_at=$(date +%s)

# Get creator pubkey from the descriptor in listunspent output
# The pubkey is: 023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281
creator_pubkey_hex="023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281"

# Serialize the circle state
export circle_state_serialized=$(./target/release/serialize_state \
    "${circle_id_hex}" \
    "${contribution_per_round}" \
    "${round_duration}" \
    "${created_at}" \
    "${creator_pubkey_hex}")

# Step 8: Get funding UTXO and change address for spell prove
funding_utxo="${in_utxo_0}"
# Get UTXO value from listunspent (you may need to adjust this)
funding_utxo_value="5000"  # TODO: Get actual value from listunspent
change_address=$(bitcoin-cli getrawchangeaddress 2>/dev/null || echo "${circle_address}")

# Step 9: Run spell prove (instead of spell check)
# This will generate ZK proof and may take ~5 minutes
echo ""
echo "Running spell prove (this will generate ZK proof and may take ~5 minutes)..."
echo "Funding UTXO: ${funding_utxo}"
echo "Funding value: ${funding_utxo_value} satoshis"
echo "Change address: ${change_address}"
echo ""

cat ../spells/create-circle.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --prev-txs=${prev_txs} \
  --funding-utxo=${funding_utxo} \
  --funding-utxo-value=${funding_utxo_value} \
  --change-address=${change_address}


