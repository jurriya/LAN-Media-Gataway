
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStreamUrl } from '../services/apiService';

const ImagePreview: React.FC = () => {
  const { path: encodedPath } = useParams();
  const navigate = useNavigate();
  const filePath = decodeURIComponent(encodedPath || '');
  const fileName = filePath.split('/').pop() || filePath;
  const imageUrl = getStreamUrl(filePath);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col overflow-hidden">
      {/* Top Bar */}
      <header className="h-16 flex items-center justify-between px-4 bg-black/50 backdrop-blur-md border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-white/10 rounded-full text-white"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex flex-col overflow-hidden">
            <h1 className="text-white text-sm font-semibold truncate leading-tight">{fileName}</h1>
            <span className="text-white/50 text-[10px] uppercase tracking-wider font-medium">Preview Mode</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={imageUrl}
            download={fileName}
            className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-[20px]">download</span>
            <span className="text-sm font-medium hidden sm:inline">Download</span>
          </a>
        </div>
      </header>

      {/* Image View */}
      <main className="flex-1 relative flex items-center justify-center p-4">
        <img
          src={imageUrl}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded shadow-2xl"
        />
      </main>

      {/* Info Card */}
      <div className="p-4 bg-slate-900/90 border-t border-white/10 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-lg">info</span>
              <h2 className="text-white font-bold text-base">File Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex flex-col">
                <span className="text-white/40 text-[10px] uppercase font-bold">Path</span>
                <p className="text-white/80 text-xs truncate">{filePath}</p>
              </div>
              <div className="flex flex-col">
                <span className="text-white/40 text-[10px] uppercase font-bold">Name</span>
                <p className="text-white/80 text-xs truncate">{fileName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagePreview;
