"use client";

import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { logoutWithEdge } from "@/lib/supabase/functions";
import useSession from "@/lib/hooks/useSession";

export default function HeaderAuth() {
  const { session, loading } = useSession();
  const router = useRouter();

  const signOut = async () => {
    await logoutWithEdge();
    const supabase = getBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
    router.refresh();
  };

  if (loading) {
    return <div className="text-xs text-gray-400">...</div>;
  }

  if (!session) {
    return (
      <a className="btn" href="/login">
        登录
      </a>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-600">{session.user.email || "已登录"}</span>
      <button className="btn" onClick={signOut}>
        退出
      </button>
    </div>
  );
}
