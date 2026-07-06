// services/agent.js
// LangChain pipeline: PromptTemplate → ChatGoogleGenerativeAI → StructuredOutputParser (Zod)

import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";

// 1. Zod schema — defines the exact shape of the AI's JSON response
const investmentSchema = z.object({
  company: z.string().describe("Name of the company being analyzed."),
  recommendation: z
    .enum(["Invest", "Pass"])
    .describe("Final investment decision."),
  pros: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Between 3 and 5 concise strengths / positive factors."),
  cons: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("Between 3 and 5 concise weaknesses / negative factors."),
  risk: z.enum(["Low", "Medium", "High"]).describe("Overall risk level."),
  reason: z
    .string()
    .describe(
      "Short paragraph (2-4 sentences) explaining why this recommendation was chosen."
    ),
  summary: z
    .string()
    .describe("One or two sentence final summary suitable for a headline."),
});

// 2. Parser wraps the schema so LangChain can inject format instructions into the prompt
const parser = StructuredOutputParser.fromZodSchema(investmentSchema);

// 3. Prompt template
const promptTemplate = PromptTemplate.fromTemplate(
  `You are a pragmatic investment research analyst. A user is
considering investing in the following company:

COMPANY: {company}

Do the following:
1. Briefly consider what the company does and its market position.
2. Identify its key strengths (moat, growth, financials, leadership).
3. Identify weaknesses and headwinds.
4. Consider material risks (regulatory, macro, competitive, execution).
5. Decide whether a reasonable long-term retail investor should
   "Invest" or "Pass" today.
6. Explain your reasoning in plain, non-jargon language.

Be honest and balanced. If the company is unknown, fictional, or
you have very low confidence, lean toward "Pass" and explain why.

IMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks.

{format_instructions}`
);

// 4. Lazy singleton model — built on first request to avoid startup errors
let model = null;
function getModel() {
  if (model) return model;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to backend/.env\n" +
      "Get a free key at: https://console.groq.com/"
    );
  }

  model = new ChatGroq({
    apiKey,
    model: process.env.MODEL_NAME || "llama-3.3-70b-versatile",
    temperature: 0.3,
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
