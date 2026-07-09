// Entry point for the AI Investment Research Agent backend.
// A tiny Express server that exposes a single POST /analyze endpoint.

import "dotenv/config";
import express from "express";
import cors from "cors";
import analyzeRouter from "./routes/analyze.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Mount the /analyze route
app.use("/analyze", analyzeRouter);

const PORT = process.env.PORT || 8001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[backend] AI Investment Research Agent listening on port ${PORT}`);
});

export default app;
