# Spell Check Scripts for ROSCA App

## Summary

✅ **Our `lib.rs` does NOT use `random_get` directly** - it's completely deterministic!
- All randomness comes from the transitive dependency `ark-std → rand` via `charms-sdk`
- Our code uses only deterministic operations (hashing, serialization, state management)

## Available Scripts

### 1. `run-create-circle.sh`
Creates a new ROSCA circle.

**Usage:**
```bash
./run-create-circle.sh
```

**What it does:**
- Builds the app binary
- Gets verification key
- Fetches previous transaction
- Serializes initial CircleState with creator as first member
- Runs `charms spell check` for `create-circle.yaml`

**Variables you need to set:**
- `circle_address` - Address to receive the circle state UTXO
- `in_utxo_0` - UTXO being spent (already set from your listunspent)

### 2. `run-join-circle.sh`
Adds a new member to an existing circle.

**Usage:**
```bash
# Edit the script first to set:
# - circle_utxo (UTXO containing current circle state)
# - prev_circle_state_data (hex-encoded previous state)
# - new_member_pubkey_hex
# - payout_round
# - circle_address

./run-join-circle.sh
```

**What it does:**
- Fetches previous transaction
- Deserializes previous CircleState
- Adds new member using `update_state` helper
- Serializes updated state
- Runs `charms spell check` for `join-circle.yaml`

**Helper binary:** `update_state add_member`

### 3. `run-contribute.sh`
Records a member's contribution and mints a sealed scroll NFT.

**Usage:**
```bash
# Edit the script first to set:
# - circle_utxo (UTXO containing current circle state)
# - contribution_utxo (UTXO being spent for contribution)
# - prev_circle_state_data (hex-encoded previous state)
# - contributor_pubkey_hex
# - contribution_amount
# - circle_address
# - contributor_address

./run-contribute.sh
```

**What it does:**
- Fetches previous transactions (circle and contribution)
- Deserializes previous CircleState
- Records contribution using `update_state` helper
- Serializes updated state
- Runs `charms spell check` for `contribute.yaml`

**Helper binary:** `update_state record_contribution`

## Helper Binaries

### `serialize_state`
Creates and serializes a new CircleState.

```bash
./target/release/serialize_state <circle_id_hex> <contribution_per_round> <round_duration> <created_at_timestamp> <creator_pubkey_hex>
```

### `update_state`
Updates an existing CircleState.

**Add member:**
```bash
./target/release/update_state add_member <prev_state_hex> <new_member_pubkey_hex> <payout_round> <joined_at_timestamp>
```

**Record contribution:**
```bash
./target/release/update_state record_contribution <prev_state_hex> <contributor_pubkey_hex> <amount> <timestamp> <txid_hex>
```

## Getting Previous Circle State Data

To get `prev_circle_state_data` for `join-circle` and `contribute`, you need to:

1. **Query the circle UTXO's app data** - This requires:
   - The UTXO that contains the circle state
   - A way to extract the app data from that UTXO

2. **For testing**, you can:
   - Use the output from `serialize_state` as `prev_circle_state_data`
   - Or manually extract it from a previous transaction's output

## Current Issue

⚠️ **All scripts will fail with the `random_get` error** until Charms fixes the SDK.

The error:
```
Error: cannot find definition for import wasi_snapshot_preview1::random_get
```

This is because `ark-std` (via `charms-sdk`) uses `rand` which requires WASI's `random_get`, but the Charms runtime doesn't provide it.

**Workaround:** Contact Charms team using the prepared Discord message in `DISCORD_MESSAGE_CONCISE.txt`.

## Next Steps

1. **For `create-circle`:** Script is ready, just needs the Charms runtime fix
2. **For `join-circle`:** Need to add logic to extract `prev_circle_state_data` from UTXO
3. **For `contribute`:** Same as above, plus need to handle NFT minting

## Building Helpers

```bash
# Build all helper binaries
cargo build --release --bin serialize_state
cargo build --release --bin update_state
```

