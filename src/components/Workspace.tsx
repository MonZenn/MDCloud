import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MarkdownViewer } from './MarkdownViewer';
import { SyncBadge, SyncStatus } from './SyncBadge';
import { ImageLightbox } from './ImageLightbox';
import { Columns, Eye, Edit3, ImagePlus } from 'lucide-react';

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
  resolveImageBlobUrl
}) => {
  const [content, setContent] = useState<string>(initialContent);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');
  const [lightboxImage, setLightboxImage] = useState<{ url: string; alt?: string } | null>(null);

  const contentRef = useRef<string>(initialContent);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setContent(initialContent);
    contentRef.current = initialContent;
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, [initialContent]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    contentRef.current = newContent;
    setSyncStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await onSaveContent(newContent);
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 1500);
  };

  const handleRetry = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    setSyncStatus('saving');
    try {
      await onSaveContent(contentRef.current);
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    }
  }, [onSaveContent]);

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
          }
          setSyncStatus('saving');
          try {
            const relativePath = await onUploadImage(file);
            const inserted = `\n![${file.name}](${relativePath})\n`;
            const current = contentRef.current;
            const updated = current.slice(0, cursor) + inserted + current.slice(cursor);
            setContent(updated);
            contentRef.current = updated;
            await onSaveContent(updated);
            setSyncStatus('synced');
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
      }
      setSyncStatus('saving');
      try {
        const rel = await onUploadImage(file);
        const updated = contentRef.current + `\n![${file.name}](${rel})\n`;
        setContent(updated);
        contentRef.current = updated;
        await onSaveContent(updated);
        setSyncStatus('synced');
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
          <span className="font-semibold text-sm text-slate-200">{noteTitle}</span>
          <SyncBadge
            status={syncStatus}
            onRetry={handleRetry}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
            title="Upload figure"
            aria-label="Upload figure"
          >
            <ImagePlus size={16} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            data-testid="file-upload-input"
            onChange={handleFileInputChange}
          />
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
      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div className={`h-full ${viewMode === 'split' ? 'w-1/2 border-r border-slate-800' : 'w-full'}`}>
            <textarea
              value={content}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder="Write your markdown note here..."
              aria-label="Markdown editor"
              className="w-full h-full p-4 bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-200"
            />
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`h-full overflow-y-auto p-6 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
            <MarkdownViewer
              content={content}
              currentFolderId={currentFolderId}
              resolveImageBlobUrl={resolveImageBlobUrl}
              onImageClick={(url, alt) => setLightboxImage({ url, alt })}
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
    </div>
  );
};
