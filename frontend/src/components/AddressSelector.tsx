import React, { useState, useEffect } from "react";

interface WalletAddress {
    index: number;
    address: string;
    pubkey: string;
}

interface AddressSelectorProps {
    onSelect: (address: string, pubkey: string) => void;
    selectedAddress?: string;
}

export const AddressSelector: React.FC<AddressSelectorProps> = ({
    onSelect,
    selectedAddress,
}) => {
    const [addresses, setAddresses] = useState<WalletAddress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchAddresses();
    }, []);

    const fetchAddresses = async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await fetch(
                "http://localhost:3001/api/wallet/addresses"
            );

            if (!response.ok) {
                throw new Error("Failed to fetch wallet addresses");
            }

            const data = await response.json();
            setAddresses(data.data);

            // Auto-select first address if none selected
            if (data.data.length > 0 && !selectedAddress) {
                onSelect(data.data[0].address, data.data[0].pubkey);
            }
        } catch (err) {
            console.error("Failed to fetch addresses:", err);
            setError(
                err instanceof Error ? err.message : "Failed to fetch addresses"
            );
        } finally {
            setLoading(false);
        }
    };

    const shortenAddress = (addr: string) => {
        if (addr.length <= 16) return addr;
        return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
    };

    if (loading) {
        return (
            <div className="text-sm text-gray-cool/70">
                Loading wallet addresses...
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-sm text-red-400">
                {error}
                <button
                    type="button"
                    onClick={fetchAddresses}
                    className="ml-2 text-cyan-accent hover:underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (addresses.length === 0) {
        return (
            <div className="text-sm text-gray-cool/70">
                No addresses found in wallet
            </div>
        );
    }

    return (
        <div>
            <label className="block text-sm font-medium text-gray-cool mb-2">
                Wallet Address
            </label>
            <select
                value={selectedAddress || addresses[0]?.address}
                onChange={(e) => {
                    const selected = addresses.find(
                        (a) => a.address === e.target.value
                    );
                    if (selected) {
                        onSelect(selected.address, selected.pubkey);
                    }
                }}
                className="w-full px-3 py-2 bg-midnight border border-cyan-accent/30 rounded-lg text-gray-cool focus:outline-none focus:ring-2 focus:ring-cyan-accent/50"
            >
                {addresses.map((addr) => (
                    <option key={addr.address} value={addr.address}>
                        Address {addr.index + 1}: {shortenAddress(addr.address)}
                    </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-gray-cool/60">
                Select which wallet address to use for this action
            </p>
        </div>
    );
};
