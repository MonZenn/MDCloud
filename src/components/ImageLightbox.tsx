import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ImageLightboxProps {
  url: string;
  alt?: string;
  onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  url,
  alt,
  onClose
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 p-2 text-slate-300 hover:text-white bg-slate-800/80 rounded-full cursor-pointer transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <img
        src={url}
        alt={alt || ''}
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};
