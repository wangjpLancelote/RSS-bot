"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";
import { getBrowserClient } from "@/lib/supabase/browser";
import { getCachedProfile, setCachedProfile } from "@/lib/stores/profileStore";

export default function ProfilePage() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [email, setEmail] = useState<string | null>(session?.user?.email ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!userId) {
        setEmail(null);
        setLoading(false);
        return;
      }

      const cached = getCachedProfile(userId);
      const hasCached = Boolean(cached);
      if (hasCached) {
        setEmail(cached?.email ?? session?.user?.email ?? null);
        setLoading(false);
      } else {
        setEmail(session?.user?.email ?? null);
        setLoading(true);
      }
      setError(null);

      try {
        const supabase = getBrowserClient();
        const { data, error: fetchError } = await supabase
          .from("users")
          .select("email")
          .eq("id", userId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        const dbEmail = (data as { email?: string } | null)?.email ?? null;
        const nextEmail = dbEmail ?? session?.user?.email ?? null;
        if (cancelled) {
          return;
        }
        setEmail(nextEmail);
        setCachedProfile(userId, nextEmail);
      } catch (err) {
        if (!cancelled && !hasCached) {
          setError(err instanceof Error ? err.message : "读取失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, userId]);

  return (
    <AuthGate>
      <section className="h-full min-h-0 overflow-auto pr-1">
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">个人资料</h2>
            <p className="mt-1 text-sm text-gray-600">查看当前登录信息</p>
          </div>
          <div className="card space-y-2 p-6">
            {loading ? (
              <p className="text-sm text-gray-600">加载中...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : (
              <>
                <div>
                  <p className="text-xs text-gray-500">邮箱</p>
                  <p className="text-sm font-medium">{email ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">用户 ID</p>
                  <p className="text-sm font-mono break-all">{session?.user?.id}</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
