import React, { useEffect, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { MermaidBlock } from './MermaidBlock';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

export interface MarkdownViewerProps {
  content: string;
  currentFolderId: string;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
  onImageClick?: (url: string, alt?: string) => void;
}

const isDirectUrl = (url?: string): boolean => {
  if (!url) return false;
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
};

const customUrlTransform = (url: string): string => {
  if (!url) return url;
  if (isDirectUrl(url)) {
    return url;
  }
  return defaultUrlTransform(url);
};

const MarkdownImage: React.FC<{
  src?: string;
  alt?: string;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
  onImageClick?: (url: string, alt?: string) => void;
}> = ({ src, alt, resolveImageBlobUrl, onImageClick }) => {
  const isDirect = isDirectUrl(src);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(isDirect ? (src || null) : null);
  const [loading, setLoading] = useState<boolean>(!isDirect && Boolean(src));

  useEffect(() => {
    let active = true;
    if (!src) {
      setLoading(false);
      return;
    }
    if (isDirectUrl(src)) {
      setResolvedUrl(src);
      setLoading(false);
      return;
    }
    setLoading(true);
    resolveImageBlobUrl(src)
      .then((url) => {
        if (active) {
          setResolvedUrl(url);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setResolvedUrl(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [src, resolveImageBlobUrl]);

  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded bg-slate-800 text-slate-400 text-xs animate-pulse">
        Loading figure: {src}...
      </span>
    );
  }

  if (!resolvedUrl) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800 text-amber-300 text-xs">
        ⚠️ Figure not found: {src}
      </span>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt || ''}
      className="max-w-full h-auto rounded-lg my-3 shadow-md cursor-zoom-in hover:opacity-95 transition-opacity"
      onClick={() => onImageClick?.(resolvedUrl, alt)}
    />
  );
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  currentFolderId: _currentFolderId,
  resolveImageBlobUrl,
  onImageClick
}) => {
  return (
    <div className="prose prose-invert max-w-none prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-img:rounded-lg">
      <ReactMarkdown
        urlTransform={customUrlTransform}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code({ node: _node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            if (match && match[1] === 'mermaid') {
              return <MermaidBlock chart={String(children).replace(/\n$/, '')} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          img({ src, alt }) {
            return (
              <MarkdownImage
                src={src}
                alt={alt}
                resolveImageBlobUrl={resolveImageBlobUrl}
                onImageClick={onImageClick}
              />
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
