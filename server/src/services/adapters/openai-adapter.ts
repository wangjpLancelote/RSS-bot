import type { MonitorLlmAdapter } from "../llmAdapter";
import {
  buildInferRulePrompt,
  buildSemanticPrompt,
  normalizeRule,
  normalizeSemanticDecision,
  readJsonPayload,
  requestJson
} from "./shared";

const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 10000);

function readMessageContent(result: Record<string, any>) {
  const choice = result?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const textPart = content.find((part) => typeof part?.text === "string");
    return textPart?.text || "";
  }
  return "";
}

async function callOpenAIJson(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const data = await requestJson({
    url: `${OPENAI_BASE_URL}/chat/completions`,
    timeoutMs: OPENAI_TIMEOUT_MS,
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    body: {
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a strict JSON API. Return only JSON and match the required output schema exactly."
        },
        {
          role: "user",
          content: prompt
        }
      ]
    }
  });
  if (!data) return null;
  return readJsonPayload(readMessageContent(data));
}

export function createAdapter(): MonitorLlmAdapter {
  return {
    async inferMonitorRule(input) {
      const payload = await callOpenAIJson(buildInferRulePrompt(input));
      return normalizeRule(payload);
    },

    async semanticDecide(input) {
      const payload = await callOpenAIJson(buildSemanticPrompt(input));
      return normalizeSemanticDecision(payload);
    }
  };
}

export default createAdapter;

