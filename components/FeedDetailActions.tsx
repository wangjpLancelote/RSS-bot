"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, authFetch } from "@/lib/api";

export default function FeedDetailActions({ feedId }: { feedId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"refresh" | "delete" | null>(null);

  const refresh = async () => {
    setBusy(true);
    setMode("refresh");
    setError(null);
    try {
      const res = await authFetch(`/feeds/${feedId}/refresh`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "刷新失败"));
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刷新失败");
    } finally {
      setBusy(false);
      setMode(null);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMode("delete");
    setError(null);
    try {
      const res = await authFetch(`/feeds/${feedId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "删除失败"));
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
      setMode(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          className="btn btn-primary shadow-sm ring-1 ring-blue-200/60"
          onClick={refresh}
          disabled={busy}
        >
          {busy && mode === "refresh" ? "刷新中..." : "手动刷新"}
        </button>
        <a className="btn" href={`/feeds/${feedId}/edit`}>
          编辑
        </a>
        <button className="btn btn-danger" onClick={remove} disabled={busy}>
          {busy && mode === "delete" ? "删除中..." : "删除"}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
