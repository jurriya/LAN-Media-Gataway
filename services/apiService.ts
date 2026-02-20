
const API_BASE = '/api'; // Vite proxy forwards to localhost:8000/api

export interface FileItem {
    name: string;
    path: string;
    is_dir: boolean;
    size: number | null;
    status?: 'none' | 'queued' | 'processing' | 'done' | 'error';
}

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
        // /health is defined in backend root and proxied by Vite
        const response = await fetch('/health');
        return response.ok;
    } catch (error) {
        console.error('Health check failed:', error);
        return false;
    }
};

export const apiService = {
    fetchFileList,
    getFiles,
    getStreamUrl,
    checkHealth
};
