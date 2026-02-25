"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import TurndownService from "turndown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FeedDetailActions from "@/components/FeedDetailActions";
import FeedItemsEmpty from "@/components/FeedItemsEmpty";
import StatusBadge from "@/components/StatusBadge";
import type { Feed, FeedItem } from "@/lib/types";
import { apiErrorMessage, authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

const NON_MAIN_ATTR_RE =
  /\b(comment|reply|reaction|like|share|social|login|signin|signup|register|auth|subscribe|newsletter|related|recommend|sidebar|widget|toolbar|menu|pager|pagination|footer|advert|promo|评论|回复|点赞|分享|登录|注册|关注|推荐)\b/i;
const NON_MAIN_TEXT_RE =
  /\b(comment|comments|reply|replies|like|likes|share|shares|sign in|log in|login|register|subscribe|newsletter)\b|评论|回复|点赞|分享|登录|注册|关注|相关阅读|推荐阅读/i;
const NON_MAIN_HREF_RE = /\/(comment|reply|login|signin|signup|register|share|social)\b/i;

function normalizeText(input: string | null | undefined) {
  return (input || "").replace(/\s+/g, " ").trim();
}

function textLinkDensity(el: Element) {
  const total = normalizeText(el.textContent).length;
  if (!total) return 0;
  const links = normalizeText(Array.from(el.querySelectorAll("a")).map((node) => node.textContent || "").join(" ")).length;
  return links / total;
}

function isLikelyNonMainText(text: string) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (normalized.length <= 140 && NON_MAIN_TEXT_RE.test(normalized)) return true;
  if (normalized.length <= 40 && NON_MAIN_ATTR_RE.test(normalized)) return true;
  return false;
}

function sanitizeArticleHtml(input: string) {
  if (typeof window === "undefined") {
    return { html: input, nonMainText: [] as string[] };
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  const removed = new Set<string>();

  const collectRemoved = (el: Element) => {
    if (removed.size >= 10) return;
    const text = normalizeText(el.textContent);
    if (text) removed.add(text.slice(0, 160));
  };

  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,noscript,template,svg,canvas").forEach((node) => {
    collectRemoved(node as Element);
    node.remove();
  });

  doc.querySelectorAll("aside,nav,footer,form,[role='navigation'],[role='complementary']").forEach((node) => {
    collectRemoved(node as Element);
    node.remove();
  });

  const all = Array.from(doc.body.querySelectorAll("*")).reverse();
  all.forEach((el) => {
    if (!el.isConnected) return;

    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        return;
      }
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    });

    const tag = el.tagName.toLowerCase();
    if (tag === "body" || tag === "html") return;

    const text = normalizeText(el.textContent);
    if ((tag === "main" || tag === "article") && text.length > 400) return;

    const attrSignal = [
      el.getAttribute("id") || "",
      el.getAttribute("class") || "",
      el.getAttribute("role") || "",
      el.getAttribute("aria-label") || "",
      el.getAttribute("data-testid") || ""
    ].join(" ");
    const href = el.getAttribute("href") || "";
    const density = textLinkDensity(el);

    const dropByAttr = NON_MAIN_ATTR_RE.test(attrSignal) && (text.length < 1200 || density > 0.6);
    const dropByText = isLikelyNonMainText(text);
    const dropByHref = tag === "a" && NON_MAIN_HREF_RE.test(href) && text.length <= 80;
    const dropByLinks = density > 0.75 && text.length <= 400 && !el.querySelector("p,article,main");

    if (dropByAttr || dropByText || dropByHref || dropByLinks) {
      collectRemoved(el);
      el.remove();
    }
  });

  return {
    html: doc.body.innerHTML.trim(),
    nonMainText: Array.from(removed)
  };
}

function IconZen({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h12" />
      <path d="M4 17h8" />
    </svg>
  );
}

