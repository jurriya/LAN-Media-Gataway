
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
    <header className="sticky top-0 z-50 glass border-b border-white/5 safe-top">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 shrink-0 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white text-lg filled">play_circle</span>
          </div>
          <h1 className="text-base font-bold tracking-tight hidden sm:block">
            <span className="gradient-text">MediaFlow</span>
          </h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-white/30 text-[20px]">search</span>
            <input
              className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 h-9 text-sm focus:ring-1 focus:ring-primary/50 focus:bg-white/10 transition-all placeholder:text-white/25 text-white outline-none"
              placeholder="Search..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5" title={serverOnline ? 'NAS Connected' : 'Offline'}>
            <div className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-emerald-400 animate-pulse-soft' : 'bg-red-500'}`} />
            <span className="text-[11px] font-medium text-white/40 hidden sm:block">
              {serverOnline ? 'NAS' : 'Offline'}
            </span>
          </div>
          <button
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white md:flex hidden"
            onClick={() => navigate('/settings')}
          >
            <span className="material-symbols-outlined text-[20px]">settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
