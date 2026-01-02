#!/bin/bash
# Check if a UTXO transaction is confirmed

TXID="${1:-ecdb435b7d645f50b7380faed72978952e687a5833e6d08df55555498af5f7dc}"

BTC_CLI="${BTC_CLI:-bitcoin-cli -testnet4}"

echo "Checking confirmation status for transaction: ${TXID}"
echo ""

while true; do
    CONFIRMATIONS=$(${BTC_CLI} gettransaction "${TXID}" 2>/dev/null | grep -o '"confirmations": [0-9]*' | grep -o '[0-9]*' || echo "0")
    
    if [ -z "${CONFIRMATIONS}" ]; then
        CONFIRMATIONS=0
    fi
    
    if [ "${CONFIRMATIONS}" -gt "0" ]; then
        echo "✅ Transaction confirmed! (${CONFIRMATIONS} confirmations)"
        echo ""
        echo "Available UTXOs from this transaction:"
        ${BTC_CLI} listunspent 0 9999999 | python3 -c "
import sys, json
data = json.load(sys.stdin)
utxos = [u for u in data if u['txid'] == '${TXID}']
for u in utxos:
    print(f\"  UTXO: {u['txid']}:{u['vout']}\")
    print(f\"  Amount: {u['amount']} BTC ({int(u['amount']*100000000)} sats)\")
    print(f\"  Confirmations: {u['confirmations']}\")
    print()
" 2>/dev/null || ${BTC_CLI} listunspent 0 9999999 | grep -A 5 "${TXID}"
        break
    else
        echo -n "Waiting for confirmation... (${CONFIRMATIONS} confirmations) "
        date +"%H:%M:%S"
        sleep 10
    fi
done

