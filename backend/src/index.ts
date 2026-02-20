
import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import SMB2 from '@marsaud/smb2';
import ffmpeg from 'fluent-ffmpeg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

app.get('/health', (req, res) => res.send('OK'));

process.on('uncaughtException', (err) => {
    console.error('FATAL UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const NAS_HOST = process.env.NAS_HOST || '';
const NAS_SHARE = process.env.NAS_SHARE || '';
const NAS_USER = process.env.NAS_USER || '';
const NAS_PASS = process.env.NAS_PASS || '';
const CACHE_DIR = process.env.CACHE_DIR || '/cache';

fs.ensureDirSync(CACHE_DIR);
fs.ensureDirSync(path.join(CACHE_DIR, 'hls'));

function getSmbClient() {
    return new SMB2({
        share: `\\\\${NAS_HOST}\\${NAS_SHARE}`,
        domain: 'WORKGROUP',
        username: NAS_USER,
        password: NAS_PASS,
        autoCloseTimeout: 0
    });
}

const FORMAT_MAP: Record<string, string> = {
    'ts': 'mpegts', 'mkv': 'matroska', 'avi': 'avi', 'mp4': 'mp4',
    'mov': 'mov', 'wmv': 'asf', 'flv': 'flv', 'webm': 'webm',
    'm4v': 'mp4', '3gp': '3gp'
};

// Track active transcoding processes so we don't double-start
const activeTranscodes: Record<string, { proc: any; client: any }> = {};

/**
 * Get a stable, filesystem-safe cache key for a file path.
 * Uses base64 encoding of the path.
 */
function getCacheKey(filePath: string): string {
    // Use URL-safe base64 to avoid / in filenames
    return Buffer.from(filePath).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
}

/**
 * Get the HLS cache directory for a file
 */
function getHlsCacheDir(filePath: string): string {
    return path.join(CACHE_DIR, 'hls', getCacheKey(filePath));
}

/**
 * Check if HLS cache is complete (has #EXT-X-ENDLIST in playlist)
 */
async function isHlsCacheComplete(hlsDir: string): Promise<boolean> {
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    if (!await fs.pathExists(playlistPath)) return false;
    const content = await fs.readFile(playlistPath, 'utf8');
    return content.includes('#EXT-X-ENDLIST');
}

/**
 * Check if HLS cache has at least some segments ready for playback
 */
async function isHlsCacheReady(hlsDir: string): Promise<boolean> {
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    if (!await fs.pathExists(playlistPath)) return false;
    const stat = await fs.stat(playlistPath);
    return stat.size > 50; // Playlist has some content
}

// ======================= LIST =======================
app.get('/api/list', async (req, res) => {
    const relativePath = (req.query.path as string || '').replace(/\\/g, '/');
    const client = getSmbClient();

    try {
        const smbPath = relativePath ? relativePath.replace(/\//g, '\\') : '';
        const files = await client.readdir(smbPath, { stats: true });

        const items = await Promise.all(files.map(async (file: any) => {
            const isDir = typeof file.isDirectory === 'function' ? file.isDirectory() : file.isDirectory;
            const filePath = path.join(relativePath, file.name).replace(/\\/g, '/');

            return {
                name: file.name,
                path: filePath,
                is_dir: isDir,
                size: file.size,
            };
        }));

        items.sort((a, b) => (b.is_dir === a.is_dir) ? a.name.localeCompare(b.name) : (b.is_dir ? 1 : -1));
        res.json(items);
    } catch (err: any) {
        console.error('List error:', err);
        res.status(500).json({ error: err.message });
    } finally {
        try { await client.close(); } catch { }
    }
});

// ======================= STREAM (MP4 direct) =======================
app.get('/api/stream', async (req, res) => {
    const filePath = (req.query.path as string || '').replace(/\\/g, '/');
    if (!filePath) return res.status(400).send('Path required');

    // Only handle MP4 direct streaming
    if (!filePath.toLowerCase().endsWith('.mp4')) {
        return res.status(415).json({ error: 'Use /api/hls/start for non-MP4 files' });
    }

    console.log('Stream: Direct MP4 for:', filePath);
    const client = getSmbClient();
    const smbPath = filePath.replace(/\//g, '\\');

    try {
        const size = await client.getSize(smbPath);
        const range = req.headers.range;

        res.on('finish', () => { try { client.close(); } catch { } });
        res.on('close', () => { try { client.close(); } catch { } });

        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
            const chunksize = (end - start) + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            });

            const stream = await client.createReadStream(smbPath, { start, end });
            stream.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': size,
                'Content-Type': 'video/mp4',
            });
            const stream = await client.createReadStream(smbPath);
            stream.pipe(res);
        }
    } catch (e) {
        console.error('Stream error:', e);
        try { await client.close(); } catch { }
        if (!res.headersSent) res.status(500).send('Stream error');
    }
});

