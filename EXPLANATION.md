# Full-Stack AI Investment Research Agent: Comprehensive Guide & Explanation

This document provides a detailed, step-by-step breakdown of how the **AI Investment Research Agent** works from the ground up. It covers the architecture, the technology decisions, and the technical implementation of both the frontend and backend. 

Use this guide to understand exactly how the project is built and to prepare for any technical discussions or interviews.

---

## 1. High-Level Architecture & Data Flow

The application is structured as a **monorepo** consisting of two main parts:
1. **Frontend**: A React single-page application (SPA) built using Vite and styled with Tailwind CSS.
2. **Backend**: An Express.js REST API server built on Node.js, utilizing LangChain.js to interface with the Google Gemini API.

### The Request Lifecycle
When a user types a company name (e.g., "Apple") and clicks **Analyze**:

```
[User Action] 
     │
     ▼ (frontend/src/App.jsx)
1. React sets loading state, fires Axios POST request to '/analyze'
     │
     ▼ (Vite Proxy or Vercel direct URL)
2. Request routed to Node.js backend (backend/index.js)
     │
     ▼ (backend/routes/analyze.js)
3. Express router receives POST, validates payload, and wraps the execution in a retry helper
     │
     ▼ (backend/services/agent.js)
4. LangChain prompt is compiled containing the company name & Zod schema formatting instructions
     │
     ▼ (Google Gemini API with Search Grounding)
5. Gemini model searches the live internet, extracts financial estimates, and synthesizes the decision
     │
     ▼ (backend/services/agent.js)
6. Zod schema parses the raw text response, validating structure, types, and constraints
     │
     ▼ (backend/routes/analyze.js)
7. Express server returns the validated JSON payload to the frontend
     │
     ▼ (frontend/src/App.jsx)
8. React updates results state. Concurrently, it triggers the logo fallback sequence to fetch 
   the crispest official logo (Clearbit -> Brandfetch -> Google Favicons).
     │
     ▼
[UI Renders final card with scores, radar chart, logo, strengths/weaknesses & reason]
```

---

## 2. Frontend Breakdown (React + Vite + Tailwind CSS)

Located in the `frontend/` directory, the interface is minimal, fast, and follows a Swiss Brutalist design system.

### Key Concepts

