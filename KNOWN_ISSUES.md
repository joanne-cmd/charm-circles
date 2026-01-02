# Known Issues

## 1. WASM Contract Validation (Simplified for Hackathon)

### Issue
The WASM smart contract currently uses simplified validation that checks for the presence of non-empty charm data but doesn't fully deserialize and validate the `CircleState` struct.

### Root Cause
CBOR deserialization of complex nested structures (CircleState with Vec<Member>) fails in the WASM runtime with `data.value::<CircleState>()`, despite working correctly in native Rust tests. This appears to be a WASM-specific runtime issue.

### Current Workaround (Hackathon Version)

```rust
fn app_contract_impl(app: &App, tx: &Transaction, _x: &Data, _w: &Data) -> Result<()> {
    let new_state_data = tx
        .outs
        .iter()
        .find_map(|out| out.get(app))
        .ok_or_else(|| anyhow::anyhow!("No charm data found for app in outputs"))?;

    ensure!(!new_state_data.is_empty(), "Charm data cannot be empty");
    Ok(())
}
```

### Validation Strategy
- **On-chain**: Basic data presence check (current)
- **Backend**: Full state validation in Node.js service
- **Future**: Full covenant-based validation once deserialization is resolved

### Impact
- ✅ Circle creation works on testnet
- ✅ State is correctly serialized and stored
- ✅ Backend can decode and validate all transitions
- ⚠️ Covenant doesn't enforce ROSCA rules yet
- ⚠️ Requires trust in backend during demo phase

### Planned Resolution
1. Investigate Charms SDK data format expectations for custom apps
2. Test with simplified state structures
3. Consult Charms SDK maintainers about CBOR deserialization in WASM
4. Implement full covenant validation before production

### Evidence of Working Serialization
```bash
# Native Rust tests pass
$ cargo test test_charms_data_compatibility
✓ Serialization roundtrip works
✓ Data::from() and data.value() work in native

# CBOR structure is valid
$ ./target/release/test_deserialization ...
✓ Serialized 463 bytes
✓ Successfully deserialized!
✓ State validation passed!
✓ Roundtrip test passed!
```

## 2. Future Enhancements

- [ ] Add dispute resolution mechanism
- [ ] Implement automated payout triggers
- [ ] Add multi-signature support for large circles
- [ ] Create mobile app interface
- [ ] Add mainnet deployment after security audit

## Technical Debt

- Cleanup commented code in src/lib.rs after validation fix
- Add comprehensive integration tests
- Improve error messages in contract validation
- Add monitoring and alerting for failed transactions
