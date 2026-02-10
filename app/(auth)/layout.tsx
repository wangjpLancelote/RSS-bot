import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function AuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 min-h-0 overflow-auto">
      {children}
    </main>
  );
}
