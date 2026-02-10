"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import FeedForm from "@/components/FeedForm";
import type { Feed } from "@/lib/types";
import { apiErrorMessage, authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

export default function EditFeedPage() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const routeParams = useParams<{ id: string }>();
  const feedId = typeof routeParams.id === "string" ? routeParams.id : "";

  const { session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId || !feedId) {
      setFeed(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/feeds/${feedId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(apiErrorMessage(data, "加载订阅失败"));
        }
        setFeed(data.feed);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [feedId, userId]);

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

  return (
    <AuthGate>
      <section className="h-full min-h-0 overflow-auto pr-1">
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">编辑订阅</h2>
            <p className="mt-1 text-sm text-gray-600">更新订阅链接或自定义标题。</p>
          </div>
          <div className="card p-6">
            <FeedForm mode="edit" feedId={feed.id} defaultUrl={feed.url} defaultTitle={feed.title} />
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
