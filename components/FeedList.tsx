"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Feed } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase/browser";
import { apiErrorMessage, authFetch } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

function IconRefresh({ className = "" }: { className?: string }) {
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
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function IconMore({ className = "" }: { className?: string }) {
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
      <path d="M12 12h.01" />
      <path d="M19 12h.01" />
      <path d="M5 12h.01" />
    </svg>
  );
}

function IconPencil({ className = "" }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function IconTrash({ className = "" }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export default function FeedList({ initialFeeds }: { initialFeeds: Feed[] }) {
  const [feeds, setFeeds] = useState<Feed[]>(initialFeeds);
  const router = useRouter();
  const [busyAll, setBusyAll] = useState(false);
  const [busyById, setBusyById] = useState<Record<string, "delete" | undefined>>({});
  const [removingIds, setRemovingIds] = useState<Record<string, true | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel("feeds-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feeds" },
        (payload) => {
          setFeeds((prev) => {
            if (payload.eventType === "DELETE") {
              return prev.filter((feed) => feed.id !== (payload.old as Feed).id);
            }
            const next = payload.new as Feed;
            const exists = prev.find((feed) => feed.id === next.id);
            if (!exists) {
              return [next, ...prev];
            }
            return prev.map((feed) => (feed.id === next.id ? { ...feed, ...next } : feed));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      // Close if user clicked outside the menu container
      if (target.closest("[data-feedlist-menu-root]")) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const sortedFeeds = useMemo(() => {
    // Keep stable-ish ordering, newest first if created_at exists.
    return [...feeds].sort((a, b) => {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bt - at;
    });
  }, [feeds]);

  const refreshAll = async () => {
    setBusyAll(true);
    setError(null);
    try {
      const res = await authFetch("/refresh", {
        method: "POST",
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "刷新全部失败"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新全部失败");
    } finally {
      setBusyAll(false);
    }
  };

  const deleteFeed = async (id: string) => {
    setBusyById((prev) => ({ ...prev, [id]: "delete" }));
    setRemovingIds((prev) => ({ ...prev, [id]: true }));
    setError(null);
    try {
      const res = await authFetch(`/feeds/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "删除订阅失败"));
      }
      // Allow the CSS transition to play.
      window.setTimeout(() => {
        setFeeds((prev) => prev.filter((feed) => feed.id !== id));
        setRemovingIds((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 220);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除订阅失败");
      setRemovingIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      setBusyById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const selectedFeed = useMemo(() => {
    if (!selectedId) return null;
    return feeds.find((f) => f.id === selectedId) || null;
  }, [feeds, selectedId]);

  const toggleManageMode = () => {
    setManageMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedId(null);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <div className="relative" data-feedlist-menu-root>
          <button
            className="btn px-2.5"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="操作菜单"
            disabled={busyAll}
          >
            <IconMore className="h-4 w-4" />
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-black/10 bg-white shadow-lg"
            >
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-60"
                onClick={async () => {
                  setMenuOpen(false);
                  await refreshAll();
                }}
                disabled={busyAll}
              >
                <IconRefresh className={["h-4 w-4", busyAll ? "animate-spin" : ""].join(" ")} />
                刷新全部
              </button>

              <Link
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5"
                href="/feeds/new"
                onClick={() => setMenuOpen(false)}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400">＋</span>
                新增订阅
              </Link>

              <div className="h-px bg-black/10" />

              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5"
                onClick={() => {
                  toggleManageMode();
                  setMenuOpen(false);
                }}
                aria-pressed={manageMode}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center text-gray-400">{manageMode ? "✓" : " "}</span>
                {manageMode ? "完成操作" : "打开操作"}
              </button>

              {manageMode ? (
                <>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 disabled:opacity-60"
                    disabled={!selectedFeed}
                    onClick={() => {
                      if (!selectedFeed) return;
                      setMenuOpen(false);
                      router.push(`/feeds/${selectedFeed.id}/edit`);
                    }}
                  >
                    <IconPencil className="h-4 w-4" />
                    编辑选中
                  </button>
                  <button
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    disabled={!selectedFeed || Boolean(selectedFeed && busyById[selectedFeed.id])}
                    onClick={async () => {
                      if (!selectedFeed) return;
                      setMenuOpen(false);
                      await deleteFeed(selectedFeed.id);
                    }}
                  >
                    <IconTrash className="h-4 w-4" />
                    {selectedFeed && busyById[selectedFeed.id] === "delete" ? "删除中..." : "删除选中"}
                  </button>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {error ? <div className="card p-4 text-sm text-red-600">{error}</div> : null}

      {feeds.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-gray-600">还没有订阅源，先添加一个 RSS 链接吧。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {sortedFeeds.map((feed) => {
            const op = busyById[feed.id];
            const isRemoving = Boolean(removingIds[feed.id]);
            const isBusy = Boolean(op) || busyAll;
            const isSelected = manageMode && selectedId === feed.id;

            return (
              <div
                key={feed.id}
                className={[
                  "card p-5 transition-all duration-200 ease-out hover:bg-white hover:shadow-md hover:-translate-y-0.5",
                  isRemoving ? "opacity-0 scale-[0.98] -translate-y-1" : "opacity-100 scale-100 translate-y-0",
                  isBusy ? "pointer-events-none opacity-80" : "",
                  isSelected ? "ring-2 ring-accent/50" : ""
                ].join(" ")}
              >
                {manageMode ? (
                  <button
                    type="button"
                    className="block w-full text-left cursor-pointer"
                    onClick={() => setSelectedId(feed.id)}
                    aria-pressed={isSelected}
                  >
                    <div className={["flex items-start justify-between gap-3 rounded-lg p-2 -m-2", isSelected ? "bg-blue-50/50" : ""].join(" ")}>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold leading-snug wrap-break-word whitespace-normal">{feed.title || feed.url}</p>
                        <p className="mt-1 text-xs text-gray-500 break-all whitespace-normal">{feed.url}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <StatusBadge status={feed.status} />
                        <span
                          className={[
                            "inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/10 text-xs font-semibold",
                            isSelected ? "bg-accent text-white border-transparent" : "bg-white text-gray-500"
                          ].join(" ")}
                          aria-label={isSelected ? "已选择" : "未选择"}
                        >
                          {isSelected ? "✓" : ""}
                        </span>
                      </div>
                    </div>
                  </button>
                ) : (
                  <Link href={`/feeds/${feed.id}`} className="block">
                    <div className="flex items-start justify-between gap-3 rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold hover:underline leading-snug wrap-break-word whitespace-normal">
                          {feed.title || feed.url}
                        </p>
                        <p className="mt-1 text-xs text-gray-500 break-all whitespace-normal">{feed.url}</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <StatusBadge status={feed.status} />
                      </div>
                    </div>
                  </Link>
                )}

                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <p className="flex items-center gap-2">
                    <IconRefresh className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-500">最近更新：</span>
                    <span className="wrap-break-word whitespace-normal">
                      {feed.last_fetched_at ? new Date(feed.last_fetched_at).toLocaleString() : "-"}
                    </span>
                  </p>
                  {feed.last_error ? (
                    <p className="text-xs text-red-600 wrap-break-word whitespace-normal">{feed.last_error}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
