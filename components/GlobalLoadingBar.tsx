"use client";

import { useEffect, useMemo, useState } from "react";

type LoadingEventDetail = { delta: 1 | -1 };

export default function GlobalLoadingBar() {
  const [count, setCount] = useState(0);

  const active = count > 0;
  const ariaLabel = useMemo(() => (active ? "Loading" : "Idle"), [active]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<LoadingEventDetail>;
      const delta = custom.detail?.delta;
      if (delta !== 1 && delta !== -1) return;
      setCount((prev) => Math.max(0, prev + delta));
    };

    window.addEventListener("app:loading", handler);
    return () => window.removeEventListener("app:loading", handler);
  }, []);

  return (
    <div className={`global-loading ${active ? "global-loading--active" : ""}`} aria-label={ariaLabel} aria-live="polite">
      <div className="global-loading__backdrop" />
      <div className="global-loading__center">
        <div className="global-loading__spinner" />
      </div>
    </div>
  );
}
