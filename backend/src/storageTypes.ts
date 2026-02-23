/**
 * Multi-Storage Provider Types
 * 
 * Extensible design: add new StorageType values and provider implementations
 * to support additional backends (Google Drive, OneDrive, Dropbox, etc.)
 */

// ─── Storage Types ───

export type StorageType = 'smb' | 'webdav' | 'local' | 's3' | 'gdrive' | 'onedrive';

export interface StorageSourceConfig {
    // SMB
    host?: string;
    share?: string;
    username?: string;
    password?: string;
    serverName?: string;
    // WebDAV
    url?: string;
    // Local FS
    mountPath?: string;
    // OAuth-based (Google Drive)
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    rootFolderId?: string;
    // S3 (future)
    endpoint?: string;
    bucket?: string;
    accessKey?: string;
    secretKey?: string;
    region?: string;
    // OAuth-based (future)
    accessToken?: string;
}

export interface StorageSource {
    id: string;
    name: string;
    type: StorageType;
    config: StorageSourceConfig;
    isActive: boolean;
}

export interface StorageConfigFile {
    sources: StorageSource[];
    activeSourceId: string | null;
}

// ─── File Item (common format) ───

export interface FileItem {
    name: string;
    path: string;
    is_dir: boolean;
    size: number | null;
    modified_at?: number | null;
}

// ─── Provider Interface ───

export interface IStorageProvider {
    /** List files/directories at the given path */
    listFiles(dirPath: string): Promise<FileItem[]>;

    /** Get a readable stream for the file, optionally for a specific range */
    getReadStream(filePath: string, options?: { start?: number, end?: number }): Promise<NodeJS.ReadableStream>;

    /** Get file size in bytes */
    getFileSize(filePath: string): Promise<number>;

    /** Check if a file/directory exists */
    exists(filePath: string): Promise<boolean>;

    /**
     * Get a local filesystem path for the file (for FFmpeg direct access).
     * Returns null if the file is not locally accessible (e.g., cloud storage).
     */
    getLocalPath(filePath: string): string | null;

    /** Test the connection to the storage backend */
    testConnection(): Promise<{ ok: boolean; message: string }>;

    /** Clean up resources (close connections, etc.) */
    dispose(): void;
}
