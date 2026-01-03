#!/bin/bash
# Test script for create-circle API endpoint

set -e

echo "======================================"
echo "Testing Create Circle API Endpoint"
echo "======================================"
echo ""

# Configuration
API_URL="http://localhost:3001"

# Step 1: Check if server is running
echo "1. Checking if backend server is running..."
if ! curl -s "${API_URL}/health" > /dev/null; then
    echo "❌ Backend server is not running!"
    echo "Please start it with: cd server && npm run dev"
    exit 1
fi
echo "✅ Backend server is running"
echo ""

# Step 2: Get wallet address and pubkey
echo "2. Getting wallet address and pubkey..."
ADDRESSES_RESPONSE=$(curl -s "${API_URL}/api/wallet/addresses")
echo "Addresses Response: $ADDRESSES_RESPONSE"

# Extract first address
CREATOR_PUBKEY=$(echo "$ADDRESSES_RESPONSE" | grep -o '"pubkey":"[^"]*' | head -1 | cut -d'"' -f4)
CREATOR_ADDRESS=$(echo "$ADDRESSES_RESPONSE" | grep -o '"address":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CREATOR_PUBKEY" ]; then
    echo "❌ Could not get wallet address"
    exit 1
fi
echo "✅ Creator pubkey: $CREATOR_PUBKEY"
echo "✅ Creator address: $CREATOR_ADDRESS"
echo ""

# Step 3: Get fresh UTXO for funding
echo "3. Generating fresh UTXO for funding..."
UTXO_RESPONSE=$(curl -s "${API_URL}/api/wallet/utxos/fresh?amount=2000")
echo "UTXO Response: $UTXO_RESPONSE"

FUNDING_UTXO=$(echo "$UTXO_RESPONSE" | grep -o '"utxo":"[^"]*' | cut -d'"' -f4)
FUNDING_AMOUNT=$(echo "$UTXO_RESPONSE" | grep -o '"amount":[0-9]*' | cut -d':' -f2)

if [ -z "$FUNDING_UTXO" ]; then
    echo "❌ Failed to generate UTXO"
    echo "Response: $UTXO_RESPONSE"
    exit 1
fi
echo "✅ Generated UTXO: $FUNDING_UTXO"
echo "✅ UTXO amount: $FUNDING_AMOUNT sats"
echo ""

# Step 4: Create circle
echo "4. Creating circle..."
echo "Request:"
echo "  Purpose: Test Circle for Join Flow"
echo "  Frequency: monthly"
echo "  Contribution: 10 sats"
echo "  Max Members: 5"
echo "  Creator Pubkey: $CREATOR_PUBKEY"
echo "  Funding UTXO: $FUNDING_UTXO"
echo "  Change Address: $CREATOR_ADDRESS"
echo ""

CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/api/spells/build-and-prove" \
  -H "Content-Type: application/json" \
  -d "{
    \"templateName\": \"create-circle\",
    \"parameters\": {
      \"contribution_per_round\": \"10\",
      \"round_duration\": \"2592000\",
      \"created_at_timestamp\": \"$(date +%s)\",
      \"creator_pubkey_hex\": \"${CREATOR_PUBKEY}\",
      \"purpose\": \"Test Circle for Join Flow\",
      \"max_members\": \"5\",
      \"circle_address\": \"${CREATOR_ADDRESS}\",
      \"in_utxo_0\": \"${FUNDING_UTXO}\"
    },
    \"appBin\": \"./target/wasm32-wasip1/release/charmcircle.wasm\",
    \"prevTxs\": \"\",
    \"fundingUtxo\": \"${FUNDING_UTXO}\",
    \"fundingUtxoValue\": ${FUNDING_AMOUNT},
    \"changeAddress\": \"${CREATOR_ADDRESS}\"
  }")

echo "Response:"
echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Step 5: Check if successful
if echo "$CREATE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Circle created successfully!"

    # Extract circle ID if available
    CIRCLE_ID=$(echo "$CREATE_RESPONSE" | grep -o '"circleId":"[^"]*' | cut -d'"' -f4)
    if [ -n "$CIRCLE_ID" ]; then
        echo "📝 Circle ID: $CIRCLE_ID"
    fi

    # Extract PSBT if available
    PSBT=$(echo "$CREATE_RESPONSE" | grep -o '"psbt":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ -n "$PSBT" ]; then
        echo "📝 PSBT created (length: ${#PSBT} characters)"
    fi
else
    echo "❌ Circle creation failed!"
    ERROR=$(echo "$CREATE_RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
    if [ -n "$ERROR" ]; then
        echo "Error: $ERROR"
    fi
    exit 1
fi

echo ""
echo "======================================"
echo "Test Complete!"
echo "======================================"
