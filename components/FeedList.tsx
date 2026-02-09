"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Feed } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase/browser";
import { apiErrorMessage, authFetch } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export default function FeedList({ initialFeeds }: { initialFeeds: Feed[] }) {
  const [feeds, setFeeds] = useState<Feed[]>(initialFeeds);
  const [busyAll, setBusyAll] = useState(false);
  const [busyById, setBusyById] = useState<Record<string, "refresh" | "delete" | undefined>>({});
  const [removingIds, setRemovingIds] = useState<Record<string, true | undefined>>({});
  const [error, setError] = useState<string | null>(null);

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

  const refreshFeed = async (id: string) => {
    setBusyById((prev) => ({ ...prev, [id]: "refresh" }));
    setError(null);
    try {
      const res = await authFetch(`/feeds/${id}/refresh`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "刷新订阅失败"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新订阅失败");
    } finally {
      setBusyById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary shadow-sm ring-1 ring-blue-200/60" onClick={refreshAll} disabled={busyAll}>
          {busyAll ? "刷新中..." : "刷新全部"}
        </button>
        <Link className="btn" href="/feeds/new">
          新增订阅
        </Link>
      </div>
      {error ? <div className="card p-4 text-sm text-red-600">{error}</div> : null}

      {feeds.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-gray-600">还没有订阅源，先添加一个 RSS 链接吧。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedFeeds.map((feed) => {
            const op = busyById[feed.id];
            const isRemoving = Boolean(removingIds[feed.id]);
            const isBusy = Boolean(op) || busyAll;

            return (
              <div
                key={feed.id}
                className={[
                  "card p-5 transition-all duration-200 ease-out",
                  isRemoving ? "opacity-0 scale-[0.98] -translate-y-1" : "opacity-100 scale-100 translate-y-0",
                  isBusy ? "pointer-events-none opacity-80" : ""
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="block font-semibold hover:underline" href={`/feeds/${feed.id}`}>
                      <span className="truncate">{feed.title || feed.url}</span>
                    </Link>
                    <p className="mt-1 truncate text-xs text-gray-500">{feed.url}</p>
                  </div>
                  <StatusBadge status={feed.status} />
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-700">
                  <p>
                    <span className="text-gray-500">最近更新：</span>
                    {feed.last_fetched_at ? new Date(feed.last_fetched_at).toLocaleString() : "-"}
                  </p>
                  {feed.last_error ? <p className="text-xs text-red-600 line-clamp-2">{feed.last_error}</p> : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="btn btn-primary shadow-sm ring-1 ring-blue-200/60"
                    onClick={() => refreshFeed(feed.id)}
                    disabled={isBusy}
                  >
                    {op === "refresh" ? "刷新中..." : "手动刷新"}
                  </button>
                  <Link className="btn" href={`/feeds/${feed.id}/edit`}>
                    编辑
                  </Link>
                  <button className="btn btn-danger" onClick={() => deleteFeed(feed.id)} disabled={isBusy}>
                    {op === "delete" ? "删除中..." : "删除"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
