import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

export const IosInstallBanner: React.FC = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      Boolean((navigator as any).standalone);

    if (isIos && !isStandalone) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 z-40 bg-indigo-950/95 border border-indigo-700/60 backdrop-blur text-indigo-100 p-3 rounded-xl shadow-2xl flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <span>Install on iPad/iPhone: tap</span>
        <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-900 border border-indigo-600 rounded">
          <Share size={12} className="mr-1" /> Share
        </span>
        <span>then</span>
        <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-900 border border-indigo-600 rounded">
          <PlusSquare size={12} className="mr-1" /> Add to Home Screen
        </span>
      </div>
      <button
        type="button"
        onClick={() => setShow(false)}
        className="p-1 text-indigo-300 hover:text-white"
        aria-label="Dismiss install prompt"
      >
        <X size={14} />
      </button>
    </div>
  );
};
