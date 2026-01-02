#!/bin/bash
# Helper script to find circle UTXO(s)

cd "$(dirname "$0")/.." || exit 1

BTC_CLI="${BTC_CLI:-bitcoin-cli} -testnet4"

# Load wallet if needed
if ! ${BTC_CLI} listwallets 2>/dev/null | grep -q "charmcircle-dev"; then
    echo "Loading wallet..."
    ${BTC_CLI} loadwallet charmcircle-dev >/dev/null 2>&1 || true
fi

echo "=== Finding Circle UTXO(s) ==="
echo ""

# Get circle address from script or use default
CIRCLE_ADDRESS="${circle_address:-tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql}"

echo "Looking for UTXOs at circle address: ${CIRCLE_ADDRESS}"
echo ""

# List unspent outputs at the circle address
echo "Unspent outputs at circle address:"
unspent=$(${BTC_CLI} listunspent 0 9999999 "[\"${CIRCLE_ADDRESS}\"]" 2>&1)

if command -v jq &> /dev/null; then
    echo "$unspent" | jq -r '.[] | "  UTXO: \(.txid):\(.vout)\n  Amount: \(.amount) BTC\n  Confirmations: \(.confirmations)\n"'
    
    # Extract UTXOs
    utxos=$(echo "$unspent" | jq -r '.[] | "\(.txid):\(.vout)"')
else
    echo "$unspent"
    # Try to extract UTXOs manually
    utxos=$(echo "$unspent" | grep -oE '"txid"[[:space:]]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)".*/\1/' | head -1)
    vouts=$(echo "$unspent" | grep -oE '"vout"[[:space:]]*:[[:space:]]*[0-9]+' | sed 's/.*:[[:space:]]*\([0-9]*\).*/\1/' | head -1)
    if [ -n "$utxos" ] && [ -n "$vouts" ]; then
        utxos="${utxos}:${vouts}"
    fi
fi

echo ""
echo "=== Recent transactions (looking for create-circle transactions) ==="
echo ""

# Check recent transactions
recent_txs=$(${BTC_CLI} listtransactions "*" 50 2>&1)

if command -v jq &> /dev/null; then
    # Show transactions that sent to circle address or received from it
    echo "$recent_txs" | jq -r '.[] | select(.address == "'"${CIRCLE_ADDRESS}"'" or .category == "send") | "  TXID: \(.txid)\n  Category: \(.category)\n  Amount: \(.amount)\n  Confirmations: \(.confirmations)\n  Address: \(.address // "N/A")\n"'
    
    # Find send transactions (these might be create-circle transactions)
    send_txs=$(echo "$recent_txs" | jq -r '.[] | select(.category == "send") | .txid')
    
    if [ -n "$send_txs" ]; then
        echo ""
        echo "=== Potential create-circle transactions (send transactions) ==="
        for txid in $send_txs; do
            echo "  TXID: $txid"
            # Get transaction details
            tx_details=$(${BTC_CLI} gettransaction "$txid" 2>&1)
            if [ $? -eq 0 ]; then
                if command -v jq &> /dev/null; then
                    echo "$tx_details" | jq -r '  Details: Sent \(.amount | tostring) BTC, Confirmations: \(.confirmations)'
                fi
            fi
        done
    fi
else
    echo "$recent_txs"
fi

echo ""
echo "=== Summary ==="
echo ""
if [ -n "$utxos" ]; then
    echo "Found UTXO(s) at circle address:"
    if command -v jq &> /dev/null; then
        echo "$unspent" | jq -r '.[] | "  \(.txid):\(.vout)"'
    else
        echo "  $utxos"
    fi
    echo ""
    echo "To use one of these as circle_utxo, run:"
    echo "  export circle_utxo='txid:index'"
    echo "  ./scripts/run-join-circle.sh"
else
    echo "No UTXOs found at circle address: ${CIRCLE_ADDRESS}"
    echo ""
    echo "This means either:"
    echo "  1. You haven't created a circle yet (run ./scripts/run-create-circle.sh first)"
    echo "  2. The circle UTXO has already been spent"
    echo "  3. The circle address is different"
fi

echo ""
echo "=== All unspent outputs in wallet ==="
all_unspent=$(${BTC_CLI} listunspent 0 9999999 2>&1)
if command -v jq &> /dev/null; then
    echo "$all_unspent" | jq -r '.[] | "  \(.txid):\(.vout) - \(.amount) BTC - \(.address)"'
else
    echo "$all_unspent"
fi

