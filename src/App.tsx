import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { loadConfig, saveConfig, parseSetupHash, AppConfig } from './services/configStore';
import { GisAuthManager } from './services/gisAuth';
import { DriveService } from './services/driveService';
import { DbStore } from './services/dbStore';
import { resolveRelativePath, VirtualNode } from './services/pathResolver';
import { Sidebar, UploadItem } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { SettingsModal } from './components/SettingsModal';
import { UploadProgressModal } from './components/UploadProgressModal';
import { IosInstallBanner } from './components/IosInstallBanner';
import { Menu, Settings as SettingsIcon, LogIn, LogOut, Cloud } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(() => loadConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(!config);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<{
    isOpen: boolean;
    current: number;
    total: number;
    currentFileName: string;
    isComplete: boolean;
    errors: string[];
  }>({
    isOpen: false,
    current: 0,
    total: 0,
    currentFileName: '',
    isComplete: false,
    errors: [],
  });
  const [tree, setTree] = useState<VirtualNode>(() => ({
    id: config?.folderId || 'root',
    name: 'My Notes',
    isFolder: true,
    parentId: null,
    children: []
  }));

  const selectedNoteIdRef = useRef<string | null>(null);

  const auth = useMemo(() => new GisAuthManager(config?.clientId || ''), [config?.clientId]);
  const drive = useMemo(() => new DriveService(() => auth.getToken()), [auth]);
  const db = useMemo(() => new DbStore(), []);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(auth.getToken()));

  useEffect(() => {
    setIsAuthenticated(Boolean(auth.getToken()));
  }, [auth]);

  const nodeMap = useMemo(() => {
    const map = new Map<string, VirtualNode>();
    const traverse = (node: VirtualNode) => {
      map.set(node.id, node);
      node.children?.forEach(traverse);
    };
    traverse(tree);
    return map;
  }, [tree]);

  const loadTree = useCallback(async () => {
    if (!config?.folderId || !auth.getToken()) return;
    try {
      const fetchChildren = async (folderId: string, depth = 0): Promise<VirtualNode[]> => {
        if (depth >= 8) return [];
        const items = await drive.listChildren(folderId);
        return Promise.all(
          items.map(async (f) => {
            const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
            let children: VirtualNode[] | undefined;
            if (isFolder) {
              try {
                children = await fetchChildren(f.id, depth + 1);
              } catch {
                children = [];
              }
            }
            return {
              id: f.id,
              name: f.name,
              isFolder,
              parentId: folderId,
              children
            };
          })
        );
      };

      const children = await fetchChildren(config.folderId);
      const rootNode: VirtualNode = {
        id: config.folderId,
        name: 'My Notes',
        isFolder: true,
        parentId: null,
        children
      };
      setTree(rootNode);
    } catch (err) {
      console.error('Failed to load drive tree', err);
    }
  }, [config?.folderId, drive, auth]);

  useEffect(() => {
    if (config?.folderId) {
      loadTree();
    }
  }, [config?.folderId, loadTree]);

  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  const resolveImageBlobUrl = useCallback(
    async (src: string): Promise<string | null> => {
      if (!activeNoteId) return null;
      const currentNote = nodeMap.get(activeNoteId);
      const parentFolderId = currentNote?.parentId || config?.folderId || 'root';

      const resolved = resolveRelativePath(parentFolderId, src, nodeMap);
      if (!resolved) return null;

      if (objectUrlsRef.current.has(resolved.id)) {
        return objectUrlsRef.current.get(resolved.id)!;
      }

      const cached = await db.getImage(resolved.id);
      if (cached) {
        const url = URL.createObjectURL(cached.blob);
        objectUrlsRef.current.set(resolved.id, url);
        return url;
      }

      try {
        const blob = await drive.getFileBlob(resolved.id);
        await db.saveImage({
          fileId: resolved.id,
          blob,
          mimeType: blob.type,
          modifiedTime: new Date().toISOString()
        });
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.set(resolved.id, url);
        return url;
      } catch {
        return null;
      }
    },
    [activeNoteId, nodeMap, config?.folderId, db, drive]
  );

  const handleSelectNote = useCallback(async (noteId: string, noteName?: string, folderId?: string) => {
    selectedNoteIdRef.current = noteId;
    setActiveNoteId(noteId);
    setNoteContent(''); // Clean reset
    
    if (folderId) {
      window.location.hash = `#/${folderId}/${noteId}`;
    } else {
      window.location.hash = `#/${noteId}`;
    }

    const cached = await db.getNote(noteId);
    if (selectedNoteIdRef.current !== noteId) return;
    
    setNoteContent(cached ? cached.content : '');

    if (cached?.isDirty) {
      try {
        await drive.updateFileText(noteId, cached.content);
        await db.saveNote({ ...cached, isDirty: false });
      } catch (err) {
        console.error('Failed to sync dirty note on load', err);
      }
      return;
    }

    try {
      const remote = await drive.getFileText(noteId);
      if (selectedNoteIdRef.current !== noteId) return;
      setNoteContent(remote);
      const noteNode = nodeMap.get(noteId);
      await db.saveNote({
        fileId: noteId,
        folderId: folderId || noteNode?.parentId || '',
        name: noteName || noteNode?.name || 'Note.md',
        content: remote,
        modifiedTime: new Date().toISOString(),
        isDirty: false
      });
    } catch (err) {
      console.error('Error fetching note', err);
    }
  }, [db, drive, nodeMap]);

  useEffect(() => {
    const handleSetupHash = () => {
      const hash = window.location.hash;
      const setupConfig = parseSetupHash(hash);
      if (setupConfig) {
        const newConfig: AppConfig = {
          clientId: setupConfig.clientId,
          folderId: setupConfig.folderId,
          theme: 'dark',
        };
        saveConfig(newConfig);
        setConfig(newConfig);
        setIsSettingsOpen(false);
        if (window.history?.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } else {
          window.location.hash = '';
        }
      }
    };

    handleSetupHash();
    window.addEventListener('hashchange', handleSetupHash);
    return () => window.removeEventListener('hashchange', handleSetupHash);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      if (!isAuthenticated) return;
      const hash = window.location.hash.replace(/^#\//, '');
      if (hash && !hash.startsWith('setup?')) {
        const parts = hash.split('/');
        const noteId = parts.length === 2 ? parts[1] : parts[0];
        const folderId = parts.length === 2 ? parts[0] : undefined;
        if (noteId && noteId !== selectedNoteIdRef.current) {
          handleSelectNote(noteId, undefined, folderId);
        }
      }
    };
    
    window.addEventListener('hashchange', handleHashChange);
    if (isAuthenticated) handleHashChange();
    
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [handleSelectNote, isAuthenticated]);

  const handleSaveContent = async (content: string) => {
    if (!activeNoteId) return;
    setNoteContent(content);
    const noteNode = nodeMap.get(activeNoteId);
    await db.saveNote({
      fileId: activeNoteId,
      folderId: noteNode?.parentId || '',
      name: noteNode?.name || 'Note.md',
      content,
      modifiedTime: new Date().toISOString(),
      isDirty: true
    });
    await drive.updateFileText(activeNoteId, content);
    await db.saveNote({
      fileId: activeNoteId,
      folderId: noteNode?.parentId || '',
      name: noteNode?.name || 'Note.md',
      content,
      modifiedTime: new Date().toISOString(),
      isDirty: false
    });
  };

  const handleUploadImage = async (file: File): Promise<string> => {
    if (!activeNoteId) throw new Error('No active note');
    const currentNote = nodeMap.get(activeNoteId);
    const parentFolderId = currentNote?.parentId || config!.folderId;
    const uploaded = await drive.createFile(file.name, parentFolderId, file, file.type);
    await db.saveImage({
      fileId: uploaded.id,
      blob: file,
      mimeType: file.type,
      modifiedTime: uploaded.modifiedTime || new Date().toISOString()
    });
    await loadTree();
    return `./${file.name}`;
  };

  const handleUploadFiles = async (
    itemsToUpload: (UploadItem | File)[] | FileList,
    targetFolderId: string
  ) => {
    const rawItems = Array.from(itemsToUpload);
    if (rawItems.length === 0) return;

    const items: UploadItem[] = rawItems.map((item) => {
      if ('file' in item && typeof (item as any).relativePath === 'string') {
        return item as UploadItem;
      }
      const file = item as File;
      return {
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
      };
    });

    setUploadProgress({
      isOpen: true,
      current: 0,
      total: items.length,
      currentFileName: items[0].relativePath,
      isComplete: false,
      errors: [],
    });

    const errors: string[] = [];
    const folderCache = new Map<string, string>();

    const resolveDestinationFolder = async (relativePath: string): Promise<string> => {
      const parts = relativePath.split('/').filter(Boolean);
      if (parts.length <= 1) {
        return targetFolderId;
      }
      const dirParts = parts.slice(0, -1);
      let currentParentId = targetFolderId;
      let currentAccumPath = '';

      for (const segment of dirParts) {
        currentAccumPath = currentAccumPath ? `${currentAccumPath}/${segment}` : segment;
        if (folderCache.has(currentAccumPath)) {
          currentParentId = folderCache.get(currentAccumPath)!;
          continue;
        }

        try {
          const children = await drive.listChildren(currentParentId);
          const existing = children.find(
            (c) => c.name.toLowerCase() === segment.toLowerCase() && c.mimeType === 'application/vnd.google-apps.folder'
          );
          if (existing) {
            currentParentId = existing.id;
            folderCache.set(currentAccumPath, existing.id);
            continue;
          }
        } catch {
          // Ignore and proceed to create
        }

        const createdFolder = await drive.createFolder(segment, currentParentId);
        currentParentId = createdFolder.id;
        folderCache.set(currentAccumPath, createdFolder.id);
      }

      return currentParentId;
    };

    for (let i = 0; i < items.length; i++) {
      const { file, relativePath } = items[i];
      setUploadProgress((prev) => ({
        ...prev,
        current: i,
        currentFileName: relativePath,
      }));

      try {
        const destFolderId = await resolveDestinationFolder(relativePath);
        const fileName = file.name;
        const isImage = file.type.startsWith('image/');
        const isMarkdown = fileName.endsWith('.md') || file.type === 'text/markdown' || fileName.endsWith('.txt');

        if (isImage) {
          const uploaded = await drive.createFile(fileName, destFolderId, file, file.type);
          await db.saveImage({
            fileId: uploaded.id,
            blob: file,
            mimeType: file.type,
            modifiedTime: uploaded.modifiedTime || new Date().toISOString(),
          });
        } else if (isMarkdown) {
          const text = typeof file.text === 'function' ? await file.text() : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsText(file);
          });
          const uploaded = await drive.createFile(fileName, destFolderId, text, 'text/markdown');
          await db.saveNote({
            fileId: uploaded.id,
            folderId: destFolderId,
            name: fileName,
            content: text,
            modifiedTime: uploaded.modifiedTime || new Date().toISOString(),
            isDirty: false,
          });
        } else {
          await drive.createFile(fileName, destFolderId, file, file.type || 'application/octet-stream');
        }
      } catch (err: any) {
        console.error(`Failed to upload ${relativePath}:`, err);
        errors.push(`${relativePath}: ${err?.message || 'Upload failed'}`);
      }

      setUploadProgress((prev) => ({
        ...prev,
        current: i + 1,
        errors: [...errors],
      }));
    }

    setUploadProgress((prev) => ({
      ...prev,
      current: items.length,
      isComplete: true,
      errors,
    }));

    await loadTree();
  };

  const handleDisconnect = () => {
    selectedNoteIdRef.current = null;
    auth.signOut();
    setIsAuthenticated(false);
    setTree({
      id: config?.folderId || 'root',
      name: 'My Notes',
      isFolder: true,
      parentId: null,
      children: []
    });
    setActiveNoteId(null);
    setNoteContent('');
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
    window.location.hash = '';
  };

  const activeNote = activeNoteId ? nodeMap.get(activeNoteId) : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Navigation */}
      <header className="h-14 border-b border-slate-800 px-4 flex items-center justify-between bg-slate-950 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle sidebar"
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 text-indigo-400 font-bold tracking-wide">
            <Cloud size={20} />
            <span>MDCloud</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleDisconnect}
              className="px-2.5 py-1 text-xs text-slate-400 hover:text-white flex items-center gap-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
            >
              <LogOut size={14} /> Disconnect
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                try {
                  await auth.requestToken();
                  setIsAuthenticated(Boolean(auth.getToken()));
                  loadTree();
                } catch (err) {
                  console.error('Sign-in failed', err);
                }
              }}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogIn size={14} /> Sign in with Google
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Settings"
            aria-label="Settings"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </header>

      {/* Main Workspace & Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          tree={tree}
          selectedFileId={activeNoteId}
          onSelectNote={handleSelectNote}
          onCreateNote={async (folderId, name) => {
            const file = await drive.createFile(name, folderId, '# ' + name, 'text/markdown');
            await db.saveNote({
              fileId: file.id,
              folderId,
              name,
              content: '# ' + name,
              modifiedTime: file.modifiedTime || new Date().toISOString(),
              isDirty: false
            });
            await loadTree();
            handleSelectNote(file.id, name, folderId);
          }}
          onCreateFolder={async (parentId, name) => {
            await drive.createFolder(name, parentId);
            await loadTree();
          }}
          onDeleteItem={async (id) => {
            await drive.deleteItem(id);
            if (activeNoteId === id) {
              selectedNoteIdRef.current = null;
              setActiveNoteId(null);
              setNoteContent('');
            }
            await loadTree();
          }}
          onUploadFiles={handleUploadFiles}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 h-full overflow-hidden">
          {activeNote ? (
            <Workspace
              key={activeNote.id}
              noteTitle={activeNote.name}
              initialContent={noteContent}
              currentFolderId={activeNote.parentId || 'root'}
              onSaveContent={handleSaveContent}
              onUploadImage={handleUploadImage}
              resolveImageBlobUrl={resolveImageBlobUrl}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 p-6 text-center">
              <Cloud size={48} className="mb-3 text-slate-600 animate-pulse" />
              <p className="text-base font-medium text-slate-400">Select or create a markdown note</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Your notes and figures in Google Drive are automatically synced across all your devices.
              </p>
            </div>
          )}
        </main>
      </div>

      <IosInstallBanner />

      <UploadProgressModal
        isOpen={uploadProgress.isOpen}
        current={uploadProgress.current}
        total={uploadProgress.total}
        currentFileName={uploadProgress.currentFileName}
        isComplete={uploadProgress.isComplete}
        errors={uploadProgress.errors}
        onClose={() => setUploadProgress((prev) => ({ ...prev, isOpen: false }))}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        currentConfig={config}
        onSaveConfig={(newConfig) => {
          saveConfig(newConfig);
          setConfig(newConfig);
          auth.updateClientId(newConfig.clientId);
          setIsSettingsOpen(false);
          loadTree();
        }}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
