import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import { MermaidBlock } from './MermaidBlock';
import {
  PresenterAnnotationOverlay,
  SelectionToolbarPosition,
  HighlightColor,
} from './PresenterAnnotationOverlay';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

export interface AnnotationAction {
  type: 'highlight' | 'comment' | 'remove' | 'updateComment' | 'updateColor';
  selectedText: string;
  comment?: string;
  newComment?: string;
  color?: HighlightColor;
  newColor?: HighlightColor;
  prefix?: string;
  suffix?: string;
}

export interface MarkdownViewerProps {
  content: string;
  currentFolderId: string;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
  onImageClick?: (url: string, alt?: string) => void;
  onAnnotate?: (action: AnnotationAction) => void;
}

const COLOR_STYLES: Record<string, { markClass: string; badgeClass: string }> = {
  yellow: {
    markClass: 'bg-amber-400/25 text-amber-200 border-amber-400/50 hover:bg-amber-400/35',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  red: {
    markClass: 'bg-rose-500/25 text-rose-200 border-rose-400/50 hover:bg-rose-500/35',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
  green: {
    markClass: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/35',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  blue: {
    markClass: 'bg-sky-500/25 text-sky-200 border-sky-400/50 hover:bg-sky-500/35',
    badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  },
  orange: {
    markClass: 'bg-orange-500/25 text-orange-200 border-orange-400/50 hover:bg-orange-500/35',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
  pink: {
    markClass: 'bg-pink-500/25 text-pink-200 border-pink-400/50 hover:bg-pink-500/35',
    badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  },
  purple: {
    markClass: 'bg-purple-500/25 text-purple-200 border-purple-400/50 hover:bg-purple-500/35',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  },
};

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

function getNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(getNodeText).join('');
  }
  if (React.isValidElement(node) && (node.props as any)?.children) {
    return getNodeText((node.props as any).children);
  }
  return '';
}

function extractContextFromRange(range: Range): { prefix: string; suffix: string } {
  let prefix = '';
  let suffix = '';

  try {
    const startNode = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) {
      const text = startNode.textContent || '';
      prefix = text.slice(Math.max(0, range.startOffset - 35), range.startOffset);
      if (prefix.length < 35 && startNode.parentElement) {
        let prev = startNode.previousSibling;
        while (prev && prefix.length < 35) {
          const t = prev.textContent || '';
          prefix = t + prefix;
          prev = prev.previousSibling;
        }
        if (prefix.length > 35) {
          prefix = prefix.slice(-35);
        }
      }
    } else if (startNode.nodeType === Node.ELEMENT_NODE) {
      const el = startNode as HTMLElement;
      // Inspect children before startOffset in reverse order
      for (let i = range.startOffset - 1; i >= 0 && prefix.length < 35; i--) {
        const child = el.childNodes[i];
        if (child) {
          prefix = (child.textContent || '') + prefix;
        }
      }
      // If still under 35 characters, inspect element's previous siblings
      let prev: ChildNode | null = el.previousSibling;
      while (prev && prefix.length < 35) {
        const t = prev.textContent || '';
        prefix = t + prefix;
        prev = prev.previousSibling;
      }
      if (prefix.length > 35) {
        prefix = prefix.slice(-35);
      }
    }

    const endNode = range.endContainer;
    if (endNode.nodeType === Node.TEXT_NODE) {
      const text = endNode.textContent || '';
      suffix = text.slice(range.endOffset, range.endOffset + 35);
      if (suffix.length < 35 && endNode.parentElement) {
        let next = endNode.nextSibling;
        while (next && suffix.length < 35) {
          const t = next.textContent || '';
          suffix = suffix + t;
          next = next.nextSibling;
        }
        if (suffix.length > 35) {
          suffix = suffix.slice(0, 35);
        }
      }
    } else if (endNode.nodeType === Node.ELEMENT_NODE) {
      const el = endNode as HTMLElement;
      // Inspect children from endOffset onwards
      for (let i = range.endOffset; i < el.childNodes.length && suffix.length < 35; i++) {
        const child = el.childNodes[i];
        if (child) {
          suffix = suffix + (child.textContent || '');
        }
      }
      // If still under 35 characters, inspect element's next siblings
      let next: ChildNode | null = el.nextSibling;
      while (next && suffix.length < 35) {
        const t = next.textContent || '';
        suffix = suffix + t;
        next = next.nextSibling;
      }
      if (suffix.length > 35) {
        suffix = suffix.slice(0, 35);
      }
    }
  } catch {
    // ignore
  }

  return { prefix, suffix };
}

function extractContextFromElement(element: HTMLElement): { prefix: string; suffix: string } {
  let prefix = '';
  let suffix = '';

  try {
    let prev = element.previousSibling;
    while (prev && prefix.length < 35) {
      const text = prev.textContent || '';
      prefix = text + prefix;
      prev = prev.previousSibling;
    }
    if (prefix.length > 35) {
      prefix = prefix.slice(-35);
    }

    let next = element.nextSibling;
    while (next && suffix.length < 35) {
      const text = next.textContent || '';
      suffix = suffix + text;
      next = next.nextSibling;
    }
    if (suffix.length > 35) {
      suffix = suffix.slice(0, 35);
    }
  } catch {
    // ignore
  }

  return { prefix, suffix };
}

