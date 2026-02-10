import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import HeaderAuth from "@/components/HeaderAuth";
import GlobalLoadingBar from "@/components/GlobalLoadingBar";
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
        <GlobalLoadingBar />
        <div className="page">
          <header className="app-header shrink-0 border-b border-slate-200/70 bg-white/92">
            <div className="container-app flex items-center justify-between py-4 md:py-5">
              <Link className="flex items-center gap-3" href="/">
                <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <Image src="/icon.svg" alt="RSS-Bot" fill sizes="40px" priority />
                </span>
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.24em] text-sky-700/80">RSS-Bot</p>
                  <h1 className="text-base font-semibold leading-tight text-slate-900 md:text-lg">
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
          <main className="container-app flex-1 min-h-0 overflow-hidden py-6 md:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
