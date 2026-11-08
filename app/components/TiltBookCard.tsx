"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import FavoriteButton from "@/app/components/FavoriteButton";
import { useFinePointer } from "@/lib/supabase/useFinePointer";

export interface TiltBook {
  id: string;
  title: string;
  author: string;
  cover: string | null;
}

interface TiltBookCardProps {
  book: TiltBook;
  index?: number;
  /** Makes the cover and title link to the detail page. */
  href?: string;
  /** Replaces the default heart button (top-right). */
  topRight?: ReactNode;
  /** Optional overlay in the top-left of the cover. */
  topLeft?: ReactNode;
  /** Rendered under the author line. */
  footer?: ReactNode;
  /** Only used by the default heart button when `topRight` is not provided. */
  onFavoriteToggle?: (isFavorited: boolean) => void;
}

const MAX_TILT = 9; // degrees
const SPRING = { stiffness: 220, damping: 24, mass: 0.6 };

export default function TiltBookCard({
  book,
  index = 0,
  href,
  topRight,
  topLeft,
  footer,
  onFavoriteToggle,
}: TiltBookCardProps) {
  const stageRef = useRef<HTMLLIElement>(null);
  const finePointer = useFinePointer();
  const reduceMotion = useReducedMotion();
  const enabled = finePointer && !reduceMotion;

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const hover = useMotionValue(0);

  const sx = useSpring(px, SPRING);
  const sy = useSpring(py, SPRING);
  const sh = useSpring(hover, { stiffness: 180, damping: 26 });

  const rotateY = useTransform(sx, [0, 1], [-MAX_TILT, MAX_TILT]);
  const rotateX = useTransform(sy, [0, 1], [MAX_TILT, -MAX_TILT]);
  const scale = useTransform(sh, [0, 1], [1, 1.035]);

  const glareX = useTransform(sx, [0, 1], [0, 100]);
  const glareY = useTransform(sy, [0, 1], [0, 100]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,240,205,0.34), rgba(245,158,11,0.12) 32%, transparent 62%)`;

  const shadowX = useTransform(sx, [0, 1], [14, -14]);
  const shadowY = useTransform(sy, [0, 1], [26, 10]);
  const glowA = useTransform(sh, [0, 1], [0, 0.28]);
  const boxShadow = useMotionTemplate`${shadowX}px ${shadowY}px 40px -12px rgba(0,0,0,0.75), 0 0 28px rgba(245,158,11,${glowA})`;

  const coverX = useTransform(sx, [0, 1], [7, -7]);
  const coverY = useTransform(sy, [0, 1], [7, -7]);

  function handleEnter(e: ReactPointerEvent<HTMLLIElement>) {
    if (!enabled || e.pointerType === "touch") return;
    hover.set(1);
  }

  function handleMove(e: ReactPointerEvent<HTMLLIElement>) {
    if (!enabled || e.pointerType === "touch") return;
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    py.set(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  }

  function handleLeave() {
    hover.set(0);
    px.set(0.5);
    py.set(0.5);
  }

  const topRightNode =
    topRight !== undefined ? (
      topRight
    ) : onFavoriteToggle ? (
      <FavoriteButton book={book} initialIsFavorited={true} onToggle={onFavoriteToggle} />
    ) : null;

  return (
    <motion.li
      ref={stageRef}
      style={{ perspective: 900 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.4), ease: [0.22, 1, 0.36, 1] }}
      onPointerEnter={handleEnter}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className="list-none"
    >
      <motion.div
        data-glow
        style={{
          rotateX: enabled ? rotateX : 0,
          rotateY: enabled ? rotateY : 0,
          scale: enabled ? scale : 1,
          boxShadow: enabled ? boxShadow : undefined,
        }}
        className="group relative overflow-hidden rounded-xl border border-amber-900/30 bg-[#1C130D]/75 shadow-lg shadow-black/30 backdrop-blur-md transition-colors duration-300 will-change-transform hover:border-amber-600/50"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#130D08]">
          {book.cover ? (
            <motion.div
              className="absolute inset-0"
              style={{
                x: enabled ? coverX : 0,
                y: enabled ? coverY : 0,
                scale: enabled ? 1.08 : 1,
              }}
            >
              <Image
                src={book.cover}
                alt={`Cover of ${book.title}`}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 768px) 25vw, 50vw"
                className="object-cover"
              />
            </motion.div>
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center font-serif text-sm text-[#D4C5B9]/70">
              No cover
            </div>
          )}

          {href && (
            <Link
              href={href}
              aria-label={`Open the page for ${book.title}`}
              className="absolute inset-0 z-10"
            />
          )}

          {topLeft && <div className="absolute left-2 top-2 z-20">{topLeft}</div>}
          {topRightNode && <div className="absolute right-2 top-2 z-20">{topRightNode}</div>}
        </div>

        <div className="p-3 sm:p-4">
          <h2
            className="line-clamp-2 font-serif text-base font-semibold text-[#FDFBF7]"
            title={book.title}
          >
            {href ? (
              <Link href={href} className="transition-colors hover:text-amber-300">
                {book.title}
              </Link>
            ) : (
              book.title
            )}
          </h2>
          <p className="mt-1 line-clamp-1 text-sm text-[#D4C5B9]">{book.author}</p>
          {footer && <div className="mt-2.5">{footer}</div>}
        </div>

        {enabled && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 mix-blend-screen"
            style={{ background: glare, opacity: sh }}
          />
        )}
      </motion.div>
    </motion.li>
  );
}