// ======================= HLS START (with permanent cache) =======================
app.get('/api/hls/start', async (req, res) => {
    const filePath = (req.query.path as string || '').replace(/\\/g, '/');
    if (!filePath) return res.status(400).json({ error: 'Path required' });

    const hlsDir = getHlsCacheDir(filePath);
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    const cacheKey = getCacheKey(filePath);

    // ---- Case 1: Cache is COMPLETE (all segments exist) -> instant playback ----
    if (await isHlsCacheComplete(hlsDir)) {
        console.log('HLS: Serving from complete cache:', filePath);
        return res.json({
            mode: 'hls',
            cached: true,
            playlistUrl: `/api/hls/${cacheKey}/playlist.m3u8`
        });
    }

    // ---- Case 2: Cache is IN PROGRESS (transcoding is running) -> serve partial ----
    if (await isHlsCacheReady(hlsDir) && activeTranscodes[filePath]) {
        console.log('HLS: Serving from in-progress cache:', filePath);
        return res.json({
            mode: 'hls',
            cached: false,
            playlistUrl: `/api/hls/${cacheKey}/playlist.m3u8`
        });
    }

    // ---- Case 3: No cache, start fresh transcoding ----
    // Clean up any stale partial cache
    if (await fs.pathExists(hlsDir)) {
        await fs.remove(hlsDir);
    }
    await fs.ensureDir(hlsDir);

    console.log('HLS: Starting fresh transcode for:', filePath);

    const client = getSmbClient();
    const smbPath = filePath.replace(/\//g, '\\');

    try {
        const smbStream = await client.createReadStream(smbPath);

        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const inputFormat = FORMAT_MAP[ext] || 'matroska';

        const proc = ffmpeg()
            .input(smbStream)
            .inputFormat(inputFormat)
            .inputOptions([
                '-analyzeduration', '10000000',
                '-probesize', '50000000',
                '-fflags', '+genpts'
            ])
            .outputOptions([
                '-map 0:v:0',
                '-map 0:a:0',
                '-c:v libx264',
                '-preset ultrafast',
                '-tune zerolatency',
                '-c:a aac', '-b:a 128k', '-ac 2',
                '-avoid_negative_ts', 'make_zero',
                '-hls_time 4',
                '-hls_list_size 0',       // Keep ALL segments in playlist (VOD-style)
                '-hls_flags append_list',
                '-start_number 0',
                '-f hls'
            ])
            .output(playlistPath)
            .on('start', (cmd) => {
                console.log('HLS FFmpeg started:', cmd);
            })
            .on('error', (err) => {
                if (err.message.includes('SIGKILL')) return;
                console.error('HLS FFmpeg error:', err.message);
                try { client.close(); } catch { }
                delete activeTranscodes[filePath];
            })
            .on('end', () => {
                console.log('HLS transcode COMPLETE for:', filePath);
                try { client.close(); } catch { }
                delete activeTranscodes[filePath];
            });

        proc.run();
        activeTranscodes[filePath] = { proc, client };

        // Wait for first segment to become available
        let waited = 0;
        while (waited < 30000) {
            if (await isHlsCacheReady(hlsDir)) {
                // Also wait for at least 1 .ts segment file
                const files = await fs.readdir(hlsDir);
                if (files.some(f => f.endsWith('.ts'))) {
                    break;
                }
            }
            await new Promise(r => setTimeout(r, 500));
            waited += 500;
        }

        if (!await isHlsCacheReady(hlsDir)) {
            console.error('HLS playlist not generated within timeout');
            try { proc.kill('SIGKILL'); } catch { }
            try { await client.close(); } catch { }
            delete activeTranscodes[filePath];
            await fs.remove(hlsDir).catch(() => { });
            return res.status(500).json({ error: 'HLS generation timeout' });
        }

        console.log('HLS: First segments ready, responding to client');
        res.json({
            mode: 'hls',
            cached: false,
            playlistUrl: `/api/hls/${cacheKey}/playlist.m3u8`
        });
    } catch (e) {
        console.error('HLS start error:', e);
        try { await client.close(); } catch { }
        delete activeTranscodes[filePath];
        await fs.remove(hlsDir).catch(() => { });
        res.status(500).json({ error: 'Failed to start HLS' });
    }
});

// ======================= HLS FILE SERVING =======================
app.get('/api/hls/:cacheKey/:file', async (req, res) => {
    const { cacheKey, file } = req.params;
    const hlsDir = path.join(CACHE_DIR, 'hls', cacheKey);
    const targetFile = path.join(hlsDir, file);

    if (!await fs.pathExists(targetFile)) {
        // Segment might not be ready yet if transcoding is in progress
        // Wait briefly for it
        let waited = 0;
        while (waited < 5000) {
            if (await fs.pathExists(targetFile)) break;
            await new Promise(r => setTimeout(r, 300));
            waited += 300;
        }

        if (!await fs.pathExists(targetFile)) {
            return res.status(404).send('Segment not found');
        }
    }

    if (file.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache'); // Always fetch latest playlist
    } else if (file.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'max-age=31536000'); // TS segments are immutable
    }

    res.sendFile(targetFile);
});

// ======================= HLS STOP (optional, for cleanup on page leave) =======================
app.delete('/api/hls/stop', (req, res) => {
    const filePath = (req.query.path as string || '').replace(/\\/g, '/');
    // We do NOT delete the cache! Only stop active transcoding if user leaves early.
    const active = activeTranscodes[filePath];
    if (active) {
        console.log('Stopping active transcode (user left):', filePath);
        try { active.proc.kill('SIGKILL'); } catch { }
        try { active.client.close(); } catch { }
        delete activeTranscodes[filePath];
        // Note: partial cache is kept. Next time user visits, it will restart.
        // We could keep partial cache too, but HLS append might not work well.
        // So clean up partial cache:
        const hlsDir = getHlsCacheDir(filePath);
        isHlsCacheComplete(hlsDir).then(complete => {
            if (!complete) {
                fs.remove(hlsDir).catch(() => { });
            }
        });
    }
    res.send('OK');
});

app.listen(8000, () => {
    console.log('Server running on port 8000');
});
