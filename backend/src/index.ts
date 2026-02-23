
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
const BG_SCAN_INTERVAL = parseInt(process.env.BG_SCAN_INTERVAL || '1800000'); // 30 min default

fs.ensureDirSync(CACHE_DIR);
fs.ensureDirSync(path.join(CACHE_DIR, 'hls'));

function getSmbClient() {
    return new SMB2({
        share: `\\\\${NAS_HOST}\\${NAS_SHARE}`,
        domain: 'WORKGROUP',
        username: NAS_USER,
        password: NAS_PASS,
        autoCloseTimeout: 0,
        cacheSize: 1024 * 1024, // 1MB cache for better throughput
        autoRefresh: true
    });
}

const FORMAT_MAP: Record<string, string> = {
    'ts': 'mpegts', 'mkv': 'matroska', 'avi': 'avi', 'mp4': 'mp4',
    'mov': 'mov', 'wmv': 'asf', 'flv': 'flv', 'webm': 'webm',
    'm4v': 'mp4', '3gp': '3gp'
};

const MEDIA_EXTS = new Set(Object.keys(FORMAT_MAP).filter(e => e !== 'mp4'));

// ======================= SHARED STATE =======================

// Track active transcoding processes (both user-initiated and background)
const activeTranscodes: Record<string, {
    proc: any;
    client: any;
    lastProgress?: any;
    bytesRead?: number;
    lastWatchdogBytes?: number;
    lastWatchdogTimeMark?: string;
    lastActiveTime?: number; // FIXED: Only resets when progress moves
    retryLevel?: number;     // Track if we need to back off further
}> = {};

// Mutex: prevent duplicate starts for the same file (race condition from rapid requests)
const pendingStarts = new Set<string>();

// Track user activity to pause background work
let userLastActiveTime = 0;
const USER_ACTIVITY_THRESHOLD = 60000; // 1 minute pause after any user activity

// Track which file the background pre-transcoder is working on
let bgCurrentFile: string | null = null;
let bgScanRunning = false;

// Background stats for the status API
const bgStats = {
    enabled: false, // DISABLED: Stopping background work to save resources
    scanning: false,
    transcoding: false,
    currentFile: null as string | null,
    lastScan: null as string | null,
    totalFiles: 0,
    pendingFiles: 0,
    completedFiles: 0,
    errors: 0,
};

// ======================= CACHE HELPERS =======================

function getCacheKey(filePath: string): string {
    return Buffer.from(filePath).toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
}

function getHlsCacheDir(filePath: string): string {
    return path.join(CACHE_DIR, 'hls', getCacheKey(filePath));
}

async function isHlsCacheComplete(hlsDir: string): Promise<boolean> {
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    if (!await fs.pathExists(playlistPath)) return false;
    const content = await fs.readFile(playlistPath, 'utf8');
    // Must have ENDLIST and must NOT have DISCONTINUITY (which indicates gaps from bad resumes)
    if (!content.includes('#EXT-X-ENDLIST')) return false;
    if (content.includes('#EXT-X-DISCONTINUITY')) {
        console.log('HLS: Cache has DISCONTINUITY gaps, marking as incomplete:', hlsDir);
        return false;
    }
    return true;
}

async function isHlsCacheReady(hlsDir: string): Promise<boolean> {
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    if (!await fs.pathExists(playlistPath)) return false;
    const stat = await fs.stat(playlistPath);
    return stat.size > 50;
}

