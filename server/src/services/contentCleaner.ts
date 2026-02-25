import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

const STRIP_TAG_SELECTOR =
  "script,style,iframe,object,embed,link,meta,noscript,template,svg,canvas,button,input,textarea,select,option";
const STRUCTURAL_NON_MAIN_SELECTOR = "aside,nav,footer,form,[role='navigation'],[role='complementary']";
const NON_MAIN_ATTR_RE =
  /\b(comment|reply|discussion|disqus|reaction|like|share|social|login|signin|signup|register|auth|subscribe|newsletter|related|recommend|sidebar|widget|toolbar|menu|pager|pagination|footer|advert|promo|cta|评论|回复|点赞|分享|登录|注册|关注|推荐)\b/i;
const NON_MAIN_TEXT_RE =
  /\b(comment|comments|reply|replies|like|likes|share|shares|sign in|log in|login|register|subscribe|newsletter)\b|评论|回复|点赞|分享|登录|注册|关注|立即登录|相关阅读|推荐阅读/i;
const NON_MAIN_HREF_RE = /\/(comment|reply|login|signin|signup|register|share|social)\b/i;
const MAX_TEXT_CHARS = 24000;
const MAX_REMOVED_TEXT_CHARS = 160;
const MAX_REMOVED_ITEMS = 12;

function normalizeWhitespace(input: string | null | undefined) {
  return (input || "").replace(/\s+/g, " ").trim();
}

function isLikelyNoiseText(text: string) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return false;
  if (normalized.length <= 140 && NON_MAIN_TEXT_RE.test(normalized)) return true;
  if (normalized.length <= 40 && NON_MAIN_ATTR_RE.test(normalized)) return true;
  return false;
}

function linkDensity($: cheerio.CheerioAPI, el: AnyNode) {
  const totalText = normalizeWhitespace($(el).text()).length;
  if (totalText === 0) return 0;
  const linkText = normalizeWhitespace($(el).find("a").text()).length;
  return linkText / totalText;
}

function collectRemovedSnippet($: cheerio.CheerioAPI, el: AnyNode, bag: Set<string>) {
  if (bag.size >= MAX_REMOVED_ITEMS) return;
  const text = normalizeWhitespace($(el).text());
  if (!text) return;
  bag.add(text.slice(0, MAX_REMOVED_TEXT_CHARS));
}

export function cleanTextForReading(input: string | null | undefined) {
  const raw = (input || "").replace(/\r/g, "\n");
  if (!raw.trim()) return "";

  const lines = raw.split("\n");
  const kept: string[] = [];

  for (const line of lines) {
    const text = normalizeWhitespace(line);
    if (!text) continue;
    if (isLikelyNoiseText(text)) continue;
    if (kept[kept.length - 1] === text) continue;
    kept.push(text);
  }

  return normalizeWhitespace(kept.join(" ")).slice(0, MAX_TEXT_CHARS);
}

export function cleanHtmlForReading(inputHtml: string | null | undefined) {
  if (!inputHtml || !inputHtml.trim()) {
    return { contentHtml: null, contentText: "", removedText: [] as string[] };
  }

  const $ = cheerio.load(inputHtml);
  const removedText = new Set<string>();

  $(STRIP_TAG_SELECTOR).each((_, el) => {
    collectRemovedSnippet($, el, removedText);
    $(el).remove();
  });

  $(STRUCTURAL_NON_MAIN_SELECTOR).each((_, el) => {
    collectRemovedSnippet($, el, removedText);
    $(el).remove();
  });

  const nodes = $("*")
    .toArray()
    .reverse();

  for (const el of nodes) {
    if (!el.parent) continue;
    const tag = (el as any).tagName?.toLowerCase?.() || "";
    if (tag === "html" || tag === "body") continue;

    const $el = $(el);
    const text = normalizeWhitespace($el.text());
    const id = $el.attr("id") || "";
    const classes = $el.attr("class") || "";
    const role = $el.attr("role") || "";
    const ariaLabel = $el.attr("aria-label") || "";
    const dataTest = $el.attr("data-testid") || "";
    const attrSignal = `${id} ${classes} ${role} ${ariaLabel} ${dataTest}`;

    if ((tag === "main" || tag === "article") && text.length > 400) {
      continue;
    }

    const density = linkDensity($, el);
    const href = $el.attr("href") || "";
    const dropByAttr = NON_MAIN_ATTR_RE.test(attrSignal) && (text.length < 1200 || density > 0.6);
    const dropByText = isLikelyNoiseText(text);
    const dropByHref = tag === "a" && NON_MAIN_HREF_RE.test(href) && text.length <= 80;
    const dropByLinks = density > 0.75 && text.length <= 400 && $el.find("p,article,main").length === 0;

    if (dropByAttr || dropByText || dropByHref || dropByLinks) {
      collectRemovedSnippet($, el, removedText);
      $el.remove();
    }
  }

  const body = $("body");
  const htmlSource = body.length > 0 ? body.html() : $.root().html();
  const textSource = body.length > 0 ? body.text() : $.root().text();
  const contentHtml = normalizeWhitespace(htmlSource || "") ? (htmlSource || "").trim() : null;
  const contentText = cleanTextForReading(textSource);
  return {
    contentHtml,
    contentText,
    removedText: Array.from(removedText)
  };
}
