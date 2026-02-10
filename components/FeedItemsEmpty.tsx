"use client";

export default function FeedItemsEmpty() {
  return (
    <div className="rounded-lg border border-dashed border-black/15 bg-white/70 p-6 text-center">
      <p className="text-base font-semibold text-gray-800">暂无条目</p>
      <p className="mt-2 text-sm text-gray-600">当前订阅暂未抓取到内容，请先刷新订阅源后再查看。</p>
    </div>
  );
}

