\"use client\";

import FeedForm from "@/components/FeedForm";
import AuthGate from "@/components/AuthGate";

export default function NewFeedPage() {
  return (
    <AuthGate>
      <section className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold">新增订阅</h2>
        <p className="mt-1 text-sm text-gray-600">粘贴 RSS/Atom 链接或页面链接。</p>
      </div>
      <div className="card p-6">
        <FeedForm mode="create" />
      </div>
      </section>
    </AuthGate>
  );
}
