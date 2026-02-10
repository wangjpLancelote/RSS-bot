"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { loginWithEdge } from "@/lib/supabase/functions";

type SubmitStatus = "idle" | "submitting" | "success" | "error";

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const router = useRouter();
  const isTransitioning = submitStatus === "submitting" || submitStatus === "success";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isTransitioning) {
      return;
    }
    setSubmitStatus("submitting");
    setFeedback(null);

    try {
      await loginWithEdge(email, password);
      setSubmitStatus("success");
      setFeedback({ type: "success", message: "登录成功，正在进入首页..." });
      await wait(380);
      router.replace("/");
    } catch (err) {
      setSubmitStatus("error");
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "登录失败" });
    }
  };

  const submitVariantClass =
    submitStatus === "success" ? "btn-success" : submitStatus === "error" ? "btn-danger" : "btn-primary";
  const submitLabel =
    submitStatus === "submitting"
      ? "处理中..."
      : submitStatus === "success"
        ? "登录成功"
        : "登录";

  return (
    <section className="auth-shell h-full min-h-0 overflow-auto pr-1">
      <div className="auth-stack mx-auto w-full max-w-6xl space-y-6">
        <div className="card auth-intro-card p-7 md:p-10">
          <div className="auth-brand">
            <span className="auth-brand-icon">
              <Image src="/icon.svg" alt="RSS-Bot" fill sizes="44px" priority />
            </span>
            <div>
              <p className="auth-brand-eyebrow">RSS-Bot</p>
              <h2 className="text-lg font-semibold md:text-2xl">登录你的账号</h2>
              <p className="auth-brand-slogan">使用AI重塑订阅</p>
            </div>
          </div>
        </div>
        <div className="card auth-form-card p-7 md:p-10">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium">邮箱</label>
              <input
                className="input mt-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isTransitioning}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">密码</label>
              <input
                className="input mt-2"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isTransitioning}
                required
              />
            </div>
            {feedback ? (
              <p className={`auth-feedback ${feedback.type === "error" ? "auth-feedback--error" : "auth-feedback--success"}`}>
                {feedback.message}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:items-start">
              <button className={`btn btn-auth-cta ${submitVariantClass}`} type="submit" disabled={isTransitioning}>
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
