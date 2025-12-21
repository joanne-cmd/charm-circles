# ROSCA Spell Templates

This directory contains Charms spell YAML templates for the Bitcoin ROSCA application.

## Overview

The spells follow the Charms Protocol spell format (version 8) and use variable substitution with `${variable_name}` syntax. Variables should be set as environment variables before using `envsubst` or your YAML processor.

For detailed information on casting spells, see the [Charms documentation on casting spells](https://docs.charms.dev/guides/charms-apps/cast-spell/).

## Spell Files

### 1. `create-circle.yaml`
Initializes a new ROSCA savings circle with the creator as the first member.

**Required Variables:**
- `app_id`: SHA256 hash of the input UTXO (hex string, 64 chars)
- `app_vk`: Verification key from `charms app vk` command
- `in_utxo_0`: Input UTXO being spent (format: `txid:index`)
- `circle_address`: Bitcoin address to receive the circle state UTXO
- `circle_state_serialized`: Serialized CircleState data (CBOR-encoded)

**CircleState Initialization:**
```rust
let circle_state = CircleState::new(
    circle_id,                    // [u8; 32] - unique identifier
    contribution_per_round,       // u64 - satoshis per round
    round_duration,               // u64 - seconds (e.g., 2592000 for 30 days)
    created_at_timestamp          // u64 - Unix timestamp
);

// Add creator as first member
circle_state.add_member(
    creator_pubkey,               // PubKey - creator's public key
    0,                            // payout_round: 0 (first to receive)
    created_at_timestamp
)?;

// Serialize: Data::from(&circle_state)
let serialized = Data::from(&circle_state);
```

### 2. `join-circle.yaml`
Adds a new member to an existing ROSCA circle.

**Required Variables:**
- `app_id`: App identifier (hex string)
- `app_vk`: Verification key
- `circle_utxo`: UTXO containing current circle state (format: `txid:index`)
- `circle_address`: Address to receive updated circle state
- `prev_circle_state_data`: Serialized previous CircleState (from input UTXO)
- `updated_circle_state_data`: Serialized updated CircleState with new member

**State Update:**
```rust
// Deserialize previous state
let mut state: CircleState = prev_data.value()?;

// Add new member
state.add_member(
    new_member_pubkey,            // PubKey - new member's public key
    payout_round,                 // u32 - round when member receives payout
    joined_at_timestamp           // u64 - Unix timestamp
)?;

// Serialize updated state
let updated = Data::from(&state);
```

### 3. `contribute.yaml`
Records a monthly contribution and mints a 'sealed scroll' NFT as proof.

**Required Variables:**
- `app_id`: App identifier
- `app_vk`: Verification key
- `circle_utxo`: UTXO with current circle state
- `contribution_utxo`: UTXO being spent for contribution
- `circle_address`: Address for updated circle state
- `contributor_address`: Address to receive the sealed scroll NFT
- `prev_circle_state_data`: Serialized previous CircleState
- `updated_circle_state_data`: Serialized updated CircleState with contribution
- `nft_ticker`: NFT ticker string (e.g., "SEALED_SCROLL")

**Contribution Recording:**
```rust
// Deserialize previous state
let mut state: CircleState = prev_data.value()?;

// Record contribution
state.record_contribution(
    &contributor_pubkey,          // &PubKey
    contribution_amount,          // u64 - satoshis
    contribution_timestamp,        // u64 - Unix timestamp
    txid                          // [u8; 32] - transaction ID
)?;

// Serialize updated state
let updated = Data::from(&state);
```

## Usage Examples

### Checking a Spell (Validation Only)

```bash
# Step 1: Build the app binary first
app_bin=$(charms app build)
export app_bin

# Step 2: Get the verification key
export app_vk=$(charms app vk)

# Step 3: Set environment variables
export in_utxo_0="d8fa4cdade7ac3dff64047dc73b58591ebe638579881b200d4fea68fc84521f0:0"
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
export circle_address="tb1p3w06fgh64axkj3uphn4t258ehweccm367vkdhkvz8qzdagjctm8qaw2xyv"

# Step 4: Serialize CircleState (in your application code)
# ... create and serialize circle_state ...
# export circle_state_serialized="<hex-encoded-serialized-data>"

# Step 5: Set previous transaction data (if needed for first transaction, may be empty)
export prev_txs=""  # Empty for first transaction, or hex-encoded transaction data

# Step 6: Validate spell (doesn't create transactions, just checks validity)
cat spells/create-circle.yaml | envsubst | charms spell check --prev-txs=${prev_txs} --app-bins=${app_bin}
```

### Casting a Spell (Creating and Proving Transactions)

To actually create and submit a spell to Bitcoin, use `charms spell prove` as described in the [Charms documentation](https://docs.charms.dev/guides/charms-apps/cast-spell/):

```bash
# Step 1: Build the app binary
app_bin=$(charms app build)
export app_bin

# Step 2: Get the verification key
export app_vk=$(charms app vk)

# Step 3: Set up Bitcoin testnet (assuming bitcoin-cli is aliased as 'b')
# Pick a funding UTXO from: b listunspent
funding_utxo="2d6d1603f0738085f2035d496baf2b91a639d204b414ea180beb417a3e09f84e:1"
funding_utxo_value="50000"  # in satoshis
change_address=$(b getrawchangeaddress)

# Step 4: Set spell-specific variables
export in_utxo_0="${funding_utxo}"
export app_id=$(echo -n "${in_utxo_0}" | sha256sum | cut -d' ' -f1)
export circle_address="tb1p3w06fgh64axkj3uphn4t258ehweccm367vkdhkvz8qzdagjctm8qaw2xyv"

# Step 5: Serialize CircleState (in your application code)
# ... create and serialize circle_state ...
# export circle_state_serialized="<hex-encoded-serialized-data>"

# Step 6: Set previous transaction data
export prev_txs=""  # Empty for first transaction, or hex-encoded transaction data

# Step 7: Cast the spell (creates commit + spell transactions)
# This takes about 5 minutes as it generates the zero-knowledge proof
export RUST_LOG=info
cat spells/create-circle.yaml | envsubst | charms spell prove \
  --app-bins=${app_bin} \
  --prev-txs=${prev_txs} \
  --funding-utxo=${funding_utxo} \
  --funding-utxo-value=${funding_utxo_value} \
  --change-address=${change_address}

# Step 8: The output will be a JSON array of two hex-encoded transactions:
# [{"bitcoin":"020000000001015f...57505efa00000000"},{"bitcoin":"020000000001025f...e14c656300000000"}]
# 
# Submit both transactions as a package:
# b submitpackage '["020000000001015f...57505efa00000000", "020000000001025f...e14c656300000000"]'
```

**Note:** `charms spell prove` creates two transactions:
1. **Commit transaction**: Creates an output committing to the spell and its proof
2. **Spell transaction**: Spends the commit output and contains the spell + proof in the witness

Both transactions must be submitted together as a package.

### Difference Between `spell check` and `spell prove`

- **`charms spell check`**: Validates that a spell is well-formed and would be accepted by the app contract. Does NOT create transactions. Use this for testing and validation.

- **`charms spell prove`**: Creates actual Bitcoin transactions (commit + spell) with zero-knowledge proofs. This is what you use to actually cast the spell on-chain. Takes ~5 minutes to generate the proof.

### Workflow for Each Spell Type

#### Creating a Circle (`create-circle.yaml`)
1. Build app: `app_bin=$(charms app build)`
2. Create initial `CircleState` with creator as first member
3. Serialize state: `Data::from(&circle_state)`
4. Set variables and cast spell with `charms spell prove`
5. Submit transactions as package

#### Joining a Circle (`join-circle.yaml`)
1. Get the current circle UTXO (from previous transaction)
2. Deserialize current state from the UTXO
3. Add new member using `circle_state.add_member()`
4. Serialize updated state
5. Cast spell with updated state
6. Submit transactions

#### Contributing (`contribute.yaml`)
1. Get the current circle UTXO
2. Deserialize current state
3. Record contribution using `circle_state.record_contribution()`
4. Serialize updated state
5. Cast spell (also mints sealed scroll NFT)
6. Submit transactions

**Troubleshooting:**

If you get an error about missing `clang` during build:
```bash
# On Ubuntu/Debian:
sudo apt-get install build-essential clang

# On Fedora/RHEL:
sudo dnf install clang gcc
```

If you get WASM build errors about `secp256k1-sys` or missing `bits/libc-header-start.h`:
- This was caused by the `bitcoin` crate dependency pulling in C code that requires compilation
- The `bitcoin` dependency has been removed from `Cargo.toml` as it's not needed
- The code uses custom types (`PubKey`, `Satoshis`) instead of bitcoin crate types
- Rebuild: `cargo build --target wasm32-wasip1 --release`

If `app_bin` is empty after building:
```bash
# Check if the build succeeded
ls -la ./target/wasm32-wasip1/release/charmcircle.wasm

# If it exists, set it manually:
export app_bin="./target/wasm32-wasip1/release/charmcircle.wasm"
```

## Data Serialization

The `CircleState` struct is serialized using Serde with CBOR encoding (via `charms_data`). The serialization happens automatically when using `Data::from(&circle_state)`.

**Important:** The `data` field in the YAML templates expects the serialized bytes. In practice, you'll need to:
1. Create the `CircleState` struct in your application
2. Serialize it using `Data::from(&state)` 
3. The serialized data will be included in the transaction when the spell is executed

## Variable Substitution

All variables use the `${variable_name}` format and should be:
- Set as environment variables, or
- Provided via your YAML processing tool (envsubst, yq, etc.)

## Notes

- The app tag `a/` is used for custom ROSCA app instances
- NFT app tag `n/` is used for the sealed scroll NFTs
- All timestamps are Unix timestamps (seconds since epoch)
- Public keys are 33-byte compressed keys (hex-encoded as 66-character strings)
- Transaction IDs are 32-byte arrays (hex-encoded as 64-character strings)

