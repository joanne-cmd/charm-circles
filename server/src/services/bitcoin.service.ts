import { exec } from "child_process";
import { promisify } from "util";
import { AppError } from "../utils/errors";

const execAsync = promisify(exec);

export class BitcoinService {
    private readonly btcCli: string;

    constructor() {
        // Use testnet by default, can be configured via env
        this.btcCli = process.env.BTC_CLI || "bitcoin-cli -testnet4";
    }

    /**
     * Get raw transaction hex by transaction ID
     * @param txid Transaction ID
     * @returns Raw transaction hex
     */
    async getTransaction(txid: string): Promise<string> {
        try {
            // Try getrawtransaction first (faster)
            const { stdout } = await execAsync(
                `${this.btcCli} getrawtransaction "${txid}" false`
            );

            const txHex = stdout.trim();

            if (!txHex || txHex.length === 0) {
                throw new Error("Transaction not found or empty");
            }

            return txHex;
        } catch (error: any) {
            // If getrawtransaction fails, try gettransaction
            try {
                const { stdout } = await execAsync(
                    `${this.btcCli} gettransaction "${txid}"`
                );
                const tx = JSON.parse(stdout);
                if (tx.hex) {
                    return tx.hex;
                }
            } catch (innerError) {
                // Ignore and throw original error
            }

            const errorMessage = error.stderr || error.stdout || error.message;
            throw new AppError(
                `Failed to get transaction ${txid}: ${errorMessage}`,
                500
            );
        }
    }

    /**
     * Get unspent transaction outputs
     * @param address Optional address to filter by
     * @returns Array of UTXOs
     */
    async getUnspentOutputs(address?: string): Promise<any[]> {
        try {
            const cmd = address
                ? `${this.btcCli} listunspent 0 9999999 '["${address}"]'`
                : `${this.btcCli} listunspent 0 9999999 '[]'`;

            const { stdout } = await execAsync(cmd, {
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
            });

            const utxos = JSON.parse(stdout);

            if (!Array.isArray(utxos)) {
                return [];
            }

            // Format UTXOs to match expected structure (txId, outputIndex, satoshis)
            return utxos.map((utxo: any) => ({
                txId: utxo.txid || utxo.txId,
                outputIndex:
                    utxo.vout !== undefined ? utxo.vout : utxo.outputIndex,
                satoshis: utxo.amount
                    ? Math.round(utxo.amount * 100000000)
                    : utxo.satoshis || 0,
                scriptPk: utxo.scriptPubKey || utxo.scriptPk,
                addressType: utxo.addressType || "unknown",
                address: utxo.address,
                confirmations: utxo.confirmations || 0,
            }));
        } catch (error: any) {
            const errorMessage = error.stderr || error.stdout || error.message;
            throw new AppError(
                `Failed to get unspent outputs: ${errorMessage}`,
                500
            );
        }
    }

    /**
     * Get transaction details (decoded)
     * @param txid Transaction ID
     * @returns Decoded transaction object
     */
    async getTransactionDetails(txid: string): Promise<any> {
        try {
            const { stdout } = await execAsync(
                `${this.btcCli} getrawtransaction "${txid}" true`
            );

            return JSON.parse(stdout);
        } catch (error: any) {
            const errorMessage = error.stderr || error.stdout || error.message;
            throw new AppError(
                `Failed to get transaction details: ${errorMessage}`,
                500
            );
        }
    }

    /**
     * Extract UTXO from string format (txid:index)
     * @param utxoString UTXO in format "txid:index"
     * @returns Object with txid and vout
     */
    parseUtxo(utxoString: string): { txid: string; vout: number } {
        const parts = utxoString.split(":");
        if (parts.length !== 2) {
            throw new AppError(
                `Invalid UTXO format: ${utxoString}. Expected: txid:index`,
                400
            );
        }

        const txid = parts[0];
        const vout = parseInt(parts[1], 10);

        if (isNaN(vout) || vout < 0) {
            throw new AppError(`Invalid UTXO index: ${parts[1]}`, 400);
        }

        return { txid, vout };
    }
}
