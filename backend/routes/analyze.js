// routes/analyze.js
// Handles POST /analyze — validates input, calls the LangChain agent, returns JSON.
// Includes automatic retry with backoff for Gemini 429 rate-limit errors (free tier).

import { Router } from "express";
import { analyzeCompany } from "../services/agent.js";

const router = Router();

// Retry helper — waits `ms` milliseconds then retries the fn up to `retries` times.
// Only retries on 429 rate-limit errors from Gemini.
async function withRetry(fn, retries = 3, baseDelayMs = 12000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRateLimit = err?.status === 429 || err?.message?.includes("429");
      if (isRateLimit && attempt < retries) {
        // Extract retryDelay from Gemini error details if available
        const retryDelayStr = err?.errorDetails?.find(
          (d) => d.retryDelay
        )?.retryDelay;
        const retryDelaySec = retryDelayStr
          ? parseInt(retryDelayStr, 10)
          : baseDelayMs / 1000;
        const waitMs = Math.min((retryDelaySec + 2) * 1000, 70000); // cap at 70s
        console.log(
          `[/analyze] Rate limited (attempt ${attempt}/${retries}). Retrying in ${waitMs / 1000}s...`
        );
        await new Promise((r) => setTimeout(r, waitMs));
      } else {
        throw err;
      }
    }
  }
}

router.post("/", async (req, res) => {
  const { company } = req.body ?? {};

  // Input validation
  if (!company || typeof company !== "string" || company.trim().length === 0) {
    return res.status(400).json({
      error: "Please provide a non-empty 'company' field in the request body.",
    });
  }

  try {
    const result = await withRetry(() => analyzeCompany(company.trim()));
    return res.json(result);
  } catch (err) {
    console.error("[/analyze] error:", err);

    const isRateLimit = err?.status === 429 || err?.message?.includes("429");
    if (isRateLimit) {
      return res.status(429).json({
        error:
          "The AI service is busy (rate limit). Please wait 30 seconds and try again.",
        detail: err.message,
      });
    }

    return res.status(500).json({
      error: "Failed to analyze the company. Please try again.",
      detail: err.message,
    });
  }
});

export default router;
