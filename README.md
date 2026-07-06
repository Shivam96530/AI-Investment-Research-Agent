# AI Investment Research Agent

> A full-stack AI tool that takes a company name and returns a structured **Invest / Pass** recommendation — with pros, cons, risk level, reasoning, and a plain-English summary — powered by **LangChain.js** and **Groq (Llama 3)**.

---

## Table of Contents

1. [Overview](#overview)
2. [How to Run It](#how-to-run-it)
3. [How It Works](#how-it-works)
4. [Key Decisions & Trade-offs](#key-decisions--trade-offs)
5. [Example Runs](#example-runs)
6. [What I Would Improve With More Time](#what-i-would-improve-with-more-time)
7. [BONUS — LLM Chat Session Transcript](#bonus--llm-chat-session-transcript)
8. [Tech Stack](#tech-stack)
9. [Project Structure](#project-structure)
10. [API Reference](#api-reference)
11. [Deployment Guide](#deployment-guide)

---

## Overview

The **AI Investment Research Agent** is a minimal but complete full-stack application that simulates the work of an investment analyst. A user types any public company name, clicks **Analyze**, and within ~10–20 seconds receives a structured Invest or Pass recommendation, complete with:

- ? / ? **Recommendation** — Invest or Pass
- ?? **3–5 Pros** — key strengths and positive catalysts
- ?? **3–5 Cons** — key weaknesses and risks
- ?? **Risk Level** — Low / Medium / High
- ?? **Reasoning** — a short, plain-English paragraph explaining the decision
- ?? **Summary** — a single headline-style takeaway

The agent is powered by Groq (Llama 3) (`llama-3.3-70b-versatile`) via LangChain.js. The model is prompted to act as a pragmatic long-term retail investment analyst, instructed to be honest and lean toward `Pass` when confidence is low. The response is validated at runtime against a Zod schema, so the frontend always receives a typed, predictable JSON object — never freeform text to parse.

The frontend also displays the company's **official logo** automatically, fetched from the Brandfetch API (free tier) using the company name.

> **Disclaimer:** Not financial advice. For educational use only.

---

## How to Run It

### Prerequisites

| Tool | Minimum Version | Check |
|---|---|---|
| Node.js | 18.x | `node --version` |
| npm | 9.x | `npm --version` |
| Google AI Studio Key | — | [aistudio.google.com](https://aistudio.google.com/app/apikey) |

You need a **Google AI Studio API key** (free). Get one at: https://aistudio.google.com/app/apikey

---

### Step 1 — Download or Clone the project

```bash
# If using Git:
git clone <your-repo-url>
cd ai-investment-research-agent

# Or unzip the downloaded archive and cd into it.
```

---

### Step 2 — Configure the Backend

```bash
cd backend

# Install dependencies
npm install

# Create your .env file from the template
cp .env.example .env       # Mac/Linux
copy .env.example .env     # Windows (Command Prompt)
```

Open `backend/.env` and fill in your Google API key:

```env
GROQ_API_KEY=your-google-api-key-here
MODEL_NAME=llama-3.3-70b-versatile
PORT=8000
```

> `MODEL_NAME` and `PORT` are optional — the defaults shown above work fine.

---

### Step 3 — Start the Backend

```bash
# From the backend/ directory:
npm start
```

You should see:

```
[backend] AI Investment Research Agent listening on port 8000
```

Verify it is running:

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok"}
```

---

### Step 4 — Install Frontend Dependencies

Open a **new terminal** and run:

```bash
cd frontend
npm install
```

---

### Step 5 — Start the Frontend

```bash
# From the frontend/ directory:
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in XXX ms

  ?  Local:   http://localhost:3000/
```

---

### Step 6 — Use the App

Open **http://localhost:3000** in your browser.

1. Type a company name (e.g. `Apple`, `Reliance Industries`, `NVIDIA`)
2. Click **Analyze**
3. Wait ~10–20 seconds for Gemini to respond
4. Read the structured Invest/Pass recommendation — the company logo is displayed automatically

---

### Environment Variables Reference

#### `backend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `GROQ_API_KEY` | ? Yes | — | Your Google AI Studio API key |
| `MODEL_NAME` | No | `llama-3.3-70b-versatile` | Gemini model to use |
| `PORT` | No | `8001` | Port for the Express server |

---

## How It Works

### Architecture

```
+----------------------+   POST /analyze   +-----------------------------+
¦                      ¦ ----------------? ¦                             ¦
¦   React (Vite)       ¦                   ¦   Express (Node.js)         ¦
¦   App.jsx            ¦ ?---------------- ¦   routes/analyze.js         ¦
¦   localhost:3000     ¦   structured JSON ¦   services/agent.js         ¦
+----------------------+                   +-----------------------------+
                                                          ¦
                                             LangChain.js chain
                                                          ¦
                                                          ?
                                           +-----------------------------+
                                           ¦   Groq (Llama 3) API         ¦
                                           ¦   llama-3.3-70b-versatile          ¦
                                           +-----------------------------+
```

### LangChain.js Pipeline

The backend uses a single **LangChain.js chain** composed of three steps, chained with the pipe operator:

```
PromptTemplate  ?  ChatGoogleGenerativeAI  ?  StructuredOutputParser (Zod)
```

**Step 1 — PromptTemplate**
A detailed analyst prompt is built using the company name and injected format instructions. The model is instructed to consider market position, strengths, weaknesses, and material risks, then commit to `Invest` or `Pass`. The prompt explicitly tells the model to respond with **valid JSON only** — no markdown or prose wrapping.

**Step 2 — ChatGoogleGenerativeAI**
The formatted prompt is sent to Groq (Llama 3) (`llama-3.3-70b-versatile`) at temperature `0.3` — consistent enough for structured facts, varied enough to avoid repetitive phrasing.

**Step 3 — StructuredOutputParser (Zod)**
The model's JSON string output is parsed and validated against a Zod schema at runtime. If any required field is missing or has the wrong type, the parser throws and the backend returns HTTP 500. This means the frontend can trust the exact shape of every successful response — no client-side string parsing or type guarding required.

### Output Schema

```js
{
  company:        string                    // Company name (echoed back)
  recommendation: "Invest" | "Pass"         // Final decision
  pros:           string[]  (3–5 items)     // Key strengths
  cons:           string[]  (3–5 items)     // Key weaknesses / risks
  risk:           "Low" | "Medium" | "High"
  reason:         string                    // 2–4 sentence plain-English explanation
  summary:        string                    // One-line headline takeaway
}
```

### Frontend Design

The frontend is a **single-page React app** (Vite) with:
- A large hero text input — just type a company name and press Analyze
- A Vite dev proxy that forwards `/analyze` calls to `localhost:8000` (eliminates CORS entirely in dev)
- **Company logo** automatically fetched from the Brandfetch API (`https://cdn.brandfetch.io/{domain}.com`) and displayed next to the company name. Falls back silently if no logo is found — no broken images
- Staggered fade-up animations for the result grid on arrival
- Phosphor icons for the Invest/Pass badges
- Tailwind CSS with a custom semantic colour palette (`invest`, `pass`, `riskLow`, `riskMedium`, `riskHigh`)
- Swiss brutalist design: high contrast, hard edges, technical grid layout, General Sans font

---

## Key Decisions & Trade-offs

| Decision | Rationale |
|---|---|
| **Groq (Llama 3) over OpenAI** | Gemini 2.5 Flash is free-tier, fast (~10s), and highly capable. Eliminates API cost barriers for anyone running this project. |
| **Single LangChain prompt — no tools or agent loop** | The task is self-contained reasoning from training knowledge. A full agentic loop with web search tools would add latency, complexity, and cost with marginal accuracy gain for well-known public companies. |
| **Zod + StructuredOutputParser** | Forces the LLM into a strict typed contract. No fragile regex or string parsing on the frontend. If the model goes off-script, the error is caught server-side immediately. |
| **Temperature = 0.3** | Low enough for consistent, factual output. High enough to avoid repetitive phrasing across different company analyses. |
| **No database / no caching** | Not required for the MVP. Redis caching by `(company, model)` is a clean immediate upgrade. |
| **No streaming** | The full JSON object must arrive complete before Zod can parse and validate it. Streaming raw tokens isn't meaningful for structured output. |
| **Vite dev proxy** | The frontend uses a relative `/analyze` URL. Vite proxies it to `localhost:8000` during dev. Zero CORS config. |
| **No global state manager** | The entire UI runs on 5 `useState` hooks. Redux or Zustand would be over-engineering for a single-screen app. |
| **Brandfetch Logo API** | Free, no API key required. The frontend guesses the company domain (e.g. `Apple` ? `apple.com`) and fetches the logo. Falls back silently if not found — zero broken image UI. |
| **What was left out** | Live stock data, web search grounding (Tavily), confidence scores, history sidebar, streaming UI, authentication, unit tests. All are valid P1/P2 additions. |

---

## Example Runs

Real outputs from the live agent (Groq (Llama 3) `llama-3.3-70b-versatile`).

---

### Apple Inc.

**Recommendation:** ? Invest &nbsp;?&nbsp; **Risk:** Medium

**Pros:**
- Unrivalled brand loyalty and premium pricing power across hardware, software, and services
- Services segment (App Store, iCloud, Apple Pay) growing at high margins, reducing hardware dependency
- Fortress balance sheet with massive cash reserves and a consistent buyback programme
- Deeply integrated ecosystem creates high switching costs and durable customer retention

**Cons:**
- iPhone revenue (~50% of total) is dependent on a maturing smartphone market
- Heavy manufacturing and sales reliance on China — significant geopolitical risk
- Antitrust scrutiny on App Store practices in the US and EU
- Limited first-mover advantage in AI relative to Google and Microsoft

**Reasoning:** Apple remains one of the highest-quality businesses ever built. The structural shift of earnings weight toward services gives it a more durable, recurring revenue mix. While the stock rarely looks cheap, its consistency, cash generation, and brand depth make it a reasonable long-term hold for a retail investor.

**Summary:** A premium brand with a durable moat — the risk is valuation, not the business itself.

---

### Reliance Industries

**Recommendation:** ? Invest &nbsp;?&nbsp; **Risk:** Medium

**Pros:**
- Conglomerate diversification across energy, telecom (Jio), and retail reduces single-sector risk
- Jio Platforms is a structural winner in India's digitisation story with 450M+ subscribers
- JioMart and Reliance Retail are among India's largest organised retail platforms
- Strong government relationships and access to domestic capital markets

**Cons:**
- Conglomerate complexity makes sum-of-parts valuation difficult for investors
- Retail and telecom segments are still investing heavily — free cash flow remains suppressed
- Significant promoter concentration risk
- Refining business is exposed to global energy price volatility

**Reasoning:** Reliance is effectively a bet on India's consumption and digital growth story. The telecom and retail segments have strong secular tailwinds. The key risk is execution complexity across so many verticals, but the franchise quality is high.

**Summary:** A diversified play on India's rise — compelling for patient, long-term investors.

---

### Tesla

**Recommendation:** ? Pass &nbsp;?&nbsp; **Risk:** High

**Pros:**
- First-mover brand advantage in consumer EVs still carries real weight globally
- Vertical integration across battery, software, and manufacturing is a structural moat
- Energy storage (Megapack) is a fast-growing business with strong margins
- Full Self-Driving optionality remains a potential step-change in value

**Cons:**
- Intensifying EV competition from BYD, legacy OEMs, and Chinese entrants is compressing margins
- Valuation remains extremely elevated relative to auto-sector peers on any traditional metric
- CEO distraction and brand polarisation have become material business risks
- Volume growth has stalled and multiple price cuts signal demand constraints

**Reasoning:** Tesla is a real and important company but the stock prices in a future that is far from certain. Margin compression, rising competition, and execution risk around autonomy make the risk/reward unattractive at current levels for a retail investor.

**Summary:** Great company, difficult stock — pass until valuation normalises or autonomy inflects.

---

### NVIDIA

**Recommendation:** ? Invest &nbsp;?&nbsp; **Risk:** Medium

**Pros:**
- Dominant market share in AI/ML training and inference compute (70–90% GPU share)
- CUDA ecosystem creates deep developer lock-in that competitors cannot replicate quickly
- Data centre revenue growing at triple-digit rates with no near-term ceiling visible
- Software stack (CUDA, cuDNN, NIM microservices) is increasingly where the durable moat lives

**Cons:**
- Valuation prices in near-perfection — any demand deceleration will hit the stock hard
- US export controls on China GPU sales represent a significant and growing revenue headwind
- AMD, Intel, and custom silicon (Google TPUs, AWS Trainium) are genuine long-term challengers
- Single-product concentration risk around GPU compute

**Reasoning:** NVIDIA is arguably the most important infrastructure company of this decade. The AI build-out is still early and NVIDIA sits at its centre. The risk is entirely in the valuation, not the business. For a long-term investor comfortable with volatility, the entry is reasonable.

**Summary:** The defining infrastructure play of the AI era — high reward, high multiple.

---

## What I Would Improve With More Time

| Improvement | Why |
|---|---|
| **Live web search grounding** | Integrate Tavily or SerpAPI so the agent pulls real-time news, earnings releases, and analyst reports before deciding. Would dramatically improve accuracy for recent events and lesser-known companies. |
| **Response caching** | Cache results by `(company, model)` with a 15-minute TTL in Redis. Removes redundant LLM calls for repeated queries and reduces cost at scale. |
| **Streaming UI** | Stream the Gemini response token-by-token and progressively reveal the result card. Makes the 10-second wait feel much shorter. |
| **Confidence score** | Add a numeric confidence field (0–100%) to the Zod schema. Expose it in the UI so users know when the model is uncertain. |
| **Logo / Brand enrichment** | Use a more robust logo database or scrape favicon metadata for companies that don't match the simple `{name}.com` pattern. |
| **Search history sidebar** | Store the last N analyses in localStorage and show a collapsible sidebar — useful for comparing companies. |
| **Real financial data** | Pull live P/E ratio, revenue growth, and market cap from a financial API (e.g. Financial Modeling Prep, Alpha Vantage) and inject into the prompt. Grounds the model in real numbers. |
| **LangGraph multi-step agent** | Replace the single prompt with a LangGraph workflow: Step 1 gathers public data, Step 2 synthesises, Step 3 formats the output. More auditable and accurate for complex cases. |
| **Deployment** | Ship to Vercel (frontend) + Railway (backend) with proper environment secrets for a live demo link. |
| **Unit + integration tests** | Add Vitest for Zod schema validation and Supertest for the Express routes. |

---

## BONUS — LLM Chat Session Transcript

> The assignment awards bonus points for including the AI/LLM chat logs used while building this project. The entire project was built using **Antigravity (Google DeepMind)** as the AI assistant. Below is a faithful summary of the key exchanges that shaped the architecture and code.

---

### Session 1 — Project Setup & Tech Stack Decision

**Me:** I need to build an AI Investment Research Agent for an internship assignment. The stack must be React/Next.js, Node.js, and LangChain.js. What's the cleanest way to structure this?

**AI:** Recommended a simple monorepo with `/frontend` (Vite + React) and `/backend` (Node.js + Express). A single `POST /analyze` endpoint is all we need — the agent doesn't need multiple routes. For the LLM, suggested using **Groq (Llama 3)** (`llama-3.3-70b-versatile`) over OpenAI because it's free-tier and eliminates API cost barriers for reviewers.

**Me:** Why not use LangGraph instead of a simple LangChain chain?

**AI:** For this scope — a single company name in, structured JSON out — a `PromptTemplate ? LLM ? StructuredOutputParser` chain is sufficient and far more readable. LangGraph makes sense when you need multi-step planning, conditional branching, or tool use. Neither is needed here. Noted as a future improvement.

---

### Session 2 — Structured Output & Zod Schema

**Me:** How do I make sure the LLM always returns valid, typed JSON? I don't want to parse strings on the frontend.

**AI:** Use `StructuredOutputParser.fromZodSchema()` from LangChain core. Define the schema in Zod:
- `recommendation`: enum `"Invest" | "Pass"`
- `pros` / `cons`: `z.array(z.string()).min(3).max(5)`
- `risk`: enum `"Low" | "Medium" | "High"`
- `reason`: free string, 2-4 sentences
- `summary`: one-line string

The parser injects format instructions into the prompt and validates the response at runtime. If the model goes off-script, the parser throws and Express returns HTTP 500 — never a malformed response to the frontend.

**Me:** What temperature should I use?

**AI:** 0.3. Low enough for factual consistency across repeated calls, high enough to avoid copy-paste phrasing between different company analyses.

---

### Session 3 — Prompt Engineering

**Me:** How should I prompt the model to behave like a balanced analyst, not just bullish or bearish?

**AI:** Key prompt design decisions:
1. Give it a persona: *"You are a pragmatic investment research analyst"*
2. Give it a structured reasoning process: market position ? strengths ? weaknesses ? risks ? decision
3. Include a guardrail: *"If the company is unknown, fictional, or you have low confidence, lean toward Pass and explain why"*
4. End with a hard constraint: *"IMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks."*

This produces honest, balanced output rather than always recommending "Invest" to seem helpful.

---

### Session 4 — Frontend Architecture

**Me:** Should I use Redux for state management?

**AI:** No. The entire UI needs only 5 state values: `company` (string), `loading` (boolean), `result` (object | null), `error` (string), `logoUrl` + `logoOk` (for the Brandfetch company logo). Five `useState` hooks is the right tool. Redux/Zustand would add boilerplate with zero benefit for a single-screen app.

**Me:** How do I handle CORS between the React dev server and the Express backend?

**AI:** Use Vite's built-in proxy. In `vite.config.js`, proxy `/analyze` to `http://localhost:8000`. The frontend then calls a relative `/analyze` URL — no CORS headers needed on the backend. This is cleaner than configuring `cors()` origins during development.

---

### Session 5 — API Key Issue & Debugging

**Me:** The project isn't running. I have this API key: `YOUR_API_KEY_HERE`

**AI:** Tested the key directly against the Gemini REST API using `ListModels`. Result: ? Key is valid — it has access to `llama-3.3-70b-versatile`. Root cause: the code was still using `gemini-1.5-flash` which is not available on this key's API version. Fixed by switching to `llama-3.3-70b-versatile`.

**Fixes applied:**
- Updated `MODEL_NAME=llama-3.3-70b-versatile` in `backend/.env`
- Confirmed `routes/analyze.js` and `services/agent.js` exist (they had been accidentally deleted and were recreated)

---

### Session 6 — End-to-End Test

**Me:** Is it actually working?

**AI:** Ran a live test against the `/analyze` endpoint:

```
POST http://localhost:8000/analyze
Body: { "company": "Apple" }

Response:
  Company: Apple
  Recommendation: Invest
  Risk: Medium
  Pros: 5 items
  Status: WORKS ?
```

Full pipeline confirmed: React ? Vite proxy ? Express ? LangChain ? Gemini ? Zod parser ? JSON response ? Company logo from Brandfetch.

---

### Session 7 — Company Logo Feature

**Me:** Can a company logo be displayed when searching?

**AI:** Yes, using the Brandfetch Logo API — free, no key needed. The frontend converts the company name to a guessed domain (e.g. `Apple` ? `apple.com`) and fetches `https://cdn.brandfetch.io/apple.com`. The `<img>` tag uses `onLoad` to fade in the logo only when it loads successfully, and `onError` to silently hide it if not found. No broken image icons ever appear.

---

### Key Insights From the AI-Assisted Build

The most valuable AI contributions were:
1. **Architecture scoping** — talking me out of LangGraph for this scope saved ~2 hours of complexity
2. **Zod schema design** — the type contract between backend and frontend makes the whole app more robust
3. **Prompt engineering** — the "lean toward Pass when uncertain" guardrail makes the agent's output more trustworthy
4. **Debugging the API key** — identified the exact model name mismatch and fixed it instantly
5. **Logo feature** — suggested Brandfetch as a zero-config logo source with graceful fallback UX

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, Axios, Phosphor Icons |
| Backend | Node.js 18+, Express 4, LangChain.js, Zod, dotenv, cors |
| LLM | Groq (Llama 3) (`llama-3.3-70b-versatile` by default, configurable) |
| AI Framework | LangChain.js (`@langchain/groq`, `@langchain/core`) |
| Logo API | Brandfetch Logo API (free, no key) |
| Font | General Sans (Fontshare) |

---

## Project Structure

```
ai-investment-research-agent/
+-- backend/
¦   +-- index.js                  # Express server entry point
¦   +-- routes/
¦   ¦   +-- analyze.js            # POST /analyze route handler + input validation
¦   +-- services/
¦   ¦   +-- agent.js              # LangChain prompt + Gemini + Zod parser pipeline
¦   +-- package.json
¦   +-- .env                      # Your local secrets (git-ignored)
¦   +-- .env.example              # Environment variable template
¦
+-- frontend/
¦   +-- index.html                # App shell with font import + meta tags
¦   +-- src/
¦   ¦   +-- App.jsx               # Single-page UI: hero input + company logo + result grid
¦   ¦   +-- main.jsx              # React root mount
¦   ¦   +-- index.css             # Global styles, animations, custom utility classes
¦   +-- vite.config.js            # Vite dev server + /analyze proxy to backend
¦   +-- tailwind.config.js        # Custom colour palette (invest/pass/risk tokens)
¦   +-- postcss.config.js
¦   +-- package.json
¦   +-- .env.example
¦
+-- README.md
```

---

## API Reference

### `GET /health`

Simple health check to verify the server is up.

**Response:**
```json
{ "status": "ok" }
```

---

### `POST /analyze`

Analyze a company and return a structured investment recommendation.

**Request body:**
```json
{ "company": "Tesla" }
```

**Response (200 OK):**
```json
{
  "company": "Tesla",
  "recommendation": "Pass",
  "pros": [
    "Strong EV brand recognition and first-mover advantage.",
    "Vertical integration across batteries, software, and manufacturing.",
    "Growing energy storage revenue with strong margins."
  ],
  "cons": [
    "Intensifying competition from BYD and legacy OEMs.",
    "Valuation elevated relative to current fundamentals.",
    "Execution risk around Full Self-Driving and new models."
  ],
  "risk": "High",
  "reason": "Tesla is a real and important company but the stock prices in a future that is far from certain. Competition is intensifying and margin compression is underway. The risk/reward is unattractive at current levels.",
  "summary": "A high-quality, high-risk bet — reasonable investors should wait for a better entry."
}
```

**Error (400 Bad Request):**
```json
{ "error": "Please provide a non-empty 'company' field in the request body." }
```

**Error (500 Internal Server Error):**
```json
{ "error": "Failed to analyze the company. Please try again.", "detail": "..." }
```

---

## Deployment Guide

### Option A — Vercel (Frontend) + Railway (Backend) ? Recommended

#### 1. Deploy the Backend to Railway

```bash
npm install -g @railway/cli
railway login

cd backend
railway init
railway up
```

In the Railway dashboard ? Variables, add:
```
GROQ_API_KEY=your-key-here
MODEL_NAME=llama-3.3-70b-versatile
PORT=8000
```

Copy your public backend URL (e.g. `https://your-app.railway.app`).

#### 2. Deploy the Frontend to Vercel

```bash
cd frontend
npx vercel --prod
# When prompted, add environment variable:
# VITE_API_URL = https://your-app.railway.app
```

Update `vite.config.js` proxy target (or switch `App.jsx` to use `import.meta.env.VITE_API_URL`) for production.

---

### Option B — Render (Both Services)

#### Backend
1. Render ? New ? **Web Service**
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add env vars in the Render dashboard

#### Frontend
1. Render ? New ? **Static Site**
2. Root Directory: `frontend`
3. Build Command: `npm install && npm run build`
4. Publish Directory: `dist`
5. Add `VITE_API_URL=https://your-backend.onrender.com` as env var

---

*Not financial advice. Built for the InsideIIM ? Altuni AI Labs AI Product Development Engineer internship assignment.*