import React, { useState, useMemo, useEffect, useRef } from 'react';
import { VirtualNode } from '../services/pathResolver';
import {
  Folder,
  FolderPlus,
  FolderUp,
  FilePlus,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Trash2,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { PromptModal } from './PromptModal';
import { ConfirmModal } from './ConfirmModal';

export interface UploadItem {
  file: File;
  relativePath: string;
}

export interface SidebarProps {
  tree: VirtualNode;
  selectedFileId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId: string, name: string) => Promise<void>;
  onCreateFolder: (parentFolderId: string, name: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onUploadFiles?: (items: UploadItem[] | File[], targetFolderId: string) => Promise<void>;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeFolderId?: string;
  onSelectFolder?: (folderId: string) => void;
}

export interface TreeNodeItemProps {
  node: VirtualNode;
  selectedFileId: string | null;
  activeFolderId?: string;
  onSelectFolder?: (folderId: string) => void;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId: string, name: string) => Promise<void>;
  onCreateFolder: (parentFolderId: string, name: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  depth: number;
  searchActive?: boolean;
  onRequestPrompt: (options: {
    title: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (val: string) => void;
  }) => void;
  onRequestConfirm: (options: {
    title: string;
    message: string;
    onConfirm: () => void;
  }) => void;
}

/**
 * Filter a VirtualNode tree based on a search query string.
 * Retains nodes whose names match case-insensitively, or folders that
 * contain matching descendants.
 */
export function filterTree(node: VirtualNode, query: string): VirtualNode | null {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) return node;

  if (!node.isFolder) {
    return node.name.toLowerCase().includes(cleanQuery) ? node : null;
  }

  // If a non-root folder matches the query, include the folder and all its contents
  if (node.parentId !== null && node.name.toLowerCase().includes(cleanQuery)) {
    return node;
  }

  const filteredChildren = (node.children || [])
    .map((child) => filterTree(child, cleanQuery))
    .filter((child): child is VirtualNode => child !== null);

  if (filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren,
    };
  }

  return null;
}

/**
 * Recursively extracts files with relative paths from a DataTransfer object.
 * Traverses directories using HTML5 FileSystem Directory Entries API when available.
 */
export async function extractDroppedItems(dataTransfer: DataTransfer): Promise<UploadItem[]> {
  const items = dataTransfer.items;
  if (items && items.length > 0) {
    const results: UploadItem[] = [];

    const traverseEntry = async (entry: any, path: string): Promise<void> => {
      if (!entry) return;
      if (entry.isFile) {
        const file = await new Promise<File>((resolve, reject) => {
          entry.file(resolve, reject);
        });
        const relativePath = path ? `${path}/${entry.name}` : entry.name;
        results.push({ file, relativePath });
      } else if (entry.isDirectory) {
        const currentPath = path ? `${path}/${entry.name}` : entry.name;
        const reader = entry.createReader();
        const readEntries = (): Promise<any[]> => {
          return new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
          });
        };

        let batch = await readEntries();
        while (batch.length > 0) {
          for (const child of batch) {
            await traverseEntry(child, currentPath);
          }
          batch = await readEntries();
        }
      }
    };

    const hasEntries = Array.from(items).some(
      (item) => typeof item.webkitGetAsEntry === 'function' && item.webkitGetAsEntry()
    );

    if (hasEntries) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.webkitGetAsEntry === 'function') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            await traverseEntry(entry, '');
          }
        }
      }
      if (results.length > 0) {
        return results;
      }
    }
  }

  const files = Array.from(dataTransfer.files || []);
  return files.map((file) => ({
    file,
    relativePath: (file as any).webkitRelativePath || file.name,
  }));
}

