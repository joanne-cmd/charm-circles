# CharmCircle Frontend

React TypeScript frontend for the Bitcoin ROSCA (Rotating Savings and Credit Association) dapp.

## Features

- **UniSat Wallet Integration**: Connect and interact with UniSat Bitcoin wallet
- **Wallet Management**: View balance, address, and manage wallet connection
- **PSBT Signing**: Sign and push Partially Signed Bitcoin Transactions
- **Modern UI**: Built with React, TypeScript, and Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- UniSat wallet browser extension installed

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build

```bash
npm run build
```

The production build will be in the `dist` folder.

## Project Structure

```
frontend/
├── src/
│   ├── components/       # React components
│   │   └── Header.tsx   # Header with wallet connection
│   ├── contexts/         # React contexts
│   │   └── WalletContext.tsx  # Wallet state management
│   ├── services/         # Service classes
│   │   └── WalletService.ts   # UniSat wallet integration
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles with Tailwind
├── index.html
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## WalletService

The `WalletService` class provides:

- `connect()`: Connect to UniSat wallet
- `disconnect()`: Disconnect from wallet
- `getBalance()`: Get wallet balance in satoshis
- `getUTXOs()`: Get unspent transaction outputs (requires indexer API)
- `signPSBT()`: Sign a Partially Signed Bitcoin Transaction
- `pushPSBT()`: Push a signed PSBT to the network
- `switchNetwork()`: Switch between mainnet and testnet

## WalletContext

The `WalletContext` provides wallet state and functions to all components:

```tsx
const {
  isConnected,
  address,
  balance,
  connect,
  disconnect,
  signPSBT,
  pushPSBT,
  // ... more
} = useWallet();
```

## Components

### Header

The Header component displays:
- App branding
- Wallet connection button
- Connected address (truncated)
- Balance display
- Refresh balance button
- Disconnect button
- Error messages

## Styling

The project uses Tailwind CSS for styling. Configuration is in `tailwind.config.js`.

## License

MIT

