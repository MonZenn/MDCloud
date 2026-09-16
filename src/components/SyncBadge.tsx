import React from 'react';
import { CheckCircle2, RefreshCw, CloudOff, AlertCircle } from 'lucide-react';

export type SyncStatus = 'synced' | 'saving' | 'offline' | 'error';

export interface SyncBadgeProps {
  status: SyncStatus;
  onRetry?: () => void;
}

export const SyncBadge: React.FC<SyncBadgeProps> = ({ status, onRetry }) => {
  switch (status) {
    case 'synced':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
          <CheckCircle2 size={14} /> Saved to Drive
        </span>
      );
    case 'saving':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
          <RefreshCw size={14} className="animate-spin" /> Saving...
        </span>
      );
    case 'offline':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-sky-400 font-medium">
          <CloudOff size={14} /> Saved Locally (Offline)
        </span>
      );
    case 'error':
      return (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium hover:underline cursor-pointer"
        >
          <AlertCircle size={14} /> Sync Failed (Retry)
        </button>
      );
  }
};
