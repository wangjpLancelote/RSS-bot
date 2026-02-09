import type { Metadata } from "next";
import "./globals.css";
import HeaderAuth from "@/components/HeaderAuth";

export const metadata: Metadata = {
  title: "RSS Reader MVP",
  description: "Minimal RSS reader with subscription management and realtime status."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>
        <div className="page">
          <header className="border-b border-black/10 bg-white/70">
            <div className="container-app flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500">RSS Reader</p>
                <h1 className="text-2xl font-semibold">订阅更新与阅读</h1>
              </div>
              <nav className="flex items-center gap-3 text-sm">
                <a className="link" href="/">订阅源</a>
                <a className="link" href="/feeds/new">新增订阅</a>
                <a className="link" href="/profile">Profile</a>
                <HeaderAuth />
              </nav>
            </div>
          </header>
          <main className="container-app">{children}</main>
        </div>
      </body>
    </html>
  );
}
