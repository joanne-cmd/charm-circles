/**
 * Custom application error class
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly isOperational: boolean;

    constructor(
        message: string,
        statusCode: number = 500,
        code: string = "APP_ERROR"
    ) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Common error codes
 */
export const ErrorCodes = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
    CHARMS_CLI_ERROR: "CHARMS_CLI_ERROR",
    TEMPLATE_NOT_FOUND: "TEMPLATE_NOT_FOUND",
    INVALID_SPELL: "INVALID_SPELL",
} as const;