const MarkdownImage: React.FC<{
  src?: string;
  alt?: string;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
  onImageClick?: (url: string, alt?: string) => void;
}> = ({ src, alt, resolveImageBlobUrl, onImageClick }) => {
  const resolveRef = useRef(resolveImageBlobUrl);
  resolveRef.current = resolveImageBlobUrl;

  const clickRef = useRef(onImageClick);
  clickRef.current = onImageClick;

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
    resolveRef.current(src)
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
  }, [src]);

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
      onClick={() => clickRef.current?.(resolvedUrl, alt)}
    />
  );
};

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  currentFolderId: _currentFolderId,
  resolveImageBlobUrl,
  onImageClick,
  onAnnotate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resolveRef = useRef(resolveImageBlobUrl);
  resolveRef.current = resolveImageBlobUrl;

  const clickRef = useRef(onImageClick);
  clickRef.current = onImageClick;

  const stableResolve = useCallback((src: string) => resolveRef.current(src), []);
  const stableClick = useCallback((url: string, alt?: string) => clickRef.current?.(url, alt), []);

  // Selection state
  const [selectionText, setSelectionText] = useState<string | null>(null);
  const [selectionPosition, setSelectionPosition] = useState<SelectionToolbarPosition | null>(null);
  const [selectionContext, setSelectionContext] = useState<{ prefix?: string; suffix?: string }>({});

  // Existing highlight management state
  const [activeHighlight, setActiveHighlight] = useState<{
    text: string;
    comment?: string;
    color?: HighlightColor;
    position: SelectionToolbarPosition;
    prefix?: string;
    suffix?: string;
  } | null>(null);

  const handleDismissSelection = useCallback(() => {
    setSelectionText(null);
    setSelectionPosition(null);
    setSelectionContext({});
  }, []);

  const handleDismissHighlight = useCallback(() => {
    setActiveHighlight(null);
  }, []);

  const handleSelectionCheck = useCallback(() => {
    if (!onAnnotate) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionText(null);
      setSelectionPosition(null);
      setSelectionContext({});
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setSelectionText(null);
      setSelectionPosition(null);
      setSelectionContext({});
      return;
    }

    // Check if selection is within the container
    if (containerRef.current) {
      const anchorNode = sel.anchorNode;
      const focusNode = sel.focusNode;
      if (
        (anchorNode && !containerRef.current.contains(anchorNode)) ||
        (focusNode && !containerRef.current.contains(focusNode))
      ) {
        return;
      }
    }

    if (sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);

    const rect = range.getBoundingClientRect ? range.getBoundingClientRect() : null;
    const isZeroRect = !rect || (rect.width === 0 && rect.height === 0);
    const position: SelectionToolbarPosition = isZeroRect
      ? { x: 100, y: 100 }
      : { x: rect.left + rect.width / 2, y: rect.top };

    const { prefix, suffix } = extractContextFromRange(range);

    setActiveHighlight(null);
    setSelectionText(text);
    setSelectionPosition(position);
    setSelectionContext({
      prefix: prefix || undefined,
      suffix: suffix || undefined,
    });
  }, [onAnnotate]);

  const touchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!onAnnotate) return;
    if (
      (e.target as HTMLElement)?.closest?.(
        '[data-testid="selection-toolbar"], [data-testid="highlight-manage-popover"]'
      )
    ) {
      return;
    }

    const sel = window.getSelection();
    const isNeutralClick =
      (!sel || sel.isCollapsed || !sel.toString().trim()) &&
      !(e.target as HTMLElement)?.closest?.('mark');
    if (isNeutralClick) {
      setActiveHighlight(null);
    }

    handleSelectionCheck();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!onAnnotate) return;
    if (
      (e.target as HTMLElement)?.closest?.(
        '[data-testid="selection-toolbar"], [data-testid="highlight-manage-popover"]'
      )
    ) {
      return;
    }

    const sel = window.getSelection();
    const isNeutralTouch =
      (!sel || sel.isCollapsed || !sel.toString().trim()) &&
      !(e.target as HTMLElement)?.closest?.('mark');
    if (isNeutralTouch) {
      setActiveHighlight(null);
    }

    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
    }
    touchTimeoutRef.current = setTimeout(handleSelectionCheck, 10);
  };

  const handleHighlight = useCallback((color?: HighlightColor) => {
    if (!selectionText) return;
    onAnnotate?.({
      type: 'highlight',
      selectedText: selectionText,
      color,
      prefix: selectionContext.prefix,
      suffix: selectionContext.suffix,
    });
    handleDismissSelection();
    window.getSelection()?.removeAllRanges();
  }, [selectionText, selectionContext, onAnnotate, handleDismissSelection]);

  const handleComment = useCallback(
    (comment: string, color?: HighlightColor) => {
      if (!selectionText) return;
      onAnnotate?.({
        type: 'comment',
        selectedText: selectionText,
        comment,
        color,
        prefix: selectionContext.prefix,
        suffix: selectionContext.suffix,
      });
      handleDismissSelection();
      window.getSelection()?.removeAllRanges();
    },
    [selectionText, selectionContext, onAnnotate, handleDismissSelection]
  );

  const handleRemoveHighlight = useCallback(() => {
    if (!activeHighlight) return;
    onAnnotate?.({
      type: 'remove',
      selectedText: activeHighlight.text,
      comment: activeHighlight.comment,
      prefix: activeHighlight.prefix,
      suffix: activeHighlight.suffix,
    });
    handleDismissHighlight();
  }, [activeHighlight, onAnnotate, handleDismissHighlight]);

  const handleUpdateComment = useCallback(
    (newComment: string) => {
      if (!activeHighlight) return;
      onAnnotate?.({
        type: 'updateComment',
        selectedText: activeHighlight.text,
        comment: activeHighlight.comment,
        newComment,
        prefix: activeHighlight.prefix,
        suffix: activeHighlight.suffix,
      });
      handleDismissHighlight();
    },
    [activeHighlight, onAnnotate, handleDismissHighlight]
  );

  const handleUpdateColor = useCallback(
    (newColor: HighlightColor) => {
      if (!activeHighlight) return;
      onAnnotate?.({
        type: 'updateColor',
        selectedText: activeHighlight.text,
        color: activeHighlight.color,
        newColor,
        comment: activeHighlight.comment,
        prefix: activeHighlight.prefix,
        suffix: activeHighlight.suffix,
      });
      setActiveHighlight((prev) => (prev ? { ...prev, color: newColor } : null));
    },
    [activeHighlight, onAnnotate]
  );

  const handleMarkClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, markText: string, comment?: string, color?: HighlightColor) => {
      if (!onAnnotate) return;

      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      window.getSelection()?.removeAllRanges();
      handleDismissSelection();

      const rect = e.currentTarget.getBoundingClientRect();
      const isZeroRect = !rect || (rect.width === 0 && rect.height === 0);
      const position: SelectionToolbarPosition = isZeroRect
        ? { x: 100, y: 100 }
        : { x: rect.left + rect.width / 2, y: rect.top };

      const { prefix, suffix } = extractContextFromElement(e.currentTarget);

      setActiveHighlight({
        text: markText,
        comment: comment || undefined,
        color: color || 'yellow',
        position,
        prefix: prefix || undefined,
        suffix: suffix || undefined,
      });
    },
    [onAnnotate, handleDismissSelection]
  );

  // Pre-process ==highlight== syntax into <mark> tags
  const processedContent = useMemo(() => {
    if (!content) return '';
    return content.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  }, [content]);

  const components = useMemo(
    () => ({
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
      img({ src, alt }: any) {
        return (
          <MarkdownImage
            src={src}
            alt={alt}
            resolveImageBlobUrl={stableResolve}
            onImageClick={stableClick}
          />
        );
      },
      mark({ node: _node, children, 'data-comment': dataComment, 'data-color': dataColor, title, ...props }: any) {
        const comment = dataComment || title;
        const colorKey = (dataColor as string) || 'yellow';
        const colorStyle = COLOR_STYLES[colorKey] || COLOR_STYLES.yellow;
        const markText = getNodeText(children);
        return (
          <mark
            className={`${colorStyle.markClass} border-b px-1 py-0.5 rounded inline-flex items-center gap-1 ${
              onAnnotate ? 'cursor-pointer transition-colors' : ''
            }`}
            onClick={
              onAnnotate
                ? (e) => handleMarkClick(e, markText, comment, (dataColor as HighlightColor) || 'yellow')
                : undefined
            }
            data-color={dataColor}
            {...props}
          >
            <span>{children}</span>
            {comment && (
              <span
                title={`Comment: ${comment}`}
                className={`inline-flex items-center text-[11px] ${colorStyle.badgeClass} px-1.5 py-0.5 rounded border ml-1 font-sans font-normal select-none`}
              >
                💬 {comment}
              </span>
            )}
          </mark>
        );
      },
    }),
    [stableResolve, stableClick, onAnnotate, handleMarkClick]
  );

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      className="relative prose prose-invert max-w-none prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-img:rounded-lg"
    >
      <ReactMarkdown
        urlTransform={customUrlTransform}
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>

      {onAnnotate && (
        <PresenterAnnotationOverlay
          selectionText={selectionText}
          selectionPosition={selectionPosition}
          onHighlight={handleHighlight}
          onComment={handleComment}
          onDismissSelection={handleDismissSelection}
          activeHighlight={activeHighlight}
          onRemoveHighlight={handleRemoveHighlight}
          onUpdateComment={handleUpdateComment}
          onUpdateColor={handleUpdateColor}
          onDismissHighlight={handleDismissHighlight}
        />
      )}
    </div>
  );
};
