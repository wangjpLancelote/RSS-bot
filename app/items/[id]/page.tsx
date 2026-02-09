"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiErrorMessage, authFetch } from "@/lib/api";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";

export default function ItemLegacyRedirectPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const routeParams = useParams<{ id: string }>();
  const itemId = typeof routeParams.id === "string" ? routeParams.id : "";

  useEffect(() => {
    if (!userId || !itemId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const redirectToFeedReader = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/items/${itemId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(apiErrorMessage(data, "加载条目失败"));
        }
        const feedId = data.item?.feed_id as string | undefined;
        if (!feedId) {
          throw new Error("条目缺少 feed_id，无法跳转。");
        }

        router.replace(`/feeds/${feedId}?item=${itemId}`);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "未知错误");
          setLoading(false);
        }
      }
    };

    redirectToFeedReader();

    return () => {
      cancelled = true;
    };
  }, [itemId, router, userId]);

  if (!userId) {
    return (
      <AuthGate>
        <section />
      </AuthGate>
    );
  }

  if (loading) {
    return <div className="card p-6 text-sm text-gray-600">正在跳转到订阅源阅读器...</div>;
  }

  if (error) {
    return (
      <div className="card space-y-3 p-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link className="link text-sm" href="/">
          返回订阅源列表
        </Link>
      </div>
    );
  }

  return <div className="card p-6 text-sm text-gray-600">正在跳转...</div>;
}
