
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
      <header className="h-12 flex items-center justify-between px-3 glass border-b border-white/5 shrink-0 safe-top z-10">
        <div className="flex items-center gap-2 overflow-hidden">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </button>
          <h1 className="text-white/80 text-xs font-medium truncate">{fileName}</h1>
        </div>
        <a
          href={imageUrl}
          download={fileName}
          className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">download</span>
        </a>
      </header>

      {/* Image View */}
      <main className="flex-1 relative flex items-center justify-center p-2">
        <img
          src={imageUrl}
          alt={fileName}
          className="max-w-full max-h-full object-contain rounded-lg"
        />
      </main>
    </div>
  );
};

export default ImagePreview;
