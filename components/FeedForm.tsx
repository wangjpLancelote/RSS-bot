"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiErrorMessage, authFetch } from "@/lib/api";
import type { FeedIntakeJob, FeedIntakeStage } from "@/lib/types";

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
  const [intake, setIntake] = useState<FeedIntakeJob | null>(null);
  const router = useRouter();

  const stageLabel: Record<FeedIntakeStage, string> = {
    detecting: "检测 RSS",
    converting: "AI 转换",
    validating: "规则校验",
    creating: "创建订阅",
    done: "完成",
    failed: "失败"
  };

  const actionableError: Record<string, string> = {
    INTAKE_DISCOVERY_FAILED: "链接无法识别为 RSS，且自动转换失败。建议检查 URL 或尝试可公开访问的页面。",
    INTAKE_SOURCE_UNAVAILABLE: "链接当前不可访问，系统已停止重试。请检查链接可用性后再试。",
    INTAKE_CONVERSION_FAILED: "AI 转换失败。建议稍后重试，或改用可直接访问的页面链接。",
    INTAKE_CONVERSION_TIMEOUT: "转换超时已终止，请稍后重试或更换更轻量页面。",
    INTAKE_VALIDATION_FAILED: "页面未提取到可监控内容。建议换更具体的栏目页或文章列表页。",
    WEB_MONITOR_RENDER_FAILED: "页面渲染失败，可能被反爬限制。建议换源或降低访问频率。",
    WEB_MONITOR_EXTRACTION_EMPTY: "页面内容提取为空。建议提供正文更稳定的页面。",
    WEB_MONITOR_LLM_BUDGET_EXCEEDED: "本次语义判重预算已用尽，稍后刷新会继续尝试。"
  };

  async function pollIntake(jobId: string) {
    const start = Date.now();
    const timeoutMs = 3 * 60 * 1000;

    while (Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const res = await authFetch(`/feeds/intake/${jobId}`, {}, { silentLoading: true });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(apiErrorMessage(data, "查询任务状态失败"));
      }

      const nextJob: FeedIntakeJob = {
        jobId: data.jobId || jobId,
        status: data.status,
        stage: data.stage,
        progress: Number(data.progress || 0),
        result: data.result,
        error: data.error
      };
      setIntake(nextJob);

      if (nextJob.status === "done") {
        return nextJob;
      }

      if (nextJob.status === "failed") {
        const code = nextJob.error?.code || "INTAKE_CONVERSION_FAILED";
        const fallback = nextJob.error?.message || "添加订阅失败";
        throw new Error(actionableError[code] || fallback);
      }
    }

    throw new Error("创建任务超时，请稍后在订阅列表中确认是否已创建。");
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setIntake(null);

    try {
      if (mode === "create") {
        const createRes = await authFetch("/feeds/intake", {
          method: "POST",
          body: JSON.stringify({ url, title: title.trim() || undefined })
        });

        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) {
          throw new Error(apiErrorMessage(createData, "创建任务失败"));
        }

        const jobId = createData.jobId as string;
        setIntake({
          jobId,
          status: createData.status || "pending",
          stage: "detecting",
          progress: 0
        });

        await pollIntake(jobId);
        router.replace("/");
        return;
      }

      const res = await authFetch(`/feeds/${feedId}`, {
        method: "PATCH",
        body: JSON.stringify({ url, title })
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
          placeholder="https://example.com/feed.xml 或页面链接"
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

      {mode === "create" && intake ? (
        <div className="rounded-lg border border-black/10 bg-white/70 p-3">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>任务状态：{stageLabel[intake.stage]}</span>
            <span>{Math.min(100, Math.max(0, intake.progress || 0))}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, intake.progress || 0))}%` }}
            />
          </div>
          <div className="mt-2 flex gap-2 text-xs text-gray-600">
            <span className={intake.stage === "detecting" ? "font-semibold text-ink" : ""}>检测 RSS</span>
            <span>{">"}</span>
            <span className={intake.stage === "converting" ? "font-semibold text-ink" : ""}>AI 转换</span>
            <span>{">"}</span>
            <span className={intake.stage === "validating" ? "font-semibold text-ink" : ""}>规则校验</span>
            <span>{">"}</span>
            <span className={intake.stage === "creating" ? "font-semibold text-ink" : ""}>创建</span>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? (mode === "create" ? "处理中..." : "提交中...") : mode === "create" ? "创建订阅" : "保存修改"}
        </button>
        <a className="btn" href="/">
          取消
        </a>
      </div>
    </form>
  );
}
