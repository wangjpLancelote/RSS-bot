"use client";

import FeedForm from "@/components/FeedForm";
import AuthGate from "@/components/AuthGate";

export default function NewFeedPage() {
  return (
    <AuthGate>
      <section className="mx-auto h-full min-h-0 w-full max-w-5xl overflow-auto pr-1 [scrollbar-gutter:stable]">
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold">新增订阅</h2>
            <p className="mt-1 text-sm text-gray-600">输入 RSS/Atom 或任意页面链接，系统会自动检测并尝试转换为可订阅源。</p>
          </div>
          <div className="card p-6">
            <FeedForm mode="create" />
          </div>
        </div>
      </section>
    </AuthGate>
  );
}
