/**
 * Local Filesystem Storage Provider
 * For directly mounted drives, USB storage, or local directories.
 */

import fs from 'fs-extra';
import fsNative from 'fs';
import path from 'path';
import { IStorageProvider, FileItem, StorageSourceConfig } from '../storageTypes';

export class LocalFsProvider implements IStorageProvider {
    private basePath: string;

    constructor(config: StorageSourceConfig) {
        this.basePath = config.mountPath || '/';
    }

    private resolvePath(relativePath: string): string {
        // Prevent path traversal attacks
        const resolved = path.resolve(this.basePath, relativePath);
        if (!resolved.startsWith(path.resolve(this.basePath))) {
            throw new Error('Path traversal detected');
        }
        return resolved;
    }

    async listFiles(dirPath: string): Promise<FileItem[]> {
        const fullPath = this.resolvePath(dirPath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });

        const items: FileItem[] = [];
        for (const entry of entries) {
            // Skip hidden files
            if (entry.name.startsWith('.')) continue;

            const filePath = path.join(dirPath, entry.name).replace(/\\/g, '/');
            let size: number | null = null;
            let modifiedAt: number | null = null;

            try {
                const stat = await fs.stat(path.join(fullPath, entry.name));
                size = entry.isDirectory() ? null : stat.size;
                modifiedAt = Math.floor(stat.mtimeMs / 1000);
            } catch { }

            items.push({
                name: entry.name,
                path: filePath,
                is_dir: entry.isDirectory(),
                size,
                modified_at: modifiedAt,
            });
        }

        items.sort((a, b) => (b.is_dir === a.is_dir) ? a.name.localeCompare(b.name) : (b.is_dir ? 1 : -1));
        return items;
    }

    async getReadStream(filePath: string, options?: { start?: number, end?: number }): Promise<NodeJS.ReadableStream> {
        const fullPath = this.resolvePath(filePath);
        return fsNative.createReadStream(fullPath, options);
    }

    async getFileSize(filePath: string): Promise<number> {
        const fullPath = this.resolvePath(filePath);
        const stat = await fs.stat(fullPath);
        return stat.size;
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            const fullPath = this.resolvePath(filePath);
            return await fs.pathExists(fullPath);
        } catch {
            return false;
        }
    }

    getLocalPath(filePath: string): string | null {
        // Local FS files are always locally accessible!
        try {
            return this.resolvePath(filePath);
        } catch {
            return null;
        }
    }

    async testConnection(): Promise<{ ok: boolean; message: string }> {
        try {
            const exists = await fs.pathExists(this.basePath);
            if (!exists) return { ok: false, message: `Path does not exist: ${this.basePath}` };

            const stat = await fs.stat(this.basePath);
            if (!stat.isDirectory()) return { ok: false, message: `Not a directory: ${this.basePath}` };

            // Try to read directory
            await fs.readdir(this.basePath);
            return { ok: true, message: `Connected to ${this.basePath}` };
        } catch (err: any) {
            return { ok: false, message: `Local FS Error: ${err.message}` };
        }
    }

    dispose(): void {
        // No resources to clean up
    }
}
