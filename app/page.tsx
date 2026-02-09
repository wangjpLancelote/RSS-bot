"use client";

import { useEffect, useState } from "react";
import FeedList from "@/components/FeedList";
import type { Feed } from "@/lib/types";
import { apiErrorMessage, authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

export default function HomePage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setFeeds([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch("/feeds");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(apiErrorMessage(data, "加载订阅失败"));
        }
        setFeeds(data.feeds || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "未知错误");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  return (
    <AuthGate>
      {loading ? (
        <div className="card p-6 text-sm text-gray-600">加载中...</div>
      ) : error ? (
        <div className="card p-6 text-sm text-red-600">{error}</div>
      ) : (
        <FeedList initialFeeds={feeds} />
      )}
    </AuthGate>
  );
}
