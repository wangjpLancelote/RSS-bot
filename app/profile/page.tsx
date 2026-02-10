"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import AuthGate from "@/components/AuthGate";
import useSession from "@/lib/hooks/useSession";
import { getBrowserClient } from "@/lib/supabase/browser";
import { logoutWithEdge } from "@/lib/supabase/functions";
import { getCachedProfile, setCachedProfile } from "@/lib/stores/profileStore";

type SignOutStatus = "idle" | "submitting" | "success" | "error";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function ProfilePage() {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [email, setEmail] = useState<string | null>(session?.user?.email ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signOutStatus, setSignOutStatus] = useState<SignOutStatus>("idle");
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const router = useRouter();

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

  const handleSignOut = async () => {
    if (signOutStatus === "submitting" || signOutStatus === "success") {
      return;
    }

    setSignOutStatus("submitting");
    setSignOutError(null);

    try {
      await logoutWithEdge();
      const supabase = getBrowserClient();
      await supabase.auth.signOut({ scope: "local" });
      setSignOutStatus("success");
      await wait(320);
      router.replace("/login?from=logout");
    } catch (err) {
      setSignOutStatus("error");
      setSignOutError(err instanceof Error ? err.message : "退出失败，请重试");
    }
  };

  const signOutLabel =
    signOutStatus === "submitting"
      ? "退出中..."
      : signOutStatus === "success"
        ? "已安全退出"
        : signOutStatus === "error"
          ? "重试退出"
          : "退出登录";

  const signOutVariant =
    signOutStatus === "success" ? "btn-success" : signOutStatus === "error" ? "btn-danger" : "btn-auth-logout";

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
          <div className="card auth-logout-card space-y-4 p-6">
            <div className="auth-brand">
              <span className="auth-brand-icon">
                <Image src="/icon.svg" alt="RSS-Bot" fill sizes="44px" />
              </span>
              <div>
                <h3 className="text-base font-semibold">安全退出</h3>
                <p className="mt-1 text-sm text-gray-600">退出当前设备会话，并返回登录页。</p>
              </div>
            </div>
            {signOutError ? <p className="text-sm text-red-600">{signOutError}</p> : null}
            <button
              className={`btn btn-auth-cta ${signOutVariant}`}
              onClick={handleSignOut}
              disabled={signOutStatus === "submitting" || signOutStatus === "success"}
            >
              {signOutLabel}
            </button>
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
