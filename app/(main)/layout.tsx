import Link from "next/link";
import Image from "next/image";
import HeaderAuth from "@/components/HeaderAuth";

export default function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
    </>
  );
}
