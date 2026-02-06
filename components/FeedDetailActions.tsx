"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/api";

export default function FeedDetailActions({ feedId }: { feedId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    await authFetch(`/feeds/${feedId}/refresh`, { method: "POST" });
    setBusy(false);
    router.refresh();
  };

  const remove = async () => {
    setBusy(true);
    await authFetch(`/feeds/${feedId}`, { method: "DELETE" });
    setBusy(false);
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex gap-2">
      <button className="btn" onClick={refresh} disabled={busy}>
        {busy ? "处理中..." : "刷新"}
      </button>
      <a className="btn" href={`/feeds/${feedId}/edit`}>
        编辑
      </a>
      <button className="btn btn-danger" onClick={remove} disabled={busy}>
        删除
      </button>
    </div>
  );
}
