/**
 * WalletService - UniSat Wallet Integration
 *
 * Provides methods to interact with the UniSat Bitcoin wallet extension.
 * Handles connection, balance queries, UTXO retrieval, and PSBT signing.
 */

// UniSat wallet types
interface UniSatWallet {
    requestAccounts(): Promise<string[]>;
    getAccounts(): Promise<string[]>;
    getPublicKey(): Promise<string>;
    getBalance(): Promise<{
        confirmed: number;
        unconfirmed: number;
        total: number;
    }>;
    getInscriptions(start?: number, size?: number): Promise<any>;
    sendBitcoin(to: string, satoshis: number, options?: any): Promise<string>;
    signPsbt(psbt: string, options?: any): Promise<string>;
    pushPsbt(psbt: string): Promise<string>;
    switchNetwork(network: "livenet" | "testnet"): Promise<void>;
    on(event: string, callback: (...args: any[]) => void): void;
    removeListener(event: string, callback: (...args: any[]) => void): void;
}

interface UTXO {
    txId: string;
    outputIndex: number;
    satoshis: number;
    scriptPk: string;
    addressType: string;
    inscriptions?: any[];
}

declare global {
    interface Window {
        unisat?: UniSatWallet;
    }
}

export class WalletService {
    private static instance: WalletService;
    private isConnected: boolean = false;
    private currentAddress: string | null = null;

    private constructor() {}

    public static getInstance(): WalletService {
        if (!WalletService.instance) {
            WalletService.instance = new WalletService();
        }
        return WalletService.instance;
    }

    /**
     * Check if UniSat wallet is installed
     */
    public isWalletInstalled(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof window.unisat !== "undefined"
        );
    }

    /**
     * Connect to UniSat wallet
     * @returns The connected Bitcoin address
     */
    public async connect(): Promise<string> {
        if (!this.isWalletInstalled()) {
            throw new Error(
                "UniSat wallet is not installed. Please install it from https://unisat.io/"
            );
        }

        try {
            const accounts = await window.unisat!.requestAccounts();

            if (accounts.length === 0) {
                throw new Error(
                    "No accounts found. Please create an account in UniSat wallet."
                );
            }

            this.currentAddress = accounts[0];
            this.isConnected = true;

            // Listen for account changes
            this.setupAccountChangeListener();

            return this.currentAddress;
        } catch (error: any) {
            this.isConnected = false;
            this.currentAddress = null;

            if (error.code === 4001) {
                throw new Error("User rejected the connection request");
            }

            throw new Error(
                `Failed to connect wallet: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Disconnect from wallet
     */
    public disconnect(): void {
        this.isConnected = false;
        this.currentAddress = null;
    }

    /**
     * Get current connected address
     */
    public getAddress(): string | null {
        return this.currentAddress;
    }

    /**
     * Check if wallet is connected
     */
    public getIsConnected(): boolean {
        return this.isConnected && this.currentAddress !== null;
    }

    /**
     * Get wallet balance
     * @returns Balance in satoshis
     */
    public async getBalance(): Promise<number> {
        if (!this.isConnected || !this.currentAddress) {
            throw new Error("Wallet is not connected");
        }

        if (!this.isWalletInstalled()) {
            throw new Error("UniSat wallet is not installed");
        }

        try {
            const balance = await window.unisat!.getBalance();
            return balance.total;
        } catch (error: any) {
            throw new Error(
                `Failed to get balance: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Get UTXOs (Unspent Transaction Outputs) for the current address
     * @param _start Starting index for pagination
     * @param _size Number of UTXOs to retrieve
     * @returns Array of UTXOs
     */
    public async getUTXOs(
        _start: number = 0,
        _size: number = 20
    ): Promise<UTXO[]> {
        if (!this.isConnected || !this.currentAddress) {
            throw new Error("Wallet is not connected");
        }

        if (!this.isWalletInstalled()) {
            throw new Error("UniSat wallet is not installed");
        }

        try {
            // UniSat doesn't have a direct getUTXOs method, but we can use getInscriptions
            // For a full implementation, you might need to query a Bitcoin indexer API
            // This is a placeholder that would need to be implemented with an external service
            throw new Error(
                "getUTXOs requires integration with a Bitcoin indexer API"
            );
        } catch (error: any) {
            throw new Error(
                `Failed to get UTXOs: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Sign a PSBT (Partially Signed Bitcoin Transaction)
     * @param psbt Base64 encoded PSBT
     * @param options Signing options
     * @returns Signed PSBT
     */
    public async signPSBT(
        psbt: string,
        options?: { autoFinalized?: boolean }
    ): Promise<string> {
        if (!this.isConnected || !this.currentAddress) {
            throw new Error("Wallet is not connected");
        }

        if (!this.isWalletInstalled()) {
            throw new Error("UniSat wallet is not installed");
        }

        try {
            const signedPsbt = await window.unisat!.signPsbt(psbt, {
                autoFinalized: options?.autoFinalized ?? false,
            });
            return signedPsbt;
        } catch (error: any) {
            if (error.code === 4001) {
                throw new Error("User rejected the signing request");
            }
            throw new Error(
                `Failed to sign PSBT: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Push a signed PSBT to the Bitcoin network
     * @param psbt Signed PSBT
     * @returns Transaction ID
     */
    public async pushPSBT(psbt: string): Promise<string> {
        if (!this.isConnected || !this.currentAddress) {
            throw new Error("Wallet is not connected");
        }

        if (!this.isWalletInstalled()) {
            throw new Error("UniSat wallet is not installed");
        }

        try {
            const txid = await window.unisat!.pushPsbt(psbt);
            return txid;
        } catch (error: any) {
            throw new Error(
                `Failed to push PSBT: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Switch network (mainnet/testnet)
     * @param network Network to switch to
     */
    public async switchNetwork(network: "livenet" | "testnet"): Promise<void> {
        if (!this.isWalletInstalled()) {
            throw new Error("UniSat wallet is not installed");
        }

        try {
            await window.unisat!.switchNetwork(network);
        } catch (error: any) {
            throw new Error(
                `Failed to switch network: ${error.message || "Unknown error"}`
            );
        }
    }

    /**
     * Setup listener for account changes
     */
    private setupAccountChangeListener(): void {
        if (!this.isWalletInstalled()) {
            return;
        }

        const handleAccountsChanged = (accounts: string[]) => {
            if (accounts.length === 0) {
                this.disconnect();
            } else if (accounts[0] !== this.currentAddress) {
                this.currentAddress = accounts[0];
            }
        };

        window.unisat!.on("accountsChanged", handleAccountsChanged);
    }

    /**
     * Format satoshis to BTC with proper decimal places
     */
    public formatBalance(satoshis: number): string {
        const btc = satoshis / 100_000_000;
        if (btc === 0) return "0";
        if (btc < 0.00001) return "< 0.00001";
        return btc.toFixed(8).replace(/\.?0+$/, "");
    }

    /**
     * Format address for display (show first 6 and last 4 characters)
     */
    public formatAddress(address: string): string {
        if (address.length <= 10) return address;
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
}
