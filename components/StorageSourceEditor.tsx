
import React, { useState, useEffect } from 'react';
import { StorageSource, StorageType, StorageSourceConfig } from '../types';
import { testStorageConnection } from '../services/apiService';

interface Props {
    source?: StorageSource; // undefined = add new
    onSave: (name: string, type: StorageType, config: StorageSourceConfig) => Promise<void>;
    onDelete?: (id: string) => Promise<void>;
    onCancel: () => void;
}

const TYPE_OPTIONS: { value: StorageType; label: string; icon: string; desc: string }[] = [
    { value: 'smb', label: 'SMB / CIFS', icon: 'dns', desc: 'Windows Share / NAS' },
    { value: 'webdav', label: 'WebDAV', icon: 'cloud', desc: 'Nextcloud, Synology...' },
    { value: 'local', label: 'Local Path', icon: 'folder', desc: 'Local / Mounted Drive' },
    { value: 'gdrive', label: 'Google Drive', icon: 'add_to_drive', desc: 'Google Cloud Storage' },
];

const StorageSourceEditor: React.FC<Props> = ({ source, onSave, onDelete, onCancel }) => {
    const [name, setName] = useState(source?.name || '');
    const [type, setType] = useState<StorageType>(source?.type || 'smb');
    const [config, setConfig] = useState<StorageSourceConfig>(source?.config || {});
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const updateConfig = (key: keyof StorageSourceConfig, value: string) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setTestResult(null);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testStorageConnection(type, config);
            setTestResult(result);
        } catch (err: any) {
            setTestResult({ ok: false, message: err.message });
        }
        setTesting(false);
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await onSave(name.trim(), type, config);
        } catch {
            setSaving(false);
        }
    };

    const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/90 placeholder-white/20 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all";

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center animate-fade-in p-0 sm:p-4">
            <div className="w-full max-w-md bg-[#1a1a2e] rounded-t-3xl sm:rounded-3xl border border-white/10 max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex-none p-4 border-b border-white/5 flex items-center justify-between bg-[#1a1a2e]">
                    <h2 className="text-base font-bold text-white">
                        {source ? 'Edit Source' : 'Add Storage Source'}
                    </h2>
                    <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-white/40 text-xl">close</span>
                    </button>
                </div>

                {/* Content Area (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Name</label>
                        <input
                            className={inputClass}
                            placeholder="My NAS, Home Server..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    {/* Type Selector */}
                    {!source && (
                        <div className="space-y-2">
                            <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Type</label>
                            <div className="grid grid-cols-3 gap-2">
                                {TYPE_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => { setType(opt.value); setConfig({}); setTestResult(null); }}
                                        className={`p-3 rounded-xl border text-center transition-all ${type === opt.value
                                            ? 'border-primary/50 bg-primary/10'
                                            : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                                            }`}
                                    >
                                        <span className={`material-symbols-outlined text-xl mb-1 block ${type === opt.value ? 'text-primary' : 'text-white/30'}`}>
                                            {opt.icon}
                                        </span>
                                        <p className={`text-[11px] font-bold leading-tight ${type === opt.value ? 'text-white' : 'text-white/40'}`}>{opt.label}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Config Fields */}
                    <div className="space-y-3">
                        <label className="block text-xs font-medium text-white/40 uppercase tracking-wider">Connection Details</label>

                        {type === 'smb' && (
                            <div className="space-y-2">
                                <input className={inputClass} placeholder="Host (e.g. 192.168.1.100)" value={config.host || ''} onChange={e => updateConfig('host', e.target.value)} />
                                <input className={inputClass} placeholder="Share Name (e.g. disk1)" value={config.share || ''} onChange={e => updateConfig('share', e.target.value)} />
                                <input className={inputClass} placeholder="Username" value={config.username || ''} onChange={e => updateConfig('username', e.target.value)} />
                                <input className={inputClass} placeholder="Password" type="password" value={config.password || ''} onChange={e => updateConfig('password', e.target.value)} />
                            </div>
                        )}

                        {type === 'webdav' && (
                            <div className="space-y-2">
                                <input className={inputClass} placeholder="WebDAV URL (e.g. https://nas.com/dav)" value={config.url || ''} onChange={e => updateConfig('url', e.target.value)} />
                                <input className={inputClass} placeholder="Username" value={config.username || ''} onChange={e => updateConfig('username', e.target.value)} />
                                <input className={inputClass} placeholder="Password" type="password" value={config.password || ''} onChange={e => updateConfig('password', e.target.value)} />
                            </div>
                        )}

                        {type === 'local' && (
                            <input className={inputClass} placeholder="Mount Path (e.g. /media)" value={config.mountPath || ''} onChange={e => updateConfig('mountPath', e.target.value)} />
                        )}

                        {type === 'gdrive' && (
                            <div className="space-y-2">
                                <input className={inputClass} placeholder="Client ID" value={config.clientId || ''} onChange={e => updateConfig('clientId', e.target.value)} />
                                <input className={inputClass} placeholder="Client Secret" type="password" value={config.clientSecret || ''} onChange={e => updateConfig('clientSecret', e.target.value)} />
                                <input className={inputClass} placeholder="Refresh Token" type="password" value={config.refreshToken || ''} onChange={e => updateConfig('refreshToken', e.target.value)} />
                                <input className={inputClass} placeholder="Root Folder ID (optional, default: root)" value={config.rootFolderId || ''} onChange={e => updateConfig('rootFolderId', e.target.value)} />
                                <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-xl">
                                    <p className="text-[11px] text-primary/80 leading-relaxed">
                                        <span className="material-symbols-outlined text-[13px] align-middle mr-1">info</span>
                                        Google Drive integration requires an OAuth2 Client. Use the Google Cloud Console to create one and obtain a Refresh Token.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Test Connection */}
                    <div className="pt-2">
                        <button
                            onClick={handleTest}
                            disabled={testing}
                            className={`w-full py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${testResult ? '' : 'text-primary/80'}`}
                        >
                            {testing ? (
                                <div className="w-4 h-4 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
                            ) : (
                                <span className="material-symbols-outlined text-lg">cable</span>
                            )}
                            {testing ? 'Testing...' : 'Test Connection'}
                        </button>

                        {testResult && (
                            <div className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 animate-slide-up ${testResult.ok
                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                : 'bg-red-500/10 border border-red-500/20'
                                }`}>
                                <span className={`material-symbols-outlined text-base flex-shrink-0 ${testResult.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {testResult.ok ? 'check_circle' : 'error'}
                                </span>
                                <span className={testResult.ok ? 'text-emerald-300/80' : 'text-red-300/80'}>
                                    {testResult.message}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="flex-none p-4 pt-4 border-t border-white/5 bg-[#1a1a2e]/95 backdrop-blur-md pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/40 text-sm font-bold hover:bg-white/5 transition-all active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!name.trim() || saving}
                                className="flex-1 py-3.5 rounded-2xl bg-primary text-white text-sm font-bold hover:bg-primary-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-95"
                            >
                                {saving ? (
                                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <span className="material-symbols-outlined text-lg">{source ? 'save' : 'add_circle'}</span>
                                )}
                                {source ? 'Save Changes' : 'Add Source'}
                            </button>
                        </div>

                        {source && onDelete && (
                            <button
                                onClick={() => {
                                    if (window.confirm(`Are you sure you want to delete "${source.name}"?`)) {
                                        onDelete(source.id);
                                    }
                                }}
                                className="w-full py-3 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/5 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-base">delete</span>
                                Delete Source
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StorageSourceEditor;
