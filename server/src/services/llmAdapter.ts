import type { LlmDecision, WebCandidate, WebExtractionRule } from "./langgraphPipeline";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type InferRuleInput = {
  url: string;
  title: string | null;
  html: string;
  candidates: WebCandidate[];
};

type SemanticDecisionInput = {
  candidate: WebCandidate;
  recentSummaries: string[];
};

type SemanticDecisionOutput = {
  decision: LlmDecision;
  summary: string;
};

export interface MonitorLlmAdapter {
  inferMonitorRule(input: InferRuleInput): Promise<WebExtractionRule | null>;
  semanticDecide(input: SemanticDecisionInput): Promise<SemanticDecisionOutput | null>;
}

let cachedAdapter: MonitorLlmAdapter | null | undefined;

function toImportSpecifier(modulePath: string) {
  const raw = modulePath.trim();
  if (!raw) return raw;
  if (raw.startsWith("file://")) {
    try {
      return fileURLToPath(raw);
    } catch {
      return raw;
    }
  }
  if (path.isAbsolute(raw)) return raw;

  const cwdResolved = path.resolve(process.cwd(), raw);
  if (fs.existsSync(cwdResolved)) return cwdResolved;

  const runtimeResolved = path.resolve(__dirname, raw);
  if (fs.existsSync(runtimeResolved)) return runtimeResolved;

  return raw;
}

async function loadAdapterFromEnv(): Promise<MonitorLlmAdapter | null> {
  if (cachedAdapter !== undefined) {
    return cachedAdapter;
  }

  const modulePath = process.env.RSS_LLM_ADAPTER_PATH?.trim();
  if (!modulePath) {
    cachedAdapter = null;
    return cachedAdapter;
  }

  try {
    const imported = await import(toImportSpecifier(modulePath));
    const maybeFactory = imported?.createAdapter;
    const maybeDefault = imported?.default;
    const adapter =
      typeof maybeFactory === "function"
        ? await maybeFactory()
        : typeof maybeDefault === "function"
          ? await maybeDefault()
          : maybeDefault;

    if (
      adapter &&
      typeof adapter.inferMonitorRule === "function" &&
      typeof adapter.semanticDecide === "function"
    ) {
      cachedAdapter = adapter as MonitorLlmAdapter;
      return cachedAdapter;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown adapter load error";
    console.warn("[llm-adapter] load_failed", { modulePath, message });
  }

  cachedAdapter = null;
  return cachedAdapter;
}

export async function inferRuleByAdapter(input: InferRuleInput) {
  const adapter = await loadAdapterFromEnv();
  if (!adapter) return null;
  try {
    return await adapter.inferMonitorRule(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown adapter infer error";
    console.warn("[llm-adapter] infer_failed", { message });
    return null;
  }
}

export async function semanticDecideByAdapter(input: SemanticDecisionInput) {
  const adapter = await loadAdapterFromEnv();
  if (!adapter) return null;
  try {
    return await adapter.semanticDecide(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown adapter semantic error";
    console.warn("[llm-adapter] semantic_failed", { message });
    return null;
  }
}
