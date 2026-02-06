"use client";

import { useEffect, useState } from "react";
import FeedForm from "@/components/FeedForm";
import type { Feed } from "@/lib/types";
import { authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

export default function EditFeedPage({ params }: { params: { id: string } }) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session } = useSession();

  useEffect(() => {
    if (!session) return;

    const load = async () => {
      try {
        const res = await authFetch(`/feeds/${params.id}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "加载订阅失败");
        }
        setFeed(data.feed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.id, session]);

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
      <div className="card p-6">
        <h2 className="text-lg font-semibold">编辑订阅</h2>
        <p className="mt-1 text-sm text-gray-600">更新订阅链接或自定义标题。</p>
      </div>
      <div className="card p-6">
        <FeedForm mode="edit" feedId={feed.id} defaultUrl={feed.url} defaultTitle={feed.title} />
      </div>
      </section>
    </AuthGate>
  );
}
