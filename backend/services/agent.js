// services/agent.js
// LangChain pipeline: PromptTemplate → ChatGoogleGenerativeAI → StructuredOutputParser (Zod)

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// 1. Zod schema — defines the exact shape of the AI's JSON response
const investmentSchema = z.object({
  company: z.string().describe("Full official name of the company being analyzed. Keep exactly as provided."),
  ticker: z.string().describe("Stock ticker symbol if publicly traded. If private or unknown, state 'N/A'."),
  sector: z.string().describe("Industry sector (e.g. Technology, Healthcare, Energy)."),
  founded: z.string().describe("Year the company was founded. If unknown, state 'N/A'."),
  headquarters: z.string().describe("City and country of headquarters. Always distinguish between Headquarters, Registered Office, Branch Office, and Manufacturing Plant."),
  ceo: z.string().describe("Name and title of the highest executive (e.g., CEO, Managing Director, Founder, President). Return whichever title actually exists. Do not force 'CEO'. If unknown, state 'N/A'."),
  employees: z.string().describe("Approximate number of employees. If unavailable, provide an estimate based on industry averages and append '(Est.)'."),
  marketCap: z.string().describe("Approximate market capitalization. If unavailable or private, provide an estimate based on industry averages and append '(Est.)'."),
  revenue: z.string().describe("Latest annual revenue. If unavailable, provide an estimate based on industry averages and append '(Est.)'."),
  revenueGrowth: z.string().describe("Year-over-year revenue growth percentage. If unavailable, provide an estimate based on industry averages and append '(Est.)'."),
  netMargin: z.string().describe("Net profit margin as percentage. If unavailable, provide an estimate based on industry averages and append '(Est.)'."),
  peRatio: z.string().describe("Price-to-earnings ratio. If unavailable, provide an estimate based on industry averages and append '(Est.)'."),
  debtToEquity: z.string().describe("Debt-to-equity ratio. If unavailable, provide an estimate based on industry averages and append '(Est.)'."),
  dividendYield: z.string().describe("Dividend yield if applicable. If unavailable, provide an estimate based on industry averages and append '(Est.)'."),
  website: z.string().describe("Official company website. If the company has no website, state 'No Official Website Found'."),
  socialMedia: z.string().describe("Official social media links. Do not invent social media links. If unavailable, state 'N/A'."),
  recommendation: z
    .enum(["Invest", "Pass"])
    .describe("Final investment decision."),
  pros: z
    .array(z.string())
    .min(1)
    .describe("Between 3 and 6 concise strengths with specific data points where possible."),
  cons: z
    .array(z.string())
    .min(1)
    .describe("Between 3 and 6 concise weaknesses with specific data points where possible."),
  risk: z.string().describe("Overall risk level. Preferably Low, Medium, or High."),
  reason: z
    .string()
    .describe(
      "Detailed paragraph (4-6 sentences) explaining the recommendation with specific data points, market context, and rationale. If information cannot be verified, explicitly mention that it could not be confirmed."
    ),
  summary: z
    .string()
    .describe("One or two sentence final summary suitable for a headline."),
  scores: z.object({
    growth: z.number().min(0).max(10).describe("Growth potential score 0-10."),
    moat: z.number().min(0).max(10).describe("Competitive moat score 0-10."),
    financials: z.number().min(0).max(10).describe("Financial health score 0-10."),
    management: z.number().min(0).max(10).describe("Management quality score 0-10."),
    valuation: z.number().min(0).max(10).describe("Valuation attractiveness score 0-10 (10=very cheap, 0=very expensive)."),
    esg: z.number().min(0).max(10).describe("ESG score 0-10."),
  }).describe("Analyst scores across 6 dimensions, each 0-10."),
  competitors: z
    .array(z.string())
    .min(1)
    .describe("Top 2-4 direct competitor company names."),
  recentDevelopments: z
    .array(z.string())
    .min(1)
    .describe("2-4 recent significant developments or news about the company (last 1-2 years)."),
  growthDrivers: z
    .array(z.string())
    .min(1)
    .describe("2-4 key future growth drivers or catalysts to watch."),
  keyRisks: z
    .array(z.string())
    .min(1)
    .describe("2-4 specific material risks with context."),
  analystConsensus: z.string().optional()
    .describe("Approximate analyst consensus rating if publicly traded (e.g. Strong Buy, Buy, Hold). Use 'N/A' if unknown."),
  investmentHorizon: z.string()
    .describe("Best investment horizon for this company (e.g., Short-term (<1yr), Medium-term (1-3yr), Long-term (3yr+)). Use 'N/A' if unknown."),
});

