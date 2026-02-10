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
    <div className="login-page">
      {/* Background decorative elements */}
      <div className="login-bg-decor" aria-hidden="true">
        <div className="login-bg-orb login-bg-orb--1" />
        <div className="login-bg-orb login-bg-orb--2" />
        <div className="login-bg-orb login-bg-orb--3" />
      </div>

      <div className="login-container">
        {/* Brand header */}
        <div className="login-brand">
          <span className="login-brand-icon">
            <Image src="/icon.svg" alt="RSS-Bot" fill sizes="48px" priority />
          </span>
          <div>
            <p className="login-brand-eyebrow">RSS-Bot</p>
            <h1 className="login-brand-title">登录你的账号</h1>
          </div>
        </div>

        {/* Login card */}
        <div className="login-card">
          <div className="login-card-header">
            <h2 className="login-card-heading">欢迎回来</h2>
            <p className="login-card-subheading">使用邮箱和密码登录，开始你的 AI 订阅之旅</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-label" htmlFor="login-email">邮箱地址</label>
              <input
                id="login-email"
                className="login-input"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isTransitioning}
                autoComplete="email"
                required
              />
            </div>

            <div className="login-field">
              <label className="login-label" htmlFor="login-password">密码</label>
              <input
                id="login-password"
                className="login-input"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isTransitioning}
                autoComplete="current-password"
                required
              />
            </div>

            {feedback ? (
              <p className={`login-feedback ${feedback.type === "error" ? "login-feedback--error" : "login-feedback--success"}`}>
                {feedback.message}
              </p>
            ) : null}

            <button
              className={`login-submit ${submitVariantClass}`}
              type="submit"
              disabled={isTransitioning}
            >
              {submitLabel}
            </button>
          </form>
        </div>

        {/* Footer tagline */}
        <p className="login-footer">使用 AI 重塑订阅</p>
      </div>
    </div>
  );
}
