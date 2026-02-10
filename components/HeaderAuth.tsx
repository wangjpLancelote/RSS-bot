"use client";

import Link from "next/link";
import useSession from "@/lib/hooks/useSession";

export default function HeaderAuth() {
  const { session, loading } = useSession();

  if (loading) {
    return <span className="header-auth-skeleton" />;
  }

  if (!session) {
    return (
      <Link className="btn btn-sm btn-auth-entry" href="/login">
        登录
      </Link>
    );
  }

  return (
    <Link className="header-auth-user" href="/profile">
      <span className="header-auth-avatar">
        {(session.user.email?.[0] ?? "U").toUpperCase()}
      </span>
      <span className="header-auth-email">{session.user.email || "已登录"}</span>
    </Link>
  );
}
