"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { logoutWithEdge } from "@/lib/supabase/functions";
import useSession from "@/lib/hooks/useSession";

type SignOutStatus = "idle" | "submitting" | "success" | "error";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function HeaderAuth() {
  const { session, loading } = useSession();
  const router = useRouter();
  const [signOutStatus, setSignOutStatus] = useState<SignOutStatus>("idle");
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const signOut = async () => {
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

  if (loading) {
    return <div className="text-xs text-gray-400">...</div>;
  }

  if (!session) {
    return (
      <Link className="btn btn-sm btn-auth-entry" href="/login">
        登录
      </Link>
    );
  }

  const signOutLabel =
    signOutStatus === "submitting"
      ? "退出中..."
      : signOutStatus === "success"
        ? "已退出"
        : signOutStatus === "error"
          ? "重试退出"
          : "退出";
  const signOutVariant =
    signOutStatus === "success" ? "btn-success" : signOutStatus === "error" ? "btn-danger" : "btn-auth-logout";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-3 text-sm">
        <span className="max-w-44 truncate text-gray-600">{session.user.email || "已登录"}</span>
        <button
          className={`btn btn-sm ${signOutVariant}`}
          onClick={signOut}
          disabled={signOutStatus === "submitting" || signOutStatus === "success"}
        >
          {signOutLabel}
        </button>
      </div>
      {signOutError ? <p className="text-xs text-red-600">{signOutError}</p> : null}
    </div>
  );
}
