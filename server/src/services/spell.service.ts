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
            const cmdParts: string[] = ["charms", "spell", "prove"];

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

            cmdParts.push(tempSpellPath);

            const command = cmdParts.join(" ");

            try {
                const { stdout, stderr } = await execAsync(command, {
                    cwd: join(process.cwd(), ".."), // Run from project root
                    maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                });

                const output = stdout || stderr || "";

                // Extract PSBT from output
                // The PSBT is typically base64 encoded and may appear in the output
                // Adjust this regex based on actual charms CLI output format
                const psbtMatch =
                    output.match(/psbt[:\s]+([A-Za-z0-9+/=]+)/i) ||
                    output.match(/(c[HB][A-Za-z0-9+/=]{100,})/); // Base64 PSBT pattern

                const psbt = psbtMatch ? psbtMatch[1] : "";

                if (!psbt) {
                    // If PSBT not found in output, return the full output
                    // The frontend can parse it or we can adjust the extraction logic
                    return {
                        psbt: "",
                        output: output,
                        error: "PSBT not found in output. Check the output field for details.",
                    };
                }

                return {
                    psbt,
                    output: output,
                };
            } catch (execError: any) {
                const errorOutput =
                    execError.stderr || execError.stdout || execError.message;

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
