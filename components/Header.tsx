
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  serverOnline?: boolean;
}

const Header: React.FC<HeaderProps> = ({ searchQuery, setSearchQuery, serverOnline }) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-slate-200 dark:border-primary/20">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <div
          className="flex items-center gap-2 shrink-0 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div className="bg-primary p-1.5 rounded-lg flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-2xl">settings_input_component</span>
          </div>
          <h1 className="text-lg font-bold tracking-tight hidden sm:block text-slate-900 dark:text-white">
            LAN Media <span className="text-primary">Gateway</span>
          </h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-xl group">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-slate-400">search</span>
            <input
              className="w-full bg-slate-200 dark:bg-primary/10 border-none rounded-full pl-10 pr-4 h-10 focus:ring-2 focus:ring-primary transition-all placeholder:text-slate-500 dark:placeholder:text-slate-400 text-slate-900 dark:text-white"
              placeholder="Search movies, photos, or documents..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Header Actions */}
        <div className="hidden md:flex items-center gap-1 sm:gap-3">
          {/* Server status indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-primary/10" title={serverOnline ? 'Server connected' : 'Server offline'}>
            <div className={`w-2 h-2 rounded-full ${serverOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {serverOnline ? 'NAS Online' : 'Offline'}
            </span>
          </div>
          <button className="p-2 hover:bg-slate-200 dark:hover:bg-primary/20 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:text-primary">
            <span className="material-symbols-outlined">schedule</span>
          </button>
          <button
            className="p-2 hover:bg-slate-200 dark:hover:bg-primary/20 rounded-full transition-colors text-slate-600 dark:text-slate-400 hover:text-primary"
            onClick={() => navigate('/settings')}
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
