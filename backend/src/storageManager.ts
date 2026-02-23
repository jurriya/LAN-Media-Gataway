/**
 * Storage Manager
 * 
 * Manages storage source configurations (persist to JSON file),
 * creates provider instances, and handles active source switching.
 */

import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { IStorageProvider, StorageSource, StorageSourceConfig, StorageConfigFile, StorageType } from './storageTypes';
import { SmbProvider } from './providers/smbProvider';
import { WebDavProvider } from './providers/webdavProvider';
import { LocalFsProvider } from './providers/localFsProvider';
import { GDriveProvider } from './providers/gdriveProvider';

// Helper for generating UUIDs (fallback for environments without randomUUID)
const generateId = () => {
    try {
        return crypto.randomUUID();
    } catch {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
};

export class StorageManager {
    private configPath: string;
    private config: StorageConfigFile;
    private activeProvider: IStorageProvider | null = null;

    constructor(cacheDir: string) {
        this.configPath = path.join(cacheDir, 'storage-config.json');
        this.config = { sources: [], activeSourceId: null };
    }

    /** Load config from disk, or initialize with defaults */
    async init(envDefaults?: { host: string; share: string; user: string; pass: string; serverName?: string }) {
        try {
            if (await fs.pathExists(this.configPath)) {
                this.config = await fs.readJSON(this.configPath);
                console.log(`Storage: Loaded ${this.config.sources.length} source(s) from config`);
            }
        } catch (err) {
            console.warn('Storage: Failed to load config, using defaults:', err);
            this.config = { sources: [], activeSourceId: null };
        }

        // Auto-create default SMB source from env if no sources exist
        if (this.config.sources.length === 0 && envDefaults?.host) {
            const defaultSource: StorageSource = {
                id: generateId(),
                name: `NAS (${envDefaults.host})`,
                type: 'smb',
                config: {
                    host: envDefaults.host,
                    share: envDefaults.share,
                    username: envDefaults.user,
                    password: envDefaults.pass,
                    serverName: envDefaults.serverName,
                },
                isActive: true,
            };
            this.config.sources.push(defaultSource);
            this.config.activeSourceId = defaultSource.id;
            await this.save();
            console.log(`Storage: Created default SMB source from env vars`);
        }

        // Activate the active source
        if (this.config.activeSourceId) {
            this.activateProvider(this.config.activeSourceId);
        }
    }

    /** Persist config to disk */
    private async save(): Promise<void> {
        await fs.writeJSON(this.configPath, this.config, { spaces: 2 });
    }

    /** Create a provider instance from a source config */
    private createProvider(source: StorageSource): IStorageProvider {
        switch (source.type) {
            case 'smb':
                return new SmbProvider(source.config);
            case 'webdav':
                return new WebDavProvider(source.config);
            case 'local':
                return new LocalFsProvider(source.config);
            case 'gdrive':
                return new GDriveProvider(source.config);
            default:
                throw new Error(`Unsupported storage type: ${source.type}`);
        }
    }

    /** Switch to a specific source */
    private activateProvider(sourceId: string): void {
        if (this.activeProvider) {
            this.activeProvider.dispose();
        }
        const source = this.config.sources.find(s => s.id === sourceId);
        if (!source) {
            console.warn(`Storage: Source ${sourceId} not found`);
            this.activeProvider = null;
            return;
        }
        this.activeProvider = this.createProvider(source);
        console.log(`Storage: Activated [${source.type}] "${source.name}"`);
    }

    /** Get the currently active provider */
    getActiveProvider(): IStorageProvider {
        if (!this.activeProvider) {
            throw new Error('No active storage source configured. Go to Settings to add one.');
        }
        return this.activeProvider;
    }

    /** Get the active source config */
    getActiveSource(): StorageSource | null {
        if (!this.config.activeSourceId) return null;
        return this.config.sources.find(s => s.id === this.config.activeSourceId) || null;
    }

    /** Get all configured sources */
    getSources(): StorageSource[] {
        // Return sources with passwords masked
        return this.config.sources.map(s => ({
            ...s,
            config: {
                ...s.config,
                password: s.config.password ? '••••••' : undefined,
                secretKey: s.config.secretKey ? '••••••' : undefined,
                clientSecret: s.config.clientSecret ? '••••••' : undefined,
                accessToken: s.config.accessToken ? '••••••' : undefined,
                refreshToken: s.config.refreshToken ? '••••••' : undefined,
            }
        }));
    }

    /** Add a new source */
    async addSource(name: string, type: StorageType, config: StorageSourceConfig): Promise<StorageSource> {
        const source: StorageSource = {
            id: generateId(),
            name,
            type,
            config,
            isActive: this.config.sources.length === 0, // First source is auto-active
        };
        this.config.sources.push(source);
        if (source.isActive) {
            this.config.activeSourceId = source.id;
            this.activateProvider(source.id);
        }
        await this.save();
        return source;
    }

    /** Update an existing source */
    async updateSource(id: string, updates: { name?: string; config?: StorageSourceConfig }): Promise<StorageSource | null> {
        const source = this.config.sources.find(s => s.id === id);
        if (!source) return null;

        if (updates.name) source.name = updates.name;
        if (updates.config) {
            // Merge config, keeping existing values for masked fields
            for (const [key, value] of Object.entries(updates.config)) {
                if (value !== undefined && value !== '••••••') {
                    (source.config as any)[key] = value;
                }
            }
        }

        // If this is the active source, re-activate to pick up changes
        if (this.config.activeSourceId === id) {
            this.activateProvider(id);
        }

        await this.save();
        return source;
    }

    /** Delete a source */
    async deleteSource(id: string): Promise<boolean> {
        const idx = this.config.sources.findIndex(s => s.id === id);
        if (idx === -1) return false;

        this.config.sources.splice(idx, 1);

        if (this.config.activeSourceId === id) {
            // Switch to first remaining source, or null
            if (this.config.sources.length > 0) {
                this.config.activeSourceId = this.config.sources[0].id;
                this.activateProvider(this.config.sources[0].id);
            } else {
                this.config.activeSourceId = null;
                if (this.activeProvider) {
                    this.activeProvider.dispose();
                    this.activeProvider = null;
                }
            }
        }

        await this.save();
        return true;
    }

    /** Set a source as active */
    async setActive(id: string): Promise<boolean> {
        const source = this.config.sources.find(s => s.id === id);
        if (!source) return false;

        // Update isActive flags
        this.config.sources.forEach(s => s.isActive = s.id === id);
        this.config.activeSourceId = id;
        this.activateProvider(id);
        await this.save();
        return true;
    }

    /** Test connection for a given config (without saving) */
    async testConnection(type: StorageType, config: StorageSourceConfig): Promise<{ ok: boolean; message: string }> {
        const tempSource: StorageSource = { id: 'test', name: 'test', type, config, isActive: false };
        const provider = this.createProvider(tempSource);
        try {
            return await provider.testConnection();
        } finally {
            provider.dispose();
        }
    }
}
