import type { Metadata } from "next";
import LoginRouteChrome from "./LoginRouteChrome";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function LoginLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LoginRouteChrome />
      {children}
    </>
  );
}
