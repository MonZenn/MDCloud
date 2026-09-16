import React, { useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export interface UploadProgressModalProps {
  isOpen: boolean;
  current: number;
  total: number;
  currentFileName: string;
  isComplete: boolean;
  errors: string[];
  onClose: () => void;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  isOpen,
  current,
  total,
  currentFileName,
  isComplete,
  errors,
  onClose,
}) => {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && isComplete) {
      closeBtnRef.current?.focus();
    }
  }, [isOpen, isComplete]);

  if (!isOpen) return null;

  const percentage = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const hasErrors = errors.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl shrink-0 ${
            isComplete
              ? hasErrors ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
              : 'bg-indigo-500/10 text-indigo-400'
          }`}>
            {isComplete ? (
              hasErrors ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />
            ) : (
              <UploadCloud size={22} className="animate-pulse" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="upload-modal-title" className="text-sm font-semibold text-slate-100 truncate">
              {isComplete
                ? hasErrors ? 'Upload Finished with Warnings' : 'Upload Complete'
                : `Uploading ${current} of ${total} files...`}
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">
              {isComplete
                ? `${total - errors.length} of ${total} files uploaded successfully.`
                : currentFileName || 'Processing files...'}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{percentage}% complete</span>
            {!isComplete && (
              <span className="flex items-center gap-1 text-slate-500">
                <Loader2 size={12} className="animate-spin" /> Uploading
              </span>
            )}
          </div>
          <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-full h-2 bg-slate-800 rounded-full overflow-hidden"
          >
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isComplete
                  ? hasErrors ? 'bg-amber-500' : 'bg-emerald-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Error list */}
        {hasErrors && (
          <div className="max-h-28 overflow-y-auto rounded-lg bg-rose-950/40 border border-rose-900/60 p-2.5 text-xs text-rose-300 space-y-1">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-rose-400 font-bold">•</span>
                <span className="break-all">{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end pt-1">
          {isComplete ? (
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
            >
              Done
            </button>
          ) : (
            <span className="text-xs text-slate-500">Please do not close this window</span>
          )}
        </div>
      </div>
    </div>
  );
};
