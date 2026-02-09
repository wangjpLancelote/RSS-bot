"use client";

import { useEffect, useState } from "react";
import FeedDetailActions from "@/components/FeedDetailActions";
import StatusBadge from "@/components/StatusBadge";
import type { Feed, FeedItem } from "@/lib/types";
import { apiErrorMessage, authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

export default function FeedDetailPage({ params }: { params: { id: string } }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setFeed(null);
      setItems([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const feedRes = await authFetch(`/feeds/${params.id}`);
        const feedData = await feedRes.json();
        if (!feedRes.ok) {
          throw new Error(apiErrorMessage(feedData, "加载订阅源失败"));
        }
        setFeed(feedData.feed);

        const itemsRes = await authFetch(`/feeds/${params.id}/items`);
        const itemsData = await itemsRes.json();
        if (!itemsRes.ok) {
          throw new Error(apiErrorMessage(itemsData, "加载条目失败"));
        }
        setItems(itemsData.items || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.id, userId]);

  if (!userId) {
    return <AuthGate><section /></AuthGate>;
  }

  if (loading) {
    return <div className="card p-6 text-sm text-gray-600">加载中...</div>;
  }

  if (error) {
    return <div className="card p-6 text-sm text-red-600">{error}</div>;
  }

  if (!feed) {
    return <p>订阅源不存在。</p>;
  }

  return (
    <AuthGate>
      <section className="space-y-6">
      <div className="card p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{feed.title || feed.url}</h2>
            <p className="text-xs text-gray-500">{feed.url}</p>
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

      <div className="card p-6">
        <h3 className="text-base font-semibold">最新条目</h3>
        <div className="mt-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-gray-600">暂无条目，请刷新订阅源。</p>
          ) : (
            items.map((item) => (
              <a
                key={item.id}
                className="block rounded-lg border border-black/5 bg-white/70 p-4 hover:bg-white"
                href={`/items/${item.id}`}
              >
                <h4 className="font-medium">{item.title || "未命名"}</h4>
                <p className="mt-1 text-xs text-gray-500">
                  {item.published_at ? new Date(item.published_at).toLocaleString() : "未提供时间"}
                </p>
                {item.content_text ? (
                  <p className="mt-2 text-sm text-gray-600">{item.content_text}</p>
                ) : null}
              </a>
            ))
          )}
        </div>
      </div>
      </section>
    </AuthGate>
  );
}
