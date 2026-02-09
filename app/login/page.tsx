"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { loginWithEdge } from "@/lib/supabase/functions";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = getBrowserClient();

      if (mode === "sign-up") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });

        if (signUpError) {
          throw signUpError;
        }

        setError("注册成功，请检查邮箱完成验证后登录。");
      } else {
        await loginWithEdge(email, password);

        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold">{mode === "sign-in" ? "登录" : "注册"}</h2>
        <p className="mt-1 text-sm text-gray-600">使用邮箱与密码进行认证。</p>
      </div>
      <div className="card p-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium">邮箱</label>
            <input
              className="input mt-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              required
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-3">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "处理中..." : mode === "sign-in" ? "登录" : "注册"}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            >
              {mode === "sign-in" ? "去注册" : "去登录"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
