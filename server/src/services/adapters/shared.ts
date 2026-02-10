import type { MonitorLlmAdapter } from "../llmAdapter";
import type { WebCandidate, WebExtractionRule } from "../langgraphPipeline";

type JsonMap = Record<string, unknown>;

type SemanticDecision = Awaited<ReturnType<MonitorLlmAdapter["semanticDecide"]>>;

const DEFAULT_MAX_HTML = 40000;
const DEFAULT_MAX_CONTENT = 8000;

export function clip(input: string | null | undefined, max: number) {
  const value = typeof input === "string" ? input : "";
  return value.length > max ? value.slice(0, max) : value;
}

export function normalizeWhitespace(input: string | null | undefined) {
  return clip(input, 120000).replace(/\s+/g, " ").trim();
}

export function safeJsonParse(input: string) {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return null;
  }
}

function findJsonBlock(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const parsedDirect = safeJsonParse(trimmed);
  if (parsedDirect && typeof parsedDirect === "object") return parsedDirect as JsonMap;

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first < 0 || last <= first) return null;

  const extracted = trimmed.slice(first, last + 1);
  const parsed = safeJsonParse(extracted);
  if (parsed && typeof parsed === "object") return parsed as JsonMap;
  return null;
}

function asObject(input: unknown): JsonMap | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return input as JsonMap;
}

export function readJsonPayload(raw: unknown) {
  if (typeof raw === "string") {
    return findJsonBlock(raw);
  }
  if (raw && typeof raw === "object") {
    return raw as JsonMap;
  }
  return null;
}

export function normalizeRule(input: unknown): WebExtractionRule | null {
  const value = asObject(input);
  if (!value) return null;

  const rawStrategy = typeof value.strategy === "string" ? value.strategy : "readability";
  const strategy = rawStrategy === "selector" || rawStrategy === "full_page" ? rawStrategy : "readability";

  const next: WebExtractionRule = { strategy };
  if (typeof value.containerSelector === "string") next.containerSelector = value.containerSelector.trim();
  if (typeof value.itemSelector === "string") next.itemSelector = value.itemSelector.trim();
  if (typeof value.titleSelector === "string") next.titleSelector = value.titleSelector.trim();
  if (typeof value.linkSelector === "string") next.linkSelector = value.linkSelector.trim();
  if (typeof value.timeSelector === "string") next.timeSelector = value.timeSelector.trim();
  if (typeof value.notes === "string") next.notes = clip(value.notes, 240);

  return next;
}

export function normalizeSemanticDecision(input: unknown): SemanticDecision {
  const value = asObject(input);
  if (!value) return null;

  const decisionRaw = typeof value.decision === "string" ? value.decision.trim().toLowerCase() : "";
  const decision =
    decisionRaw === "minor_update" || decisionRaw === "noise" || decisionRaw === "new" ? decisionRaw : "new";

  const summaryRaw = typeof value.summary === "string" ? value.summary : "";
  const summary = clip(normalizeWhitespace(summaryRaw), 1200);
  if (!summary) return null;

  return { decision, summary };
}

export function buildInferRulePrompt(input: {
  url: string;
  title: string | null;
  html: string;
  candidates: WebCandidate[];
}) {
  const payload = {
    task: "infer_web_extraction_rule",
    constraints: {
      preferPartialExtraction: true,
      allowedStrategy: ["readability", "selector", "full_page"],
      outputJsonOnly: true
    },
    page: {
      url: input.url,
      title: input.title,
      html: clip(input.html, DEFAULT_MAX_HTML)
    },
    candidates: input.candidates.slice(0, 4).map((candidate) => ({
      key: candidate.key,
      title: candidate.title,
      link: candidate.link,
      publishedAt: candidate.publishedAt,
      contentText: clip(candidate.contentText, DEFAULT_MAX_CONTENT)
    })),
    outputSchema: {
      strategy: "readability|selector|full_page",
      containerSelector: "string|optional",
      itemSelector: "string|optional",
      titleSelector: "string|optional",
      linkSelector: "string|optional",
      timeSelector: "string|optional",
      notes: "string|optional"
    }
  };

  return JSON.stringify(payload);
}

export function buildSemanticPrompt(input: { candidate: WebCandidate; recentSummaries: string[] }) {
  const payload = {
    task: "semantic_novelty_decision",
    constraints: {
      decisions: ["new", "minor_update", "noise"],
      outputJsonOnly: true
    },
    candidate: {
      key: input.candidate.key,
      title: input.candidate.title,
      link: input.candidate.link,
      contentText: clip(input.candidate.contentText, DEFAULT_MAX_CONTENT)
    },
    recentSummaries: input.recentSummaries.slice(0, 3).map((summary) => clip(summary, 1200)),
    outputSchema: {
      decision: "new|minor_update|noise",
      summary: "string"
    }
  };

  return JSON.stringify(payload);
}

export async function requestJson(input: {
  url: string;
  method?: "POST";
  headers?: Record<string, string>;
  body: unknown;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await fetch(input.url, {
      method: input.method || "POST",
      headers: {
        "content-type": "application/json",
        ...(input.headers || {})
      },
      body: JSON.stringify(input.body),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const json = (await response.json()) as JsonMap;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

