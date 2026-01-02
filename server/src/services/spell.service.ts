import { exec } from "child_process";
import { promisify } from "util";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { AppError } from "../utils/errors";

const execAsync = promisify(exec);

interface CheckSpellOptions {
    spellYaml: string;
    appBin?: string;
    prevTxs?: string;
}

interface ProveSpellOptions extends CheckSpellOptions {
    fundingUtxo?: string;
    fundingUtxoValue?: number;
    changeAddress?: string;
}

interface SpellCheckResult {
    valid: boolean;
    output: string;
    error?: string;
}

interface SpellProveResult {
    psbt: string;
    output: string;
    error?: string;
    transactions?: string[]; // Array of hex-encoded transactions from charms spell prove
}

export class SpellService {
    private readonly spellsDir: string;
    private readonly tempDir: string;

    constructor() {
        // Paths relative to project root (server is in server/ directory)
        this.spellsDir = join(process.cwd(), "..", "spells");
        this.tempDir = join(process.cwd(), "temp");
    }

    /**
     * Build spell from template with parameter substitution
     */
    async buildSpellFromTemplate(
        templateName: string,
        parameters: Record<string, string>
    ): Promise<string> {
        const templatePath = join(this.spellsDir, `${templateName}.yaml`);

        if (!existsSync(templatePath)) {
            throw new AppError(`Template not found: ${templateName}.yaml`, 404);
        }

        try {
            // Read template
            let template = await readFile(templatePath, "utf-8");

            // Substitute parameters
            // Replace ${variable} with parameter value
            for (const [key, value] of Object.entries(parameters)) {
                const regex = new RegExp(`\\$\\{${key}\\}`, "g");
                template = template.replace(regex, value);
            }

            // Check for unresolved variables (optional - can be removed if you want to allow partial substitution)
            const unresolvedVars = template.match(/\$\{[^}]+\}/g);
            if (unresolvedVars && unresolvedVars.length > 0) {
                console.warn(
                    `Warning: Unresolved variables found: ${unresolvedVars.join(
                        ", "
                    )}`
                );
            }

            return template;
        } catch (error: any) {
            throw new AppError(
                `Failed to build spell from template: ${error.message}`,
                500
            );
        }
    }

    /**
     * Check a spell using 'charms spell check'
     */
    async checkSpell(options: CheckSpellOptions): Promise<SpellCheckResult> {
        const { spellYaml, appBin, prevTxs } = options;

        try {
            // Ensure temp directory exists
            if (!existsSync(this.tempDir)) {
                await mkdir(this.tempDir, { recursive: true });
            }

            // Write spell to temporary file
            const tempSpellPath = join(
                this.tempDir,
                `spell-${Date.now()}.yaml`
            );
            await writeFile(tempSpellPath, spellYaml, "utf-8");

            // Build command
            const cmdParts: string[] = ["charms", "spell", "check"];

            if (appBin) {
                cmdParts.push(`--app-bins=${appBin}`);
            }

            if (prevTxs) {
                cmdParts.push(`--prev-txs=${prevTxs}`);
            }

            cmdParts.push(tempSpellPath);

            const command = cmdParts.join(" ");

            try {
                const { stdout, stderr } = await execAsync(command, {
                    cwd: join(process.cwd(), ".."), // Run from project root
                    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                });

                return {
                    valid: true,
                    output: stdout || stderr || "Spell check passed",
                };
            } catch (execError: any) {
                // execAsync throws on non-zero exit code
                // Check if it's actually an error or just informative output
                const errorOutput =
                    execError.stderr || execError.stdout || execError.message;

                // Some commands return non-zero but still provide useful output
                // You may want to adjust this logic based on actual charms CLI behavior
                if (
                    errorOutput.includes("error") ||
                    errorOutput.includes("Error")
                ) {
                    return {
                        valid: false,
                        output: errorOutput,
                        error: execError.message,
                    };
                }

                // If it's just a warning or info, consider it valid
                return {
                    valid: true,
                    output: errorOutput,
                };
            }
        } catch (error: any) {
            throw new AppError(`Failed to check spell: ${error.message}`, 500);
        }
    }

    /**
     * Generate unsigned PSBT using 'charms spell prove'
     */
    async proveSpell(options: ProveSpellOptions): Promise<SpellProveResult> {
        const {
            spellYaml,
            appBin,
            prevTxs,
            fundingUtxo,
            fundingUtxoValue,
            changeAddress,
        } = options;

        try {
            // Ensure temp directory exists
            if (!existsSync(this.tempDir)) {
                await mkdir(this.tempDir, { recursive: true });
            }

            // Write spell to temporary file
            const tempSpellPath = join(
                this.tempDir,
                `spell-${Date.now()}.yaml`
            );
            await writeFile(tempSpellPath, spellYaml, "utf-8");

            // Build command
            // Note: charms spell prove expects --spell flag or stdin, not positional argument
            const cmdParts: string[] = ["charms", "spell", "prove"];

            // Add spell file via --spell flag
            cmdParts.push(`--spell=${tempSpellPath}`);

            if (appBin) {
                cmdParts.push(`--app-bins=${appBin}`);
            }

            if (prevTxs) {
                cmdParts.push(`--prev-txs=${prevTxs}`);
            }

            if (fundingUtxo) {
                cmdParts.push(`--funding-utxo=${fundingUtxo}`);
            }

            if (fundingUtxoValue !== undefined) {
                cmdParts.push(`--funding-utxo-value=${fundingUtxoValue}`);
            }

            if (changeAddress) {
                cmdParts.push(`--change-address=${changeAddress}`);
            }

            const command = cmdParts.join(" ");

            console.log("[SPELL PROVE] Executing command:", command);
            console.log("[SPELL PROVE] Working directory:", join(process.cwd(), ".."));

            try {
                const { stdout, stderr } = await execAsync(command, {
                    cwd: join(process.cwd(), ".."), // Run from project root
                    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                });

                const output = stdout || stderr || "";

                console.log("[SPELL PROVE] stdout length:", stdout?.length || 0);
                console.log("[SPELL PROVE] stderr length:", stderr?.length || 0);
                console.log("[SPELL PROVE] stdout:", stdout?.substring(0, 500));
                console.log("[SPELL PROVE] stderr:", stderr?.substring(0, 500));

                // charms spell prove outputs a JSON array of transactions
                // Format: [{"bitcoin":"hex_tx1"},{"bitcoin":"hex_tx2"}]
                // We need to extract these and create a PSBT or return the transactions
                let psbt = "";
                let transactions: string[] = [];

                try {
                    // Try to parse as JSON array
                    const jsonMatch = output.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const jsonArray = JSON.parse(jsonMatch[0]);
                        if (Array.isArray(jsonArray)) {
                            // Extract transaction hex strings
                            transactions = jsonArray
                                .map((item: any) => {
                                    if (typeof item === "string") {
                                        return item;
                                    }
                                    if (item && typeof item === "object") {
                                        return (
                                            item.bitcoin ||
                                            item.hex ||
                                            item.tx ||
                                            ""
                                        );
                                    }
                                    return "";
                                })
                                .filter((tx: string) => tx.length > 0);

                            // For Charms transactions, we need to handle them specially
                            // Charms spell prove returns TWO transactions: commit + spell
                            // These need to be submitted as a package, not converted to PSBT
                            if (transactions.length > 0) {
                                console.log("[SPELL PROVE] Charms returned", transactions.length, "transaction(s)");
                                console.log("[SPELL PROVE] Transaction 1 length:", transactions[0]?.length);
                                if (transactions.length > 1) {
                                    console.log("[SPELL PROVE] Transaction 2 length:", transactions[1]?.length);
                                }

                                // Return the first transaction as-is (raw hex)
                                // Frontend will need to handle this appropriately
                                psbt = transactions[0];
                                console.log("[SPELL PROVE] Returning raw transaction (first 100 chars):", psbt.substring(0, 100));
                            }
                        }
                    }
                } catch (parseError) {
                    // JSON parsing failed, try regex extraction
                    console.warn(
                        "Failed to parse JSON output, trying regex:",
                        parseError
                    );
                }

                // If JSON parsing didn't work, try regex patterns
                if (!psbt) {
                    // Try to find PSBT in various formats
                    const psbtMatch =
                        output.match(/psbt[:\s]+([A-Za-z0-9+/=]+)/i) ||
                        output.match(/(c[HB][A-Za-z0-9+/=]{100,})/); // Base64 PSBT pattern

                    if (psbtMatch) {
                        psbt = psbtMatch[1];
                    }
                }

                // If still no PSBT, check for hex transaction patterns
                if (!psbt) {
                    // Look for hex-encoded transactions (usually start with 02000000 for Bitcoin)
                    const hexTxMatch = output.match(
                        /(02000000[0-9a-fA-F]{200,})/
                    );
                    if (hexTxMatch) {
                        psbt = hexTxMatch[1];
                        transactions = [hexTxMatch[1]];
                    }
                }

                if (!psbt && transactions.length === 0) {
                    // If PSBT not found in output, return the full output
                    return {
                        psbt: "",
                        output: output,
                        error: "PSBT or transaction not found in output. Check the output field for details.",
                    };
                }

                console.log("[SPELL PROVE] Final psbt (first 100):", psbt?.substring(0, 100));
                console.log("[SPELL PROVE] Final psbt (full length):", psbt?.length);
                console.log("[SPELL PROVE] Transactions count:", transactions.length);

                return {
                    psbt: psbt || transactions[0] || "",
                    output: output,
                    transactions:
                        transactions.length > 0 ? transactions : undefined,
                };
            } catch (execError: any) {
                console.log("[SPELL PROVE] Command failed with error:", execError.message);
                const errorOutput =
                    execError.stderr || execError.stdout || execError.message;
                console.log("[SPELL PROVE] Error output:", errorOutput?.substring(0, 500));

                // Check if it's the known WASI error (doesn't prevent spell from working)
                const isWasiError =
                    errorOutput.includes(
                        "wasi_snapshot_preview1::random_get"
                    ) ||
                    errorOutput.includes("cannot find definition for import");

                // Try to extract transactions/PSBT even if there's an error
                // charms spell prove outputs JSON array: [{"bitcoin":"hex_tx1"},{"bitcoin":"hex_tx2"}]
                let psbt = "";
                let transactions: string[] = [];

                // Try JSON array format first
                try {
                    const jsonMatch = errorOutput.match(/\[[\s\S]*\]/);
                    if (jsonMatch) {
                        const jsonArray = JSON.parse(jsonMatch[0]);
                        if (Array.isArray(jsonArray)) {
                            transactions = jsonArray
                                .map((item: any) => {
                                    if (typeof item === "string") return item;
                                    if (item && typeof item === "object") {
                                        return (
                                            item.bitcoin ||
                                            item.hex ||
                                            item.tx ||
                                            ""
                                        );
                                    }
                                    return "";
                                })
                                .filter((tx: string) => tx.length > 0);

                            if (transactions.length > 0) {
                                psbt = transactions[0]; // Use first transaction as PSBT
                            }
                        }
                    }
                } catch (parseError) {
                    // JSON parsing failed, try regex
                }

                // If JSON didn't work, try regex patterns
                if (!psbt) {
                    const psbtMatch =
                        errorOutput.match(/psbt[:\s]+([A-Za-z0-9+/=]+)/i) ||
                        errorOutput.match(/(c[HB][A-Za-z0-9+/=]{100,})/);

                    if (psbtMatch) {
                        psbt = psbtMatch[1];
                    } else {
                        // Try hex transaction pattern
                        const hexTxMatch = errorOutput.match(
                            /(02000000[0-9a-fA-F]{200,})/
                        );
                        if (hexTxMatch) {
                            psbt = hexTxMatch[1];
                            transactions = [hexTxMatch[1]];
                        }
                    }
                }

                if (psbt || transactions.length > 0) {
                    // Transactions found, return them even with error
                    return {
                        psbt: psbt || transactions[0] || "",
                        output: errorOutput,
                        transactions:
                            transactions.length > 0 ? transactions : undefined,
                        error: isWasiError
                            ? "WASI warning (known issue, transactions generated successfully)"
                            : execError.message,
                    };
                }

                return {
                    psbt: "",
                    output: errorOutput,
                    error: execError.message,
                };
            }
        } catch (error: any) {
            throw new AppError(`Failed to prove spell: ${error.message}`, 500);
        }
    }

    /**
     * Get list of available spell templates
     */
    async listTemplates(): Promise<string[]> {
        try {
            if (!existsSync(this.spellsDir)) {
                return [];
            }

            // This would require reading the directory
            // For now, return known templates
            const knownTemplates = [
                "create-circle",
                "join-circle",
                "contribute",
                "mint-nft",
                "mint-token",
                "send",
            ];

            // Filter to only return templates that actually exist
            const existingTemplates: string[] = [];
            for (const template of knownTemplates) {
                const templatePath = join(this.spellsDir, `${template}.yaml`);
                if (existsSync(templatePath)) {
                    existingTemplates.push(template);
                }
            }

            return existingTemplates;
        } catch (error: any) {
            throw new AppError(
                `Failed to list templates: ${error.message}`,
                500
            );
        }
    }
}
