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

## Quick Start

### Prerequisites

```bash
# Rust toolchain with WASM target
rustup target add wasm32-wasip1

# Charms CLI
npm install -g @charms/cli

# Bitcoin Core (testnet4)
# Download from bitcoin.org

# Node.js 18+
# Download from nodejs.org
```

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

See [scripts/TESTING_GUIDE.md](scripts/TESTING_GUIDE.md) for detailed testing instructions.

## Project Structure

```
charmcircle/
├── src/
│   ├── lib.rs              # WASM smart contract
│   └── bin/
│       ├── serialize_state.rs    # State serialization helper
│       └── update_state.rs       # State update helper
├── spells/
│   ├── create-circle.yaml  # Create circle spell template
│   ├── join-circle.yaml    # Join circle spell template
│   └── contribute.yaml     # Contribution spell template
├── server/
│   ├── src/
│   │   ├── controllers/    # API endpoints
│   │   ├── services/       # Business logic
│   │   └── types/          # TypeScript types
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API clients
│   │   └── contexts/       # React contexts
│   └── package.json
├── scripts/                # Testing/deployment scripts
├── docs/                   # Documentation
│   └── VALIDATION_ISSUES.md  # Technical deep-dive
├── KNOWN_ISSUES.md         # Known limitations
└── README.md               # This file
```

## Documentation

- **[KNOWN_ISSUES.md](KNOWN_ISSUES.md)** - Known limitations and future work
- **[docs/VALIDATION_ISSUES.md](docs/VALIDATION_ISSUES.md)** - Deep dive into WASM validation challenges
- **[scripts/TESTING_GUIDE.md](scripts/TESTING_GUIDE.md)** - Testing instructions
- **[scripts/WALLET_SETUP.md](scripts/WALLET_SETUP.md)** - Wallet configuration

## Development Status

This is a **hackathon project** demonstrating ROSCA functionality on Bitcoin using Charms SDK.

### Current State (Hackathon Version)

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

### Circle State

```rust
pub struct CircleState {
    pub circle_id: [u8; 32],           // Unique identifier
    pub contribution_per_round: u64,    // Sats per round
    pub round_duration: u64,            // Seconds per round
    pub created_at: u64,                // Unix timestamp
    pub current_round: u64,             // Current round number
    pub members: Vec<Member>,           // List of members
}
```

State is serialized using CBOR and stored in Bitcoin UTXO charm data.

### Validation Layers

1. **WASM Contract** (on-chain):
   - Validates charm data exists
   - Future: Full CircleState validation

2. **Backend Service** (off-chain):
   - Deserializes and validates state structure
   - Enforces ROSCA business rules
   - Generates valid state transitions

See [docs/VALIDATION_ISSUES.md](docs/VALIDATION_ISSUES.md) for technical details.

## API Endpoints

### Backend Server (port 3001)

```
POST /api/spells/build-and-prove
  - Builds and proves a spell
  - Returns PSBT for signing

GET /api/circles/:circleId
  - Gets circle state
  - Returns decoded CircleState

POST /api/circles/create
  - Creates new circle
  - Returns circle_id and PSBT

POST /api/circles/:circleId/join
  - Joins existing circle
  - Returns updated state PSBT
```

## Building & Testing

### Build WASM Contract

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
  $(openssl rand -hex 32) \
  100000 \
  2592000 \
  $(date +%s) \
  <pubkey_hex>
```

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

## Contributing

This is a hackathon project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Troubleshooting

### Common Issues

**Problem**: "No wallet is loaded"
```bash
# Solution: Load Bitcoin Core wallet
bitcoin-cli -testnet4 loadwallet charmcircle-dev
```

**Problem**: "Failed to sign PSBT: invalid psbt"
```bash
# Solution: Ensure UTXO has witness data
# Backend automatically runs utxoupdatepsbt
```

**Problem**: "insufficient balance X PROVE for request cost Y PROVE"
```bash
# Solution: Request more PROVE credits from Charms Discord
# This is a network resource token for testnet
```

See [docs/VALIDATION_ISSUES.md](docs/VALIDATION_ISSUES.md) for detailed troubleshooting.

## Resources

- [Charms SDK Documentation](https://charms.dev/docs)
- [Bitcoin Testnet4 Faucet](https://mempool.space/testnet4/faucet)
- [UniSat Wallet](https://unisat.io)
- [BRO Token Reference Implementation](https://github.com/CharmsDev/bro)

## License

[Your chosen license - e.g., MIT]

## Acknowledgments

- Built with [Charms SDK](https://charms.dev)
- Inspired by traditional ROSCA community savings models
- Created for [Hackathon Name] - January 2026

---

**Note**: This is a hackathon demonstration project. Not audited for production use. Use at your own risk on mainnet.
