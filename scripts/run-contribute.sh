#!/bin/bash
# Script to run contribute.yaml spell check

# Build app binary
app_bin=$(charms app build)
export app_bin

# Get verification key
export app_vk=$(charms app vk)

# Set input UTXOs
export circle_utxo="REPLACE_WITH_CIRCLE_UTXO"  # Format: txid:index
export contribution_utxo="REPLACE_WITH_CONTRIBUTION_UTXO"  # Format: txid:index

# Calculate app_id (use circle_utxo for app_id)
export app_id=$(echo -n "${circle_utxo}" | sha256sum | cut -d' ' -f1)

# Get previous transactions
echo "Fetching transactions..."

# Get circle transaction
circle_txid=$(echo "${circle_utxo}" | cut -d':' -f1)
circle_tx_info=$(bitcoin-cli gettransaction "${circle_txid}" 2>&1)
if [ $? -eq 0 ]; then
    if command -v jq &> /dev/null; then
        circle_tx=$(echo "${circle_tx_info}" | jq -r '.hex // empty' 2>/dev/null)
    else
        circle_tx=$(echo "${circle_tx_info}" | sed -n 's/.*"hex"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
    fi
fi

# Get contribution transaction
contrib_txid=$(echo "${contribution_utxo}" | cut -d':' -f1)
contrib_tx_info=$(bitcoin-cli gettransaction "${contrib_txid}" 2>&1)
if [ $? -eq 0 ]; then
    if command -v jq &> /dev/null; then
        contrib_tx=$(echo "${contrib_tx_info}" | jq -r '.hex // empty' 2>/dev/null)
    else
        contrib_tx=$(echo "${contrib_tx_info}" | sed -n 's/.*"hex"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null)
    fi
fi

# Combine transactions for prev_txs (space-separated or as needed by charms)
# Note: charms might need them in a specific format - check documentation
export prev_txs="${circle_tx} ${contrib_tx}"
prev_txs=$(echo -n "${prev_txs}" | tr -d '\n\r ')

echo "prev_txs length: ${#prev_txs}"

# Set addresses
export circle_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"  # TODO: Change to your address
export contributor_address="tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql"  # TODO: Change to contributor's address

# Build update_state helper if needed
if [ ! -f "../target/release/update_state" ]; then
    echo "Building update_state helper..."
    (cd .. && cargo build --release --bin update_state)
fi

# TODO: Get previous circle state data from the circle UTXO
export prev_circle_state_data="REPLACE_WITH_PREV_CIRCLE_STATE_HEX"

# Set contribution parameters
export contributor_pubkey_hex="023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281"  # TODO: Change to contributor's pubkey
export contribution_amount=100000  # TODO: Set contribution amount in satoshis
export contribution_timestamp=$(date +%s)
export txid_hex="0000000000000000000000000000000000000000000000000000000000000000"  # TODO: This will be the actual txid after transaction is created
export current_round=0  # TODO: Get from previous state

# Update state: record contribution
export updated_circle_state_data=$(../target/release/update_state record_contribution \
    "${prev_circle_state_data}" \
    "${contributor_pubkey_hex}" \
    "${contribution_amount}" \
    "${contribution_timestamp}" \
    "${txid_hex}")

echo "updated_circle_state_data length: ${#updated_circle_state_data}"

# Set NFT parameters
export nft_ticker="SEALED_SCROLL"

# Get funding UTXO and change address for spell prove
# For contribute, the contribution_utxo is used, but we may need additional funding
# TODO: Set this if additional funding is needed
funding_utxo="${contribution_utxo}"  # Use contribution UTXO as funding
funding_utxo_value="5000"  # TODO: Get actual value from listunspent
change_address=$(bitcoin-cli getrawchangeaddress 2>/dev/null || echo "${contributor_address}")

# Run spell prove (instead of spell check)
echo ""
echo "Running spell prove for contribute (this will generate ZK proof and may take ~5 minutes)..."
echo "Funding UTXO: ${funding_utxo}"
echo "Funding value: ${funding_utxo_value} satoshis"
echo "Change address: ${change_address}"
echo ""

cat ../spells/contribute.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --prev-txs=${prev_txs} \
  --funding-utxo=${funding_utxo} \
  --funding-utxo-value=${funding_utxo_value} \
  --change-address=${change_address}

