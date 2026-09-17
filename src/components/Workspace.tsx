import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SyncBadge, SyncStatus } from './SyncBadge';
import { MarkdownViewer, AnnotationAction } from './MarkdownViewer';
import { ImageLightbox } from './ImageLightbox';
import { PromptModal } from './PromptModal';
import {
  addHighlightToMarkdown,
  addCommentToMarkdown,
  removeHighlightFromMarkdown,
  updateCommentInMarkdown,
  updateHighlightColorInMarkdown,
  HighlightColor,
} from '../services/markdownAnchorService';
import { HIGHLIGHT_COLORS } from './PresenterAnnotationOverlay';
import {
  ImagePlus,
  Columns,
  Eye,
  Edit3,
  Bold,
  Italic,
  Heading,
  Highlighter,
  MessageSquarePlus,
  Sigma,
  Code,
  ChevronDown,
} from 'lucide-react';

export interface WorkspaceProps {
  noteTitle: string;
  initialContent: string;
  currentFolderId: string;
  onSaveContent: (content: string) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  resolveImageBlobUrl: (src: string) => Promise<string | null>;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  noteTitle,
  initialContent,
  currentFolderId,
  onSaveContent,
  onUploadImage,
  resolveImageBlobUrl,
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [viewMode, setViewMode] = useState<'edit' | 'split' | 'preview'>('split');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt?: string } | null>(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState<boolean>(false);
  const [commentSelection, setCommentSelection] = useState<{ start: number; end: number; selected: string } | null>(null);
  const [editorHighlightColor, setEditorHighlightColor] = useState<HighlightColor>('yellow');
  const [isEditorColorPickerOpen, setIsEditorColorPickerOpen] = useState(false);

  const contentRef = useRef<string>(content);
  contentRef.current = content;

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorColorPickerRef = useRef<HTMLDivElement>(null);
  const pendingSaveRef = useRef<{ content: string; saveFn: (c: string) => Promise<void> } | null>(null);

  const flushPendingSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingSaveRef.current) {
      const { content: toSave, saveFn } = pendingSaveRef.current;
      pendingSaveRef.current = null;
      try {
        await Promise.resolve(saveFn(toSave));
      } catch {
        // save failed
      }
    }
  }, []);

  useEffect(() => {
    flushPendingSave();
    setContent(initialContent);
    contentRef.current = initialContent;
    setSyncStatus('synced');
  }, [initialContent, flushPendingSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (pendingSaveRef.current) {
        const { content: toSave, saveFn } = pendingSaveRef.current;
        pendingSaveRef.current = null;
        Promise.resolve(saveFn(toSave)).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!isEditorColorPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (editorColorPickerRef.current && !editorColorPickerRef.current.contains(e.target as Node)) {
        setIsEditorColorPickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsEditorColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEditorColorPickerOpen]);

  const scheduleSave = useCallback(
    (newContent: string) => {
      setContent(newContent);
      contentRef.current = newContent;
      setSyncStatus('saving');

      pendingSaveRef.current = {
        content: newContent,
        saveFn: onSaveContent,
      };

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const toSave = pendingSaveRef.current?.content || newContent;
          const saveFn = pendingSaveRef.current?.saveFn || onSaveContent;
          pendingSaveRef.current = null;
          saveTimeoutRef.current = null;
          await saveFn(toSave);
          if (contentRef.current === toSave) {
            setSyncStatus('synced');
          }
        } catch {
          setSyncStatus('error');
        }
      }, 1500);
    },
    [onSaveContent]
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    scheduleSave(e.target.value);
  };

  const handleAnnotate = useCallback(
    (action: AnnotationAction) => {
      const current = contentRef.current;
      let nextContent = current;

      switch (action.type) {
        case 'highlight':
          nextContent = addHighlightToMarkdown(
            current,
            action.selectedText,
            {
              prefix: action.prefix,
              suffix: action.suffix,
            },
            action.color
          );
          break;
        case 'comment':
          nextContent = addCommentToMarkdown(
            current,
            action.selectedText,
            action.comment || '',
            {
              prefix: action.prefix,
              suffix: action.suffix,
            },
            action.color
          );
          break;
        case 'remove':
          nextContent = removeHighlightFromMarkdown(current, action.selectedText, action.comment, {
            prefix: action.prefix,
            suffix: action.suffix,
          });
          break;
        case 'updateComment':
          nextContent = updateCommentInMarkdown(
            current,
            action.selectedText,
            action.comment || '',
            action.newComment || '',
            {
              prefix: action.prefix,
              suffix: action.suffix,
            }
          );
          break;
        case 'updateColor':
          nextContent = updateHighlightColorInMarkdown(
            current,
            action.selectedText,
            action.newColor || 'yellow',
            action.color,
            action.comment,
            {
              prefix: action.prefix,
              suffix: action.suffix,
            }
          );
          break;
      }

      if (nextContent === current) {
        return;
      }

      scheduleSave(nextContent);
    },
    [scheduleSave]
  );

  const handleRetry = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    pendingSaveRef.current = null;
    setSyncStatus('saving');
    const toSave = contentRef.current;
    try {
      await onSaveContent(toSave);
      if (contentRef.current === toSave) {
        setSyncStatus('synced');
      }
    } catch {
      setSyncStatus('error');
    }
  }, [onSaveContent]);

  const wrapSelection = (before: string, after: string, defaultPlaceholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart ?? 0;
    const end = textarea.selectionEnd ?? 0;
    const current = contentRef.current;
    const selected = current.slice(start, end) || defaultPlaceholder;
    const updated = current.slice(0, start) + before + selected + after + current.slice(end);

    scheduleSave(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    }, 0);
  };

  const handleCommentClick = () => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const current = contentRef.current;
    const selected = current.slice(start, end);
    setCommentSelection({ start, end, selected });
    setIsCommentModalOpen(true);
  };

  const handleConfirmComment = (commentText: string) => {
    setIsCommentModalOpen(false);
    const textarea = textareaRef.current;
    if (!textarea || !commentSelection) return;

    const { start, end, selected } = commentSelection;
    const textToWrap = selected || 'commented text';
    const colorAttr = editorHighlightColor && editorHighlightColor !== 'yellow' ? ` data-color="${editorHighlightColor}"` : '';
    const before = `<mark${colorAttr} data-comment="${commentText.replace(/"/g, '&quot;')}">`;
    const after = `</mark>`;
    const current = contentRef.current;
    const updated = current.slice(0, start) + before + textToWrap + after + current.slice(end);

    scheduleSave(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + textToWrap.length);
    }, 0);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = typeof item.getAsFile === 'function' ? item.getAsFile() : null;
        if (file) {
          e.preventDefault();
          const cursor = e.currentTarget.selectionStart ?? contentRef.current.length;
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          pendingSaveRef.current = null;
          setSyncStatus('saving');
          try {
            const relativePath = await onUploadImage(file);
            const inserted = `\n![${file.name}](${relativePath})\n`;
            const current = contentRef.current;
            const updated = current.slice(0, cursor) + inserted + current.slice(cursor);
            setContent(updated);
            contentRef.current = updated;
            await onSaveContent(updated);
            if (contentRef.current === updated) {
              setSyncStatus('synced');
            }
          } catch {
            setSyncStatus('error');
          }
        }
      }
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (file) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      pendingSaveRef.current = null;
      setSyncStatus('saving');
      try {
        const rel = await onUploadImage(file);
        const updated = contentRef.current + `\n![${file.name}](${rel})\n`;
        setContent(updated);
        contentRef.current = updated;
        await onSaveContent(updated);
        if (contentRef.current === updated) {
          setSyncStatus('synced');
        }
      } catch {
        setSyncStatus('error');
      }
      input.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Workspace Subheader */}
      <div className="h-12 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-slate-200 truncate max-w-xs">{noteTitle}</span>
          <SyncBadge
            status={syncStatus}
            onRetry={handleRetry}
          />
        </div>
        <div className="flex items-center gap-2">
          {/* View mode buttons */}
          <div className="flex bg-slate-800/80 rounded p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit3 size={12} /> Edit
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 hidden md:flex cursor-pointer transition-colors ${
                viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Columns size={12} /> Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                viewMode === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={12} /> Preview
            </button>
          </div>
        </div>
      </div>

      {/* Editor / Preview Area */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`h-full flex flex-col ${viewMode === 'split' ? 'w-full md:w-1/2 border-r border-slate-800' : 'w-full'}`}>
            {/* Formatting Toolbar */}
            <div className="h-9 border-b border-slate-800/80 px-3 flex items-center gap-1 bg-slate-950/40 text-slate-400 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => wrapSelection('**', '**', 'bold text')}
                title="Bold (Ctrl+B)"
                aria-label="Bold"
                className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('*', '*', 'italic text')}
                title="Italic (Ctrl+I)"
                aria-label="Italic"
                className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('### ', '', 'Heading')}
                title="Heading 3"
                aria-label="Heading"
                className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <Heading size={13} />
              </button>

              <div className="w-px h-4 bg-slate-800 mx-1 shrink-0" />

              <div className="relative inline-flex items-center" ref={editorColorPickerRef}>
                <button
                  type="button"
                  onClick={() => {
                    const colorAttr = editorHighlightColor && editorHighlightColor !== 'yellow' ? ` data-color="${editorHighlightColor}"` : '';
                    wrapSelection(`<mark${colorAttr}>`, '</mark>', 'highlighted text');
                  }}
                  title="Highlight text (<mark>)"
                  aria-label="Highlight"
                  className="p-1.5 hover:text-amber-300 hover:bg-amber-500/10 rounded-l transition-colors flex items-center gap-1 text-xs"
                >
                  <Highlighter
                    size={13}
                    className={HIGHLIGHT_COLORS.find(c => c.id === editorHighlightColor)?.textClass || 'text-amber-400'}
                  />
                  <span className="hidden sm:inline">Highlight</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorColorPickerOpen(prev => !prev)}
                  title="Choose highlight color"
                  aria-label="Choose editor highlight color"
                  className="p-1 hover:text-amber-300 hover:bg-amber-500/10 rounded-r transition-colors flex items-center"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      HIGHLIGHT_COLORS.find(c => c.id === editorHighlightColor)?.dotClass || 'bg-amber-400'
                    }`}
                  />
                  <ChevronDown size={11} className="text-slate-400 ml-0.5" />
                </button>

                {isEditorColorPickerOpen && (
                  <div
                    role="menu"
                    className="absolute top-full left-0 mt-1 p-1.5 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 flex flex-col gap-1 min-w-[120px]"
                  >
                    {HIGHLIGHT_COLORS.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setEditorHighlightColor(c.id);
                          setIsEditorColorPickerOpen(false);
                        }}
                        aria-label={`Editor color ${c.id}`}
                        className={`flex items-center gap-2 px-2 py-1 text-xs rounded transition-colors text-left ${
                          editorHighlightColor === c.id
                            ? 'bg-slate-800 text-slate-100 font-medium'
                            : 'text-slate-300 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className={`w-3 h-3 rounded-full shrink-0 ${c.dotClass}`} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={handleCommentClick}
                title="Add Comment to text"
                aria-label="Add Comment"
                className="p-1.5 hover:text-indigo-300 hover:bg-indigo-500/10 rounded transition-colors flex items-center gap-1 text-xs"
              >
                <MessageSquarePlus size={13} className="text-indigo-400" />
                <span className="hidden sm:inline">Comment</span>
              </button>

              <div className="w-px h-4 bg-slate-800 mx-1 shrink-0" />

              <button
                type="button"
                onClick={() => wrapSelection('$', '$', 'E=mc^2')}
                title="LaTeX Math ($...$)"
                aria-label="Math formula"
                className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <Sigma size={13} />
              </button>
              <button
                type="button"
                onClick={() => wrapSelection('```\n', '\n```', 'code')}
                title="Code Block"
                aria-label="Code Block"
                className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <Code size={13} />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload figure"
                aria-label="Upload figure"
                className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              >
                <ImagePlus size={13} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                data-testid="file-upload-input"
                onChange={handleFileInputChange}
              />
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder="Write your markdown note here..."
              aria-label="Markdown editor"
              className="w-full flex-1 p-4 bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-200"
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`h-full overflow-y-auto p-6 ${viewMode === 'split' ? 'w-full md:w-1/2' : 'w-full'}`}>
            <MarkdownViewer
              content={content}
              currentFolderId={currentFolderId}
              resolveImageBlobUrl={resolveImageBlobUrl}
              onImageClick={(url, alt) => setLightboxImage({ url, alt })}
              onAnnotate={handleAnnotate}
            />
          </div>
        )}
      </div>

      {lightboxImage && (
        <ImageLightbox
          url={lightboxImage.url}
          alt={lightboxImage.alt}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Comment Prompt Modal */}
      <PromptModal
        isOpen={isCommentModalOpen}
        title="Add Comment"
        message="Enter your annotation or comment to save directly inside this note:"
        placeholder="e.g. Verify source data or check citation"
        confirmText="Add Comment"
        onConfirm={handleConfirmComment}
        onCancel={() => setIsCommentModalOpen(false)}
      />
    </div>
  );
};
