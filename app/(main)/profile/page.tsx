"use client";

import { useEffect, useState } from "react";
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

  const avatarLetter = (email?.[0] ?? "U").toUpperCase();

  return (
    <AuthGate>
      <section className="profile-page">
        <div className="profile-container">
          {/* Profile header */}
          <div className="profile-header">
            <div className="profile-avatar">
              {avatarLetter}
            </div>
            <div className="profile-header-info">
              <h2 className="profile-header-title">个人资料</h2>
              <p className="profile-header-sub">管理你的账号信息</p>
            </div>
          </div>

          {/* Account info card */}
          <div className="profile-card">
            <h3 className="profile-card-title">账号信息</h3>
            {loading ? (
              <div className="profile-field">
                <span className="profile-field-label">加载中...</span>
              </div>
            ) : error ? (
              <div className="profile-field">
                <span className="profile-field-value" style={{ color: "rgba(220,38,38,0.9)" }}>{error}</span>
              </div>
            ) : (
              <>
                <div className="profile-field">
                  <span className="profile-field-label">邮箱</span>
                  <span className="profile-field-value">{email ?? "-"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">用户 ID</span>
                  <span className="profile-field-value profile-field-mono">{session?.user?.id}</span>
                </div>
              </>
            )}
          </div>

          {/* Sign out card */}
          <div className="profile-card profile-card--danger">
            <h3 className="profile-card-title">会话管理</h3>
            <p className="profile-card-desc">退出当前设备的登录会话，并返回登录页面。</p>
            {signOutError ? (
              <p className="profile-signout-error">{signOutError}</p>
            ) : null}
            <button
              className={`profile-signout-btn ${signOutVariant}`}
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
