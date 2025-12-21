import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

export function errorHandler(
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
): void {
    // If response already sent, delegate to default Express error handler
    if (res.headersSent) {
        return next(err);
    }

    // Handle AppError (our custom error type)
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            success: false,
            error: {
                message: err.message,
                code: err.code,
                statusCode: err.statusCode,
            },
        });
        return;
    }

    // Handle unexpected errors
    console.error("Unexpected error:", err);

    res.status(500).json({
        success: false,
        error: {
            message:
                process.env.NODE_ENV === "production"
                    ? "Internal server error"
                    : err.message,
            code: "INTERNAL_SERVER_ERROR",
            statusCode: 500,
        },
    });
}
