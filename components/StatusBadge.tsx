import type { FeedStatus } from "@/lib/types";

const statusClass: Record<FeedStatus, string> = {
  idle: "badge badge-idle",
  fetching: "badge badge-fetching",
  ok: "badge badge-ok",
  error: "badge badge-error"
};

const statusLabel: Record<FeedStatus, string> = {
  idle: "空闲",
  fetching: "更新中",
  ok: "正常",
  error: "异常"
};

export default function StatusBadge({ status }: { status: FeedStatus }) {
  return <span className={statusClass[status]}>{statusLabel[status]}</span>;
}
