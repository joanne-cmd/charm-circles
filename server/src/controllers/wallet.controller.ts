import { Request, Response } from "express";
import { BitcoinService } from "../services/bitcoin.service";
import { AppError } from "../utils/errors";

export class WalletController {
    private bitcoinService: BitcoinService;
    private usedUtxos: Set<string>; // Track used UTXOs to prevent duplicates

    constructor() {
        this.bitcoinService = new BitcoinService();
        this.usedUtxos = new Set();
    }

    /**
     * Generate a fresh UTXO for use in transactions
     * This prevents the "duplicate funding UTXO spend" error
     */
    async generateFreshUtxo(req: Request, res: Response): Promise<void> {
        try {
            const { amount = 2000 } = req.query; // Default 2000 sats
            const amountBtc = Number(amount) / 100000000; // Convert sats to BTC

            console.log("[WALLET] Generating fresh UTXO for", amount, "sats");

            // Generate new address
            const address = await this.bitcoinService.getNewAddress();
            console.log("[WALLET] Generated address:", address);

            // Send Bitcoin to create UTXO
            const txid = await this.bitcoinService.sendToAddress(
                address,
                amountBtc
            );
            console.log("[WALLET] Created transaction:", txid);

            // Get transaction to find the vout
            const tx = await this.bitcoinService.getRawTransaction(txid);

            // Find which output is ours
            let vout = -1;
            for (let i = 0; i < tx.vout.length; i++) {
                if (
                    tx.vout[i].scriptPubKey.address === address &&
                    tx.vout[i].value === amountBtc
                ) {
                    vout = i;
                    break;
                }
            }

            if (vout === -1) {
                throw new AppError("Could not find UTXO in transaction", 500);
            }

            const utxo = `${txid}:${vout}`;

            // Mark as used to prevent duplicate usage
            this.usedUtxos.add(utxo);
            console.log("[WALLET] Fresh UTXO created:", utxo);

            res.json({
                success: true,
                data: {
                    utxo,
                    txid,
                    vout,
                    amount: Number(amount),
                    address,
                },
            });
        } catch (error) {
            console.error("[WALLET] Failed to generate UTXO:", error);
            if (error instanceof AppError) {
                res.status(error.statusCode).json({
                    success: false,
                    error: error.message,
                });
            } else {
                res.status(500).json({
                    success: false,
                    error: "Failed to generate UTXO",
                });
            }
        }
    }

    /**
     * Get list of wallet addresses with their details
     */
    async getAddresses(req: Request, res: Response): Promise<void> {
        try {
            console.log("[WALLET] Getting wallet addresses");

            // Get address info for first few addresses
            const addresses = [];

            // Try to get up to 5 addresses
            for (let i = 0; i < 5; i++) {
                try {
                    const address = await this.bitcoinService.getAddressByIndex(i);
                    const pubkey = await this.bitcoinService.getPubkeyForAddress(address);

                    addresses.push({
                        index: i,
                        address,
                        pubkey,
                    });
                } catch (error) {
                    // Stop if we can't get more addresses
                    break;
                }
            }

            console.log("[WALLET] Found", addresses.length, "addresses");

            res.json({
                success: true,
                data: addresses,
            });
        } catch (error) {
            console.error("[WALLET] Failed to get addresses:", error);
            res.status(500).json({
                success: false,
                error: "Failed to get wallet addresses",
            });
        }
    }

    /**
     * Get public key for a specific address
     */
    async getPubkeyForAddress(req: Request, res: Response): Promise<void> {
        try {
            const { address } = req.params;
            console.log("[WALLET] Getting pubkey for address:", address);

            const pubkey = await this.bitcoinService.getPubkeyForAddress(address);

            res.json({
                success: true,
                data: {
                    address,
                    pubkey,
                },
            });
        } catch (error) {
            console.error("[WALLET] Failed to get pubkey:", error);
            res.status(500).json({
                success: false,
                error: "Failed to get public key for address",
            });
        }
    }

    /**
     * Check if a UTXO has already been used
     */
    isUtxoUsed(utxo: string): boolean {
        return this.usedUtxos.has(utxo);
    }

    /**
     * Mark a UTXO as used to prevent duplicate usage
     */
    markUtxoAsUsed(utxo: string): void {
        this.usedUtxos.add(utxo);
        console.log("[WALLET] Marked UTXO as used:", utxo);
    }
}
