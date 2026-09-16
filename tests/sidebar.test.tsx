import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../src/components/Sidebar';
import { VirtualNode } from '../src/services/pathResolver';

describe('Sidebar', () => {
  const mockTree: VirtualNode = {
    id: 'root',
    name: 'Notes',
    isFolder: true,
    parentId: null,
    children: [
      {
        id: 'math',
        name: 'Math',
        isFolder: true,
        parentId: 'root',
        children: [
          {
            id: 'algebra',
            name: 'Algebra.md',
            isFolder: false,
            parentId: 'math',
          },
        ],
      },
      {
        id: 'note-1',
        name: 'Intro.md',
        isFolder: false,
        parentId: 'root',
      },
    ],
  };

  let originalPrompt: typeof window.prompt;
  let originalConfirm: typeof window.confirm;

  beforeEach(() => {
    originalPrompt = window.prompt;
    originalConfirm = window.confirm;
    window.prompt = vi.fn();
    window.confirm = vi.fn();
  });

  afterEach(() => {
    window.prompt = originalPrompt;
    window.confirm = originalConfirm;
    vi.restoreAllMocks();
  });

  describe('Tree Rendering', () => {
    it('renders the root folder, subfolders, and files', () => {
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.getByText('Intro.md')).toBeInTheDocument();
      expect(screen.getByText('Algebra.md')).toBeInTheDocument();
    });
  });

  describe('Note Selection & Highlighting', () => {
    it('triggers onSelectNote with note id when a note is clicked', () => {
      const handleSelectNote = vi.fn();
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={handleSelectNote}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const noteEl = screen.getByText('Intro.md');
      fireEvent.click(noteEl);
      expect(handleSelectNote).toHaveBeenCalledWith('note-1');
    });

    it('highlights the selected note with active styles', () => {
      const { rerender } = render(
        <Sidebar
          tree={mockTree}
          selectedFileId="note-1"
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const introRow = screen.getByText('Intro.md').closest('div[class*="cursor-pointer"]');
      expect(introRow).toHaveClass('bg-indigo-600/30', 'text-indigo-300');

      const algebraRow = screen.getByText('Algebra.md').closest('div[class*="cursor-pointer"]');
      expect(algebraRow).not.toHaveClass('bg-indigo-600/30');

      // Change selection
      rerender(
        <Sidebar
          tree={mockTree}
          selectedFileId="algebra"
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      expect(introRow).not.toHaveClass('bg-indigo-600/30');
      expect(algebraRow).toHaveClass('bg-indigo-600/30', 'text-indigo-300');
    });
  });

  describe('Folder Expand & Collapse', () => {
    it('collapses and expands folder children on folder click', () => {
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      // Initially Algebra.md is visible inside Math
      expect(screen.getByText('Algebra.md')).toBeInTheDocument();

      // Click on Math folder to collapse
      const mathFolder = screen.getByText('Math');
      fireEvent.click(mathFolder);

      // Now Algebra.md should not be in the document
      expect(screen.queryByText('Algebra.md')).not.toBeInTheDocument();

      // Click again to re-expand
      fireEvent.click(mathFolder);
      expect(screen.getByText('Algebra.md')).toBeInTheDocument();
    });
  });

  describe('Search & Filtering', () => {
    it('filters notes case-insensitively based on search input', () => {
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'intro' } });

      // Intro.md should be visible
      expect(screen.getByText('Intro.md')).toBeInTheDocument();
      // Algebra.md and Math should be filtered out
      expect(screen.queryByText('Algebra.md')).not.toBeInTheDocument();
      expect(screen.queryByText('Math')).not.toBeInTheDocument();
    });

    it('displays matching items in nested folders and expands parents', () => {
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'algebra' } });

      expect(screen.getByText('Algebra.md')).toBeInTheDocument();
      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.queryByText('Intro.md')).not.toBeInTheDocument();
    });

    it('shows no notes found message when query does not match anything', () => {
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent-query' } });

      expect(screen.getByText(/no notes found/i)).toBeInTheDocument();
      expect(screen.queryByText('Intro.md')).not.toBeInTheDocument();
    });

    it('restores all notes when search input is cleared', () => {
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'intro' } });
      expect(screen.queryByText('Algebra.md')).not.toBeInTheDocument();

      const clearBtn = screen.getByLabelText('Clear search');
      fireEvent.click(clearBtn);

      expect(screen.getByText('Intro.md')).toBeInTheDocument();
      expect(screen.getByText('Algebra.md')).toBeInTheDocument();
      expect(screen.getByText('Math')).toBeInTheDocument();
    });

    it('matches folders by name and displays their contents', () => {
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search notes...');
      fireEvent.change(searchInput, { target: { value: 'Math' } });

      expect(screen.getByText('Math')).toBeInTheDocument();
      expect(screen.getByText('Algebra.md')).toBeInTheDocument();
      expect(screen.queryByText('Intro.md')).not.toBeInTheDocument();
    });
  });

  describe('Note Creation', () => {
    it('appends .md extension if missing when creating note', () => {
      const handleCreateNote = vi.fn();
      vi.mocked(window.prompt).mockReturnValue('Physics');

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={handleCreateNote}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const newNoteBtn = screen.getByLabelText('New Note in Math');
      fireEvent.click(newNoteBtn);

      expect(window.prompt).toHaveBeenCalled();
      expect(handleCreateNote).toHaveBeenCalledWith('math', 'Physics.md');
    });

    it('does not duplicate .md extension if already provided', () => {
      const handleCreateNote = vi.fn();
      vi.mocked(window.prompt).mockReturnValue('Calculus.md');

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={handleCreateNote}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const newNoteBtn = screen.getByLabelText('New Note in Math');
      fireEvent.click(newNoteBtn);

      expect(handleCreateNote).toHaveBeenCalledWith('math', 'Calculus.md');
    });

    it('does not call onCreateNote if prompt is cancelled or empty', () => {
      const handleCreateNote = vi.fn();
      vi.mocked(window.prompt).mockReturnValue(null);

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={handleCreateNote}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const newNoteBtn = screen.getByLabelText('New Note in Math');
      fireEvent.click(newNoteBtn);

      expect(handleCreateNote).not.toHaveBeenCalled();

      // Empty string
      vi.mocked(window.prompt).mockReturnValue('   ');
      fireEvent.click(newNoteBtn);
      expect(handleCreateNote).not.toHaveBeenCalled();
    });
  });

  describe('Folder Creation', () => {
    it('creates folder with given name from prompt', () => {
      const handleCreateFolder = vi.fn();
      vi.mocked(window.prompt).mockReturnValue('Geometry');

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={handleCreateFolder}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const newFolderBtn = screen.getByLabelText('New Folder in Math');
      fireEvent.click(newFolderBtn);

      expect(window.prompt).toHaveBeenCalled();
      expect(handleCreateFolder).toHaveBeenCalledWith('math', 'Geometry');
    });

    it('does not call onCreateFolder if prompt is cancelled or empty', () => {
      const handleCreateFolder = vi.fn();
      vi.mocked(window.prompt).mockReturnValue(null);

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={handleCreateFolder}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const newFolderBtn = screen.getByLabelText('New Folder in Math');
      fireEvent.click(newFolderBtn);

      expect(handleCreateFolder).not.toHaveBeenCalled();

      // Whitespace
      vi.mocked(window.prompt).mockReturnValue('   ');
      fireEvent.click(newFolderBtn);
      expect(handleCreateFolder).not.toHaveBeenCalled();
    });
  });

  describe('Item Deletion', () => {
    it('deletes a note when confirmed', () => {
      const handleDeleteItem = vi.fn();
      vi.mocked(window.confirm).mockReturnValue(true);

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={handleDeleteItem}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const deleteBtn = screen.getByLabelText('Delete Intro.md');
      fireEvent.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalledWith('Delete Intro.md?');
      expect(handleDeleteItem).toHaveBeenCalledWith('note-1');
    });

    it('does not delete note when confirmation is cancelled', () => {
      const handleDeleteItem = vi.fn();
      vi.mocked(window.confirm).mockReturnValue(false);

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={handleDeleteItem}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const deleteBtn = screen.getByLabelText('Delete Intro.md');
      fireEvent.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalledWith('Delete Intro.md?');
      expect(handleDeleteItem).not.toHaveBeenCalled();
    });

    it('deletes a folder when confirmed', () => {
      const handleDeleteItem = vi.fn();
      vi.mocked(window.confirm).mockReturnValue(true);

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={handleDeleteItem}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const deleteBtn = screen.getByLabelText('Delete Math');
      fireEvent.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalledWith('Delete Math?');
      expect(handleDeleteItem).toHaveBeenCalledWith('math');
    });

    it('does not delete folder when confirmation is cancelled', () => {
      const handleDeleteItem = vi.fn();
      vi.mocked(window.confirm).mockReturnValue(false);

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={handleDeleteItem}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const deleteBtn = screen.getByLabelText('Delete Math');
      fireEvent.click(deleteBtn);

      expect(window.confirm).toHaveBeenCalledWith('Delete Math?');
      expect(handleDeleteItem).not.toHaveBeenCalled();
    });

    it('creates note directly in root folder', () => {
      const handleCreateNote = vi.fn();
      vi.mocked(window.prompt).mockReturnValue('RootNote');

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={handleCreateNote}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const newNoteBtn = screen.getByLabelText('New Note in Notes');
      fireEvent.click(newNoteBtn);

      expect(handleCreateNote).toHaveBeenCalledWith('root', 'RootNote.md');
    });

    it('creates folder directly in root folder', () => {
      const handleCreateFolder = vi.fn();
      vi.mocked(window.prompt).mockReturnValue('RootSubfolder');

      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={handleCreateFolder}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const newFolderBtn = screen.getByLabelText('New Folder in Notes');
      fireEvent.click(newFolderBtn);

      expect(handleCreateFolder).toHaveBeenCalledWith('root', 'RootSubfolder');
    });
  });

  describe('Open vs Closed State & Toggle', () => {
    it('applies open and closed width classes depending on isOpen', () => {
      const { rerender } = render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={vi.fn()}
        />
      );

      const sidebar = screen.getByTestId('sidebar');
      expect(sidebar).toHaveClass('w-64');
      expect(sidebar).not.toHaveClass('w-0');

      rerender(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={false}
          onToggleOpen={vi.fn()}
        />
      );

      expect(sidebar).toHaveClass('w-0', 'overflow-hidden');
      expect(sidebar).not.toHaveClass('w-64');
    });

    it('calls onToggleOpen when toggle button is clicked', () => {
      const handleToggleOpen = vi.fn();
      render(
        <Sidebar
          tree={mockTree}
          selectedFileId={null}
          onSelectNote={vi.fn()}
          onCreateNote={vi.fn()}
          onCreateFolder={vi.fn()}
          onDeleteItem={vi.fn()}
          isOpen={true}
          onToggleOpen={handleToggleOpen}
        />
      );

      const toggleBtn = screen.getByLabelText(/collapse sidebar/i);
      fireEvent.click(toggleBtn);
      expect(handleToggleOpen).toHaveBeenCalledTimes(1);
    });
  });
});
