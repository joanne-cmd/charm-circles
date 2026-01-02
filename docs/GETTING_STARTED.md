# Getting Started with CharmCircle

This guide walks you through setting up and testing CharmCircle on Bitcoin testnet4.

## Prerequisites

Before you begin, ensure you have:

- ✅ Rust toolchain with WASM support
- ✅ Node.js 18 or higher
- ✅ Bitcoin Core with testnet4 support
- ✅ UniSat Wallet browser extension
- ✅ Charms CLI installed globally

## Step-by-Step Setup

### 1. Install Rust and WASM Target

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-wasip1
```

### 2. Install Charms CLI

```bash
npm install -g @charms/cli

# Verify installation
charms --version
```

### 3. Install Bitcoin Core

Download and install Bitcoin Core from [bitcoin.org](https://bitcoin.org/en/download).

Configure for testnet4:

```bash
# Create or edit ~/.bitcoin/bitcoin.conf
cat << EOF > ~/.bitcoin/bitcoin.conf
testnet4=1
server=1
txindex=1  # Required for fetching arbitrary transactions
rpcuser=your_rpc_user
rpcpassword=your_rpc_password
EOF

# Start Bitcoin Core
bitcoind -daemon

# Wait for initial sync (this may take several hours)
bitcoin-cli -testnet4 getblockchaininfo
```

### 4. Create and Fund Wallet

```bash
# Create wallet for CharmCircle
bitcoin-cli -testnet4 createwallet "charmcircle-dev"

# Generate address
ADDRESS=$(bitcoin-cli -testnet4 getnewaddress)
echo "Your testnet address: $ADDRESS"

# Get testnet coins from a faucet
# Visit: https://mempool.space/testnet4/faucet
# Or: https://coinfaucet.eu/en/btc-testnet/
```

### 5. Install UniSat Wallet

1. Install [UniSat Wallet](https://unisat.io) browser extension
2. Create or import a wallet
3. Switch to Bitcoin Testnet4 network
4. Get testnet coins from a faucet (if using different address than Bitcoin Core)

### 6. Clone and Build CharmCircle

```bash
# Clone repository
git clone <your-repo-url>
cd charmcircle

# Install Node dependencies
npm install
cd frontend && npm install && cd ..
cd server && npm install && cd ..

# Build WASM contract
cargo build --target wasm32-wasip1 --release

# Build helper binaries
cargo build --release --bin serialize_state
cargo build --release --bin update_state

# Run Rust tests (optional)
cargo test
```

## Running the Application

### Terminal 1: Bitcoin Core

```bash
# Ensure Bitcoin Core is running
bitcoin-cli -testnet4 getblockchaininfo

# Load CharmCircle wallet
bitcoin-cli -testnet4 loadwallet charmcircle-dev
```

### Terminal 2: Backend Server

```bash
cd server
npm run dev

# You should see:
# [SERVER] Server running on http://localhost:3001
```

### Terminal 3: Frontend

```bash
cd frontend
npm run dev

# You should see:
# VITE v... ready in ...ms
# ➜ Local: http://localhost:5173/
```

### Terminal 4: Testing (Optional)

```bash
# Test spell check with CLI script
./scripts/run-create-circle.sh
```

## First Circle Creation

### Option 1: Using Frontend (Recommended)

1. Open http://localhost:5173 in your browser
2. Click "Connect Wallet"
3. Approve UniSat wallet connection
4. Click "Create Circle"
5. Fill in circle details:
   - **Purpose**: "Test Circle"
   - **Contribution**: 10000 sats
   - **Frequency**: Weekly
   - **Max Members**: 5
6. Click "Create Circle"
7. Sign the PSBT in UniSat wallet
8. Wait for confirmation

### Option 2: Using CLI Scripts

```bash
# 1. Edit the script variables
vim scripts/run-create-circle.sh

# Update these variables:
# - in_utxo_0: Your funding UTXO (from listunspent)
# - circle_address: Your circle output address
# - creator_pubkey_hex: Your public key (from UniSat)

# 2. Run the script
./scripts/run-create-circle.sh

# 3. If spell check passes, you'll see:
# ✅ app contract satisfied: a/...
```

## Testing Different Scenarios

### Create Multiple Circles

```bash
# Create circle with different parameters
# Weekly contributions
contribution_per_round=10000
round_duration=604800  # 7 days

