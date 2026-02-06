"use client";

import { useEffect, useMemo, useState } from "react";
import TurndownService from "turndown";
import ReactMarkdown from "react-markdown";
import type { FeedItem, Feed } from "@/lib/types";
import { authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

export default function ItemDetailPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<FeedItem | null>(null);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session } = useSession();

  useEffect(() => {
    if (!session) return;

    const load = async () => {
      try {
        const res = await authFetch(`/items/${params.id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "加载条目失败");
        }
        setItem(data.item);

        if (data.item?.feed_id) {
          const feedRes = await authFetch(`/feeds/${data.item.feed_id}`);
          const feedData = await feedRes.json();
          if (feedRes.ok) {
            setFeed(feedData.feed);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [params.id, session]);

  const markdown = useMemo(() => {
    if (!item) return "";
    const turndown = new TurndownService({ codeBlockStyle: "fenced" });
    const html = item.content_html || "";
    return html ? turndown.turndown(html) : item.content_text || "";
  }, [item]);

  if (loading) {
    return <div className="card p-6 text-sm text-gray-600">加载中...</div>;
  }

  if (error) {
    return <div className="card p-6 text-sm text-red-600">{error}</div>;
  }

  if (!item) {
    return <p>条目不存在。</p>;
  }

  return (
    <AuthGate>
      <section className="space-y-6">
      <div className="card p-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{feed?.title || "订阅"}</p>
        <h2 className="text-xl font-semibold">{item.title || "未命名"}</h2>
        <p className="text-xs text-gray-500">
          {item.published_at ? new Date(item.published_at).toLocaleString() : "未提供时间"}
        </p>
        {item.link ? (
          <a className="link text-sm" href={item.link} target="_blank" rel="noreferrer">
            原文链接
          </a>
        ) : null}
      </div>

      <div className="card p-6 prose max-w-none">
        {markdown ? <ReactMarkdown>{markdown}</ReactMarkdown> : <p>暂无内容。</p>}
      </div>
      </section>
    </AuthGate>
  );
}
