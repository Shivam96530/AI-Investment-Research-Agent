import { useState } from "react";
import axios from "axios";
import { ArrowRight, Warning, CheckCircle, XCircle } from "@phosphor-icons/react";

// Use relative URL — Vite proxy forwards /analyze to localhost:8001
// This avoids CORS issues entirely during development.
const API_URL = "";

// Risk level text colour mapping
function riskColour(risk) {
  switch (risk) {
    case "Low":    return "text-riskLow";
    case "Medium": return "text-riskMedium";
    case "High":   return "text-riskHigh";
    default:       return "text-black";
  }
}

// Overline label component — reused throughout
function Overline({ children, className = "" }) {
  return (
    <p className={`text-xs font-bold uppercase tracking-[0.2em] ${className}`}>
      {children}
    </p>
  );
}

export default function App() {
  const [company, setCompany]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [result,  setResult]    = useState(null);
  const [error,   setError]     = useState("");
  const [logoUrl, setLogoUrl]   = useState("");
  const [logoOk,  setLogoOk]    = useState(false);

  // Convert a company name into a best-guess domain for Brandfetch
  function guessLogoUrl(name) {
    const domain = name.trim().toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")   // strip special chars
      .replace(/\s+/g, "")           // remove spaces
      .replace(/(inc|ltd|llc|corp|co|plc|group)$/, ""); // strip suffixes
      
    // Use Brandfetch CDN. Note: Brandfetch requires a Client ID for hotlinking.
    // Get a free key at brandfetch.com/developers and add it to frontend/.env as VITE_BRANDFETCH_CLIENT_ID
    const clientId = import.meta.env.VITE_BRANDFETCH_CLIENT_ID || "1idC_Y-W_P"; // fallback to a generic id if none provided
    return `https://cdn.brandfetch.io/${domain}.com?c=${clientId}`;
  }

  async function handleAnalyze(e) {
    e?.preventDefault?.();
    if (!company.trim() || loading) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const { data } = await axios.post(
        `${apiUrl}/analyze`,
        { company: company.trim() },
        { timeout: 90000 }
      );
      // Try to fetch a logo as soon as we have the result
      const url = guessLogoUrl(data.company || company);
      setLogoUrl(url);
      setLogoOk(false); // reset; the <img> onLoad will set it to true
      setResult(data);
    } catch (err) {
      const status = err?.response?.status;
      const detail =
        status === 429
          ? "The AI service is busy (free tier rate limit). Please wait ~30 seconds and try again."
          : err?.response?.data?.error ||
            err?.response?.data?.detail ||
            err?.message ||
            "Something went wrong. Please try again.";
      setError(typeof detail === "string" ? detail : "Unexpected error.");
    } finally {
      setLoading(false);
    }
  }

  const isInvest = result?.recommendation === "Invest";

  return (
    <div className="min-h-screen bg-bg text-black">
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-24">

        {/* ── Brand bar ───────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-16 md:mb-24">
          <Overline className="text-black">AI Investment Research Agent</Overline>
          <span className="hidden md:block text-xs font-medium uppercase tracking-[0.2em] text-neutral-400">
            v1.0 &middot; Powered by LangChain.js
          </span>
        </div>

        {/* ── Hero input form ──────────────────────────────────────── */}
        <form onSubmit={handleAnalyze}>
          <label
            htmlFor="company-input"
            className="block text-xs font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4"
          >
            Company name
          </label>

          <input
            id="company-input"
            data-testid="company-input"
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Tesla, Apple, Reliance…"
            disabled={loading}
            autoFocus
            autoComplete="off"
            className="text-4xl md:text-6xl font-black tracking-tighter bg-transparent border-b-4 border-black focus:outline-none w-full py-4 placeholder:text-neutral-200 transition-colors disabled:opacity-60"
          />

          <div className="mt-8 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <button
              type="submit"
              data-testid="analyze-button"
              disabled={loading || !company.trim()}
              className="bg-black text-white px-8 py-4 font-bold text-base uppercase tracking-[0.2em] hover:bg-neutral-800 active:bg-neutral-900 transition-colors flex items-center justify-center gap-3 min-w-[220px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="brutal-spinner" data-testid="loading-spinner" />
                  <span>Analyzing…</span>
                </>
              ) : (
                <>
                  <span>Analyze</span>
                  <ArrowRight size={20} weight="bold" />
                </>
              )}
            </button>

            <p className="text-sm text-neutral-500 leading-relaxed max-w-xs">
              Type any public company name and get an instant Invest&nbsp;/&nbsp;Pass call.
            </p>
          </div>
        </form>

        {/* ── Error banner ─────────────────────────────────────────── */}
        {error && (
          <div
            data-testid="error-message"
            className="mt-12 border border-pass bg-passBg text-pass px-6 py-4 font-medium flex items-start gap-3"
          >
            <Warning size={20} weight="bold" className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Result grid ──────────────────────────────────────────── */}
        {result && (
          <section
            data-testid="result-card"
            className="mt-16 border-t-[3px] border-black"
          >

            {/* Row 1 — Company logo + name + Recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border fade-up fade-up-1">
              <div className="col-span-1 md:col-span-3 border-r border-border p-6 md:p-8">
                <Overline className="text-neutral-400 mb-2">Company</Overline>
                <div className="flex items-center gap-4">
                  {/* Logo — hidden until it loads successfully (Brandfetch will 404 if not found) */}
                  {logoUrl && (
                    <img
                      src={logoUrl}
                      alt={`${result.company} logo`}
                      data-testid="company-logo"
                      onLoad={() => setLogoOk(true)}
                      onError={() => setLogoOk(false)}
                      className={`w-12 h-12 md:w-16 md:h-16 object-contain border border-border bg-white p-1 flex-shrink-0 transition-opacity duration-300 ${
                        logoOk ? "opacity-100" : "opacity-0 w-0 h-0 p-0 border-0"
                      }`}
                    />
                  )}
                  <h1
                    data-testid="result-company"
                    className="text-3xl md:text-5xl font-black tracking-tighter leading-none"
                  >
                    {result.company}
                  </h1>
                </div>
              </div>

              <div className="col-span-1 p-6 md:p-8 flex flex-col justify-between gap-4">
                <Overline className="text-neutral-400">Recommendation</Overline>
                <span
                  data-testid="result-recommendation"
                  className={
                    isInvest
                      ? "inline-flex items-center gap-2 px-4 py-2 bg-investBg text-invest font-bold text-sm uppercase tracking-[0.15em] border border-invest w-fit"
                      : "inline-flex items-center gap-2 px-4 py-2 bg-passBg text-pass font-bold text-sm uppercase tracking-[0.15em] border border-pass w-fit"
                  }
                >
                  {isInvest
                    ? <><CheckCircle size={16} weight="bold" /> Invest</>
                    : <><XCircle size={16} weight="bold" /> Pass</>
                  }
                </span>
              </div>
            </div>

            {/* Row 2 — Summary */}
            <div className="border-b border-border p-6 md:p-8 fade-up fade-up-2">
              <Overline className="text-neutral-400 mb-3">Final summary</Overline>
              <p
                data-testid="result-summary"
                className="text-xl md:text-2xl font-medium leading-snug max-w-3xl"
              >
                {result.summary}
              </p>
            </div>

            {/* Row 3 — Pros + Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border fade-up fade-up-3">
              <div className="border-r border-border p-6 md:p-8">
                <Overline className="text-invest mb-5">Pros</Overline>
                <ul data-testid="result-pros" className="space-y-4 list-none pl-0">
                  {result.pros?.map((p, i) => (
                    <li key={i} className="pro-item flex items-start text-base leading-relaxed">
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 md:p-8">
                <Overline className="text-pass mb-5">Cons</Overline>
                <ul data-testid="result-cons" className="space-y-4 list-none pl-0">
                  {result.cons?.map((c, i) => (
                    <li key={i} className="con-item flex items-start text-base leading-relaxed">
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Row 4 — Risk + Reasoning */}
            <div className="grid grid-cols-1 md:grid-cols-4 fade-up fade-up-4">
              <div className="col-span-1 border-r border-border p-6 md:p-8">
                <Overline className="text-neutral-400 mb-3">Risk level</Overline>
                <p
                  data-testid="result-risk"
                  className={`text-4xl md:text-5xl font-black tracking-tighter leading-none ${riskColour(result.risk)}`}
                >
                  {result.risk}
                </p>
              </div>

              <div className="col-span-1 md:col-span-3 p-6 md:p-8">
                <Overline className="text-neutral-400 mb-3">Reasoning</Overline>
                <p
                  data-testid="result-reason"
                  className="text-base md:text-lg leading-relaxed text-neutral-700"
                >
                  {result.reason}
                </p>
              </div>
            </div>

          </section>
        )}

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="mt-24 pt-8 border-t border-border text-xs uppercase tracking-[0.2em] text-neutral-400 flex flex-col md:flex-row justify-between gap-2">
          <span>Not financial advice. For educational use only.</span>
          <span>Powered by LangChain.js &middot; Groq (Llama 3)</span>
        </footer>

      </main>
    </div>
  );
}
