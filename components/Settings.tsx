
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
        localStorage.setItem('mediaflow_settings', JSON.stringify(localSettings));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
    };

    const clearCache = () => {
        localStorage.removeItem('mediaflow_history');
        localStorage.removeItem('mediaflow_recent_paths');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
    };

    return (
        <div className="max-w-lg mx-auto w-full p-4 space-y-6 pb-24 animate-fade-in">
            <header className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-white/60 text-xl">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold text-white">Settings</h1>
            </header>

            {/* Playback Section */}
            <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white/25 px-1">Playback</h2>
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-white/5">
                        <div>
                            <p className="text-sm font-medium text-white/80">Default to HLS</p>
                            <p className="text-xs text-white/25 mt-0.5">Better cross-device compatibility</p>
                        </div>
                        <button
                            onClick={() => setLocalSettings({ ...localSettings, defaultHls: !localSettings.defaultHls })}
                            className={`relative w-11 h-6 rounded-full transition-colors ${localSettings.defaultHls ? 'bg-primary' : 'bg-white/10'}`}
                        >
                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${localSettings.defaultHls ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm font-medium text-white/80">Show Download</p>
                            <p className="text-xs text-white/25 mt-0.5">Enable direct file downloads</p>
                        </div>
                        <button
                            onClick={() => setLocalSettings({ ...localSettings, showDownload: !localSettings.showDownload })}
                            className={`relative w-11 h-6 rounded-full transition-colors ${localSettings.showDownload ? 'bg-primary' : 'bg-white/10'}`}
                        >
                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${localSettings.showDownload ? 'translate-x-5' : ''}`} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Data Section */}
            <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white/25 px-1">Data</h2>
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                    <div className="flex items-center justify-between p-4">
                        <div>
                            <p className="text-sm font-medium text-white/80">Clear History</p>
                            <p className="text-xs text-white/25 mt-0.5">Remove recently played & browsed data</p>
                        </div>
                        <button
                            onClick={clearCache}
                            className="px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-semibold transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section className="space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white/25 px-1">About</h2>
                <div className="bg-white/[0.03] rounded-2xl border border-white/5 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-sm filled">play_circle</span>
                        </div>
                        <div>
                            <p className="text-sm font-bold gradient-text">MediaFlow</p>
                            <p className="text-[10px] text-white/20">LAN Media Gateway v2.0</p>
                        </div>
                    </div>
                    <p className="text-xs text-white/20 leading-relaxed">
                        Stream your NAS media on any device. Supports HLS streaming, AirPlay casting, and Picture-in-Picture.
                    </p>
                </div>
            </section>

            <button
                onClick={handleSave}
                className="w-full bg-primary hover:bg-primary-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
                <span className="material-symbols-outlined text-xl">save</span>
                Save Changes
            </button>

            {/* Toast */}
            {showToast && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
                    <div className="glass text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-white/10">
                        <span className="material-symbols-outlined text-emerald-400 filled text-lg">check_circle</span>
                        <span className="text-xs font-medium">Saved</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
