/**
 * Markdownコンテンツをレンダリングするためのコンポーネント
 * @module Markdown
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

/**
 * Markdownコンテンツをレンダリングするコンポーネント
 * @param {MarkdownProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} レンダリングされたMarkdownコンテンツ
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn("prose prose-sm max-w-none dark:prose-invert", className)}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