async function parsePlaylistInfo(hlsDir: string): Promise<{ totalDuration: number; segmentCount: number }> {
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    if (!await fs.pathExists(playlistPath)) return { totalDuration: 0, segmentCount: 0 };
    const content = await fs.readFile(playlistPath, 'utf8');
    let totalDuration = 0;
    let segmentCount = 0;
    for (const line of content.split('\n')) {
        const m = line.match(/#EXTINF:([\d.]+)/);
        if (m) {
            totalDuration += parseFloat(m[1]);
            segmentCount++;
        }
    }
    return { totalDuration, segmentCount };
}

// ======================= SHARED TRANSCODE FUNCTION =======================

/**
 * Core transcoding engine
 * Uses CIFS-mounted file path when available for instant seeking,
 * falls back to SMB pipe streaming otherwise.
 */
async function startTranscode(filePath: string, requestedStartTime: number = 0) {
    const cacheKey = Buffer.from(filePath).toString('base64url');
    const hlsDir = path.join(CACHE_DIR, 'hls', cacheKey);
    const playlistPath = path.join(hlsDir, 'playlist.m3u8');
    await fs.ensureDir(hlsDir);

    // Check for resumable partial cache
    const { totalDuration: cachedDuration, segmentCount: cachedSegments } = await parsePlaylistInfo(hlsDir);

    // DECISION: Should we resume where we left off, or JUMP to a new position?
    const isJump = requestedStartTime > (cachedDuration + 10);
    const isResume = !isJump && cachedSegments >= 3;
    const startTime = isJump ? requestedStartTime : (isResume ? cachedDuration : 0);

    const retryLevel = activeTranscodes[filePath]?.retryLevel || 0;

    // If we jump or start fresh, we must handle the playlist carefully.
    if (isJump || !isResume) {
        if (await fs.pathExists(hlsDir)) {
            console.log(`HLS: Resetting cache for ${isJump ? 'JUMP' : 'START'}`);
            const files = await fs.readdir(hlsDir);
            for (const f of files) {
                if (f.endsWith('.ts') || f.endsWith('.m3u8')) {
                    await fs.remove(path.join(hlsDir, f)).catch(() => { });
                }
            }
        }
    }

    // --- Determine input source: CIFS mount (fast seek) vs SMB pipe (slow) ---
    const nasLocalPath = `/nas/${filePath}`;
    const useCifsMount = await fs.pathExists(nasLocalPath);

    let inputSource: string;
    let client: any = null;

    if (useCifsMount) {
        // FAST PATH: File is accessible via CIFS mount → FFmpeg can seek natively
        inputSource = nasLocalPath;
        console.log(`HLS: Using CIFS mount (instant seek): ${nasLocalPath}`);
    } else {
        // SLOW PATH: Fallback to SMB pipe (no seeking, must read from byte 0)
        console.log(`HLS: CIFS mount not available, falling back to SMB pipe for ${filePath}`);
        client = getSmbClient();
        const smbPath = filePath.replace(/\//g, '\\');

        const PassThrough = require('stream').PassThrough;
        const pipeStream = new PassThrough();
        inputSource = pipeStream;

        (async () => {
            try {
                const readStream = await client.createReadStream(smbPath);
                readStream.pipe(pipeStream);
            } catch (err: any) {
                console.error('Stream Error:', err.message);
                pipeStream.destroy();
            }
        })();

        let bytesRead = 0;
        pipeStream.on('data', (chunk: Buffer) => {
            bytesRead += chunk.length;
            if (activeTranscodes[filePath]) activeTranscodes[filePath].bytesRead = bytesRead;
        });
    }

    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const inputFormat = FORMAT_MAP[ext] || 'matroska';

    const inputOpts: string[] = [
        '-analyzeduration', '1000000',
        '-probesize', '5000000',
        '-fflags', '+genpts'
    ];

    if (startTime > 0) {
        // -ss before -i = input seeking (instant for files, fast-forward for pipes)
        inputOpts.unshift('-ss', startTime.toFixed(3));
    }

    const outputOpts: string[] = [
        '-map', '0:v:0',
        '-map', '0:a:0',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        '-avoid_negative_ts', 'make_zero',
        '-max_muxing_queue_size', '1024',
        '-hls_time', '4',
        '-hls_list_size', '0',
        '-hls_playlist_type', isJump ? 'vod' : 'event',
        '-hls_flags', isJump ? '' : 'append_list',
        '-f', 'hls'
    ];

    if (isResume) {
        outputOpts.push('-start_number', String(cachedSegments));
        console.log(`Transcode: RESUMING ${filePath} from ${cachedSegments} segments (${startTime.toFixed(1)}s) [${useCifsMount ? 'CIFS' : 'PIPE'}]`);
    } else {
        outputOpts.push('-start_number', '0');
        console.log(`Transcode: STARTING ${filePath} at ${startTime.toFixed(1)}s [${useCifsMount ? 'CIFS' : 'PIPE'}]`);
    }

    const proc = ffmpeg(inputSource)
        .inputFormat(inputFormat)
        .inputOptions(inputOpts)
        .outputOptions(outputOpts)
        .output(playlistPath)
        .on('start', (cmd) => console.log('FFmpeg started:', cmd))
        .on('stderr', (line) => {
            if (line.includes('Error') || line.includes('error') || line.includes('Failed')) {
                console.warn(`FFmpeg [stderr] ${filePath}: ${line}`);
            }
        })
        .on('progress', (p) => {
            if (activeTranscodes[filePath]) {
                activeTranscodes[filePath].lastProgress = p;
            }
        })
        .on('error', (err) => {
            const isSuppressed = err.message.includes('SIGKILL') || err.message.includes('STATUS_FILE_CLOSED');
            if (!isSuppressed) {
                console.error(`FFmpeg error for ${filePath}:`, err.message);
            }
            if (client) { try { client.close(); } catch { } }
            delete activeTranscodes[filePath];
        })
        .on('end', () => {
            console.log(`Transcode COMPLETE: ${filePath}`);
            if (client) { try { client.close(); } catch { } }
            delete activeTranscodes[filePath];
        });

    proc.run();
    activeTranscodes[filePath] = { proc, client: client || {}, retryLevel };
    activeTranscodes[filePath].lastActiveTime = Date.now();
}

/**
 * Kill an active transcode by file path.
 */
function killTranscode(filePath: string) {
    const active = activeTranscodes[filePath];
    if (active) {
        try { active.proc.kill('SIGKILL'); } catch { }
        try { active.client.close(); } catch { }
        delete activeTranscodes[filePath];
    }
}

/**
 * Check if there are any user-initiated transcodes running
 * (i.e., transcodes that are NOT the background pre-transcoder).
 */
function hasUserTranscodes(): boolean {
    const activeUserTranscodes = Object.keys(activeTranscodes).some(k => k !== bgCurrentFile);
    const userIsWatching = (Date.now() - userLastActiveTime) < USER_ACTIVITY_THRESHOLD;

    return activeUserTranscodes || userIsWatching;
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
    userLastActiveTime = Date.now();
    const filePath = (req.query.path as string || '').replace(/\\/g, '/');
    if (!filePath) return res.status(400).send('Path required');

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

app.get('/api/hls/start', async (req, res) => {
    const filePath = (req.query.path as string || '').replace(/\\/g, '/');
    const seekTime = parseFloat(req.query.time as string) || 0;

    if (!filePath) return res.status(400).json({ error: 'Path required' });
    const cacheKey = Buffer.from(filePath).toString('base64url');
    const hlsDir = path.join(CACHE_DIR, 'hls', cacheKey);

    // Case 1: Cache is COMPLETE → instant playback, no transcoding needed
    if (await isHlsCacheComplete(hlsDir)) {
        console.log(`HLS: Complete cache hit for ${filePath}`);
        return res.json({ mode: 'hls', cached: true, playlistUrl: `/api/hls/${cacheKey}/playlist.m3u8` });
    }

    const { totalDuration: cachedDuration, segmentCount } = await parsePlaylistInfo(hlsDir);

    // Case 2: Partial cache exists AND user is seeking within the cached range
    //   → Return immediately for instant playback BUT also ensure FFmpeg is running
    //     to continue transcoding beyond the cache boundary.
    if (seekTime < (cachedDuration - 10) && segmentCount > 3) {
        console.log(`HLS: Partial cache hit (${segmentCount} segs, ${cachedDuration.toFixed(0)}s). Seeking within cache for ${filePath}`);

        // CRITICAL FIX: Ensure FFmpeg is running to continue from where cache ends!
        if (!activeTranscodes[filePath]) {
            console.log(`HLS: Starting resume transcode from ${cachedDuration.toFixed(0)}s to extend cache...`);
            startTranscode(filePath, cachedDuration).catch(err =>
                console.error('Resume transcode error:', err)
            );
            // Don't await — return cached segments immediately for instant playback
        }

        return res.json({ mode: 'hls', cached: false, playlistUrl: `/api/hls/${cacheKey}/playlist.m3u8` });
    }

    // Case 3: Need to START fresh or JUMP ahead of cache
    if (bgCurrentFile && bgCurrentFile !== filePath) {
        console.log('HLS: Freeing background resources for user request');
        killTranscode(bgCurrentFile);
        bgCurrentFile = null;
    }

    // If transcode is active but too far behind, kill and restart at seek point
    const active = activeTranscodes[filePath];
    if (active && seekTime > (cachedDuration + 10)) {
        console.log(`HLS: Seeker jumped to ${seekTime}s (cache ends at ${cachedDuration}s). Restarting FFmpeg...`);
        killTranscode(filePath);
    }

    // Start transcoding if not already running
    if (!activeTranscodes[filePath]) {
        const startAt = (segmentCount > 3 && cachedDuration > 10) ? cachedDuration : seekTime;
        console.log(`HLS: Initializing FFmpeg at ${startAt.toFixed(0)}s (seekTime=${seekTime}, cached=${cachedDuration.toFixed(0)}s)...`);
        await startTranscode(filePath, startAt).catch(err => console.error('Start error:', err));
    }

    // Wait for playlist AND at least 3 segments to be ready
    let ready = false;
    const playlistFile = path.join(hlsDir, 'playlist.m3u8');

    for (let i = 0; i < 40; i++) {
        const hasPlaylist = await fs.pathExists(playlistFile);
        const tsFiles = (await fs.readdir(hlsDir).catch(() => [])).filter(f => f.endsWith('.ts'));

        if (hasPlaylist && tsFiles.length >= 3) {
            ready = true;
            break;
        }
        await new Promise(r => setTimeout(r, 500));
    }

    if (!ready) {
        console.error(`HLS: FFmpeg timeout for ${filePath} (playlist=${await fs.pathExists(playlistFile)})`);
        return res.status(500).json({ error: 'FFmpeg startup timeout' });
    }

    res.json({ mode: 'hls', cached: false, playlistUrl: `/api/hls/${cacheKey}/playlist.m3u8` });
});

// ======================= HLS FILE SERVING =======================
app.get('/api/hls/:cacheKey/:file', async (req, res) => {
    // Update user activity timestamp whenever a segment or playlist is requested
    userLastActiveTime = Date.now();

    const { cacheKey, file } = req.params;
    const hlsDir = path.join(CACHE_DIR, 'hls', cacheKey);
    const targetFile = path.join(hlsDir, file);

    if (!await fs.pathExists(targetFile)) {
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
        res.setHeader('Cache-Control', 'no-cache');
    } else if (file.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'max-age=31536000');
    }

    res.sendFile(targetFile);
});

// ======================= HLS STOP (preserve cache) =======================
app.delete('/api/hls/stop', async (req, res) => {
    const filePath = (req.query.path as string || '').replace(/\\/g, '/');
    const active = activeTranscodes[filePath];
    if (active) {
        console.log('Stopping active transcode (user left):', filePath);
        killTranscode(filePath);
        // If this was the background transcode, clear it
        if (bgCurrentFile === filePath) bgCurrentFile = null;

        const hlsDir = getHlsCacheDir(filePath);
        const { segmentCount, totalDuration } = await parsePlaylistInfo(hlsDir);
        console.log(`HLS cache preserved: ${segmentCount} segments, ${totalDuration.toFixed(1)}s`);
    }
    res.send('OK');
});

// ======================= BACKGROUND PRE-TRANSCODE =======================

/**
 * Recursively scan a NAS directory and return media file paths.
 * Uses one SMB connection per directory to avoid timeout issues.
 */
async function scanDirectory(dirPath: string): Promise<{ files: string[]; dirs: string[] }> {
    const client = getSmbClient();
    const files: string[] = [];
    const dirs: string[] = [];

    try {
        const smbPath = dirPath ? dirPath.replace(/\//g, '\\') : '';
        const entries = await client.readdir(smbPath, { stats: true });

        for (const entry of entries) {
            const isDir = typeof entry.isDirectory === 'function' ? entry.isDirectory() : entry.isDirectory;
            const fp = dirPath ? `${dirPath}/${entry.name}` : entry.name;

            if (isDir) {
                dirs.push(fp);
            } else {
                const ext = entry.name.split('.').pop()?.toLowerCase() || '';
                if (MEDIA_EXTS.has(ext)) {
                    files.push(fp);
                }
            }
        }
    } catch (err: any) {
        console.error(`BG-Scan: Error reading "${dirPath}":`, err.message);
    } finally {
        try { await client.close(); } catch { }
    }

    return { files, dirs };
}

/**
 * Scan the entire NAS recursively and return all non-MP4 media file paths.
 */
async function scanAllMediaFiles(): Promise<string[]> {
    const allFiles: string[] = [];
    const queue: string[] = [''];

    while (queue.length > 0) {
        const dir = queue.shift()!;
        const { files, dirs } = await scanDirectory(dir);
        allFiles.push(...files);
        queue.push(...dirs);
    }

    return allFiles;
}

/**
 * Run one background pre-transcode cycle:
 * 1. Scan NAS for all media files
 * 2. Filter to files without complete cache
 * 3. Transcode each one at a time, pausing for user activity
 */
async function runPreTranscodeCycle() {
    if (bgScanRunning) return;
    bgScanRunning = true;
    bgStats.scanning = true;
    bgStats.errors = 0;

    try {
        console.log('═══ BG-Transcode: Starting scan cycle ═══');
        bgStats.lastScan = new Date().toISOString();

        // Step 1: Scan all files
        const allFiles = await scanAllMediaFiles();
        bgStats.totalFiles = allFiles.length;
        console.log(`BG-Transcode: Found ${allFiles.length} non-MP4 media files`);

        // Step 2: Find files needing transcoding
        const pending: string[] = [];
        for (const fp of allFiles) {
            const hlsDir = getHlsCacheDir(fp);
            if (!await isHlsCacheComplete(hlsDir)) {
                pending.push(fp);
            }
        }
        bgStats.pendingFiles = pending.length;
        bgStats.completedFiles = allFiles.length - pending.length;
        bgStats.scanning = false;
        console.log(`BG-Transcode: ${pending.length} files need transcoding, ${bgStats.completedFiles} already cached`);

        if (pending.length === 0) {
            console.log('BG-Transcode: All files are already cached! Nothing to do.');
            bgScanRunning = false;
            return;
        }

        // Step 3: Process each file
        for (let i = 0; i < pending.length; i++) {
            const fp = pending[i];

            // Wait if user is actively transcoding
            while (hasUserTranscodes()) {
                console.log('BG-Transcode: Waiting — user transcode active...');
                bgStats.transcoding = false;
                bgStats.currentFile = null;
                await new Promise(r => setTimeout(r, 10000));
            }

            // Double-check still needed (user might have played this file while we waited)
            if (await isHlsCacheComplete(getHlsCacheDir(fp))) {
                console.log(`BG-Transcode: [${i + 1}/${pending.length}] Skipping (already complete): ${fp}`);
                bgStats.completedFiles++;
                bgStats.pendingFiles--;
                continue;
            }

            console.log(`BG-Transcode: [${i + 1}/${pending.length}] Starting: ${fp}`);
            bgCurrentFile = fp;
            bgStats.transcoding = true;
            bgStats.currentFile = fp;

            try {
                await startTranscode(fp);

                // Wait for transcoding to complete (or be killed by user priority)
                const BG_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hour max per file
                const bgStartTime = Date.now();
                let lastLog = Date.now();

                while (activeTranscodes[fp]) {
                    // CRITICAL: Check for user activity (watching ANY video) - kill background work immediately if found
                    // This ensures player has 100% of resources for seekers and live playback.
                    if (hasUserTranscodes()) {
                        console.log(`BG-Transcode: [PAUSE] User watching video! Yielding resources immediately.`);
                        killTranscode(fp);
                        bgCurrentFile = null;
                        break;
                    }

                    // If a user started a different transcode explicitly, our process might have been killed elsewhere
                    if (bgCurrentFile !== fp) {
                        console.log(`BG-Transcode: Process was preempted for another file`);
                        break;
                    }

                    // Check if playlist is already complete (FFmpeg end event may have been missed)
                    if (await isHlsCacheComplete(getHlsCacheDir(fp))) {
                        console.log(`BG-Transcode: Playlist complete, cleaning up activeTranscodes`);
                        killTranscode(fp); // Clean up any lingering process
                        break;
                    }

                    // Safety timeout
                    if (Date.now() - bgStartTime > BG_TIMEOUT) {
                        console.log(`BG-Transcode: Timeout (4h) for ${fp}, moving on`);
                        killTranscode(fp);
                        break;
                    }

                    // Progress logging
                    const now = Date.now();
                    const info = activeTranscodes[fp];
                    const isInitializing = !info?.lastProgress;
                    const logInterval = isInitializing ? 10000 : 30000;

                    if (now - lastLog > logInterval) {
                        const hlsDir = path.join(CACHE_DIR, 'hls', Buffer.from(fp).toString('base64url'));
                        const { segmentCount } = await parsePlaylistInfo(hlsDir);
                        const prog = info?.lastProgress;
                        const currentTimeMark = prog?.timemark || '';

                        // WATCHDOG: Track if progress happened
                        const progressMoved = (currentTimeMark !== info.lastWatchdogTimeMark) ||
                            (info.bytesRead !== info.lastWatchdogBytes);

                        if (progressMoved) {
                            info.lastWatchdogTimeMark = currentTimeMark;
                            info.lastWatchdogBytes = info.bytesRead;
                            info.lastActiveTime = now; // Progress is healthy
                        }

                        // Check for stall
                        const timeSinceLastActive = now - (info.lastActiveTime || now);
                        if (timeSinceLastActive > 180000) {
                            console.log(`BG-Transcode: [WATCHDOG] Stalled for 3m (time=${currentTimeMark}), killing and leveling up back-off...`);
                            info.retryLevel = (info.retryLevel || 0) + 1;
                            killTranscode(fp);
                            break;
                        }

                        let status = '';
                        if (prog) {
                            status = `time=${prog.timemark} speed=${prog.currentSpeed}`;
                        } else {
                            const mbRead = ((info?.bytesRead || 0) / 1024 / 1024).toFixed(1);
                            status = `initializing (read ${mbRead}MB)...`;
                        }

                        console.log(`BG-Transcode: [progress] ${fp} — segments=${segmentCount}, ${status}`);
                        lastLog = now;
                    }

                    await new Promise(r => setTimeout(r, 2000));
                }

                // Check if it completed successfully
                if (await isHlsCacheComplete(getHlsCacheDir(fp))) {
                    console.log(`BG-Transcode: [${i + 1}/${pending.length}] COMPLETE: ${fp}`);
                    bgStats.completedFiles++;
                    bgStats.pendingFiles--;
                } else {
                    console.log(`BG-Transcode: [${i + 1}/${pending.length}] Incomplete (will retry next cycle): ${fp}`);
                }
            } catch (err: any) {
                console.error(`BG-Transcode: Error processing ${fp}:`, err.message);
                bgStats.errors++;
            }

            bgCurrentFile = null;
            bgStats.transcoding = false;
            bgStats.currentFile = null;

            // Brief pause between files
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log('═══ BG-Transcode: Scan cycle complete ═══');
    } catch (err) {
        console.error('BG-Transcode: Fatal error in cycle:', err);
    } finally {
        bgScanRunning = false;
        bgStats.scanning = false;
        bgStats.transcoding = false;
        bgStats.currentFile = null;
    }
}

/**
 * Main background loop: runs cycles with interval between them.
 */
async function bgTranscodeLoop() {
    // Wait 30s after server start before first scan
    await new Promise(r => setTimeout(r, 30000));
    console.log('BG-Transcode: Background pre-transcoding enabled');

    while (bgStats.enabled) {
        await runPreTranscodeCycle();

        // Wait before next cycle
        console.log(`BG-Transcode: Next scan in ${BG_SCAN_INTERVAL / 60000} minutes`);
        await new Promise(r => setTimeout(r, BG_SCAN_INTERVAL));
    }
}

// ======================= PRE-TRANSCODE STATUS API =======================
app.get('/api/pretranscode/status', (req, res) => {
    res.json({
        ...bgStats,
        activeTranscodes: Object.keys(activeTranscodes),
    });
});

// Trigger an immediate scan
app.post('/api/pretranscode/scan', (req, res) => {
    if (bgScanRunning) {
        return res.json({ message: 'Scan already in progress' });
    }
    // Run in background
    runPreTranscodeCycle().catch(err => console.error('Manual scan error:', err));
    res.json({ message: 'Scan started' });
});

// Toggle enable/disable
app.post('/api/pretranscode/toggle', (req, res) => {
    bgStats.enabled = !bgStats.enabled;
    console.log(`BG-Transcode: ${bgStats.enabled ? 'ENABLED' : 'DISABLED'}`);
    res.json({ enabled: bgStats.enabled });
});

// ======================= START SERVER =======================
app.listen(8000, () => {
    console.log('Server running on port 8000');

    // Start the background pre-transcode loop (Commented out to stop background work)
    console.log('BG-Transcode: Background pre-transcoding is DISABLED by user request');
    // bgTranscodeLoop().catch(err => console.error('BG loop fatal:', err));
});
