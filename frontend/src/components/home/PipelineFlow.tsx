"use client";

import React from "react";
import { motion } from "framer-motion";
import { Upload, Binary, Database, Bot, MessageSquare, LucideIcon } from "lucide-react";

interface PipelineNode {
  label: string;
  icon: LucideIcon;
  x: number;
  y: number;
}

const VB_WIDTH = 1200;
const VB_HEIGHT = 340;
const STAGGER = 0.5; // seconds between each stage lighting up

const NODES: PipelineNode[] = [
  { label: "Upload", icon: Upload, x: 110, y: 170 },
  { label: "Embedding", icon: Binary, x: 355, y: 90 },
  { label: "Retrieval", icon: Database, x: 600, y: 250 },
  { label: "LLM", icon: Bot, x: 845, y: 90 },
  { label: "Response", icon: MessageSquare, x: 1090, y: 170 },
];

function connectorPath(a: PipelineNode, b: PipelineNode): string {
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
}

const CONNECTORS = NODES.slice(0, -1).map((n, i) => connectorPath(n, NODES[i + 1]));

export const PipelineFlow: React.FC = () => {
  return (
    <div className="w-full rounded-2xl border border-dark-border bg-dark-card overflow-x-auto overflow-y-hidden">
      <div className="relative min-w-[720px]" style={{ aspectRatio: `${VB_WIDTH} / ${VB_HEIGHT}` }}>
        {/* Subtle grid backdrop */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(128,128,128,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.14) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full"
          viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
          preserveAspectRatio="xMidYMid meet"
          fill="none"
        >
          <defs>
            <filter id="pipeline-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
          </defs>

          {CONNECTORS.map((d, i) => {
            const delay = i * STAGGER;
            return (
              <g key={i}>
                {/* Soft glow trace */}
                <motion.path
                  d={d}
                  stroke="#3b82f6"
                  strokeWidth={7}
                  strokeOpacity={0.4}
                  strokeLinecap="round"
                  filter="url(#pipeline-glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: STAGGER, delay, ease: "easeInOut" }}
                />
                {/* Crisp core line */}
                <motion.path
                  d={d}
                  stroke="#60a5fa"
                  strokeWidth={2}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: STAGGER, delay, ease: "easeInOut" }}
                />
                {/* Continuously traveling pulse, starts once this segment finishes drawing */}
                <motion.path
                  d={d}
                  stroke="#bfdbfe"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeDasharray="30 700"
                  initial={{ strokeDashoffset: 0, opacity: 0 }}
                  animate={{ strokeDashoffset: -730, opacity: 1 }}
                  transition={{
                    opacity: { duration: 0.3, delay: delay + STAGGER },
                    strokeDashoffset: {
                      duration: 1.9,
                      delay: delay + STAGGER,
                      repeat: Infinity,
                      repeatDelay: 0.9,
                      ease: "linear",
                    },
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {NODES.map((node, i) => {
          const delay = i * STAGGER;
          const Icon = node.icon;
          return (
            // Plain positioning wrapper (untouched transform) — kept separate from the
            // motion.div below because Framer Motion owns the `transform` CSS property
            // on any element it animates `scale` on, silently clobbering a manual
            // translate(-50%,-50%) set via style. Splitting position from animation
            // into two elements avoids that clash.
            <div
              key={node.label}
              className="absolute flex flex-col items-center gap-3"
              style={{
                left: `${(node.x / VB_WIDTH) * 100}%`,
                top: `${(node.y / VB_HEIGHT) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <motion.div
                className="flex flex-col items-center gap-3"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay }}
              >
              <motion.div
                className="relative w-20 h-20 rounded-2xl bg-dark-bg border flex items-center justify-center"
                initial={{ borderColor: "rgb(var(--color-border))", boxShadow: "0 0 0 rgba(59,130,246,0)" }}
                animate={{
                  borderColor: "rgba(96,165,250,0.6)",
                  boxShadow: [
                    "0 0 0 rgba(59,130,246,0)",
                    "0 0 32px rgba(59,130,246,0.4)",
                    "0 0 18px rgba(59,130,246,0.25)",
                  ],
                }}
                transition={{
                  borderColor: { duration: 0.4, delay },
                  boxShadow: { duration: 2.4, delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
                }}
              >
                {/* Small bright flare, like a highlight catching the corner */}
                <motion.span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-accent-300"
                  style={{ filter: "blur(1.5px)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0.6] }}
                  transition={{ duration: 2.4, delay, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                />
                <Icon className="w-8 h-8 text-accent-text" />
              </motion.div>
              <span className="text-sm font-semibold uppercase tracking-wide text-ink-primary whitespace-nowrap">
                {node.label}
              </span>
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
