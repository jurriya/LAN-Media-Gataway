
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { useNavigate } from 'react-router-dom';

interface SettingsProps {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, setSettings }) => {
  const navigate = useNavigate();
  const [showToast, setShowToast] = useState(false);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

  const handleSave = () => {
    setSettings(localSettings);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-8 pb-24">
        <header className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/')}
                  className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-primary/20 transition-colors text-slate-800 dark:text-white"
                >
                    <span className="material-symbols-outlined block text-2xl">arrow_back</span>
                </button>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Settings</h1>
            </div>
            <div className="flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined">lan</span>
                <span className="text-sm font-semibold uppercase tracking-wider">Gateway</span>
            </div>
        </header>

        <section className="space-y-4">
            <div className="flex items-center gap-2 px-1 text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-primary">dns</span>
                <h2 className="text-lg font-bold">Server Connection</h2>
            </div>
            <div className="bg-white dark:bg-primary/5 rounded-xl border border-slate-200 dark:border-primary/10 p-5 space-y-4 shadow-sm">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-500 dark:text-slate-400">API Base URL</label>
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-primary/20 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all text-slate-900 dark:text-white"
                            placeholder="http://localhost:8000"
                            type="text"
                            value={localSettings.apiBaseUrl}
                            onChange={(e) => setLocalSettings({...localSettings, apiBaseUrl: e.target.value})}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">link</span>
                    </div>
                    <p className="text-xs text-slate-400">Specify the backend endpoint for media indexing and streaming metadata.</p>
                </div>
            </div>
        </section>

        <section className="space-y-4">
            <div className="flex items-center gap-2 px-1 text-slate-900 dark:text-white">
                <span className="material-symbols-outlined text-primary">play_circle</span>
                <h2 className="text-lg font-bold">Playback & UI</h2>
            </div>
            <div className="bg-white dark:bg-primary/5 rounded-xl border border-slate-200 dark:border-primary/10 overflow-hidden shadow-sm">
                {/* Default to HLS */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-primary/10">
                    <div className="space-y-1">
                        <p className="font-medium text-slate-900 dark:text-white">Default to HLS</p>
                        <p className="text-sm text-slate-500">Use HTTP Live Streaming for better compatibility</p>
                    </div>
                    <button 
                        onClick={() => setLocalSettings({...localSettings, defaultHls: !localSettings.defaultHls})}
                        className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.defaultHls ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${localSettings.defaultHls ? 'translate-x-6' : ''}`}></div>
                    </button>
                </div>

                {/* Show Download Buttons */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-primary/10">
                    <div className="space-y-1">
                        <p className="font-medium text-slate-900 dark:text-white">Show Download Buttons</p>
                        <p className="text-sm text-slate-500">Enable direct file downloads in the media player</p>
                    </div>
                    <button 
                        onClick={() => setLocalSettings({...localSettings, showDownload: !localSettings.showDownload})}
                        className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.showDownload ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${localSettings.showDownload ? 'translate-x-6' : ''}`}></div>
                    </button>
                </div>

                {/* Clear Cache */}
                <div className="p-5 flex items-center justify-between bg-slate-50/50 dark:bg-primary/5">
                    <div className="space-y-1">
                        <p className="font-medium text-slate-900 dark:text-white">Local Storage Cache</p>
                        <p className="text-sm text-slate-500">Clear all locally stored session data and preferences</p>
                    </div>
                    <button className="px-4 py-2 border border-red-500/50 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">delete_forever</span>
                        Clear Cache
                    </button>
                </div>
            </div>
        </section>

        <div className="pt-4">
            <button 
                onClick={handleSave}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
                <span className="material-symbols-outlined">save</span>
                Save Changes
            </button>
        </div>

        {/* Toast Notification */}
        {showToast && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
                <div className="bg-background-dark/90 dark:bg-white/95 backdrop-blur-md text-white dark:text-background-dark px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 border border-primary/20 animate-bounce">
                    <span className="material-symbols-outlined text-green-500 filled">check_circle</span>
                    <span className="text-sm font-semibold">Settings saved successfully</span>
                </div>
            </div>
        )}
    </div>
  );
};

export default Settings;
