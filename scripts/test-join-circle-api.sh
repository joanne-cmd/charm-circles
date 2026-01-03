#!/bin/bash
# Test script for join-circle API endpoint

set -e

echo "======================================"
echo "Testing Join Circle API Endpoint"
echo "======================================"
echo ""

# Configuration
API_URL="http://localhost:3001"
CIRCLE_ID="${CIRCLE_ID:-9b451fcc13d911bc0725e38d89b8a21856072bba7ed547b711ac70497708cfa6}"  # Test circle (can override with env var)

# Step 1: Check if server is running
echo "1. Checking if backend server is running..."
if ! curl -s "${API_URL}/health" > /dev/null; then
    echo "❌ Backend server is not running!"
    echo "Please start it with: cd server && npm start"
    exit 1
fi
echo "✅ Backend server is running"
echo ""

# Step 2: Get fresh UTXO for joining
echo "2. Generating fresh UTXO for joiner..."
UTXO_RESPONSE=$(curl -s "${API_URL}/api/wallet/utxos/fresh?amount=2000")
echo "UTXO Response: $UTXO_RESPONSE"

FUNDING_UTXO=$(echo "$UTXO_RESPONSE" | grep -o '"utxo":"[^"]*' | cut -d'"' -f4)
if [ -z "$FUNDING_UTXO" ]; then
    echo "❌ Failed to generate UTXO"
    echo "Response: $UTXO_RESPONSE"
    exit 1
fi
echo "✅ Generated UTXO: $FUNDING_UTXO"
echo ""

# Step 3: Get wallet addresses
echo "3. Getting wallet addresses..."
ADDRESSES_RESPONSE=$(curl -s "${API_URL}/api/wallet/addresses")
echo "Addresses Response: $ADDRESSES_RESPONSE"

# Extract second address pubkey (for joiner, assuming first address created the circle)
JOINER_PUBKEY=$(echo "$ADDRESSES_RESPONSE" | grep -o '"pubkey":"[^"]*' | sed -n '2p' | cut -d'"' -f4)
JOINER_ADDRESS=$(echo "$ADDRESSES_RESPONSE" | grep -o '"address":"[^"]*' | sed -n '2p' | cut -d'"' -f4)

if [ -z "$JOINER_PUBKEY" ]; then
    echo "❌ Could not find second wallet address"
    echo "Response: $ADDRESSES_RESPONSE"
    exit 1
fi
echo "✅ Joiner pubkey: $JOINER_PUBKEY"
echo "✅ Joiner address: $JOINER_ADDRESS"
echo ""

# Step 4: Get circle details
echo "4. Getting circle details..."
CIRCLE_RESPONSE=$(curl -s "${API_URL}/api/circles")
echo "Circle found with ID: $CIRCLE_ID"
echo ""

# Step 5: Test join-circle endpoint
echo "5. Calling join-circle API..."
echo "Request:"
echo "  Circle ID: $CIRCLE_ID"
echo "  Joiner Pubkey: $JOINER_PUBKEY"
echo "  Funding UTXO: $FUNDING_UTXO"
echo "  Change Address: $JOINER_ADDRESS"
echo ""

JOIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/circles/${CIRCLE_ID}/join" \
  -H "Content-Type: application/json" \
  -d "{
    \"joinerPubkey\": \"${JOINER_PUBKEY}\",
    \"fundingUtxo\": \"${FUNDING_UTXO}\",
    \"changeAddress\": \"${JOINER_ADDRESS}\"
  }")

echo "Response:"
echo "$JOIN_RESPONSE" | jq '.' 2>/dev/null || echo "$JOIN_RESPONSE"
echo ""

# Step 6: Check if successful
if echo "$JOIN_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Join circle successful!"

    # Extract transaction if available
    TX=$(echo "$JOIN_RESPONSE" | grep -o '"transaction":"[^"]*' | cut -d'"' -f4)
    if [ -n "$TX" ]; then
        echo "📝 Transaction: ${TX:0:64}..."
    fi

    # Check new member count
    NEW_MEMBER_COUNT=$(echo "$JOIN_RESPONSE" | grep -o '"newMemberCount":[0-9]*' | cut -d':' -f2)
    if [ -n "$NEW_MEMBER_COUNT" ]; then
        echo "👥 New member count: $NEW_MEMBER_COUNT"
    fi
else
    echo "❌ Join circle failed!"
    ERROR=$(echo "$JOIN_RESPONSE" | grep -o '"error":"[^"]*' | cut -d'"' -f4)
    if [ -n "$ERROR" ]; then
        echo "Error: $ERROR"
    fi
    exit 1
fi

echo ""
echo "======================================"
echo "Test Complete!"
echo "======================================"
