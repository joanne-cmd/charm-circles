# Bitcoin Wallet Setup

## Wallet Name

The scripts use the wallet: **`charmcircle-dev`**

## Loading the Wallet

### Manual Load

```bash
bitcoin-cli -testnet4 loadwallet charmcircle-dev
```

### Automatic Load

All scripts now automatically load the wallet if it's not already loaded.

### Helper Script

```bash
cd scripts
./load-wallet.sh
```

## Verify Wallet is Loaded

```bash
bitcoin-cli -testnet4 listwallets
```

Should show:
```json
[
  "charmcircle-dev"
]
```

## Common Commands

### Get New Address
```bash
bitcoin-cli -testnet4 getnewaddress
```

### List Unspent Outputs
```bash
bitcoin-cli -testnet4 listunspent
```

### Get Change Address
```bash
bitcoin-cli -testnet4 getrawchangeaddress
```

### Check Wallet Balance
```bash
bitcoin-cli -testnet4 getbalance
```

## Troubleshooting

### Error: "No wallet is loaded"

**Solution:**
```bash
bitcoin-cli -testnet4 loadwallet charmcircle-dev
```

### Error: "Wallet file not found"

**Solution:** Create a new wallet:
```bash
bitcoin-cli -testnet4 createwallet charmcircle-dev
```

Then load it:
```bash
bitcoin-cli -testnet4 loadwallet charmcircle-dev
```

### Wallet Not Persisting

If the wallet doesn't stay loaded after restarting Bitcoin Core, you may need to configure it to auto-load in `bitcoin.conf`:

```
testnet=1
wallet=charmcircle-dev
```

## Note

All scripts use `bitcoin-cli -testnet4` for testnet. If you're using mainnet, you'll need to:
1. Remove `-testnet4` flags
2. Update wallet name if different
3. Update scripts accordingly

