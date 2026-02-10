"use client";

import { useEffect } from "react";

export default function LoginRouteChrome() {
  useEffect(() => {
    document.body.classList.add("login-mode");

    return () => {
      document.body.classList.remove("login-mode");
    };
  }, []);

  return null;
}
