
const API_BASE = '/api'; // Vite proxy forwards to localhost:8000/api

export interface FileItem {
    name: string;
    path: string;
    is_dir: boolean;
    size: number | null;
    status?: 'none' | 'queued' | 'processing' | 'done' | 'error';
}

import { StorageSource, StorageType, StorageSourceConfig } from '../types';

export const fetchFileList = async (path: string = ''): Promise<FileItem[]> => {
    try {
        const url = `${API_BASE}/list?path=${encodeURIComponent(path)}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error fetching files: ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching files:', error);
        throw error;
    }
};

// Alias for compatibility if needed elsewhere
export const getFiles = fetchFileList;

export const getStreamUrl = (path: string): string => {
    return `${API_BASE}/stream?path=${encodeURIComponent(path)}`;
};

export const checkHealth = async (): Promise<boolean> => {
    try {
        const response = await fetch('/health');
        return response.ok;
    } catch (error) {
        console.error('Health check failed:', error);
        return false;
    }
};

// ── Storage Management ──

export const getStorageSources = async (): Promise<StorageSource[]> => {
    const res = await fetch(`${API_BASE}/storage/sources`);
    if (!res.ok) throw new Error('Failed to fetch storage sources');
    return res.json();
};

export const addStorageSource = async (name: string, type: StorageType, config: StorageSourceConfig): Promise<StorageSource> => {
    const res = await fetch(`${API_BASE}/storage/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, config }),
    });
    if (!res.ok) throw new Error('Failed to add storage source');
    return res.json();
};

export const updateStorageSource = async (id: string, name: string, config: StorageSourceConfig): Promise<StorageSource> => {
    const res = await fetch(`${API_BASE}/storage/sources/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
    });
    if (!res.ok) throw new Error('Failed to update storage source');
    return res.json();
};

export const deleteStorageSource = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/storage/sources/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete storage source');
};

export const setActiveSource = async (id: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/storage/active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error('Failed to set active source');
};

export const testStorageConnection = async (type: StorageType, config: StorageSourceConfig): Promise<{ ok: boolean; message: string }> => {
    const res = await fetch(`${API_BASE}/storage/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config }),
    });
    return res.json();
};

export const apiService = {
    fetchFileList,
    getFiles,
    getStreamUrl,
    checkHealth,
    getStorageSources,
    addStorageSource,
    updateStorageSource,
    deleteStorageSource,
    setActiveSource,
    testStorageConnection,
};