export default function FeedDetailPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "reader">("list");
  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const feedId = typeof routeParams.id === "string" ? routeParams.id : "";

  const { session } = useSession();
  const userId = session?.user?.id;
  const selectedItemId = searchParams.get("item");
  const zenMode = searchParams.get("zen") === "1";

  useEffect(() => {
    if (!userId || !feedId) {
      setFeed(null);
      setItems([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [feedRes, itemsRes] = await Promise.all([
          authFetch(`/feeds/${feedId}`),
          authFetch(`/feeds/${feedId}/items`)
        ]);
        const [feedData, itemsData] = await Promise.all([
          feedRes.json().catch(() => ({})),
          itemsRes.json().catch(() => ({}))
        ]);

        if (!feedRes.ok) {
          throw new Error(apiErrorMessage(feedData, "加载订阅源失败"));
        }
        if (!itemsRes.ok) {
          throw new Error(apiErrorMessage(itemsData, "加载条目失败"));
        }

        setFeed(feedData.feed);
        setItems(itemsData.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [feedId, userId]);

  useEffect(() => {
    setMobileView(selectedItemId ? "reader" : "list");
  }, [selectedItemId, feedId]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (zenMode) {
      document.body.classList.add("zen-mode");
    } else {
      document.body.classList.remove("zen-mode");
    }
    return () => document.body.classList.remove("zen-mode");
  }, [zenMode]);

  useEffect(() => {
    if (!feedId || selectedItemId || items.length === 0) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("item", items[0].id);
    const nextQuery = nextParams.toString();
    router.replace(`/feeds/${feedId}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
  }, [feedId, items, router, searchParams, selectedItemId]);

  useEffect(() => {
    if (!selectedItemId) return;
    const frame = window.requestAnimationFrame(() => {
      readerScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedItemId]);

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return items.find((item) => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const cleanedOriginal = useMemo(() => {
    if (!selectedItem?.content_html) {
      return { html: "", nonMainText: [] as string[] };
    }
    return sanitizeArticleHtml(selectedItem.content_html);
  }, [selectedItem?.content_html]);

  const markdown = useMemo(() => {
    if (!selectedItem) return "";
    const turndown = new TurndownService({ codeBlockStyle: "fenced" });
    const html = cleanedOriginal.html || "";
    return html ? turndown.turndown(html) : selectedItem.content_text || "";
  }, [cleanedOriginal.html, selectedItem]);
  const sanitizedOriginalHtml = useMemo(() => {
    return cleanedOriginal.html;
  }, [cleanedOriginal.html]);
  const nonMainText = cleanedOriginal.nonMainText;
  const shouldUseOriginalContent = useMemo(() => {
    if (!selectedItem) return false;
    const hasMarkdown = markdown.trim().length > 0;
    const hasOriginalHtml = sanitizedOriginalHtml.length > 0;
    return !hasMarkdown && hasOriginalHtml;
  }, [markdown, sanitizedOriginalHtml, selectedItem]);

  const hasInvalidItemParam = Boolean(selectedItemId) && !selectedItem;
  const compact = (text: string | null | undefined, max = 220) => {
    const normalized = (text || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= max) return normalized;
    return `${normalized.slice(0, max)}...`;
  };

  if (!userId) {
    return (
      <AuthGate>
        <section />
      </AuthGate>
    );
  }

  if (loading) {
    return null;
  }

  if (error) {
    return <div className="mx-auto w-full max-w-5xl card p-6 text-sm text-red-600">{error}</div>;
  }

  if (!feed) {
    return <p className="mx-auto w-full max-w-5xl">订阅源不存在。</p>;
  }

  const selectItem = (itemId: string) => {
    if (!feedId) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("item", itemId);
    const nextQuery = nextParams.toString();
    router.replace(`/feeds/${feedId}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
    setMobileView("reader");
  };

  const toggleZenMode = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (zenMode) {
      nextParams.delete("zen");
    } else {
      nextParams.set("zen", "1");
    }
    const nextQuery = nextParams.toString();
    router.replace(`/feeds/${feedId}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
  };

  return (
    <AuthGate>
      <section className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-4 overflow-hidden md:gap-6">
        {!zenMode ? (
          <div className="card shrink-0 space-y-3 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold break-words">{feed.title || feed.url}</h2>
                <p className="text-xs text-gray-500 break-all">{feed.url}</p>
              </div>
              <FeedDetailActions feedId={feed.id} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
              <StatusBadge status={feed.status} />
              <span>
                最近更新：{feed.last_fetched_at ? new Date(feed.last_fetched_at).toLocaleString() : "尚未更新"}
              </span>
            </div>
            {feed.last_error ? <p className="text-sm text-red-600">{feed.last_error}</p> : null}
            <p className="text-sm text-gray-600">{feed.description || "暂无简介"}</p>
          </div>
        ) : null}

        <div
          className={[
            "grid min-h-0 flex-1 gap-4 overflow-hidden",
            zenMode ? "grid-cols-1" : "md:grid-cols-[minmax(320px,38%)_minmax(0,1fr)]"
          ].join(" ")}
        >
          {!zenMode ? (
            <div className={`min-h-0 overflow-hidden ${mobileView === "reader" ? "hidden md:block" : ""}`}>
            <div className="card flex h-full min-h-0 flex-col p-4 md:p-5">
              <div className="shrink-0 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">最新条目</h3>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <FeedItemsEmpty />
                ) : (
                  items.map((item) => {
                    const selected = selectedItemId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={[
                          "block w-full rounded-lg border text-left transition-colors",
                          "p-4",
                          selected
                            ? "border-accent/40 bg-blue-50/60"
                            : "border-black/5 bg-white/70 hover:bg-white"
                        ].join(" ")}
                        onClick={() => selectItem(item.id)}
                      >
                        <h4 className="font-medium break-words">{compact(item.title || "未命名", 140)}</h4>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.published_at ? new Date(item.published_at).toLocaleString() : "未提供时间"}
                        </p>
                        {item.content_text ? (
                          <p className="mt-2 break-words text-sm text-gray-600">
                            {compact(item.content_text, 220)}
                          </p>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            </div>
          ) : null}

          <div className={`min-h-0 overflow-hidden ${!zenMode && mobileView === "list" ? "hidden md:block" : ""}`}>
            <div className="card flex h-full min-h-0 flex-col overflow-hidden p-4 md:p-6">
              {items.length === 0 ? (
                <FeedItemsEmpty />
              ) : !selectedItemId ? (
                <p className="text-sm text-gray-600">请选择一篇条目开始阅读。</p>
              ) : hasInvalidItemParam ? (
                <p className="text-sm text-red-600">当前条目不存在或不属于此订阅源。</p>
              ) : selectedItem ? (
                <div className="flex h-full min-h-0 flex-col space-y-4">
                  <div className="shrink-0 space-y-2 border-b border-black/10 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{feed.title || "订阅"}</p>
                      <button
                        type="button"
                        onClick={toggleZenMode}
                        className={[
                          "group relative inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm shadow-sm transition-colors",
                          zenMode
                            ? "border-blue-800 bg-blue-700 text-white hover:bg-blue-800"
                            : "border-black/10 bg-white text-ink hover:bg-black/5"
                        ].join(" ")}
                        aria-label={zenMode ? "退出 Zen 模式" : "进入 Zen 模式"}
                        title={zenMode ? "退出 Zen 模式" : "进入 Zen 模式"}
                      >
                        <IconZen className="h-4 w-4" />
                        <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {zenMode ? "退出 Zen" : "进入 Zen"}
                        </span>
                      </button>
                    </div>
                    <h3 className="text-xl font-semibold break-words">{selectedItem.title || "未命名"}</h3>
                    <p className="text-xs text-gray-500">
                      {selectedItem.published_at ? new Date(selectedItem.published_at).toLocaleString() : "未提供时间"}
                    </p>
                    {selectedItem.link ? (
                      <a className="link text-sm" href={selectedItem.link} target="_blank" rel="noreferrer">
                        原文链接
                      </a>
                    ) : null}
                  </div>
                  <div ref={readerScrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="prose prose-pre:overflow-x-auto prose-code:break-words max-w-none break-words text-[16px] leading-8 text-slate-900 prose-headings:text-slate-950 prose-p:text-slate-900 prose-strong:text-slate-950 prose-a:text-blue-700 prose-li:text-slate-900">
                      {shouldUseOriginalContent ? (
                        <div className="space-y-3">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">正文内容</p>
                          <div dangerouslySetInnerHTML={{ __html: sanitizedOriginalHtml }} />
                        </div>
                      ) : markdown ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                      ) : (
                        <p>暂无内容。</p>
                      )}
                      {nonMainText.length > 0 ? (
                        <details className="not-prose mt-8 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.16em] text-slate-500">
                            非正文信息（已折叠）
                          </summary>
                          <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3 text-[12px] leading-5 text-slate-500">
                            {nonMainText.map((line, idx) => (
                              <p key={`${idx}-${line.slice(0, 24)}`} className="font-normal italic">
                                {line}
                              </p>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-600">条目加载中...</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
