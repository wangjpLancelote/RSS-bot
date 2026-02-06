"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Feed } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase/browser";
import { authFetch } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

export default function FeedList({ initialFeeds }: { initialFeeds: Feed[] }) {
  const [feeds, setFeeds] = useState<Feed[]>(initialFeeds);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
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

  const refreshAll = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/refresh", {
        method: "POST",
        body: JSON.stringify({})
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "刷新全部失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新全部失败");
    } finally {
      setBusy(false);
    }
  };

  const refreshFeed = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/feeds/${id}/refresh`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "刷新订阅失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新订阅失败");
    } finally {
      setBusy(false);
    }
  };

  const deleteFeed = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/feeds/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "删除订阅失败");
      }
      setFeeds((prev) => prev.filter((feed) => feed.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除订阅失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={refreshAll} disabled={busy}>
          {busy ? "处理中..." : "刷新全部"}
        </button>
        <a className="btn" href="/feeds/new">
          新增订阅
        </a>
      </div>
      {error ? <div className="card p-4 text-sm text-red-600">{error}</div> : null}

      {feeds.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-gray-600">还没有订阅源，先添加一个 RSS 链接吧。</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>订阅源</th>
              <th>状态</th>
              <th>最近更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((feed) => (
              <tr key={feed.id}>
                <td>
                  <div className="space-y-1">
                    <a className="link font-medium" href={`/feeds/${feed.id}`}>
                      {feed.title || feed.url}
                    </a>
                    <p className="text-xs text-gray-500">{feed.url}</p>
                  </div>
                </td>
                <td>
                  <StatusBadge status={feed.status} />
                  {feed.last_error ? (
                    <p className="mt-1 text-xs text-red-600">{feed.last_error}</p>
                  ) : null}
                </td>
                <td className="text-sm text-gray-700">
                  {feed.last_fetched_at ? new Date(feed.last_fetched_at).toLocaleString() : "-"}
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn" onClick={() => refreshFeed(feed.id)} disabled={busy}>
                      刷新
                    </button>
                    <a className="btn" href={`/feeds/${feed.id}/edit`}>
                      编辑
                    </a>
                    <button className="btn btn-danger" onClick={() => deleteFeed(feed.id)} disabled={busy}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