export const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  selectedFileId,
  activeFolderId,
  onSelectFolder,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onDeleteItem,
  depth,
  searchActive = false,
  onRequestPrompt,
  onRequestConfirm,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Automatically expand folders when search is active to display matching descendants
  useEffect(() => {
    if (searchActive) {
      setIsExpanded(true);
    }
  }, [searchActive]);

  if (!node.isFolder) {
    const isSelected = selectedFileId === node.id;
    return (
      <div
        className={`group flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer rounded-md mx-2 transition-colors ${
          isSelected ? 'bg-indigo-600/30 text-indigo-300 font-medium' : 'text-slate-300 hover:bg-slate-800'
        }`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => onSelectNote(node.id)}
      >
        <div className="flex items-center gap-2 truncate">
          <FileText size={15} className="text-slate-400 shrink-0" />
          <span className="truncate">{node.name}</span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRequestConfirm({
              title: 'Delete Note',
              message: `Are you sure you want to delete "${node.name}"? This action cannot be undone.`,
              onConfirm: () => onDeleteItem(node.id),
            });
          }}
          title="Delete Note"
          aria-label={`Delete ${node.name}`}
          className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 text-slate-500 rounded transition-opacity"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  }

  const isFolderActive = activeFolderId === node.id;

  return (
    <div>
      <div
        className={`group flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer rounded-md mx-2 transition-colors ${
          isFolderActive ? 'bg-indigo-600/20 text-indigo-200 font-medium' : 'text-slate-400 hover:bg-slate-800/70'
        }`}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => {
          onSelectFolder?.(node.id);
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="flex items-center gap-1.5 truncate">
          {isExpanded ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
          <Folder size={15} className="text-amber-400 shrink-0" />
          <span className="font-medium text-slate-200 truncate">{node.name}</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestPrompt({
                title: 'New Note',
                placeholder: 'Note.md',
                onConfirm: (name) => {
                  const trimmed = name.trim();
                  if (trimmed) {
                    onCreateNote(node.id, trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`);
                  }
                },
              });
            }}
            title="New Note"
            aria-label={`New Note in ${node.name}`}
            className="p-1 hover:text-slate-200 text-slate-400 rounded transition-colors"
          >
            <FilePlus size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRequestPrompt({
                title: 'New Folder',
                placeholder: 'Folder name',
                onConfirm: (name) => {
                  const trimmed = name.trim();
                  if (trimmed) {
                    onCreateFolder(node.id, trimmed);
                  }
                },
              });
            }}
            title="New Folder"
            aria-label={`New Folder in ${node.name}`}
            className="p-1 hover:text-slate-200 text-slate-400 rounded transition-colors"
          >
            <FolderPlus size={13} />
          </button>
          {(depth > 0 || node.parentId !== null) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRequestConfirm({
                  title: 'Delete Folder',
                  message: `Are you sure you want to delete "${node.name}"? This will delete all notes and files inside it.`,
                  onConfirm: () => onDeleteItem(node.id),
                });
              }}
              title="Delete Folder"
              aria-label={`Delete ${node.name}`}
              className="p-1 hover:text-rose-400 text-slate-500 rounded transition-colors"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      {isExpanded && node.children && node.children.length > 0 && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedFileId={selectedFileId}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              onSelectNote={onSelectNote}
              onCreateNote={onCreateNote}
              onCreateFolder={onCreateFolder}
              onDeleteItem={onDeleteItem}
              depth={depth + 1}
              searchActive={searchActive}
              onRequestPrompt={onRequestPrompt}
              onRequestConfirm={onRequestConfirm}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  tree,
  selectedFileId,
  onSelectNote,
  onCreateNote,
  onCreateFolder,
  onDeleteItem,
  onUploadFiles,
  isOpen,
  onToggleOpen,
  activeFolderId: propActiveFolderId,
  onSelectFolder: propOnSelectFolder,
}) => {
  const [internalActiveFolderId, setInternalActiveFolderId] = useState<string>(tree.id);
  const [search, setSearch] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    placeholder?: string;
    defaultValue?: string;
    onConfirm: (val: string) => void;
  } | null>(null);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const activeFolderId = propActiveFolderId ?? internalActiveFolderId;

  const handleSelectFolder = (folderId: string) => {
    setInternalActiveFolderId(folderId);
    propOnSelectFolder?.(folderId);
  };

  const activeFolderName = useMemo(() => {
    function find(node: VirtualNode): string | null {
      if (node.id === activeFolderId) return node.name;
      if (node.children) {
        for (const child of node.children) {
          const res = find(child);
          if (res) return res;
        }
      }
      return null;
    }
    return find(tree) || tree.name || 'Root';
  }, [tree, activeFolderId]);

  const filteredTree = useMemo(() => {
    return filterTree(tree, search);
  }, [tree, search]);

  const searchActive = search.trim().length > 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (onUploadFiles) {
      const items = await extractDroppedItems(e.dataTransfer);
      if (items.length > 0) {
        onUploadFiles(items, activeFolderId);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const items: UploadItem[] = Array.from(files).map((file) => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
      }));
      onUploadFiles?.(items, activeFolderId);
    }
    e.target.value = '';
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const items: UploadItem[] = Array.from(files).map((file) => ({
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
      }));
      onUploadFiles?.(items, activeFolderId);
    }
    e.target.value = '';
  };

  return (
    <aside
      data-testid="sidebar"
      aria-label="Sidebar"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative h-full bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-0 -translate-x-full overflow-hidden border-none'
      }`}
    >
      {/* Drag and Drop Dropzone Overlay */}
      {isDraggingOver && (
        <div
          data-testid="sidebar-dropzone"
          className="absolute inset-0 bg-indigo-950/90 border-2 border-dashed border-indigo-500 rounded flex flex-col items-center justify-center gap-2 z-50 text-indigo-200 pointer-events-none p-4 text-center"
        >
          <Upload size={32} className="text-indigo-400 animate-bounce" />
          <span className="font-semibold text-sm">Drop files or folders to upload</span>
          <span className="text-xs text-indigo-300 truncate max-w-full">to /{activeFolderName}</span>
        </div>
      )}

      {/* Top Action Bar - Compact and Sleek */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            setPromptConfig({
              isOpen: true,
              title: 'New Note',
              placeholder: 'Note.md',
              onConfirm: (name) => {
                const trimmed = name.trim();
                if (trimmed) {
                  onCreateNote(activeFolderId, trimmed.toLowerCase().endsWith('.md') ? trimmed : `${trimmed}.md`);
                }
              },
            });
          }}
          title="Create Note in active folder"
          aria-label="+ Note"
          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
        >
          <FilePlus size={13} />
          <span>+ Note</span>
        </button>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            type="button"
            onClick={() => {
              setPromptConfig({
                isOpen: true,
                title: 'New Folder',
                placeholder: 'Folder name',
                onConfirm: (name) => {
                  const trimmed = name.trim();
                  if (trimmed) {
                    onCreateFolder(activeFolderId, trimmed);
                  }
                },
              });
            }}
            title="New Folder in active folder"
            aria-label="New Folder"
            className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            <FolderPlus size={15} />
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Files to active folder"
            aria-label="Upload Files"
            className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            <Upload size={15} />
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            title="Upload Folder to active folder"
            aria-label="Upload Folder"
            className="p-1.5 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors cursor-pointer"
          >
            <FolderUp size={15} />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          data-testid="sidebar-file-upload-input"
          onChange={handleFileInputChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error - webkitdirectory is standard for folder picker
          webkitdirectory=""
          directory=""
          className="hidden"
          data-testid="sidebar-folder-upload-input"
          onChange={handleFolderInputChange}
        />
      </div>

      {/* Target Folder Indicator */}
      <div
        data-testid="target-folder-indicator"
        className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center gap-1.5 text-xs text-slate-400 truncate shrink-0"
        title={`Active Target: /${activeFolderName}`}
      >
        <span className="text-slate-500 font-medium shrink-0">Target:</span>
        <Folder size={12} className="text-amber-400 shrink-0" />
        <span className="text-indigo-300 font-semibold truncate">/{activeFolderName}</span>
      </div>

      {/* Search Header */}
      <div className="p-3 border-b border-slate-800 flex items-center gap-2 shrink-0">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            aria-label="Search notes"
            className="w-full pl-8 pr-7 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:outline-none focus:border-indigo-500 placeholder-slate-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              title="Clear search"
              aria-label="Clear search"
              className="absolute right-2 top-2 text-slate-500 hover:text-slate-300"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {onToggleOpen && (
          <button
            type="button"
            onClick={onToggleOpen}
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors shrink-0"
          >
            <ChevronLeft size={16} />
          </button>
        )}
      </div>

      {/* Hierarchy Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {filteredTree ? (
          <TreeNodeItem
            node={filteredTree}
            selectedFileId={selectedFileId}
            activeFolderId={activeFolderId}
            onSelectFolder={handleSelectFolder}
            onSelectNote={onSelectNote}
            onCreateNote={onCreateNote}
            onCreateFolder={onCreateFolder}
            onDeleteItem={onDeleteItem}
            depth={0}
            searchActive={searchActive}
            onRequestPrompt={(opts) => setPromptConfig({ ...opts, isOpen: true })}
            onRequestConfirm={(opts) => setConfirmConfig({ ...opts, isOpen: true })}
          />
        ) : (
          <div className="px-4 py-6 text-center text-xs text-slate-500">
            No notes found
          </div>
        )}
      </div>

      {/* Custom Input Prompt Modal */}
      {promptConfig && (
        <PromptModal
          isOpen={promptConfig.isOpen}
          title={promptConfig.title}
          placeholder={promptConfig.placeholder}
          defaultValue={promptConfig.defaultValue}
          onConfirm={(val) => {
            promptConfig.onConfirm(val);
            setPromptConfig(null);
          }}
          onCancel={() => setPromptConfig(null)}
        />
      )}

      {/* Custom Confirmation Modal */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={() => {
            confirmConfig.onConfirm();
            setConfirmConfig(null);
          }}
          onCancel={() => setConfirmConfig(null)}
        />
      )}
    </aside>
  );
};
