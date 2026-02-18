
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Browser', icon: 'folder', path: '/' },
    { label: 'Recent', icon: 'schedule', path: '/recent' },
    { label: 'Favorites', icon: 'star', path: '/favorites' },
    { label: 'Settings', icon: 'settings', path: '/settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-[100] bg-white/80 dark:bg-background-dark/90 backdrop-blur-lg border-t border-slate-200 dark:border-primary/20 px-6 py-3 pb-8 flex items-center justify-between text-slate-500 dark:text-slate-400">
      {navItems.map(item => {
        const isActive = location.pathname === item.path;
        return (
          <button 
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-primary' : 'hover:text-primary'}`}
          >
            <span className={`material-symbols-outlined ${isActive ? 'filled' : ''}`}>{item.icon}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileNav;
