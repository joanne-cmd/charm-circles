import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { spellRouter } from "./routes/spell.routes";
import { circleRouter } from "./routes/circle.routes";
import walletRouter from "./routes/wallet.routes";
import { errorHandler } from "./middleware/errorHandler";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
    })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/spells", spellRouter);
app.use("/api/circles", circleRouter);
app.use("/api/wallet", walletRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(
        `📡 CORS enabled for: ${
            process.env.FRONTEND_URL || "http://localhost:5173"
        }`
    );
});
