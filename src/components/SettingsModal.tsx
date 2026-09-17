import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  AppConfig,
  parseFolderId,
  sanitizeClientId,
  isValidWebClientId,
  encodeConfigToSetupHash,
} from '../services/configStore';
import { Settings, X, KeyRound, FolderOpen, QrCode, Copy, Check, Info, Smartphone } from 'lucide-react';

export interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: 'credentials' | 'sync';
  currentConfig: AppConfig | null;
  onSaveConfig: (config: AppConfig) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = 'credentials',
  currentConfig,
  onSaveConfig,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'credentials' | 'sync'>(initialTab);
  const [clientId, setClientId] = useState('');
  const [folderInput, setFolderInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (currentConfig) {
      setClientId(currentConfig.clientId);
      setFolderInput(currentConfig.folderUrl || currentConfig.folderId);
    }
  }, [currentConfig]);

  // Generate QR Code when sync tab is selected
  useEffect(() => {
    const activeClientId = sanitizeClientId(clientId || currentConfig?.clientId || '');
    const activeFolderId = parseFolderId(folderInput || currentConfig?.folderId || '');

    if (activeClientId && activeFolderId && typeof window !== 'undefined') {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const hash = encodeConfigToSetupHash({ clientId: activeClientId, folderId: activeFolderId });
      const fullUrl = `${origin}${pathname}${hash}`;

      QRCode.toString(fullUrl, {
        type: 'svg',
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then((svg) => setQrSvg(svg))
        .catch(() => setQrSvg(''));
    } else {
      setQrSvg('');
    }
  }, [activeTab, clientId, folderInput, currentConfig]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanClientId = sanitizeClientId(clientId);
    const cleanFolderInput = folderInput.trim();
    const folderId = parseFolderId(cleanFolderInput);

    if (!cleanClientId) {
      setError('Please enter your Google OAuth Client ID');
      return;
    }
    if (cleanClientId.includes('@') && !cleanClientId.includes('.apps.googleusercontent.com')) {
      setError('Please enter your Google OAuth Client ID (ending in .apps.googleusercontent.com), not your email address.');
      return;
    }
    if (!folderId) {
      setError('Please enter your Google Drive folder link or ID');
      return;
    }
    if (!cleanClientId.toLowerCase().endsWith('.apps.googleusercontent.com')) {
      setError('Invalid Client ID: Must end with .apps.googleusercontent.com. If using iPhone/iPad, use your Web Application Client ID (not an iOS client ID).');
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

  const handleCopySetupLink = () => {
    const activeClientId = sanitizeClientId(clientId || currentConfig?.clientId || '');
    const activeFolderId = parseFolderId(folderInput || currentConfig?.folderId || '');
    if (!activeClientId || !activeFolderId || typeof window === 'undefined') return;

    const fullUrl = `${window.location.origin}${window.location.pathname}${encodeConfigToSetupHash({
      clientId: activeClientId,
      folderId: activeFolderId,
    })}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const hasValidConfigForSync = Boolean(
    (currentConfig?.clientId && currentConfig?.folderId) ||
    (sanitizeClientId(clientId) && parseFolderId(folderInput))
  );

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

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-slate-950/50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('credentials')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'credentials'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound size={14} /> Credentials
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sync')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sync'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone size={14} /> Sync to Mobile
          </button>
        </div>

        {activeTab === 'credentials' ? (
          /* Credentials Form */
          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <p className="text-xs text-slate-400 leading-relaxed">
              MDCloud stores all credentials directly in your browser&apos;s local storage. Zero secrets or personal
              identifiers are ever uploaded to GitHub.
            </p>

            {/* Mobile / iOS guidance tip */}
            <div className="flex items-start gap-2.5 bg-indigo-950/40 border border-indigo-800/60 rounded-lg p-3 text-xs text-indigo-200 leading-relaxed">
              <Info size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-indigo-300">Using iPhone or iPad?</span>
                <span className="text-slate-300"> MDCloud is a Web App (PWA). You must use the </span>
                <span className="text-indigo-200 font-semibold">exact same Web Application Client ID</span>
                <span className="text-slate-300"> as your Mac. Do </span>
                <span className="text-rose-300 font-semibold">not</span>
                <span className="text-slate-300"> create an &quot;iOS&quot; client ID in Google Cloud Console. Or simply switch to the </span>
                <span className="text-indigo-300 font-medium cursor-pointer underline" onClick={() => setActiveTab('sync')}>
                  Sync to Mobile tab
                </span>
                <span className="text-slate-300"> to scan a QR code.</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <KeyRound size={14} className="text-indigo-400" /> Google OAuth 2.0 Web Client ID
                </label>
                {clientId && (
                  <span className={`text-[10px] font-medium ${isValidWebClientId(clientId) ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isValidWebClientId(clientId) ? '✓ Valid format' : 'Ending in .apps.googleusercontent.com'}
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
        ) : (
          /* Sync to Mobile Tab */
          <div className="p-6 flex flex-col items-center gap-4 text-center">
            {hasValidConfigForSync ? (
              <>
                <p className="text-xs text-slate-300 max-w-sm">
                  Scan this QR code with the <strong className="text-white">Camera app</strong> on your iPhone or iPad to open MDCloud and sync your credentials with zero typing:
                </p>

                {qrSvg ? (
                  <div
                    className="p-3 bg-white rounded-xl shadow-lg border border-slate-700 w-52 h-52 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  <div className="w-52 h-52 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center text-slate-500 text-xs">
                    Generating QR code...
                  </div>
                )}

                <div className="w-full flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCopySetupLink}
                    className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {copied ? 'Setup Link Copied to Clipboard!' : 'Copy Mobile Setup Link (for AirDrop / Notes)'}
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Opening the link on iOS automatically populates credentials without manual copy-paste errors.
                  </span>
                </div>
              </>
            ) : (
              <div className="py-8 flex flex-col items-center gap-3">
                <QrCode size={36} className="text-slate-600" />
                <p className="text-xs text-slate-400 max-w-xs">
                  Please enter and save your Google Client ID and Folder ID in the <strong>Credentials</strong> tab first to generate a mobile sync QR code.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('credentials')}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs cursor-pointer hover:bg-indigo-500"
                >
                  Enter Credentials
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
