#!/bin/bash
# Script to run join-circle.yaml spell check

# Build app binary
app_bin=$(charms app build)
export app_bin

# Get verification key
export app_vk=$(charms app vk)

# Set input UTXO (circle state UTXO from previous transaction)
# TODO: Replace with actual circle UTXO
export circle_utxo="REPLACE_WITH_CIRCLE_UTXO"  # Format: txid:index

# Calculate app_id
export app_id=$(echo -n "${circle_utxo}" | sha256sum | cut -d' ' -f1)

# Get previous transaction for circle_utxo
txid=$(echo "${circle_utxo}" | cut -d':' -f1)
echo "Fetching transaction: ${txid}"

# Try gettransaction first (for wallet transactions)
tx_info=$(bitcoin-cli gettransaction "${txid}" 2>&1)
if [ $? -eq 0 ]; then
    if command -v jq &> /dev/null; then
        prev_txs=$(echo "${tx_info}" | jq -r '.hex // empty' 2>/dev/null)
    else
        prev_txs=$(echo "${tx_info}" | sed -n 's/.*"hex"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
    fi
    if [ -n "$prev_txs" ] && [ "$prev_txs" != "null" ]; then
        echo "Got transaction from wallet"
    else
        prev_txs=""
    fi
fi

# If gettransaction didn't work, try getrawtransaction with block hash
if [ -z "$prev_txs" ] || [ "$prev_txs" = "null" ]; then
    tx_verbose=$(bitcoin-cli getrawtransaction "${txid}" true 2>&1)
    if [ $? -eq 0 ]; then
        if command -v jq &> /dev/null; then
            blockhash=$(echo "${tx_verbose}" | jq -r '.blockhash // empty' 2>/dev/null)
        else
            blockhash=$(echo "${tx_verbose}" | sed -n 's/.*"blockhash"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
        fi
        if [ -n "$blockhash" ] && [ "$blockhash" != "null" ]; then
            prev_txs=$(bitcoin-cli getrawtransaction "${txid}" false "${blockhash}" 2>&1)
            if echo "${prev_txs}" | grep -q "error"; then
                prev_txs=""
            fi
        fi
    fi
fi

prev_txs=$(echo -n "${prev_txs}" | tr -d '\n\r ')

if [ -z "$prev_txs" ] || [ "$prev_txs" = "null" ]; then
    echo "Error: Could not fetch transaction ${txid}"
    exit 1
fi

export prev_txs
echo "prev_txs length: ${#prev_txs}"

# Set circle address (where updated state will go)
export circle_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"  # TODO: Change to your address

# Build update_state helper if needed
if [ ! -f "../target/release/update_state" ]; then
    echo "Building update_state helper..."
    (cd .. && cargo build --release --bin update_state)
fi

# TODO: Get previous circle state data from the UTXO
# For now, you need to provide it manually or extract it from the transaction
# This would typically come from querying the UTXO's app data
export prev_circle_state_data="REPLACE_WITH_PREV_CIRCLE_STATE_HEX"

# Set new member parameters
export new_member_pubkey_hex="023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281"  # TODO: Change to new member's pubkey
export payout_round=1  # TODO: Set appropriate payout round
export joined_at_timestamp=$(date +%s)

# Update state: add new member
export updated_circle_state_data=$(../target/release/update_state add_member \
    "${prev_circle_state_data}" \
    "${new_member_pubkey_hex}" \
    "${payout_round}" \
    "${joined_at_timestamp}")

echo "updated_circle_state_data length: ${#updated_circle_state_data}"

# Get funding UTXO and change address for spell prove
# For join-circle, we need a funding UTXO to pay for the transaction
# TODO: Set this to an available UTXO from listunspent
funding_utxo="REPLACE_WITH_FUNDING_UTXO"  # Format: txid:index
funding_utxo_value="5000"  # TODO: Get actual value from listunspent
change_address=$(bitcoin-cli getrawchangeaddress 2>/dev/null || echo "${circle_address}")

# Run spell prove (instead of spell check)
echo ""
echo "Running spell prove for join-circle (this will generate ZK proof and may take ~5 minutes)..."
echo "Funding UTXO: ${funding_utxo}"
echo "Funding value: ${funding_utxo_value} satoshis"
echo "Change address: ${change_address}"
echo ""

cat ../spells/join-circle.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --prev-txs=${prev_txs} \
  --funding-utxo=${funding_utxo} \
  --funding-utxo-value=${funding_utxo_value} \
  --change-address=${change_address}