# Monthly contributions
contribution_per_round=50000
round_duration=2592000  # 30 days
```

### Join Existing Circle

```bash
# Using CLI
./scripts/run-join-circle.sh

# Or use frontend:
# 1. Click "Discover Circles"
# 2. Select a circle
# 3. Click "Join Circle"
# 4. Sign PSBT
```

### Make Contributions

```bash
# Using CLI
./scripts/run-contribute.sh

# Or use frontend:
# 1. View "My Circles"
# 2. Select active circle
# 3. Click "Make Contribution"
# 4. Sign PSBT
```

## Troubleshooting

### "Failed to build WASM binary"

```bash
# Ensure WASM target is installed
rustup target add wasm32-wasip1

# Try clean build
cargo clean
cargo build --target wasm32-wasip1 --release
```

### "Connection refused at localhost:3001"

```bash
# Check if backend is running
lsof -i :3001

# Restart backend
cd server
npm run dev
```

### "No wallet is loaded"

```bash
# Load wallet
bitcoin-cli -testnet4 loadwallet charmcircle-dev

# List loaded wallets
bitcoin-cli -testnet4 listwallets
```

### "UniSat wallet not connected"

1. Check UniSat extension is installed and enabled
2. Switch to testnet4 network in UniSat
3. Refresh the page
4. Click "Connect Wallet" again

### "Failed to sign PSBT"

Check that:
- UniSat is on testnet4 network
- You have sufficient balance
- UTXO is not already spent
- PSBT format is valid (backend adds witness data automatically)

### "insufficient balance X PROVE for request cost Y PROVE"

This means you've run out of PROVE credits on the Charms testnet.

**Solution**: Request more PROVE credits from Charms Discord:
- Join: https://discord.gg/charms (check Charms website for invite)
- Ask in support channel for testnet PROVE credits
- Mention you're building for a hackathon/testing

## Understanding the Flow

### Circle Creation Flow

```
1. User inputs → Frontend validation
2. Frontend → Backend API: POST /api/spells/build-and-prove
3. Backend:
   - Generates circle_id
   - Serializes CircleState
   - Builds create-circle.yaml spell
   - Calls charms spell prove
   - Converts output to PSBT
4. Backend → Frontend: Returns PSBT
5. Frontend → UniSat: Request signature
6. User approves in UniSat
7. UniSat → Frontend: Returns signed PSBT
8. Frontend → Backend: POST broadcast
9. Backend broadcasts to Bitcoin testnet4
10. Success! Circle created on-chain
```

### State Transitions

```
Create Circle:
  - Input: Regular Bitcoin UTXO (funding)
  - Output: Circle UTXO with CircleState charm data
  - State: { circle_id, contribution_per_round, members: [creator] }

Join Circle:
  - Input: Circle UTXO + Member's funding UTXO
  - Output: Updated Circle UTXO
  - State: members.push(new_member)

Contribute:
  - Input: Circle UTXO + Member's contribution UTXO
  - Output: Updated Circle UTXO + Payout to recipient
  - State: current_round++, mark_payout_complete()
```

## Next Steps

- Read [VALIDATION_ISSUES.md](VALIDATION_ISSUES.md) to understand technical challenges
- Check [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) for current limitations
- Review [scripts/TESTING_GUIDE.md](../scripts/TESTING_GUIDE.md) for comprehensive testing
- Explore the codebase starting with [src/lib.rs](../src/lib.rs)

## Getting Help

- **Charms SDK**: https://charms.dev/docs
- **Bitcoin Testnet**: https://mempool.space/testnet4
- **Project Issues**: Check repository issues tab
- **Charms Discord**: Join for PROVE credits and SDK help

## Common Commands Reference

```bash
# Bitcoin Core
bitcoin-cli -testnet4 getblockchaininfo
bitcoin-cli -testnet4 listunspent
bitcoin-cli -testnet4 getnewaddress
bitcoin-cli -testnet4 sendtoaddress <addr> <amount>

# Charms
charms app build
charms app vk
charms spell check --prev-txs=<hex> --app-bins=<path>
charms spell prove --prev-txs=<hex> --app-bins=<path>

# Project
cargo build --target wasm32-wasip1 --release
cargo test
npm run dev  # In server/ or frontend/
```

Happy building! 🎉
