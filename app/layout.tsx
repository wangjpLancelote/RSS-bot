import type { Metadata } from "next";
import "./globals.css";
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
          {children}
        </div>
      </body>
    </html>
  );
}
