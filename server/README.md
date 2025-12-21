# CharmCircle Server

Express TypeScript server that bridges the React frontend to the Charms CLI.

## Features

- Build spells from templates with parameter substitution
- Check spells using `charms spell check`
- Generate unsigned PSBTs using `charms spell prove`
- Error handling and CORS support
- TypeScript implementation

## Setup

```bash
cd server
npm install
```

## Configuration

Create a `.env` file (optional):

```env
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Development

```bash
npm run dev
```

The server will run on `http://localhost:3001` (or the port specified in `.env`).

## Production

```bash
npm run build
npm start
```

## API Endpoints

### POST `/api/spells/build`

Build a spell from template with parameter substitution.

**Request Body:**
```json
{
  "templateName": "create-circle",
  "parameters": {
    "app_id": "abc123...",
    "app_vk": "def456...",
    "in_utxo_0": "txid:0",
    "circle_address": "tb1q...",
    "circle_state_serialized": "..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "spellYaml": "...",
    "templateName": "create-circle"
  }
}
```

### POST `/api/spells/check`

Check a spell using `charms spell check`.

**Request Body:**
```json
{
  "spellYaml": "...",
  "appBin": "./target/wasm32-wasip1/release/charmcircle.wasm",
  "prevTxs": "02000000..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "output": "Spell check passed"
  }
}
```

### POST `/api/spells/prove`

Generate unsigned PSBT using `charms spell prove`.

**Request Body:**
```json
{
  "spellYaml": "...",
  "appBin": "./target/wasm32-wasip1/release/charmcircle.wasm",
  "prevTxs": "02000000...",
  "fundingUtxo": "txid:0",
  "fundingUtxoValue": 5000,
  "changeAddress": "tb1q..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "psbt": "cHNidP8BA...",
    "output": "..."
  }
}
```

### POST `/api/spells/build-and-check`

Build spell from template and check it in one request.

**Request Body:**
```json
{
  "templateName": "create-circle",
  "parameters": { ... },
  "appBin": "...",
  "prevTxs": "..."
}
```

### POST `/api/spells/build-and-prove`

Build spell from template and generate PSBT in one request.

**Request Body:**
```json
{
  "templateName": "create-circle",
  "parameters": { ... },
  "appBin": "...",
  "prevTxs": "...",
  "fundingUtxo": "...",
  "fundingUtxoValue": 5000,
  "changeAddress": "..."
}
```

## Error Handling

All errors are returned in a consistent format:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

## CORS

CORS is enabled for local development. Configure the allowed origin via the `FRONTEND_URL` environment variable.

## Project Structure

```
server/
├── src/
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── routes/          # Route definitions
│   ├── middleware/      # Express middleware
│   ├── utils/          # Utility functions
│   └── index.ts        # Entry point
├── dist/               # Compiled JavaScript (generated)
├── temp/               # Temporary spell files (generated)
└── package.json
```

## Notes

- The server expects to be run from the project root (where `spells/` directory exists)
- Temporary spell files are created in `server/temp/` directory
- The `charms` CLI must be installed and available in PATH
- PSBT extraction from `charms spell prove` output may need adjustment based on actual CLI output format

