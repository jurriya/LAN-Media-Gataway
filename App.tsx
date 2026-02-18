
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { MediaItem, AppSettings, FileType, NasItem, nasItemToMediaItem } from './types';
import { fetchFileList, checkHealth } from './services/apiService';
import Header from './components/Header';
import FileBrowser from './components/FileBrowser';
import VideoPlayer from './components/VideoPlayer';
import ImagePreview from './components/ImagePreview';
import Settings from './components/Settings';
import MobileNav from './components/MobileNav';

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | FileType>('ALL');
  const [currentPath, setCurrentPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    apiBaseUrl: 'http://localhost:8000',
    defaultHls: true,
    showDownload: true,
    theme: 'dark'
  });

  // Check server health on mount
  useEffect(() => {
    checkHealth().then(setServerOnline);
  }, []);

  // Load file list when currentPath changes
  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const nasItems: NasItem[] = await fetchFileList(path);
      const mapped = nasItems.map(nasItemToMediaItem);
      // Sort: folders first, then by name
      mapped.sort((a, b) => {
        if (a.type === FileType.FOLDER && b.type !== FileType.FOLDER) return -1;
        if (a.type !== FileType.FOLDER && b.type === FileType.FOLDER) return 1;
        return a.name.localeCompare(b.name);
      });
      setItems(mapped);
    } catch (err: any) {
      setError(err.message || 'Failed to load files');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles(currentPath);
  }, [currentPath, loadFiles]);

  const handleItemClick = (item: MediaItem) => {
    setActiveItem(item);
    if (item.type === FileType.FOLDER) {
      setCurrentPath(item.path);
    } else if (item.type === FileType.VIDEO) {
      navigate('/play/' + encodeURIComponent(item.path));
    } else if (item.type === FileType.IMAGE) {
      navigate('/preview/' + encodeURIComponent(item.path));
    }
  };

  const handleNavigateToPath = (path: string) => {
    setCurrentPath(path);
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'ALL' || item.type === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark transition-colors duration-300">
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        serverOnline={serverOnline}
      />

      <main className="flex-1 pb-24 md:pb-6">
        <Routes>
          <Route path="/" element={
            <FileBrowser
              items={filteredItems}
              activeFilter={filter}
              setFilter={setFilter}
              onItemClick={handleItemClick}
              currentPath={currentPath}
              onNavigate={handleNavigateToPath}
              loading={loading}
              error={error}
              onRetry={() => loadFiles(currentPath)}
            />
          } />
          <Route path="/play/:path" element={
            <VideoPlayer
              settings={settings}
            />
          } />
          <Route path="/preview/:path" element={
            <ImagePreview />
          } />
          <Route path="/settings" element={
            <Settings
              settings={settings}
              setSettings={setSettings}
            />
          } />
        </Routes>
      </main>

      <MobileNav />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
