"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant markdown (bold, headings, lists, tables) with dark-theme
 * styling instead of showing raw ** and # characters.
 */
export const Markdown: React.FC<{ content: string }> = ({ content }) => (
  <div className="text-sm leading-relaxed text-ink-secondary">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ node, ...props }) => <h3 className="text-base font-semibold text-ink-primary mt-4 mb-2 first:mt-0" {...props} />,
        h2: ({ node, ...props }) => <h3 className="text-base font-semibold text-ink-primary mt-4 mb-2 first:mt-0" {...props} />,
        h3: ({ node, ...props }) => <h4 className="text-sm font-semibold text-ink-primary mt-3 mb-1.5 first:mt-0" {...props} />,
        h4: ({ node, ...props }) => <h4 className="text-sm font-semibold text-ink-primary mt-3 mb-1.5 first:mt-0" {...props} />,
        p: ({ node, ...props }) => <p className="mb-2.5 last:mb-0" {...props} />,
        strong: ({ node, ...props }) => <strong className="font-semibold text-ink-primary" {...props} />,
        em: ({ node, ...props }) => <em className="italic text-ink-secondary" {...props} />,
        ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2.5 space-y-1" {...props} />,
        ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2.5 space-y-1" {...props} />,
        li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
        a: ({ node, ...props }) => (
          <a className="text-accent-text hover:underline" target="_blank" rel="noreferrer" {...props} />
        ),
        code: ({ node, className, children, ...props }) => (
          <code
            className="px-1.5 py-0.5 rounded bg-black/40 border border-white/10 font-mono text-[12px] text-accent-300"
            {...props}
          >
            {children}
          </code>
        ),
        pre: ({ node, ...props }) => (
          <pre className="p-3 mb-2.5 rounded-lg bg-black/40 border border-white/10 overflow-x-auto text-[12px]" {...props} />
        ),
        blockquote: ({ node, ...props }) => (
          <blockquote className="border-l-2 border-dark-border pl-3 text-ink-muted mb-2.5" {...props} />
        ),
        hr: () => <hr className="border-dark-border my-3" />,
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto mb-2.5">
            <table className="w-full text-left text-xs border-collapse" {...props} />
          </div>
        ),
        th: ({ node, ...props }) => (
          <th className="py-1.5 pr-4 border-b border-dark-border font-semibold text-ink-secondary" {...props} />
        ),
        td: ({ node, ...props }) => <td className="py-1.5 pr-4 border-b border-dark-border" {...props} />,
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);