// 2. Parser wraps the schema so LangChain can inject format instructions into the prompt
const parser = StructuredOutputParser.fromZodSchema(investmentSchema);

// 3. Prompt template
const promptTemplate = PromptTemplate.fromTemplate(
  `You are an expert global business research assistant and senior investment analyst. A user wants a comprehensive, highly accurate deep-dive analysis of the following company anywhere in the world:

COMPANY: {company}
CURRENT YEAR: 2026

IMPORTANT INSTRUCTION: Use your native Google Search Grounding to deeply search for this company right now. You MUST fetch the absolute latest data available up to 2026. Do NOT rely on outdated 2023/2024 figures if newer 2025/2026 figures exist.
CRITICAL CAPABILITY: You are a meticulous research agent. You MUST perform exhaustive internet searches to gather exact financial data. Do not rely on your pre-training data. Verify each financial metric and ensure every figure is backed by recent search results. Do not be lazy.

STRICT RESEARCH RULES:
1. Search globally, not only well-known companies.
2. If exact figures for revenue, market cap, or other financials are unavailable, provide a realistic estimate or industry average, clearly marking it with '(Est.)'.
3. Do NOT simply return "Not Publicly Available" for financial metrics. Use estimated data based on similar publicly traded companies if necessary.
4. If multiple sources disagree, prefer: Official company website, Government/business registry, Official LinkedIn page, Stock exchange filings, Company press releases, Trusted business databases.
5. Keep company names exactly as provided.
6. If the company is private and limited information exists, report verified facts alongside your best estimates marked with '(Est.)'.
7. Recognize different executive titles (e.g., CEO, Managing Director, Founder, President). Return whichever title actually exists. Never force "CEO" if the company does not have one.
8. If multiple executives exist, return the highest executive responsible for the company.
9. Always distinguish between: Headquarters, Registered Office, Branch Office, and Manufacturing Plant.
10. Do not invent social media links. If unknown, use 'N/A'.
11. If the company has no website, return exactly: "No Official Website Found".
12. If information cannot be verified, explicitly mention in your reasoning that it could not be confirmed.

Conduct a thorough, data-driven analysis covering:

1. **Company Overview & Profile**: Full official name, ticker symbol (if public), sector, founding year, headquarters (distinguishing office types), highest executive (with correct title), approximate employee count, official website, and official social media.

2. **Financial Profile**: Figures for market cap, latest annual revenue, YoY revenue growth, net profit margin, P/E ratio, debt-to-equity ratio, dividend yield. Provide realistic estimates with '(Est.)' if exact numbers are hidden.

3. **Investment Scorecard** — score each dimension from 0-10:
   - growth, moat, financials, management, valuation, esg.

4. **Strengths (pros)** & **Weaknesses (cons)**: Specific, data-backed points.

5. **Competitors**: Direct competitors.

6. **Recent Developments**: Significant recent events or news.

7. **Growth Catalysts** & **Key Risks**: Future drivers and material risks.

8. **Recommendation**: "Invest" or "Pass" with detailed reasoning (4-6 sentences). Include verification notes if data is unconfirmed.

9. **Analyst Consensus** & **Investment Horizon**.

IMPORTANT: Respond with valid JSON only. No markdown, no code blocks, no extra text.

{format_instructions}`
);

// 4. Lazy singleton model — built on first request to avoid startup errors
let model = null;
function getModel() {
  if (model) return model;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_API_KEY is not set. Add it to backend/.env"
    );
  }

  model = new ChatGoogleGenerativeAI({
    apiKey: apiKey,
    model: process.env.MODEL_NAME || "gemini-2.5-flash",
    temperature: 0.2,
    tools: [{ googleSearch: {} }],
  });
  return model;
}

// 5. Public function called by the route handler
export async function analyzeCompany(company) {
  const chain = promptTemplate.pipe(getModel()).pipe(parser);

  const result = await chain.invoke({
    company,
    format_instructions: parser.getFormatInstructions(),
  });

  return { ...result, company: result.company || company };
}
// Trigger restart
