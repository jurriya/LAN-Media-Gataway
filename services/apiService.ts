
import { NasItem } from '../types';

/**
 * All requests go through Vite proxy (/api → localhost:8000).
 * In production, configure a reverse proxy or update the base URL.
 */
const API_BASE = '';   // empty = same origin (vite proxy handles it)

export async function fetchFileList(path: string = ''): Promise<NasItem[]> {
    const res = await fetch(`${API_BASE}/api/list?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`Failed to list files: ${res.status}`);
    return res.json();
}

export function getStreamUrl(path: string): string {
    return `${API_BASE}/api/stream?path=${encodeURIComponent(path)}`;
}

export async function requestHls(path: string): Promise<{ id: string; m3u8_url: string }> {
    const res = await fetch(`${API_BASE}/api/hls?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`HLS request failed: ${res.status}`);
    return res.json();
}

export async function checkHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        return res.ok;
    } catch {
        return false;
    }
}
