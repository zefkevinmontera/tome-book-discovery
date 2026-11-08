"use client";

import { useEffect, useRef } from "react";
import { useFinePointer } from "@/lib/supabase/useFinePointer";

const HALF = 360; // half of the 720px spotlight layer

export default function CursorSpotlight() {
  const enabled = useFinePointer();
  const spotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const spot = spotRef.current;
    if (!spot) return;

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let raf = 0;
    let visible = false;

    function setGlow(cx: number, cy: number, hide = false) {
      const els = document.querySelectorAll<HTMLElement>("[data-glow]");
      const vh = window.innerHeight;
      const rects: DOMRect[] = [];
      els.forEach((el) => rects.push(el.getBoundingClientRect())); // read phase
      els.forEach((el, i) => {
        // write phase
        if (hide) {
          el.style.setProperty("--glow-x", "-9999px");
          el.style.setProperty("--glow-y", "-9999px");
          return;
        }
        const r = rects[i];
        if (r.bottom < -200 || r.top > vh + 200) return; // off-screen
        el.style.setProperty("--glow-x", `${cx - r.left}px`);
        el.style.setProperty("--glow-y", `${cy - r.top}px`);
      });
    }

    function tick() {
      raf = 0;
      const dx = target.x - current.x;
      const dy = target.y - current.y;
      current.x += dx * 0.22;
      current.y += dy * 0.22;

      spot!.style.transform = `translate3d(${current.x - HALF}px, ${current.y - HALF}px, 0)`;
      setGlow(current.x, current.y);

      if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) raf = requestAnimationFrame(tick);
    }

    const schedule = () => {
      if (visible && !raf) raf = requestAnimationFrame(tick);
    };

    function onMove(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        visible = true;
        current.x = target.x;
        current.y = target.y;
        spot!.style.opacity = "1";
      }
      schedule();
    }

    function onLeave() {
      visible = false;
      spot!.style.opacity = "0";
      setGlow(0, 0, true);
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    document.documentElement.addEventListener("mouseleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", schedule, true);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      setGlow(0, 0, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={spotRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[60] h-[720px] w-[720px] opacity-0 transition-opacity duration-500 will-change-transform"
      style={{
        background:
          "radial-gradient(circle, rgba(245,158,11,0.10) 0%, rgba(217,119,6,0.05) 35%, transparent 70%)",
      }}
    />
  );
}