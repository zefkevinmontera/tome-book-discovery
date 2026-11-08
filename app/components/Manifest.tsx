"use client";

import { Fragment, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

type Tag = "h1" | "h2" | "h3" | "p" | "span" | "div";

interface CommonProps {
  as?: Tag;
  delay?: number;
  className?: string;
}
type BlockProps = CommonProps & { by?: "block"; children: ReactNode };
type WordProps = CommonProps & { by: "word"; children: string };
export type ManifestProps = BlockProps | WordProps;

const EASE = [0.22, 1, 0.36, 1] as const;

const blockVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 8 },
  show: (delay: number) => ({
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.9, delay, ease: EASE },
  }),
};

const containerVariants: Variants = {
  hidden: {},
  show: (delay: number) => ({
    transition: { delayChildren: delay, staggerChildren: 0.07 },
  }),
};

const wordVariants: Variants = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 8 },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.8, ease: EASE },
  },
};

export default function Manifest(props: ManifestProps) {
  const { as = "div", delay = 0, className } = props;
  const reduce = useReducedMotion();
  const Tag = motion[as] as unknown as typeof motion.div;
  const initial = reduce ? false : "hidden";

  if (props.by === "word") {
    const words = props.children.split(/\s+/).filter(Boolean);
    return (
      <Tag
        className={className}
        initial={initial}
        animate="show"
        custom={delay}
        variants={containerVariants}
      >
        <span className="sr-only">{props.children}</span>
        {words.map((word, i) => (
          <Fragment key={`${word}-${i}`}>
            <motion.span aria-hidden variants={wordVariants} className="inline-block">
              {word}
            </motion.span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </Tag>
    );
  }

  return (
    <Tag
      className={className}
      initial={initial}
      animate="show"
      custom={delay}
      variants={blockVariants}
    >
      {props.children}
    </Tag>
  );
}