"use client";

import useSession from "@/lib/hooks/useSession";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="card p-6 text-sm text-gray-600">加载中...</div>;
  }

  if (!session) {
    return (
      <div className="card p-6 space-y-3">
        <h3 className="text-base font-semibold">需要登录</h3>
        <p className="text-sm text-gray-600">请先登录以管理你的订阅源。</p>
        <a className="btn btn-primary" href="/login">
          去登录
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
