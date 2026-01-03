import { Router } from "express";
import { WalletController } from "../controllers/wallet.controller";

const router = Router();
const walletController = new WalletController();

// Generate a fresh UTXO
router.get("/utxos/fresh", (req, res) =>
    walletController.generateFreshUtxo(req, res)
);

// Get wallet addresses
router.get("/addresses", (req, res) =>
    walletController.getAddresses(req, res)
);

// Get pubkey for specific address
router.get("/address/:address/pubkey", (req, res) =>
    walletController.getPubkeyForAddress(req, res)
);

export default router;
