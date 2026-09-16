import React, { useState, useEffect } from 'react';
import { AppConfig, parseFolderId } from '../services/configStore';
import { Settings, X, KeyRound, FolderOpen } from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  currentConfig: AppConfig | null;
  onSaveConfig: (config: AppConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentConfig,
  onSaveConfig,
  onClose,
}) => {
  const [clientId, setClientId] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentConfig) {
      setClientId(currentConfig.clientId);
      setFolderInput(currentConfig.folderUrl || currentConfig.folderId);
    }
  }, [currentConfig]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClientId = clientId.trim();
    const cleanFolderInput = folderInput.trim();
    const folderId = parseFolderId(cleanFolderInput);

    if (!cleanClientId) {
      setError('Please enter your Google OAuth Client ID');
      return;
    }
    if (!folderId) {
      setError('Please enter your Google Drive folder link or ID');
      return;
    }

    onSaveConfig({
      clientId: cleanClientId,
      folderId,
      folderUrl: cleanFolderInput,
      theme: 'dark',
    });
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold">
            <Settings size={18} />
            <span className="text-white">Google Drive Connection Settings</span>
          </div>
          {currentConfig && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            MDCloud stores all credentials directly in your browser&apos;s local storage. Zero secrets or personal
            identifiers are ever uploaded to GitHub.
          </p>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <KeyRound size={14} className="text-indigo-400" /> Google OAuth 2.0 Web Client ID
            </label>
            <input
              type="text"
              required
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. 123456789-abcdef.apps.googleusercontent.com"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
              <FolderOpen size={14} className="text-amber-400" /> Google Drive Notes Folder Link or ID
            </label>
            <input
              type="text"
              required
              value={folderInput}
              onChange={(e) => {
                setFolderInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. https://drive.google.com/drive/folders/1aBcD..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {error && (
            <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded border border-rose-800">
              {error}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition-colors cursor-pointer"
            >
              Save & Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
