import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    it('appends .md extension if missing when creating note via custom modal', () => {
      const handleCreateNote = vi.fn();

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

      expect(window.prompt).not.toHaveBeenCalled();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('New Note')).toBeInTheDocument();

      const input = within(dialog).getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Physics' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(handleCreateNote).toHaveBeenCalledWith('math', 'Physics.md');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not duplicate .md extension if already provided', () => {
      const handleCreateNote = vi.fn();

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

      const dialog = screen.getByRole('dialog');
      const input = within(dialog).getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Calculus.md' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(handleCreateNote).toHaveBeenCalledWith('math', 'Calculus.md');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not call onCreateNote if modal is cancelled or empty', () => {
      const handleCreateNote = vi.fn();

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

      let dialog = screen.getByRole('dialog');
      // Cancel button
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(handleCreateNote).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Open again, empty submission is disabled or ignored
      fireEvent.click(newNoteBtn);
      dialog = screen.getByRole('dialog');
      const input = within(dialog).getByRole('textbox');
      fireEvent.change(input, { target: { value: '   ' } });
      const createBtn = within(dialog).getByRole('button', { name: 'Create' });
      fireEvent.click(createBtn);
      expect(handleCreateNote).not.toHaveBeenCalled();
    });
  });

  describe('Folder Creation', () => {
    it('creates folder with given name from custom modal', () => {
      const handleCreateFolder = vi.fn();

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

      expect(window.prompt).not.toHaveBeenCalled();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('New Folder')).toBeInTheDocument();

      const input = within(dialog).getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Geometry' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(handleCreateFolder).toHaveBeenCalledWith('math', 'Geometry');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not call onCreateFolder if modal is cancelled', () => {
      const handleCreateFolder = vi.fn();

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

      const dialog = screen.getByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(handleCreateFolder).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });


  describe('Item Deletion', () => {
    it('deletes a note when confirmed in custom modal', () => {
      const handleDeleteItem = vi.fn();

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

      expect(window.confirm).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Note')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete "Intro.md"\?/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(handleDeleteItem).toHaveBeenCalledWith('note-1');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not delete note when confirmation modal is cancelled', () => {
      const handleDeleteItem = vi.fn();

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

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(handleDeleteItem).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('deletes a folder when confirmed in custom modal', () => {
      const handleDeleteItem = vi.fn();

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

      expect(window.confirm).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete Folder')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete "Math"\?/)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(handleDeleteItem).toHaveBeenCalledWith('math');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('does not delete folder when confirmation modal is cancelled', () => {
      const handleDeleteItem = vi.fn();

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

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(handleDeleteItem).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('creates note directly in root folder via custom modal', () => {
      const handleCreateNote = vi.fn();

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

      const dialog = screen.getByRole('dialog');
      const input = within(dialog).getByRole('textbox');
      fireEvent.change(input, { target: { value: 'RootNote' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(handleCreateNote).toHaveBeenCalledWith('root', 'RootNote.md');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('creates folder directly in root folder via custom modal', () => {
      const handleCreateFolder = vi.fn();

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

      const dialog = screen.getByRole('dialog');
      const input = within(dialog).getByRole('textbox');
      fireEvent.change(input, { target: { value: 'RootSubfolder' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }));

      expect(handleCreateFolder).toHaveBeenCalledWith('root', 'RootSubfolder');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
