
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

  // Restore settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('mediaflow_settings');
    if (saved) {
      try { setSettings(JSON.parse(saved)); } catch { }
    }
  }, []);

  useEffect(() => {
    checkHealth().then(setServerOnline);
  }, []);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const nasItems: NasItem[] = await fetchFileList(path);
      const mapped = nasItems.map(nasItemToMediaItem);
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

  // Save recent path
  useEffect(() => {
    if (currentPath) {
      const recents = JSON.parse(localStorage.getItem('mediaflow_recent_paths') || '[]');
      const updated = [currentPath, ...recents.filter((p: string) => p !== currentPath)].slice(0, 10);
      localStorage.setItem('mediaflow_recent_paths', JSON.stringify(updated));
    }
  }, [currentPath]);

  const handleItemClick = (item: MediaItem) => {
    if (item.type === FileType.FOLDER) {
      setCurrentPath(item.path);
    } else if (item.type === FileType.VIDEO) {
      // Save to recently played
      const history = JSON.parse(localStorage.getItem('mediaflow_history') || '[]');
      const entry = { path: item.path, name: item.name, time: Date.now() };
      const updated = [entry, ...history.filter((h: any) => h.path !== item.path)].slice(0, 50);
      localStorage.setItem('mediaflow_history', JSON.stringify(updated));
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

  // Hide chrome on player pages
  const isPlayerPage = location.pathname.startsWith('/play/') || location.pathname.startsWith('/preview/');

  return (
    <div className="flex flex-col min-h-screen min-h-[100dvh] bg-bg-app text-white transition-colors duration-300">
      {!isPlayerPage && (
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          serverOnline={serverOnline}
        />
      )}

      <main className={`flex-1 ${isPlayerPage ? '' : 'pb-20 md:pb-6'}`}>
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
            <VideoPlayer settings={settings} />
          } />
          <Route path="/preview/:path" element={
            <ImagePreview />
          } />
          <Route path="/settings" element={
            <Settings settings={settings} setSettings={setSettings} />
          } />
        </Routes>
      </main>

      {!isPlayerPage && <MobileNav />}
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
