# Archived Scripts

This directory contains scripts from the old CLI-based workflow that are no longer used in the current API-based implementation.

## Why These Were Archived

The CharmCircle application has evolved from a CLI-based workflow to a full web application with a REST API backend. These scripts were part of the original implementation but are now superseded by:

- **Backend API endpoints** (`/api/circles/*`, `/api/wallet/*`)
- **Frontend UI** (React components for creating/joining circles)
- **Automated testing scripts** (test-create-circle-api.sh, test-join-circle-api.sh)

## Archived Scripts

### `run-create-circle.sh`
**Status:** Replaced by `/api/spells/build-and-prove` endpoint and CreateCircleModal.tsx
**Original Purpose:** CLI-based circle creation using charms spell commands
**Why Archived:** Circle creation now happens through the web UI

### `run-join-circle.sh`
**Status:** Replaced by `/api/circles/:circleId/join` endpoint and JoinCircleModal.tsx
**Original Purpose:** CLI-based joining of circles
**Why Archived:** Joining now happens through the web UI with automatic UTXO management

### `run-contribute.sh`
**Status:** Not implemented in current version
**Original Purpose:** CLI-based contributions to circles
**Why Archived:** Contribution feature pending implementation in web UI

### `find-circle-utxo.sh`
**Status:** Replaced by circle discovery API
**Original Purpose:** Helper script to find circle UTXOs
**Why Archived:** Backend now tracks circles in storage and provides discovery API

### `check-utxo-confirmation.sh`
**Status:** Functionality integrated into backend
**Original Purpose:** Check UTXO confirmations on Bitcoin
**Why Archived:** Backend handles UTXO verification automatically

### `load-wallet.sh`
**Status:** Replaced by backend wallet initialization
**Original Purpose:** Load Bitcoin wallet via CLI
**Why Archived:** Backend automatically loads wallet on startup

## Current Active Scripts

See the main `scripts/` directory for currently used scripts:
- `start-backend.sh` - Development server startup
- `get-circle-state.sh` - Circle state extraction (used by backend)
- `test-create-circle-api.sh` - API testing for circle creation
- `test-join-circle-api.sh` - API testing for joining circles

## Restoration

If you need to restore any of these scripts for reference or historical purposes, they are preserved here exactly as they were when archived on 2026-01-03.
