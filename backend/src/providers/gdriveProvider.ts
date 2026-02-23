import { google, drive_v3 } from 'googleapis';
import { IStorageProvider, FileItem, StorageSourceConfig } from '../storageTypes';
import { Readable } from 'stream';

export class GDriveProvider implements IStorageProvider {
    private drive: drive_v3.Drive;
    private auth;
    private rootFolderId: string;

    constructor(config: StorageSourceConfig) {
        this.auth = new google.auth.OAuth2(
            config.clientId,
            config.clientSecret
        );
        this.auth.setCredentials({
            refresh_token: config.refreshToken
        });
        this.drive = google.drive({ version: 'v3', auth: this.auth });
        this.rootFolderId = config.rootFolderId || 'root';
    }

    private async getFileIdByPath(filePath: string): Promise<string> {
        if (!filePath || filePath === '/') return this.rootFolderId;

        const parts = filePath.split('/').filter(p => p);
        let parentId = this.rootFolderId;

        for (const part of parts) {
            const res = await this.drive.files.list({
                q: `'${parentId}' in parents and name = '${part.replace(/'/g, "\\'")}' and trashed = false`,
                fields: 'files(id, name)',
                spaces: 'drive',
            });

            const files = res.data.files || [];
            if (files.length === 0) throw new Error(`File not found: ${part}`);
            parentId = files[0].id!;
        }

        return parentId;
    }

    async listFiles(dirPath: string): Promise<FileItem[]> {
        const folderId = await this.getFileIdByPath(dirPath);
        const res = await this.drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType, size, modifiedTime)',
            spaces: 'drive',
        });

        const files = res.data.files || [];
        const items: FileItem[] = files.map(file => {
            const isDir = file.mimeType === 'application/vnd.google-apps.folder';
            const itemPath = (dirPath === '/' ? '' : dirPath) + '/' + file.name;
            return {
                name: file.name!,
                path: itemPath.startsWith('/') ? itemPath.substring(1) : itemPath,
                is_dir: isDir,
                size: file.size ? parseInt(file.size, 10) : null,
                modified_at: file.modifiedTime ? Math.floor(new Date(file.modifiedTime).getTime() / 1000) : null,
            };
        });

        // Sort: directories first, then name
        items.sort((a, b) => (b.is_dir === a.is_dir) ? a.name.localeCompare(b.name) : (b.is_dir ? 1 : -1));
        return items;
    }

    async getReadStream(filePath: string, options?: { start?: number, end?: number }): Promise<NodeJS.ReadableStream> {
        const fileId = await this.getFileIdByPath(filePath);

        const headers: any = {};
        if (options && (options.start !== undefined || options.end !== undefined)) {
            headers.Range = `bytes=${options.start ?? 0}-${options.end ?? ''}`;
        }

        const res = await this.drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream', headers }
        );

        return res.data as NodeJS.ReadableStream;
    }

    async getFileSize(filePath: string): Promise<number> {
        const fileId = await this.getFileIdByPath(filePath);
        const res = await this.drive.files.get({
            fileId,
            fields: 'size',
        });
        return parseInt(res.data.size || '0', 10);
    }

    async exists(filePath: string): Promise<boolean> {
        try {
            await this.getFileIdByPath(filePath);
            return true;
        } catch {
            return false;
        }
    }

    getLocalPath(_filePath: string): string | null {
        return null; // Cloud storage not locally accessible
    }

    async testConnection(): Promise<{ ok: boolean; message: string }> {
        try {
            await this.drive.files.list({ pageSize: 1 });
            return { ok: true, message: 'Connected to Google Drive' };
        } catch (err: any) {
            return { ok: false, message: `Google Drive Error: ${err.message}` };
        }
    }

    dispose(): void {
        // No persistent connections to close
    }
}
