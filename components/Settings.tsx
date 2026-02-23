
import React, { useState, useEffect } from 'react';
import { AppSettings, StorageSource, StorageType, StorageSourceConfig } from '../types';
import { useNavigate } from 'react-router-dom';
import { getStorageSources, addStorageSource, updateStorageSource, deleteStorageSource, setActiveSource } from '../services/apiService';
import StorageSourceEditor from './StorageSourceEditor';

interface SettingsProps {
    settings: AppSettings;
    setSettings: (s: AppSettings) => void;
}

const TYPE_ICONS: Record<StorageType, string> = {
    smb: 'dns',
    webdav: 'cloud',
    local: 'folder',
    s3: 'cloud_queue',
    gdrive: 'add_to_drive',
    onedrive: 'cloud_circle',
};

const TYPE_LABELS: Record<StorageType, string> = {
    smb: 'SMB',
    webdav: 'WebDAV',
    local: 'Local',
    s3: 'S3',
    gdrive: 'Google Drive',
    onedrive: 'OneDrive',
};

const Settings: React.FC<SettingsProps> = ({ settings, setSettings }) => {
    const navigate = useNavigate();
    const [showToast, setShowToast] = useState(false);
    const [toastMsg, setToastMsg] = useState('Saved');
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);

    // Storage sources
    const [sources, setSources] = useState<StorageSource[]>([]);
    const [loadingSources, setLoadingSources] = useState(true);
    const [showEditor, setShowEditor] = useState(false);
    const [editingSource, setEditingSource] = useState<StorageSource | undefined>(undefined);
    const [switchingId, setSwitchingId] = useState<string | null>(null);

    // Load sources on mount
    useEffect(() => {
        loadSources();
    }, []);

    const loadSources = async () => {
        try {
            const data = await getStorageSources();
            setSources(data);
        } catch (err) {
            console.error('Failed to load storage sources:', err);
        }
        setLoadingSources(false);
    };

    const showToastMessage = (msg: string) => {
        setToastMsg(msg);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
    };

    const handleSave = () => {
        setSettings(localSettings);
        localStorage.setItem('mediaflow_settings', JSON.stringify(localSettings));
        showToastMessage('Settings saved');
    };

    const clearCache = () => {
        localStorage.removeItem('mediaflow_history');
        localStorage.removeItem('mediaflow_recent_paths');
        // Clear all saved playback positions
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('vpos_')) localStorage.removeItem(key);
        });
        showToastMessage('Cache cleared');
    };

    const handleAddSource = async (name: string, type: StorageType, config: StorageSourceConfig) => {
        await addStorageSource(name, type, config);
        await loadSources();
        setShowEditor(false);
        showToastMessage('Source added');
    };

    const handleEditSource = async (name: string, type: StorageType, config: StorageSourceConfig) => {
        if (!editingSource) return;
        await updateStorageSource(editingSource.id, name, config);
        await loadSources();
        setEditingSource(undefined);
        setShowEditor(false);
        showToastMessage('Source updated');
    };

    const handleDeleteSource = async (id: string) => {
        if (!confirm('Delete this storage source?')) return;
        await deleteStorageSource(id);
        await loadSources();
        showToastMessage('Source deleted');
    };

    const handleSetActive = async (id: string) => {
        setSwitchingId(id);
        try {
            await setActiveSource(id);
            await loadSources();
            showToastMessage('Switched storage source');
        } catch (err) {
            console.error('Failed to switch source:', err);
        }
        setSwitchingId(null);
    };

    return (
        <div className="max-w-lg mx-auto w-full p-4 space-y-6 pb-32 animate-fade-in">
            <header className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                    <span className="material-symbols-outlined text-white/60 text-xl">arrow_back</span>
                </button>
                <h1 className="text-lg font-bold text-white">Settings</h1>
            </header>

            {/* Storage Sources Section */}
            <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white/25">Storage Sources</h2>
                    <button
                        onClick={() => { setEditingSource(undefined); setShowEditor(true); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all"
                    >
                        <span className="material-symbols-outlined text-primary text-sm">add</span>
                        <span className="text-xs font-medium text-primary">Add</span>
                    </button>
                </div>

                <div className="bg-white/[0.03] rounded-2xl border border-white/5 overflow-hidden">
                    {loadingSources ? (
                        <div className="p-6 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-white/10 border-t-primary rounded-full animate-spin" />
                        </div>
                    ) : sources.length === 0 ? (
                        <div className="p-6 text-center">
                            <span className="material-symbols-outlined text-3xl text-white/10 block mb-2">cloud_off</span>
                            <p className="text-sm text-white/30">No storage sources configured</p>
                            <p className="text-xs text-white/15 mt-1">Add one to get started</p>
                        </div>
                    ) : (
                        sources.map((source, idx) => (
                            <div
                                key={source.id}
                                className={`flex items-center gap-3 p-4 ${idx !== sources.length - 1 ? 'border-b border-white/5' : ''} ${source.isActive ? 'bg-primary/[0.03]' : ''}`}
                            >
                                {/* Icon */}
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${source.isActive
                                    ? 'bg-primary/15 border border-primary/20'
                                    : 'bg-white/5 border border-white/5'
                                    }`}>
                                    <span className={`material-symbols-outlined text-lg ${source.isActive ? 'text-primary' : 'text-white/30'}`}>
                                        {TYPE_ICONS[source.type] || 'storage'}
                                    </span>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="text-sm font-medium text-white/80 truncate">{source.name}</p>
                                        {source.isActive && (
                                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">ACTIVE</span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-white/25 mt-0.5">
                                        {TYPE_LABELS[source.type]}
                                        {source.config.host ? ` • ${source.config.host}` : ''}
                                        {source.config.url ? ` • ${source.config.url}` : ''}
                                        {source.config.mountPath ? ` • ${source.config.mountPath}` : ''}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {!source.isActive && (
                                        <button
                                            onClick={() => handleSetActive(source.id)}
                                            disabled={switchingId === source.id}
                                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                            title="Set as active"
                                        >
                                            {switchingId === source.id ? (
                                                <div className="w-4 h-4 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                                            ) : (
                                                <span className="material-symbols-outlined text-white/30 text-base">radio_button_unchecked</span>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { setEditingSource(source); setShowEditor(true); }}
                                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                        title="Edit"
                                    >
                                        <span className="material-symbols-outlined text-white/30 text-base">edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSource(source.id)}
                                        className="p-2 rounded-lg hover:bg-red-500/10 active:bg-red-500/20 group transition-colors"
                                        title="Delete Storage Source"
                                    >
                                        <span className="material-symbols-outlined text-red-400 group-hover:text-red-500 text-sm">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </section>

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
                            <p className="text-[10px] text-white/20">LAN Media Gateway v3.0</p>
                        </div>
                    </div>
                    <p className="text-xs text-white/20 leading-relaxed">
                        Stream media from NAS, WebDAV, local drives, and cloud storage. Supports HLS transcoding, AirPlay, and Picture-in-Picture.
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
                        <span className="text-xs font-medium">{toastMsg}</span>
                    </div>
                </div>
            )}

            {/* Storage Source Editor Modal */}
            {showEditor && (
                <StorageSourceEditor
                    source={editingSource}
                    onSave={editingSource ? handleEditSource : handleAddSource}
                    onDelete={handleDeleteSource}
                    onCancel={() => { setShowEditor(false); setEditingSource(undefined); }}
                />
            )}
        </div>
    );
};

export default Settings;
