/**
 * Markdownコンテンツをレンダリングするためのコンポーネント
 * @module Markdown
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Markdownコンテンツをレンダリングするコンポーネント
 * @param {MarkdownProps} props - コンポーネントのプロパティ
 * @returns {JSX.Element} レンダリングされたMarkdownコンテンツ
 */
export function Markdown({ content, className }: MarkdownProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} className={cn("prose prose-sm max-w-none dark:prose-invert", className)}>
      {content}
    </ReactMarkdown>
  );
}
