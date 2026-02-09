"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import TurndownService from "turndown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import FeedDetailActions from "@/components/FeedDetailActions";
import StatusBadge from "@/components/StatusBadge";
import type { Feed, FeedItem } from "@/lib/types";
import { apiErrorMessage, authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

function IconCompact({ className = "" }: { className?: string }) {
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
      <path d="M4 5h6v14H4z" />
      <path d="M14 5h6v4h-6z" />
      <path d="M14 11h6v3h-6z" />
      <path d="M14 17h6v2h-6z" />
    </svg>
  );
}

function sanitizeHtml(input: string) {
  if (typeof window === "undefined") return input;
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(input, "text/html");

  doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());

  doc.querySelectorAll("*").forEach((el) => {
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
  });

  return doc.body.innerHTML.trim();
}

export default function FeedDetailPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "reader">("list");
  const [compactList, setCompactList] = useState(false);
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
    if (!zenMode && compactList) {
      setCompactList(false);
    }
  }, [compactList, zenMode]);

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

  const markdown = useMemo(() => {
    if (!selectedItem) return "";
    const turndown = new TurndownService({ codeBlockStyle: "fenced" });
    const html = selectedItem.content_html || "";
    return html ? turndown.turndown(html) : selectedItem.content_text || "";
  }, [selectedItem]);
  const sanitizedOriginalHtml = useMemo(() => {
    if (!selectedItem?.content_html) return "";
    return sanitizeHtml(selectedItem.content_html);
  }, [selectedItem?.content_html]);
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
    return <div className="card p-6 text-sm text-red-600">{error}</div>;
  }

  if (!feed) {
    return <p>订阅源不存在。</p>;
  }

  const selectItem = (itemId: string) => {
    if (!feedId) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("item", itemId);
    const nextQuery = nextParams.toString();
    router.replace(`/feeds/${feedId}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
    setMobileView("reader");
  };

  return (
    <AuthGate>
      <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden md:gap-6">
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
            zenMode
              ? compactList
                ? "md:grid-cols-[88px_minmax(0,1fr)]"
                : "md:grid-cols-[minmax(240px,30%)_minmax(0,1fr)]"
              : "md:grid-cols-[minmax(320px,38%)_minmax(0,1fr)]"
          ].join(" ")}
        >
          <div className={`min-h-0 overflow-hidden ${mobileView === "reader" ? "hidden md:block" : ""}`}>
            <div className="card flex h-full min-h-0 flex-col p-4 md:p-5">
              <div className="shrink-0 flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{zenMode && compactList ? "缩略" : "最新条目"}</h3>
                <div className="flex items-center gap-2">
                  {zenMode ? (
                    <button
                      type="button"
                      className={[
                        "btn hidden px-2 py-1 md:inline-flex",
                        compactList ? "border-blue-800 bg-blue-700 text-white hover:bg-blue-800" : ""
                      ].join(" ")}
                      onClick={() => setCompactList((v) => !v)}
                      title={compactList ? "展开列表" : "缩略列表"}
                      aria-label={compactList ? "展开列表" : "缩略列表"}
                      aria-pressed={compactList}
                    >
                      <IconCompact className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {items.length === 0 ? (
                  <p className="text-sm text-gray-600">暂无条目，请刷新订阅源。</p>
                ) : (
                  items.map((item) => {
                    const selected = selectedItemId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={[
                          "block w-full rounded-lg border text-left transition-colors",
                          zenMode && compactList ? "p-2" : "p-4",
                          selected
                            ? "border-accent/40 bg-blue-50/60"
                            : "border-black/5 bg-white/70 hover:bg-white"
                        ].join(" ")}
                        onClick={() => selectItem(item.id)}
                      >
                        {zenMode && compactList ? (
                          <div className="space-y-1">
                            <p className="line-clamp-3 text-xs font-semibold leading-tight break-all">
                              {compact(item.title || "未命名", 60)}
                            </p>
                            <p className="text-[11px] text-gray-500">
                              {item.published_at ? new Date(item.published_at).toLocaleDateString() : "-"}
                            </p>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-medium break-words">{compact(item.title || "未命名", 140)}</h4>
                            <p className="mt-1 text-xs text-gray-500">
                              {item.published_at ? new Date(item.published_at).toLocaleString() : "未提供时间"}
                            </p>
                            {item.content_text ? (
                              <p className="mt-2 break-words text-sm text-gray-600">
                                {compact(item.content_text, 220)}
                              </p>
                            ) : null}
                          </>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className={`min-h-0 overflow-hidden ${mobileView === "list" ? "hidden md:block" : ""}`}>
            <div className="card flex h-full min-h-0 flex-col overflow-hidden p-4 md:p-6">
              {!selectedItemId ? (
                <p className="text-sm text-gray-600">请选择一篇条目开始阅读。</p>
              ) : hasInvalidItemParam ? (
                <p className="text-sm text-red-600">当前条目不存在或不属于此订阅源。</p>
              ) : selectedItem ? (
                <div className="flex h-full min-h-0 flex-col space-y-4">
                  <div className="shrink-0 space-y-2 border-b border-black/10 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{feed.title || "订阅"}</p>
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
                    <div className="prose prose-pre:overflow-x-auto prose-code:break-words max-w-none break-words">
                      {shouldUseOriginalContent ? (
                        <div className="space-y-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">原文内容</p>
                          <div dangerouslySetInnerHTML={{ __html: sanitizedOriginalHtml }} />
                        </div>
                      ) : markdown ? (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
                      ) : (
                        <p>暂无内容。</p>
                      )}
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
