import React, { useState, useEffect, useRef } from 'react';
import { Highlighter, MessageSquarePlus, Trash2, Edit2, Check, X } from 'lucide-react';

export type HighlightColor = 'yellow' | 'red' | 'green' | 'blue' | 'orange' | 'pink' | 'purple';

export interface ColorOption {
  id: HighlightColor;
  label: string;
  dotClass: string;
  textClass: string;
}

export const HIGHLIGHT_COLORS: ColorOption[] = [
  { id: 'yellow', label: 'Yellow', dotClass: 'bg-amber-400', textClass: 'text-amber-400' },
  { id: 'red', label: 'Light Red', dotClass: 'bg-rose-400', textClass: 'text-rose-400' },
  { id: 'green', label: 'Light Green', dotClass: 'bg-emerald-400', textClass: 'text-emerald-400' },
  { id: 'blue', label: 'Light Blue', dotClass: 'bg-sky-400', textClass: 'text-sky-400' },
  { id: 'orange', label: 'Orange', dotClass: 'bg-orange-400', textClass: 'text-orange-400' },
  { id: 'pink', label: 'Pink', dotClass: 'bg-pink-400', textClass: 'text-pink-400' },
  { id: 'purple', label: 'Purple', dotClass: 'bg-purple-400', textClass: 'text-purple-400' },
];

export interface SelectionToolbarPosition {
  x: number;
  y: number;
}

export interface PresenterAnnotationOverlayProps {
  selectionText: string | null;
  selectionPosition: SelectionToolbarPosition | null;
  onHighlight: (color?: HighlightColor) => void;
  onComment: (comment: string, color?: HighlightColor) => void;
  onDismissSelection: () => void;

  activeHighlight: {
    text: string;
    comment?: string;
    color?: HighlightColor;
    position: SelectionToolbarPosition;
  } | null;
  onRemoveHighlight: () => void;
  onUpdateComment: (newComment: string) => void;
  onUpdateColor?: (newColor: HighlightColor) => void;
  onDismissHighlight: () => void;
}

