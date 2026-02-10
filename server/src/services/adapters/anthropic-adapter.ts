import type { MonitorLlmAdapter } from "../llmAdapter";
import {
  buildInferRulePrompt,
  buildSemanticPrompt,
  normalizeRule,
  normalizeSemanticDecision,
  readJsonPayload,
  requestJson
} from "./shared";

const ANTHROPIC_BASE_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1").replace(/\/+$/, "");
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
const ANTHROPIC_TIMEOUT_MS = Number(process.env.ANTHROPIC_TIMEOUT_MS || 10000);
const ANTHROPIC_API_VERSION = process.env.ANTHROPIC_API_VERSION || "2023-06-01";

function readAnthropicText(data: Record<string, any>) {
  const content = Array.isArray(data?.content) ? data.content : [];
  const textPart = content.find((part) => part?.type === "text" && typeof part?.text === "string");
  return textPart?.text || "";
}

async function callAnthropicJson(prompt: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const data = await requestJson({
    url: `${ANTHROPIC_BASE_URL}/messages`,
    timeoutMs: ANTHROPIC_TIMEOUT_MS,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_API_VERSION
    },
    body: {
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      temperature: 0,
      system: "You are a strict JSON API. Return only JSON with no markdown wrapper.",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    }
  });
  if (!data) return null;
  return readJsonPayload(readAnthropicText(data));
}

export function createAdapter(): MonitorLlmAdapter {
  return {
    async inferMonitorRule(input) {
      const payload = await callAnthropicJson(buildInferRulePrompt(input));
      return normalizeRule(payload);
    },

    async semanticDecide(input) {
      const payload = await callAnthropicJson(buildSemanticPrompt(input));
      return normalizeSemanticDecision(payload);
    }
  };
}

export default createAdapter;

