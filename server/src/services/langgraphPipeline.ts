import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import { DEFAULT_HEADERS } from "../utils/constants";
import { inferRuleByAdapter, semanticDecideByAdapter } from "./llmAdapter";

export type FeedSourceType = "rss" | "web_monitor";
export type LlmDecision = "new" | "minor_update" | "noise";

export type WebExtractionMode = "partial_preferred" | "full_page";

export type WebCandidate = {
  key: string;
  title: string | null;
  link: string | null;
  publishedAt: string | null;
  contentText: string;
  contentMarkdown?: string | null;
  contentHtml: string | null;
};

export type WebExtractionRule = {
  strategy: "readability" | "selector" | "full_page";
  containerSelector?: string;
  itemSelector?: string;
  titleSelector?: string;
  linkSelector?: string;
  timeSelector?: string;
  notes?: string;
};

type RenderedPage = {
  url: string;
  title: string | null;
  html: string;
  warnings: string[];
};

type ConversionResult = {
  siteUrl: string;
  title: string | null;
  description: string | null;
  extractionMode: WebExtractionMode;
  extractionRule: WebExtractionRule;
  candidates: WebCandidate[];
  warnings: string[];
};

export class PipelineError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type SemanticDecisionInput = {
  candidate: WebCandidate;
  recentSummaries: string[];
  budget: { used: number; max: number };
};

type SemanticDecisionResult = {
  decision: LlmDecision;
  summary: string;
  budgetExceeded?: boolean;
};

const MIN_MEANINGFUL_TEXT_CHARS = 80;
const FETCH_TIMEOUT_MS = Number(process.env.INTAKE_FETCH_TIMEOUT_MS || 12000);
const CONVERSION_TIMEOUT_MS = Number(process.env.INTAKE_MAX_CONVERSION_MS || 20000);
const CONTENT_ENRICH_MIN_CHARS = Number(process.env.CONTENT_ENRICH_MIN_CHARS || 140);
const CONTENT_ENRICH_MAX_LINKS = Number(process.env.CONTENT_ENRICH_MAX_LINKS || 3);
const CONTENT_ENRICH_TIMEOUT_MS = Number(process.env.CONTENT_ENRICH_TIMEOUT_MS || 8000);

function safeRequire(name: string): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(name);
  } catch {
    return null;
  }
}

function normalizeSpace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function toHash(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function toAbsoluteUrl(href: string | null | undefined, baseUrl: string) {
  const raw = (href || "").trim();
  if (!raw) return null;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return null;
  }
}

function sanitizeText(input: string) {
  return normalizeSpace(input).slice(0, 24000);
}

function hasMeaningfulText(input: string) {
  return sanitizeText(input).length >= MIN_MEANINGFUL_TEXT_CHARS;
}

function candidateBodyLength(candidate: Pick<WebCandidate, "contentText" | "contentMarkdown" | "contentHtml">) {
  const textLen = sanitizeText(candidate.contentText || "").length;
  const markdownLen = sanitizeText(candidate.contentMarkdown || "").length;
  const htmlLen = candidate.contentHtml ? sanitizeText(cheerio.load(candidate.contentHtml).text())?.length : 0;
  return Math.max(textLen, markdownLen, htmlLen || 0);
}

