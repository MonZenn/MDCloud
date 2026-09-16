import { useState, useEffect, useMemo, useCallback } from 'react';
import { loadConfig, saveConfig, AppConfig } from './services/configStore';
import { GisAuthManager } from './services/gisAuth';
import { DriveService } from './services/driveService';
import { DbStore } from './services/dbStore';
import { resolveRelativePath, VirtualNode } from './services/pathResolver';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { SettingsModal } from './components/SettingsModal';
import { IosInstallBanner } from './components/IosInstallBanner';
import { Menu, Settings as SettingsIcon, LogIn, LogOut, Cloud } from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(() => loadConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(!config);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<string>('');
  const [tree, setTree] = useState<VirtualNode>(() => ({
    id: config?.folderId || 'root',
    name: 'My Notes',
    isFolder: true,
    parentId: null,
    children: []
  }));

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
      const fetchChildren = async (folderId: string): Promise<VirtualNode[]> => {
        const items = await drive.listChildren(folderId);
        return Promise.all(
          items.map(async (f) => {
            const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
            let children: VirtualNode[] | undefined;
            if (isFolder) {
              try {
                children = await fetchChildren(f.id);
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

  const resolveImageBlobUrl = useCallback(
    async (src: string): Promise<string | null> => {
      if (!activeNoteId) return null;
      const currentNote = nodeMap.get(activeNoteId);
      const parentFolderId = currentNote?.parentId || config?.folderId || 'root';

      const resolved = resolveRelativePath(parentFolderId, src, nodeMap);
      if (!resolved) return null;

      const cached = await db.getImage(resolved.id);
      if (cached) return URL.createObjectURL(cached.blob);

      try {
        const blob = await drive.getFileBlob(resolved.id);
        await db.saveImage({
          fileId: resolved.id,
          blob,
          mimeType: blob.type,
          modifiedTime: new Date().toISOString()
        });
        return URL.createObjectURL(blob);
      } catch {
        return null;
      }
    },
    [activeNoteId, nodeMap, config?.folderId, db, drive]
  );

  const handleSelectNote = async (noteId: string) => {
    setActiveNoteId(noteId);
    const cached = await db.getNote(noteId);
    if (cached) {
      setNoteContent(cached.content);
    }
    try {
      const remote = await drive.getFileText(noteId);
      setNoteContent(remote);
      const noteNode = nodeMap.get(noteId);
      await db.saveNote({
        fileId: noteId,
        folderId: noteNode?.parentId || '',
        name: noteNode?.name || 'Note.md',
        content: remote,
        modifiedTime: new Date().toISOString(),
        isDirty: false
      });
    } catch (err) {
      console.error('Error fetching note', err);
    }
  };

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

  const handleDisconnect = () => {
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
            handleSelectNote(file.id);
          }}
          onCreateFolder={async (parentId, name) => {
            await drive.createFolder(name, parentId);
            await loadTree();
          }}
          onDeleteItem={async (id) => {
            await drive.deleteItem(id);
            if (activeNoteId === id) {
              setActiveNoteId(null);
              setNoteContent('');
            }
            await loadTree();
          }}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 h-full overflow-hidden">
          {activeNote ? (
            <Workspace
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
