import { useState } from "react";
import axios from "axios";
import { ArrowRight, Warning, CheckCircle, XCircle, TrendDown, TrendUp } from "@phosphor-icons/react";

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

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, max = 10 }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value >= 7 ? "#047857" : value >= 4 ? "#0a0a0a" : "#e11d48";
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold uppercase tracking-[0.15em] text-neutral-500">{label}</span>
        <span className="text-sm font-black tabular-nums">{value.toFixed(1)}<span className="text-neutral-400 font-medium text-xs">/10</span></span>
      </div>
      <div className="h-[3px] bg-neutral-100 w-full">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Radar Chart (SVG, pure) ────────────────────────────────────────────────
function RadarChart({ scores }) {
  const dims = [
    { key: "growth",     label: "Growth" },
    { key: "moat",       label: "Moat" },
    { key: "financials", label: "Financials" },
    { key: "management", label: "Management" },
    { key: "valuation",  label: "Valuation" },
    { key: "esg",        label: "ESG" },
  ];

  const N = dims.length;
  const cx = 140, cy = 140, r = 95;

  // Compute polygon points for each score
  function polar(i, fraction) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    return {
      x: cx + r * fraction * Math.cos(angle),
      y: cy + r * fraction * Math.sin(angle),
    };
  }

  const dataPoints = dims.map((d, i) => polar(i, (scores[d.key] || 0) / 10));
  const polyData = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Label offsets — push them slightly further
  function labelPos(i) {
    const pt = polar(i, 1.28);
    return pt;
  }

  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-[280px] mx-auto">
      {/* Grid rings */}
      {rings.map((ring, ri) => {
        const pts = dims.map((_, i) => {
          const p = polar(i, ring);
          return `${p.x},${p.y}`;
        }).join(" ");
        return (
          <polygon
            key={ri}
            points={pts}
            fill="none"
            stroke="#e5e5e5"
            strokeWidth="1"
          />
        );
      })}

      {/* Axes */}
      {dims.map((_, i) => {
        const end = polar(i, 1);
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={end.x} y2={end.y}
            stroke="#e5e5e5"
            strokeWidth="1"
          />
        );
      })}

      {/* Data polygon */}
      <polygon
        points={polyData}
        fill="rgba(10,10,10,0.08)"
        stroke="#0a0a0a"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="4" fill="#0a0a0a" />
      ))}

      {/* Labels */}
      {dims.map((d, i) => {
        const lp = labelPos(i);
        return (
          <text
            key={i}
            x={lp.x}
            y={lp.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="8"
            fontWeight="700"
            fontFamily="'General Sans', system-ui, sans-serif"
            fill="#737373"
            letterSpacing="0.08em"
          >
            {d.label.toUpperCase()}
          </text>
        );
      })}
    </svg>
  );
}

// ── Metric Pill ───────────────────────────────────────────────────────────────
function MetricPill({ label, value }) {
  if (!value) return null;
  const isPositive = typeof value === "string" && value.startsWith("+");
  const isNegative = typeof value === "string" && value.startsWith("-");
  return (
    <div className="border border-border p-4">
      <Overline className="text-neutral-400 mb-1">{label}</Overline>
      <p className={`text-lg font-black tracking-tight ${isPositive ? "text-invest" : isNegative ? "text-pass" : "text-black"}`}>
        {value}
      </p>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ children, variant = "neutral" }) {
  const cls = {
    neutral: "border border-border text-neutral-600 bg-transparent",
    green:   "border border-invest text-invest bg-investBg",
    red:     "border border-pass text-pass bg-passBg",
  };
  return (
    <span className={`inline-flex px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] ${cls[variant]}`}>
      {children}
    </span>
  );
}

// Consensus → variant mapping
function consensusVariant(c) {
  if (!c) return "neutral";
  if (c === "Strong Buy" || c === "Buy") return "green";
  if (c === "Sell" || c === "Strong Sell") return "red";
  return "neutral";
}