#### A. State Management (Why no Redux?)
For a single-screen application, using a complex state manager like Redux or Zustand adds unnecessary boilerplate. The app uses 5 simple `useState` hooks inside [App.jsx](file:///d:/OneDrive/Attachments/AI%20Agent/frontend/src/App.jsx):
- `company`: Stores the user's text input.
- `loading`: Boolean toggled to display the custom brutalist loading spinner and disable the submit button during API calls.
- `result`: Stores the successfully returned JSON data from the backend.
- `error`: Stores any error message to display in the alert banner.
- `logoUrls` / `logoIndex` / `logoOk`: Used to drive the multi-provider fallback logo rendering.

#### B. Vite Development Proxy
In development, the React app runs on `http://localhost:3000` and the backend runs on `http://localhost:8000`. To prevent CORS (Cross-Origin Resource Sharing) blockages during local development, [vite.config.js](file:///d:/OneDrive/Attachments/AI%20Agent/frontend/vite.config.js) defines a proxy rule:
```javascript
proxy: {
  "/analyze": {
    target: "http://localhost:8000",
    changeOrigin: true,
  }
}
```
This tells Vite to catch any requests from the React app going to `/analyze` and silently forward them to the backend server. To React, it looks like it is calling itself, completely bypassing CORS constraints. In production (Vercel), we set `VITE_API_URL` to point directly to the Render backend.

#### C. Progressive Logo Fallback Sequence
Instead of relying on a single Logo API (which can fail or return broken images), the frontend uses a fallback hierarchy with three major image CDN providers:
1. **Clearbit API**: Requests `https://logo.clearbit.com/{domain}?size=512`. It is extremely high-resolution and supports thousands of global companies.
2. **Brandfetch CDN**: Requests `https://cdn.brandfetch.io/{domain}?c={clientId}` using a fallback client ID.
3. **Google Favicons**: Requests `https://www.google.com/s2/favicons?domain={domain}&sz=256` as a final fallback.

**How it works in code:**
We use a JSX `<img>` tag equipped with React's native `onError` event handler:
```javascript
{logoUrls.length > 0 && logoIndex < logoUrls.length && (
  <img
    src={logoUrls[logoIndex]}
    onError={() => {
      setLogoOk(false);
      setLogoIndex((prev) => prev + 1); // Try the next URL in the array
    }}
    onLoad={() => setLogoOk(true)}
  />
)}
```
If Clearbit returns an error or a 404, `onError` fires, increments `logoIndex`, and React automatically attempts to load the Brandfetch URL. If that fails, it transitions to Google.

#### D. Custom SVG Radar Chart
We did not use heavy charting libraries (like Recharts). Instead, [App.jsx](file:///d:/OneDrive/Attachments/AI%20Agent/frontend/src/App.jsx) draws a custom SVG radar chart manually.
- The 6 scores (moat, growth, financials, management, valuation, esg) are mapped to a 6-sided polygon.
- Polar coordinates are computed mathematically: $x = cx + r \times \text{score} \times \cos(\text{angle})$, $y = cy + r \times \text{score} \times \sin(\text{angle})$.
- This results in a fast, responsive, zero-dependency visual chart.

---

## 3. Backend Breakdown (Express.js + LangChain.js)

Located in the `backend/` directory, the backend acts as a proxy between our frontend and the Gemini LLM.

### Key Concepts

#### A. LangChain Pipeline
Instead of manually calling raw OpenAI/Gemini fetch endpoints and parsing text, the backend uses a structured LangChain pipeline:
```
PromptTemplate ──► ChatGoogleGenerativeAI ──► StructuredOutputParser (Zod)
```
1. **`PromptTemplate`**: Defines the system prompt. It automatically injects `{company}` and the JSON format instructions required by Zod.
2. **`ChatGoogleGenerativeAI`**: The LLM interface. We use `gemini-2.5-flash` at `temperature: 0.2` (for low variance and reliable facts) and pass `tools: [{ googleSearch: {} }]` to enable native search grounding.
3. **`StructuredOutputParser`**: Takes our Zod schema and generates formatting instructions (e.g. "You must output a JSON object with keys..."). When Gemini responds, the parser validates the JSON against our schema rules.

#### B. Gemini Google Search Grounding
To answer accurately and avoid outdated data, we explicitly instruct Gemini to search the live web:
```javascript
tools: [{ googleSearch: {} }]
```
When Gemini processes the prompt, it decides which terms to search for, queries Google search, retrieves facts up to 2026, and uses those search results as facts before compiling its final response.

#### C. Zod Validation (Preventing 500 crashes)
A common problem with AI structured output is that LLMs can sometimes return non-standard values (e.g., if a schema requires `"Low" | "Medium" | "High"`, the model might write `"Moderate"`). A strict Zod validation schema will throw an exception, resulting in a server crash (500).

To prevent this, we designed the Zod schema with resilient strings and clear descriptions:
- **Resilient fields**: Instead of `z.enum(["Low", "Medium", "High"])`, we use `z.string().describe("Overall risk level. Preferably Low, Medium, or High.")`.
- **Estimate instructions**: The Zod descriptions explicitly instruct the model: *"If unavailable, provide an estimate based on industry averages and append '(Est.)'"*.
This contract guarantees that the AI always attempts to write estimates (satisfying the user request) and will never cause validation crashes on the backend.

#### D. Backend API Retry Mechanism
The Gemini API free-tier has rate limits (429 errors). To make the backend robust for deployment, [analyze.js](file:///d:/OneDrive/Attachments/AI%20Agent/backend/routes/analyze.js) implements a wrapper function `withRetry`:
- If the Gemini API responds with `429 (Too Many Requests)`, it catches the error.
- It parses the `retryDelay` suggested by the API, or defaults to a delay.
- It sleeps for that duration, and then transparently retries the analysis (up to 3 times) before giving up and returning an error.

---

## 4. Key Decisions & Trade-Offs

| Option Chosen | Why? | Trade-off / Left Out |
|---|---|---|
| **Google Gemini over Groq/Llama** | Gemini supports native Google Search Grounding. This allows real-time internet search out of the box, whereas Groq has no native search and relies on static training data. | Groq is slightly faster in raw token output, but Gemini provides vastly superior factual accuracy for business research. |
| **No Database (Stateless)** | Keeps the project simple, cheap, and easy to deploy on Render. | Caching is not persistent. If two users search "Tesla", the LLM is queried twice. A production upgrade would use a Redis cache with a 15-minute TTL. |
| **No LangGraph (State Machine)** | A single-prompt chain is sufficient for this scope. | A multi-agent framework would build a more thorough report (e.g. Agent 1 gathers financials, Agent 2 checks news, Agent 3 critiques). However, this would take minutes to execute instead of 5 seconds. |

---

## 5. Standard Interview Questions & Answers

**Q: Why was the application throwing 500 errors after deployment earlier, and how did you fix it?**
> **A:** The 500 errors were caused by strict Zod schema validation. The original schema used hardcoded ENUM fields (like `z.enum(["Invest", "Pass"])` or strict arrays). If the Gemini model returned slightly different text (like `"Moderate"` instead of `"Medium"` for risk, or omitted a field), Zod rejected the payload, throwing a validation exception. We fixed this by converting the strict ENUMs to descriptive `z.string()` definitions and modifying the prompt instructions to handle empty metrics by returning industry estimates marked with `(Est.)` rather than failing.

**Q: How does the logo loading work? What happens if a company doesn't have a logo?**
> **A:** The logo uses a progressive multi-provider fallback. The frontend creates an array of three CDN URLs: Clearbit, Brandfetch, and Google Favicons. It renders the image using React state (`logoIndex` and `logoOk`). If the first CDN fails (triggering the `onError` event), the component increments the index and tries the next CDN. If all CDNs fail, the image fades out smoothly, ensuring there are never any broken image placeholders in the UI.

**Q: How does Vite's proxy work during development?**
> **A:** The React dev server runs on port 3000 and the backend runs on port 8000. Under normal circumstances, requesting `http://localhost:8000/analyze` from port 3000 would fail due to CORS (Cross-Origin Resource Sharing) blockages. Vite's proxy intercepts requests to `/analyze` on the dev server (3000) and redirects them to the backend (8000) under the hood. In production, we specify the direct backend URL using the `VITE_API_URL` environment variable.
