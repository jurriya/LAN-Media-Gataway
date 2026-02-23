/**
 * SMB Storage Provider
 * Wraps the existing @marsaud/smb2 client behind the IStorageProvider interface.
 */

import SMB2 from '@marsaud/smb2';
import path from 'path';
import { IStorageProvider, FileItem, StorageSourceConfig } from '../storageTypes';

export class SmbProvider implements IStorageProvider {
    private config: StorageSourceConfig;
    private shareString: string;

    constructor(config: StorageSourceConfig) {
        this.config = config;
        this.shareString = `\\\\${config.host}\\${config.share}`;
    }

    private createClient(): any {
        return new SMB2({
            share: this.shareString,
            domain: 'WORKGROUP',
            username: this.config.username || '',
            password: this.config.password || '',
            autoCloseTimeout: 0,
            cacheSize: 1024 * 1024,
            autoRefresh: true
        } as any);
    }

    async listFiles(dirPath: string): Promise<FileItem[]> {
        const client = this.createClient();
        try {
            const smbPath = dirPath ? dirPath.replace(/\//g, '\\') : '';
            const files = await client.readdir(smbPath, { stats: true });

            const items: FileItem[] = files.map((file: any) => {
                const isDir = typeof file.isDirectory === 'function' ? file.isDirectory() : file.isDirectory;
                const filePath = path.join(dirPath, file.name).replace(/\\/g, '/');
                return {
                    name: file.name,
                    path: filePath,
                    is_dir: isDir,
                    size: file.size ?? null,
                };
            });

            items.sort((a, b) => (b.is_dir === a.is_dir) ? a.name.localeCompare(b.name) : (b.is_dir ? 1 : -1));
            return items;
        } finally {
            try { await client.close(); } catch { }
        }
    }

    async getReadStream(filePath: string, options?: { start?: number, end?: number }): Promise<NodeJS.ReadableStream> {
        const client = this.createClient();
        const smbPath = filePath.replace(/\//g, '\\');
        const stream = await client.createReadStream(smbPath, options);
        // Close client when stream ends or errors
        stream.on('end', () => { try { client.close(); } catch { } });
        stream.on('error', () => { try { client.close(); } catch { } });
        return stream;
    }

    async getFileSize(filePath: string): Promise<number> {
        const client = this.createClient();
        try {
            const smbPath = filePath.replace(/\//g, '\\');
            return await client.getSize(smbPath);
        } finally {
            try { await client.close(); } catch { }
        }
    }

    async exists(filePath: string): Promise<boolean> {
        const client = this.createClient();
        try {
            const smbPath = filePath.replace(/\//g, '\\');
            await client.stat(smbPath);
            return true;
        } catch {
            return false;
        } finally {
            try { await client.close(); } catch { }
        }
    }

    getLocalPath(filePath: string): string | null {
        // Check if CIFS mount is available at /nas/
        const localPath = `/nas/${filePath}`;
        try {
            const fs = require('fs');
            if (fs.existsSync(localPath)) return localPath;
        } catch { }
        return null;
    }

    async testConnection(): Promise<{ ok: boolean; message: string }> {
        const client = this.createClient();
        try {
            await client.readdir('', { stats: false });
            return { ok: true, message: `Connected to ${this.shareString}` };
        } catch (err: any) {
            return { ok: false, message: `SMB Error: ${err.message}` };
        } finally {
            try { await client.close(); } catch { }
        }
    }

    dispose(): void {
        // No persistent resources to clean up (clients are per-request)
    }
}
