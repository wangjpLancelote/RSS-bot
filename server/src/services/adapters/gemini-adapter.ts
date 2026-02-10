import type { MonitorLlmAdapter } from "../llmAdapter";
import {
  buildInferRulePrompt,
  buildSemanticPrompt,
  normalizeRule,
  normalizeSemanticDecision,
  readJsonPayload,
  requestJson
} from "./shared";

const GEMINI_BASE_URL = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(
  /\/+$/,
  ""
);
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 10000);

function readGeminiText(data: Record<string, any>) {
  const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
  const parts = candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  const textPart = parts.find((part) => typeof part?.text === "string");
  return textPart?.text || "";
}

async function callGeminiJson(prompt: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;

  const data = await requestJson({
    url: `${GEMINI_BASE_URL}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    timeoutMs: GEMINI_TIMEOUT_MS,
    body: {
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json"
      },
      systemInstruction: {
        role: "system",
        parts: [
          {
            text: "You are a strict JSON API. Return only JSON and do not include markdown."
          }
        ]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ]
    }
  });
  if (!data) return null;
  return readJsonPayload(readGeminiText(data));
}

export function createAdapter(): MonitorLlmAdapter {
  return {
    async inferMonitorRule(input) {
      const payload = await callGeminiJson(buildInferRulePrompt(input));
      return normalizeRule(payload);
    },

    async semanticDecide(input) {
      const payload = await callGeminiJson(buildSemanticPrompt(input));
      return normalizeSemanticDecision(payload);
    }
  };
}

export default createAdapter;

