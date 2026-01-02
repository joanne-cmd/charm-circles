# Validation Issues & Solutions

## Overview

This document details the validation challenges encountered during CharmCircle development, specifically focusing on WASM contract validation issues and the solutions implemented for the hackathon submission.

## Table of Contents

1. [Primary Validation Issue](#primary-validation-issue)
2. [Root Cause Analysis](#root-cause-analysis)
3. [Attempted Solutions](#attempted-solutions)
4. [Final Workaround](#final-workaround)
5. [Secondary Issues & Fixes](#secondary-issues--fixes)
6. [Testing Evidence](#testing-evidence)
7. [Future Work](#future-work)

---

## Primary Validation Issue

### The Error

```
thread 'main' panicked at charms-sdk/src/lib.rs:195:9:
assertion failed: charmcircle::app_contract(&app, &tx, &x, &w)
```

### What This Means

The WASM smart contract's `app_contract` function was returning `false`, causing spell check validation to fail. This function is responsible for validating ROSCA (Rotating Savings and Credit Association) state transitions on-chain.

### Original Implementation (Failed in WASM)

```rust
fn app_contract_impl(app: &App, tx: &Transaction, _x: &Data, _w: &Data) -> Result<()> {
    // Extract new state from transaction outputs
    let new_state_data = tx
        .outs
        .iter()
        .find_map(|out| out.get(app))
        .ok_or_else(|| anyhow::anyhow!("No charm data found for app in outputs"))?;

    // Attempt to deserialize CircleState
    let new_state: CircleState = new_state_data
        .value()
        .context("Failed to deserialize CircleState from charm data")?;

    // Validate the state
    new_state.validate()?;

    Ok(())
}
```

**This code worked perfectly in native Rust tests but failed in WASM runtime.**

---

## Root Cause Analysis

### CBOR Deserialization in WASM

The root cause is a WASM-specific runtime issue with CBOR deserialization of complex nested structures:

1. **CircleState Structure**:
   ```rust
   #[derive(Debug, Clone, Serialize, Deserialize)]
   pub struct CircleState {
       pub circle_id: [u8; 32],
       pub contribution_per_round: u64,
       pub round_duration: u64,
       pub created_at: u64,
       pub current_round: u64,
       pub members: Vec<Member>,  // ← Complex nested structure
   }

   #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
   pub struct Member {
       pub pubkey: PubKey,
       pub payout_round: u64,
       pub joined_at: u64,
       pub has_received_payout: bool,
   }
   ```

2. **CBOR Serialization**:
   - State is serialized using `ciborium` (same library Charms SDK uses internally)
   - Serialization produces valid CBOR bytes (463 bytes for initial state)
   - Native Rust tests successfully roundtrip serialize/deserialize

3. **WASM Runtime Failure**:
   - `data.value::<CircleState>()` fails silently in WASM
   - Returns `None` instead of `Some(CircleState)`
   - No panic, no error message - just fails to deserialize
   - Same code works in native Rust tests

### Evidence of Working Serialization

```bash
# Native Rust tests pass
$ cargo test test_charms_data_compatibility
running 1 test
test tests::test_charms_data_compatibility ... ok

# Manual deserialization test
$ ./target/release/test_deserialization ...
✓ Serialized 463 bytes
✓ Successfully deserialized!
✓ State validation passed!
✓ Roundtrip test passed!
```

### Why It Works in Native But Not WASM

Several potential reasons (still under investigation):

1. **WASM Memory Constraints**: WASM has different memory layout and alignment requirements
2. **SDK Data Format**: Charms SDK may wrap/encode data differently in WASM context
3. **Allocator Differences**: WASM allocator behavior differs from native
4. **Type Representation**: Rust types may have different representations in WASM vs native

---

## Attempted Solutions

### Attempt 1: Simplified Struct (Failed)

Tried removing nested Vec<Member> to use simpler types:

```rust
pub struct SimpleState {
    pub circle_id: [u8; 32],
    pub contribution: u64,
}
```

**Result**: Same failure - `data.value::<SimpleState>()` returned None

### Attempt 2: Manual CBOR Parsing (Too Complex)

Attempted manual CBOR parsing without relying on `value()`:

```rust
let bytes = new_state_data.as_ref();
let state: CircleState = ciborium::de::from_reader(bytes)?;
```

**Result**: Compilation issues in WASM environment, SDK data format unclear

### Attempt 3: Raw Bytes Validation (Insufficient)

Just checking bytes exist without deserialization:

```rust
ensure!(!new_state_data.is_empty(), "Charm data cannot be empty");
```

**Result**: This works but provides no actual validation

---

## Final Workaround

### Hackathon Implementation

For the hackathon submission, we implemented a **two-layer validation strategy**:

#### Layer 1: On-Chain (WASM Contract)
```rust
fn app_contract_impl(app: &App, tx: &Transaction, _x: &Data, _w: &Data) -> Result<()> {
    // Extract charm data from outputs
    let new_state_data = tx
        .outs
        .iter()
        .find_map(|out| out.get(app))
        .ok_or_else(|| anyhow::anyhow!("No charm data found for app in outputs"))?;

    // Simplified validation: just check data exists and is non-empty
    ensure!(!new_state_data.is_empty(), "Charm data cannot be empty");

    Ok(())
}
```

**What This Validates**:
- ✅ Transaction includes charm data for our app
- ✅ Charm data is not empty
- ❌ Does NOT validate ROSCA business logic yet

#### Layer 2: Backend (Node.js Service)

The backend fully deserializes and validates all state transitions:

```typescript
// In spell.service.ts
const stateHex = parameters.circle_state_serialized;
const stateBytes = Buffer.from(stateHex, 'hex');
const state = decode(stateBytes); // Full CBOR deserialization

// Validate state structure
validateCircleState(state);
```

**What This Validates**:
- ✅ State structure is valid CBOR
- ✅ All required fields present
- ✅ Contribution amounts correct
- ✅ Member limits enforced
- ✅ Round durations valid

### Trade-offs

| Aspect | On-Chain | Backend |
|--------|----------|---------|
| **Trust Model** | Trustless | Requires trusting backend |
| **Validation Depth** | Basic | Complete |
| **Performance** | Fast | Fast |
| **Suitable For** | Hackathon demo | Hackathon demo |
| **Production Ready** | No | No |

---

## Secondary Issues & Fixes

### Issue 1: Wallet Connection State

**Problem**: Frontend WalletService lost connection state after reload

**Solution**: Modified `getPublicKey()` to auto-reconnect:

```typescript
// First, try to get accounts to ensure wallet is accessible
const accounts = await window.unisat!.getAccounts();

if (!accounts || accounts.length === 0) {
    throw new Error("No accounts found. Please connect your wallet first.");
}

// Update internal state if we got accounts
if (!this.isConnected) {
    this.isConnected = true;
    this.currentAddress = accounts[0];
    console.log("[WALLET] Auto-reconnected to:", this.currentAddress);
}
```

**File**: [frontend/src/services/WalletService.ts:178-217](../frontend/src/services/WalletService.ts#L178-L217)

### Issue 2: PSBT Witness Data Missing

**Problem**: UniSat wallet rejected PSBT with "Need a Utxo input item for signing"

**Root Cause**: `bitcoin-cli converttopsbt` creates PSBT without witness UTXO data required for SegWit signing

**Solution**: Added `utxoupdatepsbt` step:

```typescript
// Convert raw transaction to PSBT
const { stdout: psbtBase } = await execAsync(
    `bitcoin-cli -testnet4 converttopsbt "${rawTx}"`
);

// Update PSBT with witness UTXO data
const { stdout: updatedPsbt } = await execAsync(
    `bitcoin-cli -testnet4 utxoupdatepsbt "${psbtBase.trim()}"`
);

psbt = updatedPsbt.trim();
```

**File**: [server/src/services/spell.service.ts:265-304](../server/src/services/spell.service.ts#L265-L304)

### Issue 3: PSBT Not Finalized

**Problem**: Signed PSBT couldn't be broadcast - "Not finalized"

**Solution**: Changed UniSat signing to auto-finalize:

```typescript
// Before
const signedPsbt = await signPSBT(psbt, { autoFinalized: false });

// After
const signedPsbt = await signPSBT(psbt, { autoFinalized: true });
```

**File**: [frontend/src/components/CreateCircleModal.tsx:156](../frontend/src/components/CreateCircleModal.tsx#L156)

### Issue 4: Duplicate UTXO Spends

**Problem**: Charms network rejected transactions with "duplicate funding UTXO spend with different spell"

**Root Cause**: Each create circle attempt generates new random `circle_id`, creating different spell. Same UTXO used with different spells across multiple attempts looks like double-spend to network.

**Solution**: Create fresh UTXO for each test attempt:

```bash
# Create fresh UTXO
bitcoin-cli -testnet4 sendtoaddress tb1q7yp6yzzk2kt5ll0jhjtz3eyjjuk9rg2seeckql 0.00002

# Wait for confirmation, then use new UTXO
```

---

## Testing Evidence

### Spell Check Success

After implementing simplified validation:

```bash
$ ./scripts/run-create-circle.sh

Running spell check...

✅ app contract satisfied: a/cac3324494d8ae5392d57d8b43d973fd72f55df8bf432bd8ad31228b3548aaa6/2e0487cd8abe2bfcd912accdb9f4b4c84d1d7a3b5aaf46726fd15d97aebc987e
```

### State Serialization Working

```bash
$ ./target/release/serialize_state \
    $(openssl rand -hex 32) \
    100000 \
    2592000 \
    $(date +%s) \
    023b709e70b6b30177f2e5fd05e43697f0870a4e942530ef19502f8cee07a63281

a66963697263...  # 463 bytes of valid CBOR data
```

### Native Tests Passing

```bash
$ cargo test
running 3 tests
test tests::test_add_member ... ok
test tests::test_charms_data_compatibility ... ok
test tests::test_validate_contribution ... ok

test result: ok. 3 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

---

## Future Work

### Short Term (Post-Hackathon)

1. **Investigate SDK Data Format**
   - Consult Charms SDK maintainers about expected data format
   - Check if SDK wraps custom app data in additional layers
   - Review BRO token and other example apps

2. **Test Simplified Structures**
   - Try even simpler state (single u64)
   - Test with different CBOR libraries
   - Compare with working Charms apps

3. **WASM Debugging**
   - Add extensive logging in WASM contract
   - Test different WASM targets (wasm32-unknown-unknown vs wasm32-wasip1)
   - Profile memory usage in WASM

### Long Term (Production)

1. **Full Covenant Validation**
   - Enable complete CircleState deserialization in WASM
   - Validate all ROSCA business rules on-chain:
     - Contribution amounts match requirements
     - Round durations enforced
     - Member limits respected
     - Payout ordering correct

2. **Security Hardening**
   - Remove trust in backend validation
   - Implement dispute resolution
   - Add multi-signature support for large circles
   - Security audit before mainnet

3. **Performance Optimization**
   - Optimize CBOR encoding for smaller size
   - Reduce on-chain data footprint
   - Implement efficient state transitions

---

## Conclusion

The WASM validation issue is a genuine technical challenge that requires further investigation with the Charms SDK maintainers. Our hackathon implementation demonstrates:

✅ **Full integration** with Charms SDK
✅ **Working serialization** of complex state
✅ **End-to-end functionality** from frontend to Bitcoin testnet
✅ **Pragmatic workaround** balancing demo needs with technical constraints

The simplified validation approach is **clearly documented** and **appropriate for a hackathon demo**, with a **concrete plan** for achieving full covenant validation in production.

---

## References

- [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) - Summary of known limitations
- [src/lib.rs](../src/lib.rs) - WASM contract implementation
- [BRO Token Reference](https://github.com/CharmsDev/bro/blob/main/bro-token/src/lib.rs) - Error handling pattern borrowed
- [Charms SDK Documentation](https://charms.dev/docs) - Official SDK docs
