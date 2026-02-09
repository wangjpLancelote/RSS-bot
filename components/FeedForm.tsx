"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, authFetch } from "@/lib/api";

type Props = {
  mode: "create" | "edit";
  defaultUrl?: string;
  defaultTitle?: string | null;
  feedId?: string;
};

export default function FeedForm({ mode, defaultUrl = "", defaultTitle = "", feedId }: Props) {
  const [url, setUrl] = useState(defaultUrl);
  const [title, setTitle] = useState(defaultTitle || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = mode === "create" ? { url } : { url, title };
      const endpoint = mode === "create" ? "/feeds" : `/feeds/${feedId}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await authFetch(endpoint, {
        method,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "请求失败"));
      }

      // Home page fetches fresh feeds on mount; avoid extra refresh flash.
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">RSS/Atom 链接</label>
        <input
          className="input mt-2"
          placeholder="https://example.com/feed.xml"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">自定义标题（可选）</label>
        <input
          className="input mt-2"
          placeholder="我的订阅"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "提交中..." : mode === "create" ? "创建订阅" : "保存修改"}
        </button>
        <a className="btn" href="/">
          取消
        </a>
      </div>
    </form>
  );
}