export const PresenterAnnotationOverlay: React.FC<PresenterAnnotationOverlayProps> = ({
  selectionText,
  selectionPosition,
  onHighlight,
  onComment,
  onDismissSelection,
  activeHighlight,
  onRemoveHighlight,
  onUpdateComment,
  onUpdateColor,
  onDismissHighlight,
}) => {
  const [selectedColor, setSelectedColor] = useState<HighlightColor>('yellow');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [editExistingInput, setEditExistingInput] = useState('');

  const commentInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsCommenting(false);
    setCommentInput('');
  }, [selectionPosition]);

  useEffect(() => {
    setIsEditingExisting(false);
    setEditExistingInput(activeHighlight?.comment || '');
  }, [activeHighlight]);

  useEffect(() => {
    if (isCommenting) {
      const timerId = setTimeout(() => commentInputRef.current?.focus(), 50);
      return () => clearTimeout(timerId);
    }
  }, [isCommenting]);

  useEffect(() => {
    if (isEditingExisting) {
      const timerId = setTimeout(() => editInputRef.current?.focus(), 50);
      return () => clearTimeout(timerId);
    }
  }, [isEditingExisting]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const isActive =
      selectionPosition !== null ||
      activeHighlight !== null ||
      isCommenting ||
      isEditingExisting;

    if (!isActive) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCommenting) {
          setIsCommenting(false);
        } else if (selectionPosition) {
          onDismissSelection();
        } else if (isEditingExisting) {
          setIsEditingExisting(false);
        } else if (activeHighlight) {
          onDismissHighlight();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommenting, selectionPosition, onDismissSelection, isEditingExisting, activeHighlight, onDismissHighlight]);

  const handleCommentSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (commentInput.trim()) {
      onComment(commentInput.trim());
      setIsCommenting(false);
      setCommentInput('');
    }
  };

  const handleEditSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onUpdateComment(editExistingInput.trim());
    setIsEditingExisting(false);
  };

  const activeColorOption = HIGHLIGHT_COLORS.find((c) => c.id === selectedColor) || HIGHLIGHT_COLORS[0];
  const activeHighlightColor = HIGHLIGHT_COLORS.find((c) => c.id === activeHighlight?.color) || HIGHLIGHT_COLORS[0];

  return (
    <>
      {/* 1. Selection Floating Toolbar & Comment Input */}
      {selectionPosition && selectionText && (
        <div
          data-testid="selection-toolbar"
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2.5 transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            left: `${selectionPosition.x}px`,
            top: `${selectionPosition.y}px`,
          }}
        >
          {!isCommenting ? (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-lg p-1 text-slate-200">
                <button
                  type="button"
                  onClick={() => onHighlight(selectedColor)}
                  className={`px-2.5 py-1.5 hover:bg-slate-800 ${activeColorOption.textClass} rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer`}
                  title={`Highlight text (${activeColorOption.label})`}
                  aria-label="Highlight"
                >
                  <Highlighter size={14} className={activeColorOption.textClass} />
                  <span>Highlight</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  className="p-1.5 hover:bg-slate-800 rounded flex items-center gap-1 cursor-pointer transition-colors"
                  title="Choose color"
                  aria-label="Choose color"
                >
                  <span className={`w-3 h-3 rounded-full ${activeColorOption.dotClass} ring-1 ring-white/50 shadow-sm`} />
                </button>
                <div className="w-px h-4 bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setIsCommenting(true)}
                  className="px-2.5 py-1.5 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Add comment"
                  aria-label="Comment"
                >
                  <MessageSquarePlus size={14} className="text-indigo-400" />
                  <span>Comment</span>
                </button>
              </div>

              {isColorPickerOpen && (
                <div className="flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-lg p-1.5 mt-1 animate-in fade-in zoom-in-95">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedColor(c.id);
                        setIsColorPickerOpen(false);
                      }}
                      className={`w-4 h-4 rounded-full ${c.dotClass} cursor-pointer hover:scale-125 transition-transform ${
                        selectedColor === c.id ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                      }`}
                      title={c.label}
                      aria-label={c.label}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleCommentSubmit}
              className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 shadow-2xl rounded-lg p-1.5 w-72 text-slate-200"
            >
              <input
                ref={commentInputRef}
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCommentSubmit(e);
                  }
                }}
                placeholder="Add a note or comment..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-sans"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="p-1 hover:bg-indigo-600 text-slate-300 hover:text-white rounded transition-colors disabled:opacity-40 cursor-pointer"
                title="Save comment"
                aria-label="Save"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsCommenting(false)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                title="Cancel"
                aria-label="Cancel"
              >
                <X size={14} />
              </button>
            </form>
          )}
        </div>
      )}

      {/* 2. Existing Highlight Management Popover */}
      {activeHighlight && (
        <div
          data-testid="highlight-manage-popover"
          className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            left: `${activeHighlight.position.x}px`,
            top: `${activeHighlight.position.y}px`,
          }}
        >
          <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-lg p-2.5 max-w-xs text-slate-200 font-sans text-xs">
            {isEditingExisting ? (
              <form onSubmit={handleEditSubmit} className="flex items-center gap-1.5">
                <input
                  ref={editInputRef}
                  type="text"
                  value={editExistingInput}
                  onChange={(e) => setEditExistingInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEditSubmit(e);
                    }
                  }}
                  placeholder="Update comment..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="p-1 hover:bg-indigo-600 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                  title="Save"
                  aria-label="Save"
                >
                  <Check size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingExisting(false)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                  title="Cancel"
                  aria-label="Cancel"
                >
                  <X size={14} />
                </button>
              </form>
            ) : (
              <div>
                {activeHighlight.comment ? (
                  <div className="mb-2 pb-2 border-b border-slate-800 flex items-start justify-between gap-2">
                    <div className={`${activeHighlightColor.textClass} font-medium break-words leading-snug`}>
                      💬 {activeHighlight.comment}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingExisting(true)}
                      className="text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
                      title="Edit comment"
                      aria-label="Edit comment"
                    >
                      <Edit2 size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="mb-2 pb-2 border-b border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-slate-400 italic">Highlighted text</span>
                    <button
                      type="button"
                      onClick={() => setIsEditingExisting(true)}
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <MessageSquarePlus size={12} /> Add comment
                    </button>
                  </div>
                )}

                {/* Color swatches */}
                <div className="mb-2 pb-2 border-b border-slate-800 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 mr-1">Color:</span>
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onUpdateColor?.(c.id)}
                      className={`w-3.5 h-3.5 rounded-full ${c.dotClass} cursor-pointer hover:scale-125 transition-transform ${
                        (activeHighlight.color || 'yellow') === c.id ? 'ring-2 ring-white scale-110' : 'opacity-60 hover:opacity-100'
                      }`}
                      title={`Change color to ${c.label}`}
                      aria-label={`Change color to ${c.label}`}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={onRemoveHighlight}
                    className="flex items-center gap-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded transition-colors cursor-pointer"
                    title="Remove highlight"
                    aria-label="Remove"
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDismissHighlight}
                    className="text-slate-400 hover:text-slate-200 px-2 py-1 rounded cursor-pointer"
                    aria-label="Close"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