export default function App() {
  const [company, setCompany]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [result,  setResult]    = useState(null);
  const [error,   setError]     = useState("");
  const [logoUrl, setLogoUrl]   = useState("");
  const [logoOk,  setLogoOk]    = useState(false);

  function getLogoUrl(data, fallbackName) {
    const clientId = import.meta.env.VITE_BRANDFETCH_CLIENT_ID || "1idC_Y-W_P";
    let domain = "";
    
    // 1. Try to use the exact website provided by the AI
    if (data?.website && data.website !== "No Official Website Found" && data.website !== "Not Publicly Available") {
      try {
        let urlStr = data.website;
        if (!urlStr.startsWith("http")) urlStr = "https://" + urlStr;
        const url = new URL(urlStr);
        domain = url.hostname.replace(/^www\./, "");
      } catch (e) {
        // ignore parse errors
      }
    }
    
    // 2. Fallback to guessing the domain based on company name
    if (!domain) {
      const name = data?.company || fallbackName || "";
      domain = name.trim().toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "")
        .replace(/(inc|ltd|llc|corp|co|plc|group)$/, "") + ".com";
    }
    
    return `https://cdn.brandfetch.io/${domain}?c=${clientId}`;
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
        { timeout: 120000 }
      );
      
      const url = getLogoUrl(data, company);
      setLogoUrl(url);
      setLogoOk(false);
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
            v2.0 &middot; Powered by LangChain.js
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
              Deep-dive analysis: financials, scores, charts &amp; more.
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
          <section data-testid="result-card" className="mt-16 border-t-[3px] border-black">

            {/* ── Row 1: Company header + Recommendation ── */}
            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border fade-up fade-up-1">
              <div className="col-span-1 md:col-span-3 border-r border-border p-6 md:p-8">
                <Overline className="text-neutral-400 mb-2">Company</Overline>
                <div className="flex items-center gap-4 mb-3">
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
                {/* Company meta tags */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {result.ticker && <Badge>{result.ticker}</Badge>}
                  {result.sector && <Badge>{result.sector}</Badge>}
                  {result.investmentHorizon && <Badge>{result.investmentHorizon}</Badge>}
                  {result.analystConsensus && (
                    <Badge variant={consensusVariant(result.analystConsensus)}>
                      Consensus: {result.analystConsensus}
                    </Badge>
                  )}
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
                <div>
                  <Overline className="text-neutral-400 mb-1">Risk level</Overline>
                  <p
                    data-testid="result-risk"
                    className={`text-2xl font-black tracking-tighter leading-none ${riskColour(result.risk)}`}
                  >
                    {result.risk}
                  </p>
                </div>
              </div>
            </div>

            {/* ── Row 2: Summary ── */}
            <div className="border-b border-border p-6 md:p-8 fade-up fade-up-2">
              <Overline className="text-neutral-400 mb-3">Final summary</Overline>
              <p
                data-testid="result-summary"
                className="text-xl md:text-2xl font-medium leading-snug max-w-3xl"
              >
                {result.summary}
              </p>
            </div>

            {/* ── Row 3: Company quick facts ── */}
            {(result.founded || result.headquarters || result.ceo || result.employees) && (
              <div className="border-b border-border p-6 md:p-8 fade-up fade-up-3">
                <Overline className="text-neutral-400 mb-5">Company profile</Overline>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {result.founded && (
                    <div>
                      <Overline className="text-neutral-400 mb-1">Founded</Overline>
                      <p className="text-base font-black">{result.founded}</p>
                    </div>
                  )}
                  {result.headquarters && (
                    <div>
                      <Overline className="text-neutral-400 mb-1">HQ</Overline>
                      <p className="text-base font-black">{result.headquarters}</p>
                    </div>
                  )}
                  {result.ceo && (
                    <div>
                      <Overline className="text-neutral-400 mb-1">CEO</Overline>
                      <p className="text-base font-black">{result.ceo}</p>
                    </div>
                  )}
                  {result.employees && (
                    <div>
                      <Overline className="text-neutral-400 mb-1">Employees</Overline>
                      <p className="text-base font-black">{result.employees}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Row 4: Financial metrics grid ── */}
            {(result.marketCap || result.revenue || result.revenueGrowth || result.netMargin || result.peRatio || result.debtToEquity || result.dividendYield) && (
              <div className="border-b border-border p-6 md:p-8 fade-up fade-up-4">
                <Overline className="text-neutral-400 mb-5">Financial metrics <span className="normal-case text-neutral-300">(estimates)</span></Overline>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <MetricPill label="Market Cap" value={result.marketCap} />
                  <MetricPill label="Annual Revenue" value={result.revenue} />
                  <MetricPill label="Revenue Growth" value={result.revenueGrowth} />
                  <MetricPill label="Net Margin" value={result.netMargin} />
                  <MetricPill label="P/E Ratio" value={result.peRatio} />
                  <MetricPill label="Debt / Equity" value={result.debtToEquity} />
                  <MetricPill label="Dividend Yield" value={result.dividendYield} />
                </div>
              </div>
            )}

            {/* ── Row 5: Radar chart + Score bars ── */}
            {result.scores && (
              <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border fade-up" style={{ animationDelay: "0.33s" }}>
                <div className="border-r border-border p-6 md:p-8 flex flex-col items-center justify-center">
                  <Overline className="text-neutral-400 mb-5 self-start">Investment radar</Overline>
                  <RadarChart scores={result.scores} />
                </div>
                <div className="p-6 md:p-8">
                  <Overline className="text-neutral-400 mb-5">Score breakdown</Overline>
                  <ScoreBar label="Growth Potential" value={result.scores.growth} />
                  <ScoreBar label="Competitive Moat" value={result.scores.moat} />
                  <ScoreBar label="Financial Health" value={result.scores.financials} />
                  <ScoreBar label="Management" value={result.scores.management} />
                  <ScoreBar label="Valuation" value={result.scores.valuation} />
                  <ScoreBar label="ESG" value={result.scores.esg} />

                  {/* Composite score */}
                  {(() => {
                    const avg = Object.values(result.scores).reduce((a, b) => a + b, 0) / Object.keys(result.scores).length;
                    return (
                      <div className="mt-6 pt-4 border-t border-border flex justify-between items-baseline">
                        <Overline className="text-neutral-400">Composite score</Overline>
                        <span className="text-3xl font-black tracking-tighter">{avg.toFixed(1)}<span className="text-neutral-400 text-sm font-medium">/10</span></span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── Row 6: Pros + Cons ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border fade-up" style={{ animationDelay: "0.39s" }}>
              <div className="border-r border-border p-6 md:p-8">
                <Overline className="text-invest mb-5">Strengths</Overline>
                <ul data-testid="result-pros" className="space-y-4 list-none pl-0">
                  {result.pros?.map((p, i) => (
                    <li key={i} className="pro-item flex items-start text-base leading-relaxed">
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-6 md:p-8">
                <Overline className="text-pass mb-5">Weaknesses</Overline>
                <ul data-testid="result-cons" className="space-y-4 list-none pl-0">
                  {result.cons?.map((c, i) => (
                    <li key={i} className="con-item flex items-start text-base leading-relaxed">
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ── Row 7: Recent developments + Growth drivers ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border fade-up" style={{ animationDelay: "0.45s" }}>
              {result.recentDevelopments?.length > 0 && (
                <div className="border-r border-border p-6 md:p-8">
                  <Overline className="text-neutral-400 mb-5">Recent developments</Overline>
                  <ul className="space-y-4 list-none pl-0">
                    {result.recentDevelopments.map((d, i) => (
                      <li key={i} className="flex items-start gap-3 text-base leading-relaxed">
                        <span className="text-neutral-300 font-black flex-shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.growthDrivers?.length > 0 && (
                <div className="p-6 md:p-8">
                  <Overline className="text-neutral-400 mb-5">Growth catalysts</Overline>
                  <ul className="space-y-4 list-none pl-0">
                    {result.growthDrivers.map((d, i) => (
                      <li key={i} className="flex items-start gap-3 text-base leading-relaxed">
                        <TrendUp size={18} weight="bold" className="text-invest flex-shrink-0 mt-0.5" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ── Row 8: Key risks + Competitors ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border fade-up" style={{ animationDelay: "0.51s" }}>
              {result.keyRisks?.length > 0 && (
                <div className="border-r border-border p-6 md:p-8">
                  <Overline className="text-pass mb-5">Key risks</Overline>
                  <ul className="space-y-4 list-none pl-0">
                    {result.keyRisks.map((r, i) => (
                      <li key={i} className="flex items-start gap-3 text-base leading-relaxed">
                        <TrendDown size={18} weight="bold" className="text-pass flex-shrink-0 mt-0.5" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.competitors?.length > 0 && (
                <div className="p-6 md:p-8">
                  <Overline className="text-neutral-400 mb-5">Competitive landscape</Overline>
                  <div className="space-y-3">
                    {result.competitors.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 border-b border-border pb-3 last:border-0">
                        <span className="text-xs font-black text-neutral-300 w-5 flex-shrink-0">{i + 1}</span>
                        <span className="font-bold text-base">{c}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Row 9: Reasoning ── */}
            <div className="fade-up" style={{ animationDelay: "0.57s" }}>
              <div className="p-6 md:p-8">
                <Overline className="text-neutral-400 mb-3">Analyst reasoning</Overline>
                <p
                  data-testid="result-reason"
                  className="text-base md:text-lg leading-relaxed text-neutral-700 max-w-3xl"
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
          <span>Powered by LangChain.js &middot; Google Gemini</span>
        </footer>

      </main>
    </div>
  );
}
