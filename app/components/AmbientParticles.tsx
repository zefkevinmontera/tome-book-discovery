"use client";

import { useEffect, useRef } from "react";

interface Mote {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  sway: number;
  speed: number;
  phase: number;
  alpha: number;
}

/** Pre-rendered glow sprite: cheap to stamp, so we avoid per-frame gradients. */
function makeSprite(): HTMLCanvasElement {
  const size = 64;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const g = sprite.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(255, 236, 190, 1)");
    grad.addColorStop(0.18, "rgba(251, 191, 36, 0.85)");
    grad.addColorStop(0.45, "rgba(245, 158, 11, 0.22)");
    grad.addColorStop(1, "rgba(245, 158, 11, 0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return sprite;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

export default function AmbientParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const sprite = makeSprite();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    let w = 0;
    let h = 0;
    let motes: Mote[] = [];
    let raf = 0;
    let last = performance.now();

    function spawn(anywhere: boolean): Mote {
      return {
        x: rand(0, w),
        y: anywhere ? rand(0, h) : h + rand(10, 60),
        r: rand(0.6, 2.2),
        vx: rand(-0.04, 0.04),
        vy: -rand(0.06, 0.26), // px per frame at 60fps: slow, rising embers
        sway: rand(0.03, 0.12),
        speed: rand(0.6, 1.6),
        phase: rand(0, Math.PI * 2),
        alpha: rand(0.25, 0.7),
      };
    }

    function draw(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      for (const m of motes) {
        const twinkle = 0.55 + 0.45 * Math.sin(now * 0.001 * m.speed + m.phase * 2);
        // Fade near the top and bottom edges so motes never pop in or out.
        const edge = Math.max(0, Math.min(1, m.y / 80, (h - m.y) / 80));
        ctx.globalAlpha = m.alpha * twinkle * edge;
        const size = m.r * 8;
        ctx.drawImage(sprite, m.x - size / 2, m.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    function step(dt: number, now: number) {
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.y += m.vy * dt;
        m.x += (m.vx + Math.sin(now * 0.0004 * m.speed + m.phase) * m.sway) * dt;

        if (m.y < -20) motes[i] = spawn(false);
        else if (m.x < -20) m.x = w + 20;
        else if (m.x > w + 20) m.x = -20;
      }
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 16.667, 3); // clamp after tab switches
      last = now;
      step(dt, now);
      draw(now);
    }

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cap = coarse ? 36 : 70;
      const target = Math.round(Math.min(Math.max((w * h) / 22000, 24), cap));
      if (motes.length > target) motes.length = target;
      while (motes.length < target) motes.push(spawn(true));

      if (reduceMotion) draw(performance.now());
    }

    resize();
    window.addEventListener("resize", resize);

    if (!reduceMotion) raf = requestAnimationFrame(frame);
    // Fade the layer in once it is ready.
    const fade = requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(fade);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[-1] h-full w-full opacity-0 transition-opacity duration-[1500ms]"
    />
  );
}