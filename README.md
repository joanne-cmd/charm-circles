# CharmCircle 🌟

**A ROSCA (Rotating Savings and Credit Association) Protocol on Bitcoin**

CharmCircle brings traditional community savings circles to Bitcoin using the [Charms SDK](https://charms.dev) for programmable Bitcoin covenants.

## What is CharmCircle?

CharmCircle enables groups to create trustless savings circles on Bitcoin where:
- Members contribute a fixed amount each round (weekly/monthly)
- Each round, one member receives the full pot
- Smart contracts enforce the rules without intermediaries
- All contributions and payouts happen on-chain

### Example Use Case

5 friends want to save 100,000 sats monthly for 5 months:
- Each month, everyone contributes 100,000 sats
- Month 1: Alice receives 500,000 sats
- Month 2: Bob receives 500,000 sats
- ... and so on
- All rules enforced by Bitcoin covenants

## Features

✅ **Trustless**: Smart contracts enforce ROSCA rules on Bitcoin
✅ **Programmable**: Built on Charms SDK for Bitcoin covenants
✅ **Transparent**: All state transitions verifiable on-chain
✅ **Real Bitcoin**: Runs on Bitcoin testnet4 (mainnet-ready architecture)

## Architecture

```
┌─────────────────┐
│  React Frontend │  ← User interface (TypeScript/React)
│   + UniSat      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express API    │  ← Backend server (Node.js/TypeScript)
│   + Spell Gen   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  WASM Contract  │  ← On-chain validation (Rust/WASM)
│  + Charms SDK   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Bitcoin Network│  ← Testnet4 / Mainnet
└─────────────────┘
```

## Tech Stack

- **Smart Contract**: Rust (no_std) compiled to WASM
- **SDK**: Charms SDK for Bitcoin covenants
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: React + TypeScript + Vite
- **Wallet**: UniSat (browser extension)
- **Network**: Bitcoin testnet4


### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd charmcircle

# Install dependencies
npm install
cd frontend && npm install
cd ../server && npm install
cd ..

# Build WASM contract
cargo build --target wasm32-wasip1 --release

# Build Rust helper binaries
cargo build --release --bin serialize_state
cargo build --release --bin update_state
```

### Running the Application

#### 1. Start Bitcoin Core (testnet4)

```bash
bitcoind -testnet4 -daemon
bitcoin-cli -testnet4 loadwallet charmcircle-dev
```

#### 2. Start Backend Server

```bash
cd server
npm run dev
# Runs on http://localhost:3001
```

#### 3. Start Frontend

```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

#### 4. Connect UniSat Wallet

1. Install [UniSat Wallet](https://unisat.io) browser extension
2. Switch to testnet4 network
3. Get testnet coins from a faucet
4. Connect wallet in the CharmCircle UI

### Testing Scripts

Test the core functionality using CLI scripts:

```bash
# Create a new circle
./scripts/run-create-circle.sh

# Join an existing circle
./scripts/run-join-circle.sh

# Make a contribution
./scripts/run-contribute.sh
```

## Documentation

- **[KNOWN_ISSUES.md](KNOWN_ISSUES.md)** - Known limitations and future work
- **[docs/VALIDATION_ISSUES.md](docs/VALIDATION_ISSUES.md)** - Deep dive into WASM validation challenges
- **[scripts/TESTING_GUIDE.md](scripts/TESTING_GUIDE.md)** - Testing instructions
- **[scripts/WALLET_SETUP.md](scripts/WALLET_SETUP.md)** - Wallet configuration



### Current State 

✅ **Working Features**:
- Circle creation with configurable parameters
- Member joining functionality
- Contribution tracking
- State serialization/deserialization
- Frontend integration with UniSat wallet
- Backend spell generation and proving
- End-to-end transaction flow

⚠️ **Known Limitations**:
- Simplified WASM validation (checks data presence, not full state validation)
- Backend-based state validation (not purely trustless yet)
- Requires PROVE credits from Charms network

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) for details.

### Production Roadmap

- [ ] Full covenant-based validation in WASM
- [ ] Dispute resolution mechanism
- [ ] Automated payout triggers
- [ ] Multi-signature support for large circles
- [ ] Mobile app interface
- [ ] Security audit
- [ ] Mainnet deployment

## How It Works

### Creating a Circle

1. **User inputs**: Purpose, contribution amount, frequency, max members
2. **Frontend**: Generates parameters and calls backend API
3. **Backend**:
   - Generates unique circle_id
   - Serializes initial CircleState
   - Builds create-circle spell from template
   - Proves spell with Charms network
   - Returns PSBT
4. **Wallet**: User signs PSBT with UniSat
5. **Network**: Transaction broadcasts to Bitcoin testnet4


```bash
# Build WASM binary
cargo build --target wasm32-wasip1 --release

# Get verification key
app_bin=./target/wasm32-wasip1/release/charmcircle.wasm
charms app vk $app_bin
```

### Run Tests

```bash
# Rust tests (native)
cargo test

# Test state serialization
cargo build --release --bin serialize_state
./target/release/serialize_state \


### Verify Spell

```bash
# Set environment variables
export app_bin=./target/wasm32-wasip1/release/charmcircle.wasm
export app_vk=$(charms app vk)
export in_utxo_0="<your_utxo>"
# ... (see scripts for full setup)

# Check spell
cat spells/create-circle.yaml | envsubst | \
  charms spell check --prev-txs="${prev_txs}" --app-bins="${app_bin}"
```
