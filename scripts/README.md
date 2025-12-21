# ROSCA Spell Scripts

This directory contains scripts for running spell checks for the ROSCA (Rotating Savings and Credit Association) app.

## Scripts

### `run-create-circle.sh`
Creates a new ROSCA circle.

**Usage:**
```bash
cd scripts
./run-create-circle.sh
```

**What it does:**
- Builds the app binary
- Gets verification key
- Fetches previous transaction from wallet
- Serializes initial CircleState with creator as first member
- Runs `charms spell check` for `create-circle.yaml`

**Variables:**
- `in_utxo_0` - UTXO being spent (set from listunspent output)
- `circle_address` - Address to receive the circle state UTXO
- `circle_state_serialized` - Generated automatically

### `run-join-circle.sh`
Adds a new member to an existing circle.

**Usage:**
```bash
cd scripts
# Edit the script to set required variables, then:
./run-join-circle.sh
```

**Required Variables (edit in script):**
- `circle_utxo` - UTXO containing current circle state (format: `txid:index`)
- `prev_circle_state_data` - Hex-encoded previous CircleState
- `new_member_pubkey_hex` - New member's public key (66 hex chars)
- `payout_round` - Round when member receives payout (u32)
- `circle_address` - Address to receive updated circle state

**What it does:**
- Fetches previous transaction
- Deserializes previous CircleState
- Adds new member using `update_state` helper
- Serializes updated state
- Runs `charms spell check` for `join-circle.yaml`

### `run-contribute.sh`
Records a member's contribution and mints a sealed scroll NFT.

**Usage:**
```bash
cd scripts
# Edit the script to set required variables, then:
./run-contribute.sh
```

**Required Variables (edit in script):**
- `circle_utxo` - UTXO containing current circle state
- `contribution_utxo` - UTXO being spent for contribution
- `prev_circle_state_data` - Hex-encoded previous CircleState
- `contributor_pubkey_hex` - Contributor's public key (66 hex chars)
- `contribution_amount` - Amount in satoshis (u64)
- `circle_address` - Address to receive updated circle state
- `contributor_address` - Address to receive the NFT
- `nft_ticker` - NFT ticker string (e.g., "SEALED_SCROLL")

**What it does:**
- Fetches previous transactions (circle and contribution)
- Deserializes previous CircleState
- Records contribution using `update_state` helper
- Serializes updated state
- Runs `charms spell check` for `contribute.yaml`

## Helper Binaries

These are built with `cargo build --release --bin <name>` and located in `../target/release/`:

### `serialize_state`
Creates and serializes a new CircleState.

```bash
../target/release/serialize_state <circle_id_hex> <contribution_per_round> <round_duration> <created_at_timestamp> <creator_pubkey_hex>
```

**Example:**
```bash
../target/release/serialize_state \
    $(openssl rand -hex 32) \
    100000 \
    2592000 \
    $(date +%s) \
    023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281
```

### `update_state`
Updates an existing CircleState.

**Add member:**
```bash
../target/release/update_state add_member <prev_state_hex> <new_member_pubkey_hex> <payout_round> <joined_at_timestamp>
```

**Record contribution:**
```bash
../target/release/update_state record_contribution <prev_state_hex> <contributor_pubkey_hex> <amount> <timestamp> <txid_hex>
```

## Getting Previous Circle State Data

To get `prev_circle_state_data` for `join-circle` and `contribute`:

1. **From a previous transaction:**
   - Query the circle UTXO's app data
   - Extract the serialized CircleState (CBOR-encoded, hex-encoded)

2. **For testing:**
   - Use output from `serialize_state` as `prev_circle_state_data`
   - Or manually extract from a previous transaction's output

## Common Issues

### `random_get` Error
All scripts will fail with:
```
Error: cannot find definition for import wasi_snapshot_preview1::random_get
```

**Cause:** `ark-std` (via `charms-sdk`) uses `rand` which requires WASI's `random_get`, but Charms runtime doesn't provide it.

**Solution:** Contact Charms team (see `../DISCORD_MESSAGE_CONCISE.txt`). This is a dependency issue that needs to be fixed at the SDK level.

### Transaction Not Found
If you get "No such mempool transaction":
- The script tries `gettransaction` first (for wallet transactions)
- Falls back to `getrawtransaction` with block hash
- Make sure the transaction exists and is accessible

### Missing Previous State Data
For `join-circle` and `contribute`, you need to provide `prev_circle_state_data`:
- Extract it from the circle UTXO's app data
- Or use test data for development

## Building Helpers

From the project root:
```bash
cargo build --release --bin serialize_state
cargo build --release --bin update_state
```

## Notes

- All scripts use `bitcoin-cli` directly (not the `b` alias)
- Scripts automatically fetch previous transactions
- Helper binaries are only built for native targets (not WASM)
- All state serialization uses CBOR (via `serde_cbor`)

