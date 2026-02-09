"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function IconZen({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M4 12h12" />
      <path d="M4 17h8" />
    </svg>
  );
}

export default function HeaderZenToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isFeedReaderPage = useMemo(() => /^\/feeds\/[^/]+$/.test(pathname || ""), [pathname]);
  if (!isFeedReaderPage) return null;

  const zenMode = searchParams.get("zen") === "1";

  const toggleZen = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (zenMode) {
      nextParams.delete("zen");
      nextParams.delete("compact");
    } else {
      nextParams.set("zen", "1");
    }
    const nextQuery = nextParams.toString();
    router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`, { scroll: false });
  };

  return (
    <button
      type="button"
      className={[
        "btn",
        zenMode ? "border-blue-800 bg-blue-700 text-white hover:bg-blue-800" : ""
      ].join(" ")}
      onClick={toggleZen}
      aria-pressed={zenMode}
      title={zenMode ? "退出 Zen 模式" : "开启 Zen 模式"}
    >
      <IconZen className="h-4 w-4" />
      <span>{zenMode ? "Zen 开" : "Zen"}</span>
    </button>
  );
}
