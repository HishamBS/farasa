'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { CodeBlock } from './code-block'
import type { Components } from 'react-markdown'

type MarkdownRendererProps = {
  content: string
}

const components: Components = {
  code: ({ className, children }) => (
    <CodeBlock className={className}>{children}</CodeBlock>
  ),
  a: ({ href, children }) => {
    const safeHref =
      href && /^(https?:|mailto:|\/)/i.test(href) ? href : undefined
    return (
      <a
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[--accent] underline underline-offset-2 hover:text-[--accent-hover]"
      >
        {children}
      </a>
    )
  },
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-[--accent] pl-4 italic text-[--text-muted]">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-xl">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-[--border-default] bg-[--bg-surface] px-3 py-2 text-left text-xs font-medium text-[--text-muted]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-[--border-subtle] px-3 py-2 text-sm text-[--text-secondary]">
      {children}
    </td>
  ),
  h1: ({ children }) => (
    <h1 className="mb-3 mt-6 text-xl font-semibold text-[--text-primary]">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 mt-5 text-lg font-semibold text-[--text-primary]">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-base font-medium text-[--text-primary]">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-[--text-secondary]">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-[--text-secondary]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-[--text-secondary]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[--text-primary]">{children}</strong>
  ),
  hr: () => <hr className="my-4 border-[--border-subtle]" />,
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        [
          rehypeSanitize,
          {
            ...defaultSchema,
            attributes: {
              ...defaultSchema.attributes,
              code: [...(defaultSchema.attributes?.code ?? []), 'className'],
              span: [...(defaultSchema.attributes?.span ?? []), 'className', 'style'],
            },
          },
        ],
      ]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}
