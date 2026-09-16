import React, { useState, useMemo, useEffect } from 'react';
import { VirtualNode } from '../services/pathResolver';
import {
  Folder,
  FolderPlus,
  FilePlus,
  FileText,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Trash2,
  Search,
  X,
} from 'lucide-react';
import { PromptModal } from './PromptModal';
import { ConfirmModal } from './ConfirmModal';

export interface SidebarProps {
  tree: VirtualNode;
  selectedFileId: string | null;
  onSelectNote: (noteId: string) => void;
  onCreateNote: (folderId: string, name: string) => Promise<void>;
  onCreateFolder: (parentFolderId: string, name: string) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export interface TreeNodeItemProps {
  node: VirtualNode;
  selectedFileId: string | null;
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

export const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  selectedFileId,
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

  return (
    <div>
      <div
        className="group flex items-center justify-between px-3 py-1.5 text-sm cursor-pointer text-slate-400 hover:bg-slate-800/70 rounded-md mx-2 transition-colors"
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
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
  isOpen,
  onToggleOpen,
}) => {
  const [search, setSearch] = useState<string>('');
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

  const filteredTree = useMemo(() => {
    return filterTree(tree, search);
  }, [tree, search]);

  const searchActive = search.trim().length > 0;

  return (
    <aside
      data-testid="sidebar"
      aria-label="Sidebar"
      className={`h-full bg-slate-950 border-r border-slate-800 flex flex-col transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-0 -translate-x-full overflow-hidden border-none'
      }`}
    >
      {/* Search Header */}
      <div className="p-3 border-b border-slate-800 flex items-center gap-2">
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