function withTimeout<T>(promise: Promise<T>, ms: number, code: string, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(new PipelineError(code, message));
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

function toMarkdown(html: string | null) {
  if (!html) return null;
  const TurndownService = safeRequire("turndown");
  if (!TurndownService) return null;
  try {
    const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
    const md = turndown.turndown(html);
    const normalized = normalizeSpace(md);
    return normalized || null;
  } catch {
    return null;
  }
}

export function candidateContentHash(candidate: WebCandidate) {
  const raw = normalizeSpace([candidate.title || "", candidate.link || "", candidate.contentText].join("\n"));
  return toHash(raw);
}

function summarizeCandidate(candidate: WebCandidate) {
  const content = sanitizeText(candidate.contentText);
  if (content.length <= 260) return content || candidate.title || "empty";
  return `${content.slice(0, 260)}...`;
}

function lexicalSimilarity(a: string, b: string) {
  const setA = new Set(
    normalizeSpace(a)
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
  );
  const setB = new Set(
    normalizeSpace(b)
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
  );
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const token of setA) {
    if (setB.has(token)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function fetchWithPlaywright(inputUrl: string): Promise<RenderedPage> {
  const playwright = safeRequire("playwright");
  if (!playwright?.chromium) {
    throw new PipelineError("WEB_MONITOR_RENDER_FAILED", "Playwright is not installed");
  }

  const browser = await playwright.chromium.launch({ headless: true });
  const warnings: string[] = [];

  try {
    const page = await browser.newPage({
      userAgent: DEFAULT_HEADERS["User-Agent"]
    });

    page.setDefaultNavigationTimeout(FETCH_TIMEOUT_MS);
    const response = await page.goto(inputUrl, { waitUntil: "domcontentloaded", timeout: FETCH_TIMEOUT_MS });
    if (!response || response.status() >= 400) {
      warnings.push(`render status=${response?.status() || "unknown"}`);
    }

    await page.waitForTimeout(250);
    const html = await page.content();
    const title = (await page.title()) || null;
    const url = page.url();

    return { url, title, html, warnings };
  } finally {
    await browser.close();
  }
}

async function fetchStatically(inputUrl: string): Promise<RenderedPage> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const response = await fetch(inputUrl, { headers: DEFAULT_HEADERS, redirect: "follow", signal: controller.signal }).finally(
    () => clearTimeout(timer)
  );
  if (!response.ok) {
    throw new PipelineError("WEB_MONITOR_RENDER_FAILED", `Static fetch failed with status ${response.status}`);
  }

  const html = await response.text();
  const title = cheerio.load(html)("title").first().text().trim() || null;
  return { url: response.url, title, html, warnings: [] };
}

export async function renderPageWithFallback(inputUrl: string): Promise<RenderedPage> {
  try {
    return await fetchWithPlaywright(inputUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown render error";
    const staticResult = await fetchStatically(inputUrl);
    staticResult.warnings.push(`playwright_failed:${message}`);
    return staticResult;
  }
}

function extractCandidatesWithReadability(rendered: RenderedPage): WebCandidate[] {
  const jsdom = safeRequire("jsdom");
  const readabilityPkg = safeRequire("@mozilla/readability");
  if (!jsdom?.JSDOM || !readabilityPkg?.Readability) {
    return [];
  }

  try {
    const dom = new jsdom.JSDOM(rendered.html, { url: rendered.url });
    const reader = new readabilityPkg.Readability(dom.window.document);
    const article = reader.parse();

    if (!article?.textContent) {
      return [];
    }

    const text = sanitizeText(article.textContent);
    if (!hasMeaningfulText(text)) {
      return [];
    }
    const html = typeof article.content === "string" ? article.content : null;
    const markdown = toMarkdown(html);
    const key = toHash(`${rendered.url}:${article.title || ""}:${text.slice(0, 280)}`);

    return [
      {
        key,
        title: article.title || rendered.title,
        link: rendered.url,
        publishedAt: null,
        contentText: text,
        contentMarkdown: markdown,
        contentHtml: html
      }
    ];
  } catch {
    return [];
  }
}

function extractCandidatesWithSelector(rendered: RenderedPage, rule: WebExtractionRule): WebCandidate[] {
  const $ = cheerio.load(rendered.html);
  const rootSelector = rule.containerSelector || "main, article, body";
  const itemSelector = rule.itemSelector || "article, .post, .entry, li";
  const titleSelector = rule.titleSelector || "h1, h2, h3";
  const linkSelector = rule.linkSelector || "a[href]";
  const timeSelector = rule.timeSelector || "time";

  const roots = $(rootSelector);
  const candidates: WebCandidate[] = [];

  roots.each((_, root) => {
    $(root)
      .find(itemSelector)
      .slice(0, 8)
      .each((index, el) => {
        const title = normalizeSpace($(el).find(titleSelector).first().text()) || null;
        const link = toAbsoluteUrl($(el).find(linkSelector).first().attr("href"), rendered.url);
        const publishedAtRaw = normalizeSpace($(el).find(timeSelector).first().attr("datetime") || "");
        const publishedAt = publishedAtRaw || null;
        const text = sanitizeText($(el).text());
        const html = $.html(el) || null;
        if (!hasMeaningfulText(text)) return;
        const markdown = toMarkdown(html);
        const key = toHash(`${rendered.url}:${index}:${link || ""}:${title || ""}:${text.slice(0, 200)}`);
        candidates.push({
          key,
          title: title || rendered.title,
          link,
          publishedAt,
          contentText: text,
          contentMarkdown: markdown,
          contentHtml: html
        });
      });
  });

  if (candidates.length > 0) return candidates;

  const fallbackText = sanitizeText($("main, article, body").first().text());
  if (!hasMeaningfulText(fallbackText)) return [];
  const fallbackHtml = $("main, article, body").first().html() || null;

  return [
    {
      key: toHash(`${rendered.url}:${fallbackText.slice(0, 260)}`),
      title: rendered.title,
      link: rendered.url,
      publishedAt: null,
      contentText: fallbackText,
      contentMarkdown: toMarkdown(fallbackHtml),
      contentHtml: fallbackHtml
    }
  ];
}

function extractCandidates(
  rendered: RenderedPage,
  mode: WebExtractionMode,
  rule?: WebExtractionRule | null
): WebCandidate[] {
  if (mode === "full_page") {
    const text = sanitizeText(cheerio.load(rendered.html)("body").text());
    if (!hasMeaningfulText(text)) return [];
    return [
      {
        key: toHash(`${rendered.url}:${text.slice(0, 400)}`),
        title: rendered.title,
        link: rendered.url,
        publishedAt: null,
        contentText: text,
        contentMarkdown: toMarkdown(rendered.html),
        contentHtml: rendered.html
      }
    ];
  }

  const readabilityCandidates = extractCandidatesWithReadability(rendered);
  if (readabilityCandidates.length > 0) return readabilityCandidates;
  return extractCandidatesWithSelector(rendered, rule || { strategy: "selector" });
}

async function extractBestCandidateFromUrl(inputUrl: string) {
  const result = await withTimeout(
    (async () => {
      const rendered = await renderPageWithFallback(inputUrl);
      const partial = extractCandidates(rendered, "partial_preferred");
      if (partial.length > 0) return partial[0];
      const full = extractCandidates(rendered, "full_page");
      return full[0] || null;
    })(),
    CONTENT_ENRICH_TIMEOUT_MS,
    "WEB_MONITOR_RENDER_FAILED",
    "Detail content enrichment timeout"
  );
  return result;
}

function shouldEnrichCandidate(candidate: WebCandidate, pageUrl: string) {
  if (!candidate.link) return false;
  if (candidate.link === pageUrl) return false;
  return candidateBodyLength(candidate) < CONTENT_ENRICH_MIN_CHARS;
}

async function enrichCandidatesWithLinkedContent(candidates: WebCandidate[], pageUrl: string) {
  if (!candidates.length || CONTENT_ENRICH_MAX_LINKS <= 0) {
    return { candidates, warnings: [] as string[] };
  }

  const enriched = [...candidates];
  const warnings: string[] = [];
  let used = 0;
  const linkCache = new Map<string, WebCandidate | null>();

  for (let i = 0; i < enriched.length; i += 1) {
    if (used >= CONTENT_ENRICH_MAX_LINKS) break;
    const current = enriched[i];
    if (!shouldEnrichCandidate(current, pageUrl)) continue;

    used += 1;
    try {
      const targetLink = current.link || "";
      const cached = linkCache.get(targetLink);
      const detail = cached !== undefined ? cached : await extractBestCandidateFromUrl(targetLink);
      if (cached === undefined) {
        linkCache.set(targetLink, detail);
      }
      if (!detail) {
        warnings.push("detail_enrich_empty");
        continue;
      }
      const currentLen = candidateBodyLength(current);
      const detailLen = candidateBodyLength(detail);
      if (detailLen < CONTENT_ENRICH_MIN_CHARS || detailLen <= currentLen + 24) {
        continue;
      }

      enriched[i] = {
        ...current,
        title: current.title || detail.title,
        contentText: detail.contentText,
        contentMarkdown: detail.contentMarkdown || detail.contentText,
        contentHtml: detail.contentHtml
      };
    } catch {
      warnings.push("detail_enrich_failed");
    }
  }

  return { candidates: enriched, warnings };
}

export async function extractReadableContentFromUrl(inputUrl: string) {
  try {
    const candidate = await extractBestCandidateFromUrl(inputUrl);
    if (!candidate) return null;
    return {
      title: candidate.title,
      contentText: candidate.contentText,
      contentMarkdown: candidate.contentMarkdown || null,
      contentHtml: candidate.contentHtml
    };
  } catch {
    return null;
  }
}

async function inferRuleWithLlm(rendered: RenderedPage, candidates: WebCandidate[]): Promise<WebExtractionRule | null> {
  return inferRuleByAdapter({
    url: rendered.url,
    title: rendered.title,
    html: rendered.html,
    candidates
  });
}

async function runLinearConversion(inputUrl: string): Promise<ConversionResult> {
  const rendered = await renderPageWithFallback(inputUrl);
  const warnings = [...rendered.warnings];

  const extracted = extractCandidates(rendered, "partial_preferred");
  if (extracted.length === 0) {
    const fullPageCandidates = extractCandidates(rendered, "full_page");
    if (fullPageCandidates.length === 0) {
      throw new PipelineError("WEB_MONITOR_EXTRACTION_EMPTY", "No extractable content from page");
    }

    return {
      siteUrl: new URL(rendered.url).origin,
      title: rendered.title,
      description: "Converted from non-RSS page (full-page fallback)",
      extractionMode: "full_page",
      extractionRule: { strategy: "full_page", notes: "readability-and-selector-empty-fallback" },
      candidates: fullPageCandidates,
      warnings: warnings.concat(["partial_extract_empty_fallback_full_page"])
    };
  }

  const enriched = await enrichCandidatesWithLinkedContent(extracted, rendered.url);
  warnings.push(...enriched.warnings);

  const llmRule = await inferRuleWithLlm(rendered, enriched.candidates).catch(() => null);
  const rule = llmRule || { strategy: "readability", notes: "heuristic-default" };

  return {
    siteUrl: new URL(rendered.url).origin,
    title: rendered.title,
    description: "Converted from non-RSS page",
    extractionMode: "partial_preferred",
    extractionRule: rule,
    candidates: enriched.candidates,
    warnings
  };
}

async function runWithLangGraph(inputUrl: string): Promise<ConversionResult> {
  const langgraphPkg = safeRequire("@langchain/langgraph");
  if (!langgraphPkg?.StateGraph || !langgraphPkg?.Annotation) {
    return runLinearConversion(inputUrl);
  }

  try {
    const Annotation = langgraphPkg.Annotation;
    const START = langgraphPkg.START;
    const END = langgraphPkg.END;
    const StateGraph = langgraphPkg.StateGraph;

    const State = Annotation.Root({
      inputUrl: Annotation(),
      rendered: Annotation({ reducer: (_x: any, y: any) => y, default: () => null }),
      candidates: Annotation({ reducer: (_x: any, y: any) => y, default: () => [] }),
      extractionMode: Annotation({ reducer: (_x: any, y: any) => y, default: () => null }),
      extractionRule: Annotation({ reducer: (_x: any, y: any) => y, default: () => null }),
      warnings: Annotation({ reducer: (x: string[], y: string[]) => [...x, ...y], default: () => [] })
    });

    const graph = new StateGraph(State)
      .addNode("fetch_page", async (state: any) => {
        const rendered = await renderPageWithFallback(state.inputUrl);
        return { rendered, warnings: rendered.warnings };
      })
      .addNode("extract_partial_content", async (state: any) => {
        const rendered: RenderedPage = state.rendered;
        const partial = extractCandidates(rendered, "partial_preferred");
        if (partial.length > 0) {
          const enriched = await enrichCandidatesWithLinkedContent(partial, rendered.url);
          return {
            candidates: enriched.candidates,
            extractionMode: "partial_preferred",
            extractionRule: { strategy: "readability", notes: "langgraph-partial" } as WebExtractionRule,
            warnings: enriched.warnings
          };
        }
        const full = extractCandidates(rendered, "full_page");
        return {
          candidates: full,
          extractionMode: "full_page",
          extractionRule: { strategy: "full_page", notes: "langgraph-full-page-fallback" } as WebExtractionRule,
          warnings: ["partial_extract_empty_fallback_full_page"]
        };
      })
      .addNode("infer_monitor_rule", async (state: any) => {
        const rendered: RenderedPage = state.rendered;
        const candidates: WebCandidate[] = state.candidates;
        const llmRule = await inferRuleWithLlm(rendered, candidates).catch(() => null);
        if (!llmRule) return {};
        return { extractionRule: llmRule };
      })
      .addNode("dry_run_validate", async (state: any) => {
        const candidates: WebCandidate[] = state.candidates;
        if (candidates.length === 0) {
          throw new PipelineError("INTAKE_VALIDATION_FAILED", "No candidates after rule validation");
        }
        return {};
      })
      .addEdge(START, "fetch_page")
      .addEdge("fetch_page", "extract_partial_content")
      .addEdge("extract_partial_content", "infer_monitor_rule")
      .addEdge("infer_monitor_rule", "dry_run_validate")
      .addEdge("dry_run_validate", END);

    const app = graph.compile();
    const state = await app.invoke({ inputUrl });
    const rendered: RenderedPage = state.rendered;
    const candidates: WebCandidate[] = state.candidates || [];
    const extractionMode: WebExtractionMode = state.extractionMode || "partial_preferred";
    const extractionRule: WebExtractionRule =
      state.extractionRule || { strategy: "readability", notes: "langgraph-default" };

    return {
      siteUrl: new URL(rendered.url).origin,
      title: rendered.title,
      description: "Converted from non-RSS page",
      extractionMode,
      extractionRule,
      candidates,
      warnings: state.warnings || []
    };
  } catch (err) {
    if (err instanceof PipelineError) {
      throw err;
    }
    return runLinearConversion(inputUrl);
  }
}

export async function runLangGraphConversion(inputUrl: string): Promise<ConversionResult> {
  try {
    return await withTimeout(
      runWithLangGraph(inputUrl),
      CONVERSION_TIMEOUT_MS,
      "INTAKE_CONVERSION_TIMEOUT",
      "Conversion exceeded time budget"
    );
  } catch (err) {
    if (err instanceof PipelineError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Unknown conversion error";
    throw new PipelineError("INTAKE_CONVERSION_FAILED", message);
  }
}

export async function extractCandidatesForRefresh({
  url,
  extractionMode,
  extractionRule
}: {
  url: string;
  extractionMode: WebExtractionMode;
  extractionRule?: WebExtractionRule | null;
}) {
  const rendered = await renderPageWithFallback(url);
  const initialCandidates = extractCandidates(rendered, extractionMode, extractionRule || undefined);
  if (initialCandidates.length === 0) {
    throw new PipelineError("WEB_MONITOR_EXTRACTION_EMPTY", "No extractable candidates during refresh");
  }
  const enriched = await enrichCandidatesWithLinkedContent(initialCandidates, rendered.url);
  rendered.warnings.push(...enriched.warnings);
  return { rendered, candidates: enriched.candidates };
}

export async function semanticDecideNovelty({
  candidate,
  recentSummaries,
  budget
}: SemanticDecisionInput): Promise<SemanticDecisionResult> {
  const summary = summarizeCandidate(candidate);
  const baseline = recentSummaries.filter(Boolean).slice(0, 3);
  if (baseline.length === 0) {
    return { decision: "new", summary };
  }

  const topSimilarity = Math.max(...baseline.map((item) => lexicalSimilarity(summary, item)));
  if (topSimilarity >= 0.92) {
    return { decision: "noise", summary };
  }
  if (topSimilarity >= 0.78) {
    return { decision: "minor_update", summary };
  }

  const adapterEnabled = Boolean(process.env.RSS_LLM_ADAPTER_PATH?.trim());
  if (!adapterEnabled) {
    return { decision: "new", summary };
  }

  if (budget.used >= budget.max) {
    return { decision: "noise", summary, budgetExceeded: true };
  }

  budget.used += 1;
  const adapted = await semanticDecideByAdapter({
    candidate,
    recentSummaries: baseline
  });
  if (!adapted) {
    return { decision: "new", summary };
  }

  const decision: LlmDecision =
    adapted.decision === "minor_update" || adapted.decision === "noise" ? adapted.decision : "new";
  const nextSummary = adapted.summary?.trim() || summary;
  return { decision, summary: nextSummary.slice(0, 1200) };
}
