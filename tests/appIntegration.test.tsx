import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import App from '../src/App';
import { GisAuthManager } from '../src/services/gisAuth';
import { DriveService } from '../src/services/driveService';
import { DbStore } from '../src/services/dbStore';
import { saveConfig } from '../src/services/configStore';

// Mock mermaid to prevent errors in jsdom
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockImplementation(async (_id: string, chart: string) => {
      return { svg: `<svg data-testid="mermaid-svg"><text>${chart}</text></svg>` };
    })
  }
}));

globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
globalThis.URL.revokeObjectURL = vi.fn();
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = globalThis.URL.createObjectURL;
  window.URL.revokeObjectURL = globalThis.URL.revokeObjectURL;
}

describe('App Root Integration', () => {
  const db = new DbStore();

  beforeEach(async () => {
    localStorage.clear();
    await db.init();
    await db.clearAll();
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    globalThis.URL.revokeObjectURL = vi.fn();
    if (typeof window !== 'undefined') {
      window.URL.createObjectURL = globalThis.URL.createObjectURL;
      window.URL.revokeObjectURL = globalThis.URL.revokeObjectURL;
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing and displays setup modal when unconfigured', () => {
    render(<App />);
    expect(screen.getByText(/Google Drive Connection Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/MDCloud stores all credentials directly in your browser/i)).toBeInTheDocument();
  });

  it('allows user to configure Google Drive credentials and saves to storage', async () => {
    render(<App />);

    const clientInput = screen.getByPlaceholderText(/e.g. 123456789-abcdef.apps.googleusercontent.com/i);
    const folderInput = screen.getByPlaceholderText(/e.g. https:\/\/drive.google.com\/drive\/folders\/1aBcD.../i);
    const saveButton = screen.getByRole('button', { name: /Save & Connect/i });

    fireEvent.change(clientInput, { target: { value: 'client-123.apps.googleusercontent.com' } });
    fireEvent.change(folderInput, { target: { value: 'https://drive.google.com/drive/folders/folder-abc' } });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.queryByText(/Google Drive Connection Settings/i)).not.toBeInTheDocument();
    });

    const stored = localStorage.getItem('mdcloud_app_config');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.clientId).toBe('client-123.apps.googleusercontent.com');
    expect(parsed.folderId).toBe('folder-abc');
  });

  it('displays notes tree in configured state and selects a note', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([
      {
        id: 'note-1',
        name: 'Calculus.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      }
    ]);
    vi.spyOn(DriveService.prototype, 'getFileText').mockResolvedValue('# Calculus Lecture 1\n\nNotes on derivatives.');

    render(<App />);

    // Notes tree should be loaded in sidebar
    const noteItem = await screen.findByText('Calculus.md');
    expect(noteItem).toBeInTheDocument();

    // Select the note
    fireEvent.click(noteItem);

    // Workspace should render note title and remote content
    await waitFor(() => {
      expect(screen.getByText('Calculus Lecture 1')).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue(/# Calculus Lecture 1/)).toBeInTheDocument();

    // Verify DbStore cached the note
    const cached = await db.getNote('note-1');
    expect(cached).toBeDefined();
    expect(cached?.content).toContain('# Calculus Lecture 1');
  });

  it('loads note from DbStore cache first, then updates from remote DriveService', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    // Seed local cache with older content
    await db.saveNote({
      fileId: 'note-cached',
      folderId: 'folder-root',
      name: 'CachedNote.md',
      content: '# Initial Cached Content',
      modifiedTime: '2026-09-15T00:00:00Z',
      isDirty: false
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([
      {
        id: 'note-cached',
        name: 'CachedNote.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      }
    ]);

    let resolveRemote: (val: string) => void;
    const remotePromise = new Promise<string>((resolve) => {
      resolveRemote = resolve;
    });
    vi.spyOn(DriveService.prototype, 'getFileText').mockReturnValue(remotePromise);

    render(<App />);

    const noteItem = await screen.findByText('CachedNote.md');
    fireEvent.click(noteItem);

    // Cached content should be shown immediately
    await waitFor(() => {
      expect(screen.getByDisplayValue('# Initial Cached Content')).toBeInTheDocument();
    });

    // Resolve remote content
    await act(async () => {
      resolveRemote!('# Fresh Remote Content');
    });

    // Workspace should now reflect the updated remote content
    await waitFor(() => {
      expect(screen.getByDisplayValue('# Fresh Remote Content')).toBeInTheDocument();
    });

    // Cache should be updated with new remote content
    const updatedCache = await db.getNote('note-cached');
    expect(updatedCache?.content).toBe('# Fresh Remote Content');
  });

  it('saves note content to DbStore and calls DriveService to update remote note', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([
      {
        id: 'note-save-test',
        name: 'SaveTest.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      }
    ]);
    vi.spyOn(DriveService.prototype, 'getFileText').mockResolvedValue('# Initial Content');
    const updateSpy = vi.spyOn(DriveService.prototype, 'updateFileText').mockResolvedValue({
      id: 'note-save-test',
      name: 'SaveTest.md',
      mimeType: 'text/markdown',
      modifiedTime: '2026-09-16T12:05:00Z'
    });

    render(<App />);

    const noteItem = await screen.findByText('SaveTest.md');
    fireEvent.click(noteItem);

    const textarea = await screen.findByPlaceholderText('Write your markdown note here...');
    await waitFor(() => {
      expect(textarea).toHaveValue('# Initial Content');
    });

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // User edits note
    fireEvent.change(textarea, { target: { value: '# Initial Content - Edited by User' } });
    expect(screen.getByText('Saving...')).toBeInTheDocument();

    // Advance timers for 1500ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    vi.useRealTimers();

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('note-save-test', '# Initial Content - Edited by User');
    });
    await waitFor(() => {
      expect(screen.getByText('Saved to Drive')).toBeInTheDocument();
    });

    // Check DbStore
    const saved = await db.getNote('note-save-test');
    expect(saved?.content).toBe('# Initial Content - Edited by User');
    expect(saved?.isDirty).toBe(false);
  });

  it('opens and closes settings modal in configured state', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([]);

    render(<App />);

    // Initially settings modal is closed
    expect(screen.queryByText(/Google Drive Connection Settings/i)).not.toBeInTheDocument();

    // Click Settings button in header
    const settingsBtn = screen.getByRole('button', { name: /settings/i });
    await act(async () => {
      fireEvent.click(settingsBtn);
    });

    // Modal should now be open
    expect(screen.getByText(/Google Drive Connection Settings/i)).toBeInTheDocument();

    // Close settings modal
    const closeBtn = screen.getByRole('button', { name: /close settings/i });
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(screen.queryByText(/Google Drive Connection Settings/i)).not.toBeInTheDocument();
  });

  it('handles disconnect / sign out correctly', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    let token: string | null = 'mock-token';
    vi.spyOn(GisAuthManager.prototype, 'getToken').mockImplementation(() => token);
    const signOutSpy = vi.spyOn(GisAuthManager.prototype, 'signOut').mockImplementation(() => {
      token = null;
    });
    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([
      {
        id: 'note-1',
        name: 'PrivateNote.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      }
    ]);
    vi.spyOn(DriveService.prototype, 'getFileText').mockResolvedValue('# Private Note');

    render(<App />);

    // Disconnect button should be visible when authenticated
    const disconnectBtn = await screen.findByRole('button', { name: /disconnect/i });
    expect(disconnectBtn).toBeInTheDocument();

    // Select note
    const note = await screen.findByText('PrivateNote.md');
    fireEvent.click(note);
    await screen.findByText('Private Note');

    // Click Disconnect
    await act(async () => {
      fireEvent.click(disconnectBtn);
    });

    expect(signOutSpy).toHaveBeenCalledTimes(1);

    // Header should now show Sign in with Google
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });

    // Workspace should reset to empty placeholder
    expect(screen.getByText(/Select or create a markdown note/i)).toBeInTheDocument();
  });

  it('handles sign in with Google when unauthenticated', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    let token: string | null = null;
    vi.spyOn(GisAuthManager.prototype, 'getToken').mockImplementation(() => token);
    const requestTokenSpy = vi.spyOn(GisAuthManager.prototype, 'requestToken').mockImplementation(async () => {
      token = 'newly-granted-token';
      return 'newly-granted-token';
    });
    const listSpy = vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([]);

    render(<App />);

    const signInBtn = screen.getByRole('button', { name: /sign in with google/i });
    expect(signInBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(signInBtn);
    });

    expect(requestTokenSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument();
    });
  });

  it('toggles sidebar visibility using top navigation button', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([]);

    render(<App />);

    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar).toHaveClass('w-64');

    const toggleBtn = screen.getByRole('button', { name: /toggle sidebar/i });
    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(sidebar).toHaveClass('w-0');

    await act(async () => {
      fireEvent.click(toggleBtn);
    });
    expect(sidebar).toHaveClass('w-64');
  });

  it('handles image upload to Google Drive, caches in DbStore, and resolves relative image blob URLs', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    const items = [
      {
        id: 'note-img-test',
        name: 'FigTest.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      },
      {
        id: 'img-file-1',
        name: 'chart.png',
        mimeType: 'image/png',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      }
    ];

    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue(items);
    vi.spyOn(DriveService.prototype, 'getFileText').mockResolvedValue('# Analysis\n\n![Chart](./chart.png)');

    const testBlob = new Blob(['image-binary-data'], { type: 'image/png' });
    const getBlobSpy = vi.spyOn(DriveService.prototype, 'getFileBlob').mockResolvedValue(testBlob);
    const createFileSpy = vi.spyOn(DriveService.prototype, 'createFile').mockResolvedValue({
      id: 'img-uploaded-2',
      name: 'diagram.png',
      mimeType: 'image/png',
      modifiedTime: '2026-09-16T12:05:00Z',
      parents: ['folder-root']
    });

    render(<App />);

    const note = await screen.findByText('FigTest.md');
    await act(async () => {
      fireEvent.click(note);
    });

    await screen.findByText('Analysis');

    // 1. Verify relative image resolution from DriveService and caching in DbStore
    await waitFor(() => {
      expect(getBlobSpy).toHaveBeenCalledWith('img-file-1');
    });
    const renderedImg = await screen.findByRole('img', { name: 'Chart' });
    expect(renderedImg).toBeInTheDocument();

    // Verify cached in DbStore
    const cachedChart = await db.getImage('img-file-1');
    expect(cachedChart).toBeDefined();

    // 2. Verify image upload
    const fileInput = screen.getByTestId('file-upload-input');
    const newImageFile = new File(['diagram-bytes'], 'diagram.png', { type: 'image/png' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [newImageFile] } });
    });

    expect(createFileSpy).toHaveBeenCalledWith('diagram.png', 'folder-root', newImageFile, 'image/png');
    const cachedUpload = await db.getImage('img-uploaded-2');
    expect(cachedUpload).toBeDefined();
    expect(cachedUpload?.mimeType).toBe('image/png');
  });

  it('creates and deletes notes via sidebar', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    let items = [
      {
        id: 'note-existing',
        name: 'Existing.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      }
    ];

    vi.spyOn(DriveService.prototype, 'listChildren').mockImplementation(async () => items);
    const createFileSpy = vi.spyOn(DriveService.prototype, 'createFile').mockImplementation(async (name, parentId) => {
      const newFile = {
        id: 'note-created',
        name,
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:10:00Z',
        parents: [parentId]
      };
      items.push(newFile);
      return newFile;
    });
    vi.spyOn(DriveService.prototype, 'getFileText').mockResolvedValue('# New Note');
    const deleteSpy = vi.spyOn(DriveService.prototype, 'deleteItem').mockImplementation(async (id) => {
      items = items.filter((i) => i.id !== id);
    });

    render(<App />);

    await screen.findByText('Existing.md');

    // Create note via custom PromptModal
    const newNoteBtn = screen.getByRole('button', { name: /New Note in My Notes/i });
    await act(async () => {
      fireEvent.click(newNoteBtn);
    });

    const promptDialog = screen.getByRole('dialog');
    const input = within(promptDialog).getByRole('textbox');
    fireEvent.change(input, { target: { value: 'NewNote.md' } });
    await act(async () => {
      fireEvent.click(within(promptDialog).getByRole('button', { name: 'Create' }));
    });

    expect(createFileSpy).toHaveBeenCalledWith('NewNote.md', 'folder-root', '# NewNote.md', 'text/markdown');
    const sidebar = screen.getByTestId('sidebar');
    await waitFor(() => {
      expect(within(sidebar).getByText('NewNote.md')).toBeInTheDocument();
    });

    // Delete note via custom ConfirmModal
    const deleteBtn = within(sidebar).getByRole('button', { name: /Delete Existing.md/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    const confirmDialog = screen.getByRole('dialog');
    await act(async () => {
      fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));
    });

    expect(deleteSpy).toHaveBeenCalledWith('note-existing');
    await waitFor(() => {
      expect(within(sidebar).queryByText('Existing.md')).not.toBeInTheDocument();
    });
  });

  it('guards against race conditions and resets content when switching notes rapidly', async () => {
    saveConfig({
      clientId: 'mock-client-id',
      folderId: 'folder-root',
      theme: 'dark'
    });

    vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
    const items = [
      {
        id: 'note-slow',
        name: 'SlowNote.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      },
      {
        id: 'note-fast',
        name: 'FastNote.md',
        mimeType: 'text/markdown',
        modifiedTime: '2026-09-16T12:00:00Z',
        parents: ['folder-root']
      }
    ];

    vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue(items);

    let resolveSlow: (val: string) => void;
    const slowPromise = new Promise<string>((resolve) => {
      resolveSlow = resolve;
    });

    vi.spyOn(DriveService.prototype, 'getFileText').mockImplementation(async (id) => {
      if (id === 'note-slow') return slowPromise;
      return '# Fast Note Content';
    });

    render(<App />);

    const slowNote = await screen.findByText('SlowNote.md');
    const fastNote = await screen.findByText('FastNote.md');

    // Click slow note first
    await act(async () => {
      fireEvent.click(slowNote);
    });

    // Content should immediately be empty while slow note is fetching
    const textarea = await screen.findByPlaceholderText('Write your markdown note here...');
    expect(textarea).toHaveValue('');

    // Quickly switch to fast note before slow note resolves
    await act(async () => {
      fireEvent.click(fastNote);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('# Fast Note Content')).toBeInTheDocument();
    });

    // Now slow note's promise resolves late
    await act(async () => {
      resolveSlow!('# Stale Slow Note Content');
    });

    // The fast note should STILL be displayed; slow note response must be discarded
    expect(screen.getByDisplayValue('# Fast Note Content')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('# Stale Slow Note Content')).not.toBeInTheDocument();
  });

  describe('Routing and Offline Edits', () => {
    it('preserves offline edits and syncs them when selecting a dirty note', async () => {
      saveConfig({ clientId: 'mock-client-id', folderId: 'folder-root', theme: 'dark' });
      vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
      vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([{
        id: 'note-dirty', name: 'Dirty.md', mimeType: 'text/markdown', modifiedTime: '2026-09-16T12:00:00Z', parents: ['folder-root']
      }]);
      
      const updateFileTextSpy = vi.spyOn(DriveService.prototype, 'updateFileText').mockResolvedValue({} as any);
      
      await db.saveNote({
        fileId: 'note-dirty',
        folderId: 'folder-root',
        name: 'Dirty.md',
        content: 'Local dirty content',
        modifiedTime: '2026-09-16T12:05:00Z',
        isDirty: true
      });
      
      render(<App />);
      
      const dirtyNote = await screen.findByText('Dirty.md');
      await act(async () => {
        fireEvent.click(dirtyNote);
      });
      
      expect(await screen.findByDisplayValue('Local dirty content')).toBeInTheDocument();
      await waitFor(() => {
        expect(updateFileTextSpy).toHaveBeenCalledWith('note-dirty', 'Local dirty content');
      });
      
      const cached = await db.getNote('note-dirty');
      expect(cached?.isDirty).toBe(false);
    });

    it('navigates to note on initial hash load', async () => {
      saveConfig({ clientId: 'mock-client-id', folderId: 'folder-root', theme: 'dark' });
      vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
      vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([{
        id: 'note-hash', name: 'Hash.md', mimeType: 'text/markdown', modifiedTime: '2026-09-16T12:00:00Z', parents: ['folder-root']
      }]);
      vi.spyOn(DriveService.prototype, 'getFileText').mockResolvedValue('Hash loaded content');
      
      window.location.hash = '#/folder-root/note-hash';
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('Hash loaded content')).toBeInTheDocument();
      });
    });

    it('navigates to note on hashchange event', async () => {
      saveConfig({ clientId: 'mock-client-id', folderId: 'folder-root', theme: 'dark' });
      vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
      vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([{
        id: 'note-changed', name: 'Changed.md', mimeType: 'text/markdown', modifiedTime: '2026-09-16T12:00:00Z', parents: ['folder-root']
      }]);
      
      const getFileTextSpy = vi.spyOn(DriveService.prototype, 'getFileText').mockResolvedValue('Content for changed hash');
      
      window.location.hash = ''; // Clear hash from previous test
      
      render(<App />);
      
      await act(async () => {
        window.location.hash = '#/folder-root/note-changed';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });
      
      await waitFor(() => {
        expect(getFileTextSpy).toHaveBeenCalledWith('note-changed');
        expect(screen.getByDisplayValue('Content for changed hash')).toBeInTheDocument();
      });
    });

    it('supports bulk uploading markdown files and images with progress modal and IndexedDB caching', async () => {
      saveConfig({ clientId: 'mock-client-id', folderId: 'folder-root', theme: 'dark' });
      vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
      vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([]);

      const createFileSpy = vi.spyOn(DriveService.prototype, 'createFile')
        .mockImplementation(async (name: string, folderId: string, _content: string | Blob, mimeType: string) => {
          return {
            id: `id-${name}`,
            name,
            mimeType,
            modifiedTime: '2026-09-17T08:00:00Z',
            parents: [folderId],
          };
        });

      render(<App />);

      // Find file input in sidebar
      const fileInput = await screen.findByTestId('sidebar-file-upload-input');

      const mdFile = new File(['# Bulk Note 1 Content'], 'Bulk1.md', { type: 'text/markdown' });
      const imgFile = new File(['image-bytes'], 'figure1.png', { type: 'image/png' });

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [mdFile, imgFile] } });
      });

      // Upload progress modal appears and completes
      const modalHeader = await screen.findByText(/Upload complete/i);
      expect(modalHeader).toBeInTheDocument();
      expect(screen.getByText(/2 of 2 files uploaded successfully/i)).toBeInTheDocument();

      // Verify drive service was called for both
      expect(createFileSpy).toHaveBeenCalledWith('Bulk1.md', 'folder-root', '# Bulk Note 1 Content', 'text/markdown');
      expect(createFileSpy).toHaveBeenCalledWith('figure1.png', 'folder-root', imgFile, 'image/png');

      // Verify IndexedDB was populated
      const cachedNote = await db.getNote('id-Bulk1.md');
      expect(cachedNote).toBeTruthy();
      expect(cachedNote?.content).toBe('# Bulk Note 1 Content');

      const cachedImage = await db.getImage('id-figure1.png');
      expect(cachedImage).toBeTruthy();
      expect(cachedImage?.fileId).toBe('id-figure1.png');

      // Close modal
      const doneBtn = screen.getByRole('button', { name: /Done/i });
      fireEvent.click(doneBtn);
      await waitFor(() => {
        expect(screen.queryByText(/Upload complete/i)).not.toBeInTheDocument();
      });
    });

    it('supports uploading nested folders containing images, auto-creating Drive subfolders and caching in IndexedDB', async () => {
      saveConfig({ clientId: 'mock-client-id', folderId: 'folder-root', theme: 'dark' });
      vi.spyOn(GisAuthManager.prototype, 'getToken').mockReturnValue('valid-token');
      vi.spyOn(DriveService.prototype, 'listChildren').mockResolvedValue([]);

      const createFolderSpy = vi.spyOn(DriveService.prototype, 'createFolder')
        .mockResolvedValue({
          id: 'folder-figures-id',
          name: 'figures',
          mimeType: 'application/vnd.google-apps.folder',
          modifiedTime: '2026-09-17T08:00:00Z',
          parents: ['folder-root'],
        });

      const createFileSpy = vi.spyOn(DriveService.prototype, 'createFile')
        .mockImplementation(async (name: string, folderId: string, _content: string | Blob, mimeType: string) => {
          return {
            id: `id-${name}`,
            name,
            mimeType,
            modifiedTime: '2026-09-17T08:00:00Z',
            parents: [folderId],
          };
        });

      render(<App />);

      const folderInput = await screen.findByTestId('sidebar-folder-upload-input');

      const plotFile = new File(['plot-data'], 'plot1.png', { type: 'image/png' });
      Object.defineProperty(plotFile, 'webkitRelativePath', {
        value: 'figures/plot1.png',
        writable: false,
      });

      await act(async () => {
        fireEvent.change(folderInput, { target: { files: [plotFile] } });
      });

      // Modal finishes
      const modalHeader = await screen.findByText(/Upload complete/i);
      expect(modalHeader).toBeInTheDocument();

      // Subfolder was created in Google Drive
      expect(createFolderSpy).toHaveBeenCalledWith('figures', 'folder-root');

      // File was uploaded into the subfolder
      expect(createFileSpy).toHaveBeenCalledWith('plot1.png', 'folder-figures-id', plotFile, 'image/png');

      // Image was cached in IndexedDB
      const cachedImage = await db.getImage('id-plot1.png');
      expect(cachedImage).toBeTruthy();
      expect(cachedImage?.fileId).toBe('id-plot1.png');
    });
  });
});
