# Scripts Cleanup Summary

**Date:** January 3, 2026
**Action:** Archived unused CLI-based scripts

## ✅ Active Scripts (Kept)

### Development & Testing
- **`start-backend.sh`** - Starts the development backend server
- **`test-create-circle-api.sh`** - Tests circle creation API endpoint
- **`test-join-circle-api.sh`** - Tests circle joining API endpoint

### Backend Integration
- **`get-circle-state.sh`** - Extracts circle state from UTXOs (called by circle.service.ts)

### Documentation
- **`README.md`** - Scripts documentation
- **`TESTING_GUIDE.md`** - Testing instructions
- **`WALLET_SETUP.md`** - Wallet setup guide

## 📦 Archived Scripts (Moved to `archive/`)

The following scripts were moved to `scripts/archive/` as they are no longer used in the current API-based implementation:

1. **`run-create-circle.sh`** - Old CLI-based circle creation (replaced by web UI)
2. **`run-join-circle.sh`** - Old CLI-based joining (replaced by web UI)
3. **`run-contribute.sh`** - Old CLI-based contributions (not yet implemented)
4. **`find-circle-utxo.sh`** - Old UTXO finder helper
5. **`check-utxo-confirmation.sh`** - Old confirmation checker
6. **`load-wallet.sh`** - Old wallet loader (handled by backend now)

## Why This Cleanup?

The CharmCircle application has evolved from a CLI-based workflow to a modern web application:

- ✅ **Before:** Manual script execution for each operation
- ✅ **Now:** Web UI with REST API backend
- ✅ **Benefit:** Better UX, automatic UTXO management, proper state tracking

## Location of Archived Scripts

All archived scripts are preserved in:
```
/home/joanne/charmcircle/scripts/archive/
```

See `scripts/archive/README.md` for details about each archived script and why it was replaced.

## Current Workflow

### Creating a Circle
- **Old:** `./scripts/run-create-circle.sh`
- **New:** Use the web UI at http://localhost:5173 → "Create Circle" button

### Joining a Circle
- **Old:** `./scripts/run-join-circle.sh`
- **New:** Use the web UI → Click "Join Circle" on any available circle

### Testing
- **API Testing:** Use `test-create-circle-api.sh` and `test-join-circle-api.sh`
- **Manual Testing:** Use the web UI with browser DevTools for debugging
