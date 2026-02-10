import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import HeaderAuth from "@/components/HeaderAuth";
import GlobalLoadingBar from "@/components/GlobalLoadingBar";
import PublicEnvScript from "@/components/PublicEnvScript";
import { getSiteUrl } from "@/lib/siteUrl";

const siteUrl = getSiteUrl();
const metadataBase = siteUrl ? new URL(siteUrl) : undefined;
const ogDescription = "RSS-Bot 通过 AI 帮你识别 RSS、转换网页订阅，并提供结构化增量阅读体验。";

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: "RSS-Bot | 使用AI重塑订阅",
    template: "%s | RSS-Bot"
  },
  description: ogDescription,
  applicationName: "RSS-Bot",
  keywords: ["RSS", "订阅", "AI", "Feed", "网页监控", "自动化阅读"],
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }]
  },
  ...(siteUrl
    ? {
        alternates: {
          canonical: "/"
        }
      }
    : {}),
  openGraph: {
    type: "website",
    locale: "zh_CN",
    title: "RSS-Bot | 使用AI重塑订阅",
    description: ogDescription,
    siteName: "RSS-Bot",
    ...(siteUrl ? { url: siteUrl } : {}),
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "RSS-Bot"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "RSS-Bot | 使用AI重塑订阅",
    description: ogDescription,
    images: ["/opengraph-image"]
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>
        <PublicEnvScript />
        <GlobalLoadingBar />
        <div className="page">
          <header className="bg-white/92 border-slate-200/70 border-b app-header shrink-0">
            <div className="flex justify-between items-center py-4 md:py-5 container-app">
              <Link className="flex items-center gap-3" href="/">
                <span className="block relative bg-white border border-slate-200 rounded-lg w-10 h-10 overflow-hidden shrink-0">
                  <Image src="/icon.svg" alt="RSS-Bot" fill sizes="40px" priority />
                </span>
                <div className="space-y-1">
                  <p className="text-sky-700/80 text-xs uppercase tracking-[0.24em]">RSS-Bot</p>
                  <h1 className="font-semibold text-slate-900 text-base md:text-lg leading-tight">
                    使用AI重塑订阅
                  </h1>
                </div>
              </Link>
              <nav className="flex items-center gap-3 text-sm">
                <Link className="link" href="/">订阅源</Link>
                <Link className="link" href="/feeds/new">新增订阅</Link>
                <Link className="link" href="/profile">Profile</Link>
                <HeaderAuth />
              </nav>
            </div>
          </header>
          <main className="flex-1 py-6 md:py-8 min-h-0 overflow-hidden container-app">{children}</main>
        </div>
      </body>
    </html>
  );
}
