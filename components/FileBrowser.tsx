
import React from 'react';
import { MediaItem, FileType } from '../types';

interface FileBrowserProps {
  items: MediaItem[];
  activeFilter: 'ALL' | FileType;
  setFilter: (f: 'ALL' | FileType) => void;
  onItemClick: (item: MediaItem) => void;
  currentPath: string;
  onNavigate: (path: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

const FileBrowser: React.FC<FileBrowserProps> = ({
  items, activeFilter, setFilter, onItemClick,
  currentPath, onNavigate, loading, error, onRetry
}) => {

  const getIcon = (type: FileType) => {
    switch (type) {
      case FileType.FOLDER: return { icon: 'folder', color: 'text-primary-300' };
      case FileType.VIDEO: return { icon: 'movie', color: 'text-pink-400' };
      case FileType.IMAGE: return { icon: 'image', color: 'text-emerald-400' };
      case FileType.DOCUMENT: return { icon: 'description', color: 'text-amber-400' };
      default: return { icon: 'draft', color: 'text-white/30' };
    }
  };

  const pathSegments = currentPath ? currentPath.split('/') : [];
  const breadcrumbs: { label: string; path: string }[] = [
    { label: 'Home', path: '' }
  ];
  pathSegments.forEach((seg, i) => {
    breadcrumbs.push({
      label: seg,
      path: pathSegments.slice(0, i + 1).join('/'),
    });
  });

  return (
    <div className="max-w-7xl mx-auto px-3 md:px-4 py-4 flex flex-col gap-4 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-xs overflow-x-auto no-scrollbar">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            {i > 0 && (
              <span className="material-symbols-outlined text-white/15 text-sm shrink-0">chevron_right</span>
            )}
            <button
              onClick={() => onNavigate(crumb.path)}
              className={`shrink-0 px-2 py-1 rounded-lg transition-all ${i === breadcrumbs.length - 1
                ? 'font-semibold text-primary bg-primary/10'
                : 'text-white/30 hover:text-primary hover:bg-primary/5 active:bg-primary/10'
                }`}
            >
              {i === 0 && <span className="material-symbols-outlined text-xs align-middle mr-1 filled">home</span>}
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* Filters - compact pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { id: 'ALL', label: 'All', icon: 'apps' },
          { id: FileType.VIDEO, label: 'Videos', icon: 'movie' },
          { id: FileType.IMAGE, label: 'Images', icon: 'image' },
          { id: FileType.DOCUMENT, label: 'Documents', icon: 'description' },
          { id: FileType.FOLDER, label: 'Folders', icon: 'folder' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap ${activeFilter === cat.id
              ? 'bg-primary text-white shadow-lg shadow-primary/20'
              : 'bg-white/5 text-white/40 hover:bg-white/10 active:bg-white/15'
              }`}
          >
            <span className="material-symbols-outlined text-sm">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-red-400">cloud_off</span>
          </div>
          <p className="text-white/40 text-sm text-center max-w-xs">{error}</p>
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary-600 active:scale-95 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-shimmer skeleton rounded-2xl p-3 flex gap-3 h-16">
              <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 bg-white/5 rounded w-3/4" />
                <div className="h-2 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
            <span className="material-symbols-outlined text-3xl text-white/20">folder_off</span>
          </div>
          <p className="text-white/30 text-sm">This folder is empty</p>
        </div>
      )}

      {/* File List - mobile-optimized list/grid hybrid */}
      {!loading && !error && items.length > 0 && (
        <div className="flex flex-col gap-1">
          {/* Go Up */}
          {currentPath && (
            <button
              onClick={() => {
                const parent = currentPath.split('/').slice(0, -1).join('/');
                onNavigate(parent);
              }}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] hover:bg-white/5 active:bg-white/10 transition-all group"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">arrow_upward</span>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-white/70">Go Up</p>
                <p className="text-[11px] text-white/20">Parent directory</p>
              </div>
            </button>
          )}

          {items.map((item, index) => {
            const { icon, color } = getIcon(item.type);
            const isVideo = item.type === FileType.VIDEO;
            const isFolder = item.type === FileType.FOLDER;

            return (
              <button
                key={item.id}
                onClick={() => onItemClick(item)}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-all group text-left animate-slide-up"
                style={{ animationDelay: `${Math.min(index * 20, 200)}ms` }}
              >
                {/* Icon/Thumbnail */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isVideo ? 'bg-pink-500/10' : isFolder ? 'bg-primary/10' : 'bg-white/5'
                  }`}>
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <span className={`material-symbols-outlined text-xl ${color} ${isFolder ? 'filled' : ''}`}>{icon}</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/90 truncate leading-tight">{item.name}</p>
                  <p className="text-[11px] text-white/25 mt-0.5">
                    {item.size !== '—' ? item.size : ''}
                    {isVideo && <span className="inline-flex items-center ml-1.5 text-pink-400/50">• Video</span>}
                    {isFolder && <span className="inline-flex items-center ml-1.5 text-primary-300/50">• Folder</span>}
                  </p>
                </div>

                {/* Action hint */}
                <div className="shrink-0 text-white/10 group-hover:text-white/30 transition-colors">
                  {isVideo ? (
                    <span className="material-symbols-outlined text-lg filled text-pink-400/40">play_circle</span>
                  ) : isFolder ? (
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  ) : (
                    <span className="material-symbols-outlined text-lg">open_in_new</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileBrowser;
