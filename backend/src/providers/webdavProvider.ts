/**
 * WebDAV Storage Provider
 * Uses the 'webdav' npm package to connect to WebDAV-compatible servers
 * (Synology, Nextcloud, ownCloud, Apache, nginx, etc.)
 */

import { createClient, WebDAVClient, FileStat } from 'webdav';
import { Readable } from 'stream';
import { IStorageProvider, FileItem, StorageSourceConfig } from '../storageTypes';

export class WebDavProvider implements IStorageProvider {
    private client: WebDAVClient;
    private config: StorageSourceConfig;

    constructor(config: StorageSourceConfig) {
        this.config = config;
        this.client = createClient(config.url || '', {
            username: config.username || '',
            password: config.password || '',
        });
    }

    async listFiles(dirPath: string): Promise<FileItem[]> {
        const remotePath = dirPath ? `/${dirPath}` : '/';
        const contents = await this.client.getDirectoryContents(remotePath) as FileStat[];

        const items: FileItem[] = contents.map((item) => {
            // Remove leading / and the base path to get relative path
            let relativePath = item.filename;
            if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);

            return {
                name: item.basename,
                path: relativePath,
                is_dir: item.type === 'directory',
                size: item.size ?? null,
                modified_at: item.lastmod ? Math.floor(new Date(item.lastmod).getTime() / 1000) : null,
            };
        });

        items.sort((a, b) => (b.is_dir === a.is_dir) ? a.name.localeCompare(b.name) : (b.is_dir ? 1 : -1));
        return items;
    }

    async getReadStream(filePath: string, options?: { start?: number, end?: number }): Promise<NodeJS.ReadableStream> {
        const remotePath = `/${filePath}`;
        const requestOptions: any = {};
        if (options && (options.start !== undefined || options.end !== undefined)) {
            requestOptions.range = `bytes=${options.start ?? 0}-${options.end ?? ''}`;
        }
        const stream = this.client.createReadStream(remotePath, requestOptions);
        return stream as unknown as NodeJS.ReadableStream;
    }

    async getFileSize(filePath: string): Promise<number> {
        const remotePath = `/${filePath}`;
        const stat = await this.client.stat(remotePath) as FileStat;
        return stat.size || 0;
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            const remotePath = `/${filePath}`;
            return await this.client.exists(remotePath);
        } catch {
            return false;
        }
    }

    getLocalPath(_filePath: string): string | null {
        // WebDAV files are not locally accessible
        return null;
    }

    async testConnection(): Promise<{ ok: boolean; message: string }> {
        try {
            await this.client.getDirectoryContents('/');
            return { ok: true, message: `Connected to ${this.config.url}` };
        } catch (err: any) {
            return { ok: false, message: `WebDAV Error: ${err.message}` };
        }
    }

    dispose(): void {
        // webdav client has no persistent connections to clean up
    }
}
