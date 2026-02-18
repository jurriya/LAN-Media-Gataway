
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
      case FileType.FOLDER: return { icon: 'folder', color: 'text-primary' };
      case FileType.VIDEO: return { icon: 'movie', color: 'text-blue-400' };
      case FileType.IMAGE: return { icon: 'image', color: 'text-emerald-400' };
      case FileType.DOCUMENT: return { icon: 'description', color: 'text-red-500' };
      default: return { icon: 'draft', color: 'text-slate-400' };
    }
  };

  // Build breadcrumb segments
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
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-5">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1 text-sm overflow-x-auto no-scrollbar">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            {i > 0 && (
              <span className="material-symbols-outlined text-slate-400 text-base shrink-0">chevron_right</span>
            )}
            <button
              onClick={() => onNavigate(crumb.path)}
              className={`shrink-0 px-2 py-1 rounded-md transition-colors ${i === breadcrumbs.length - 1
                  ? 'font-semibold text-primary bg-primary/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-primary hover:bg-primary/5'
                }`}
            >
              {i === 0 && <span className="material-symbols-outlined text-sm align-middle mr-1">home</span>}
              {crumb.label}
            </button>
          </React.Fragment>
        ))}
      </nav>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
        {[
          { id: 'ALL', label: 'All Files', icon: 'apps' },
          { id: FileType.VIDEO, label: 'Videos', icon: 'movie' },
          { id: FileType.IMAGE, label: 'Images', icon: 'image' },
          { id: FileType.DOCUMENT, label: 'Documents', icon: 'description' },
          { id: FileType.FOLDER, label: 'Folders', icon: 'folder' },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilter(cat.id as any)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeFilter === cat.id
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-slate-200 dark:bg-primary/10 text-slate-700 dark:text-slate-300 hover:bg-primary/20'
              }`}
          >
            <span className="material-symbols-outlined text-lg">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <span className="material-symbols-outlined text-6xl text-red-400">cloud_off</span>
          <p className="text-slate-500 dark:text-slate-400 text-center">{error}</p>
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">refresh</span>
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse flex flex-col gap-3 p-4 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 rounded-xl">
              <div className="aspect-video rounded-lg bg-slate-200 dark:bg-primary/20" />
              <div className="h-4 bg-slate-200 dark:bg-primary/15 rounded w-3/4" />
              <div className="h-3 bg-slate-200 dark:bg-primary/10 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600">folder_off</span>
          <p className="text-slate-500 dark:text-slate-400">This folder is empty</p>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {/* Go Up button when in a subdirectory */}
          {currentPath && (
            <div
              onClick={() => {
                const parent = currentPath.split('/').slice(0, -1).join('/');
                onNavigate(parent);
              }}
              className="group flex flex-col gap-3 p-4 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 rounded-xl hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
            >
              <div className="aspect-video rounded-lg bg-slate-100 dark:bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-primary">drive_folder_upload</span>
              </div>
              <div>
                <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">.. Go Up</h3>
                <p className="text-xs text-slate-500 mt-1">Parent directory</p>
              </div>
            </div>
          )}

          {items.map(item => {
            const { icon, color } = getIcon(item.type);
            return (
              <div
                key={item.id}
                onClick={() => onItemClick(item)}
                className="group relative flex flex-col gap-3 p-4 bg-white dark:bg-primary/5 border border-slate-200 dark:border-primary/10 rounded-xl hover:border-primary/50 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:-translate-y-1"
              >
                <div className="aspect-video rounded-lg bg-slate-100 dark:bg-primary/20 flex items-center justify-center overflow-hidden relative">
                  {item.thumbnail ? (
                    <>
                      <img
                        src={item.thumbnail}
                        alt={item.name}
                        className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"
                        onError={(e) => {
                          // Fallback to icon on image load error
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {item.type === FileType.VIDEO && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-primary text-white p-2 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                            <span className="material-symbols-outlined text-2xl filled">play_arrow</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className={`material-symbols-outlined text-6xl ${color}`}>{icon}</span>
                  )}
                  {item.type === FileType.VIDEO && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-primary text-white p-2 rounded-full shadow-lg">
                        <span className="material-symbols-outlined text-2xl filled">play_arrow</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-2 overflow-hidden">
                    <h3 className="font-semibold text-sm line-clamp-2 text-slate-900 dark:text-slate-100">{item.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 truncate">
                      {item.size !== '—' ? item.size : ''}{item.size !== '—' && item.modified !== '—' ? ' • ' : ''}{item.modified !== '—' ? item.modified : ''}
                    </p>
                  </div>
                  <div className={`shrink-0 ${color}`}>
                    <span className="material-symbols-outlined text-lg">{icon}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FileBrowser;
