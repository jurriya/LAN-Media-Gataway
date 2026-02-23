
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Browse', icon: 'folder', path: '/' },
    { label: 'Recent', icon: 'history', path: '/recent' },
    { label: 'Settings', icon: 'tune', path: '/settings' },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-[100] glass border-t border-white/5 safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '/');
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl transition-all ${isActive
                ? 'text-primary'
                : 'text-white/30 active:text-white/50'
                }`}
            >
              <span className={`material-symbols-outlined text-[22px] ${isActive ? 'filled' : ''}`}>{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNav;
