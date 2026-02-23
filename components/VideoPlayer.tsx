
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppSettings } from '../types';
import { apiService } from '../services/apiService';
import Hls from 'hls.js';

interface VideoPlayerProps {
    settings: AppSettings;
}

function hasNativeHls(): boolean {
    const v = document.createElement('video');
    return !!v.canPlayType('application/vnd.apple.mpegurl');
}

function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function fmt(s: number): string {
    if (!s || !isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
        : `${m}:${sec.toString().padStart(2, '0')}`;
}

// --- Playback position persistence ---
const STORAGE_KEY_PREFIX = 'video_pos_';
function getSavedPosition(fp: string): number {
    try {
        const val = localStorage.getItem(STORAGE_KEY_PREFIX + fp);
        return val ? parseFloat(val) : 0;
    } catch { return 0; }
}
function savePosition(fp: string, time: number) {
    try { localStorage.setItem(STORAGE_KEY_PREFIX + fp, String(time)); } catch { }
}
function clearPosition(fp: string) {
    try { localStorage.removeItem(STORAGE_KEY_PREFIX + fp); } catch { }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ settings }) => {
    const { path: encodedPath } = useParams();
    const navigate = useNavigate();
    const filePath = decodeURIComponent(encodedPath || '');
    const fileName = filePath.split('/').pop() || filePath;
    const isMp4 = fileName.toLowerCase().endsWith('.mp4');

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const seekBarRef = useRef<HTMLDivElement>(null);
    const lastSaveRef = useRef(0); // Throttle position saves
    const didResumeRef = useRef(false); // Prevent double-resume

    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(!isMp4);
    const [mode, setMode] = useState<'direct' | 'hls' | 'native-hls' | 'cached'>('direct');
    const [resumed, setResumed] = useState(0);
    const [resumedAt, setResumedAt] = useState(0); // For toast

    // Playback state
    const [playing, setPlaying] = useState(false);
    const [curTime, setCurTime] = useState(0);
    const [seekEnd, setSeekEnd] = useState(0);    // seekable end = transcoded duration
    const [totalDur, setTotalDur] = useState(0);  // full duration (if known)
    const [buffered, setBuffered] = useState(0);   // buffered end
    const [isSeeking, setIsSeeking] = useState(false);

    const useNative = hasNativeHls();
    const onIOS = isIOS();
    const streamUrl = apiService.getStreamUrl(filePath);

    // ---- Derived values ----
    // effectiveEnd: The total range we display on the seekbar
    // If totalDur is known and finite, use it. Otherwise use seekEnd.
    const effectiveEnd = (totalDur && isFinite(totalDur) && totalDur > 0) ? totalDur : seekEnd;
    // progress: current position as % of effectiveEnd
    const progress = effectiveEnd > 0 ? (curTime / effectiveEnd) * 100 : 0;
    // transcodedProgress: how much is transcoded as % of total (or 100% if unknown)
    const transcodedPct = (totalDur && isFinite(totalDur) && totalDur > 0 && seekEnd > 0)
        ? (seekEnd / totalDur) * 100
        : 100;

    // ---- Update seekable range periodically ----
    const updateRanges = useCallback(() => {
        const v = videoRef.current;
        if (!v) return;

        // seekable range = what FFmpeg has transcoded so far
        if (v.seekable.length > 0) {
            setSeekEnd(v.seekable.end(v.seekable.length - 1));
        }

        // total duration (finite for completed, Infinity for in-progress)
        if (v.duration && isFinite(v.duration)) {
            setTotalDur(v.duration);
        }

        // buffered range
        if (v.buffered.length > 0) {
            setBuffered(v.buffered.end(v.buffered.length - 1));
        }
    }, []);

    // ---- HLS / Stream Setup ----
    useEffect(() => {
        if (isMp4) { setLoading(false); setMode('direct'); return; }

        let mounted = true;
        const abortCtrl = new AbortController();

        const startHls = async () => {
            try {
                setLoading(true); setError(false);
                const res = await fetch(`/api/hls/start?path=${encodeURIComponent(filePath)}`, { signal: abortCtrl.signal });
                if (!res.ok) throw new Error('HLS start failed');
                const data = await res.json();
                if (!mounted) return;

                if (data.resumedFrom) setResumed(data.resumedFrom);

                // Cached MP4 stream
                if (data.mode === 'cached') {
                    setMode('cached'); setLoading(false);
                    if (videoRef.current) {
                        videoRef.current.src = data.streamUrl;
                        videoRef.current.load();
                        videoRef.current.play().catch(() => { });
                    }
                    return;
                }

                const video = videoRef.current;
                if (!video) return;

                // Safari / iOS: native HLS (for AirPlay)
                if (useNative) {
                    setMode('native-hls');
                    let attempt = 0;
                    const MAX = 5, DELAY = 2500;

                    const tryLoad = () => {
                        if (!mounted || !videoRef.current) return;
                        attempt++;
                        const v = videoRef.current;
                        const ok = () => { if (mounted) { setLoading(false); v.play().catch(() => { }); } };
                        const fail = () => {
                            v.removeEventListener('loadedmetadata', ok);
                            if (attempt < MAX && mounted) setTimeout(tryLoad, DELAY);
                            else if (mounted) { setError(true); setLoading(false); }
                        };
                        v.addEventListener('loadedmetadata', ok, { once: true });
                        v.addEventListener('error', fail, { once: true });
                        v.src = data.playlistUrl + (attempt > 1 ? `?r=${attempt}` : '');
                        v.load();
                    };
                    tryLoad();
                    return;
                }

                // Other browsers: hls.js
                if (Hls.isSupported()) {
                    setMode('hls');
                    const hls = new Hls({ enableWorker: true, maxBufferLength: 30, maxMaxBufferLength: 60 });
                    hls.loadSource(data.playlistUrl);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => { if (mounted) { setLoading(false); video.play().catch(() => { }); } });
                    hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) { if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad(); else { if (mounted) setError(true); setLoading(false); } } });
                    hlsRef.current = hls;
                } else { setError(true); setLoading(false); }
            } catch (err: any) {
                if (err?.name === 'AbortError') return; // Component unmounted, ignore
                if (mounted) { setError(true); setLoading(false); }
            }
        };

        startHls();
        return () => {
            mounted = false;
            abortCtrl.abort(); // Cancel any in-flight /api/hls/start request
            if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
            fetch(`/api/hls/stop?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' }).catch(() => { });
        };
    }, [filePath, isMp4, useNative]);

    // ---- Video event listeners ----
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const onTime = () => {
            setCurTime(v.currentTime);
            updateRanges();

            // Save position every 3 seconds
            const now = Date.now();
            if (now - lastSaveRef.current > 3000 && v.currentTime > 5) {
                lastSaveRef.current = now;
                savePosition(filePath, v.currentTime);
            }
        };
        const onPlay = () => setPlaying(true);
        const onPause = () => {
            setPlaying(false);
            // Save on every pause
            if (v.currentTime > 5) savePosition(filePath, v.currentTime);
        };
        const onLoad = () => {
            updateRanges();

            // Resume from saved position (once)
            if (!didResumeRef.current) {
                didResumeRef.current = true;
                const saved = getSavedPosition(filePath);
                if (saved > 5) {
                    // If near the end (within 10s), start from beginning
                    const dur = v.duration;
                    if (dur && isFinite(dur) && saved > dur - 10) {
                        clearPosition(filePath);
                    } else {
                        v.currentTime = saved;
                        setCurTime(saved);
                        setResumedAt(saved);
                        // Auto-hide toast after 3s
                        setTimeout(() => setResumedAt(0), 3000);
                    }
                }
            }
        };
        const onProgress = () => updateRanges();
        const onEnded = () => {
            // Video finished, clear saved position
            clearPosition(filePath);
        };

        v.addEventListener('timeupdate', onTime);
        v.addEventListener('play', onPlay);
        v.addEventListener('pause', onPause);
        v.addEventListener('loadedmetadata', onLoad);
        v.addEventListener('progress', onProgress);
        v.addEventListener('durationchange', onLoad);
        v.addEventListener('ended', onEnded);

        // Poll seekable range every 2s (for in-progress transcoding)
        const poll = setInterval(updateRanges, 2000);

        return () => {
            // Save position on unmount (leaving the player)
            if (v.currentTime > 5) savePosition(filePath, v.currentTime);

            v.removeEventListener('timeupdate', onTime);
            v.removeEventListener('play', onPlay);
            v.removeEventListener('pause', onPause);
            v.removeEventListener('loadedmetadata', onLoad);
            v.removeEventListener('progress', onProgress);
            v.removeEventListener('durationchange', onLoad);
            v.removeEventListener('ended', onEnded);
            clearInterval(poll);
        };
    }, [filePath, updateRanges]);

    // ---- Keyboard shortcuts ----
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const v = videoRef.current;
            if (!v) return;
            switch (e.key) {
                case ' ': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
                case 'ArrowLeft': v.currentTime = Math.max(0, v.currentTime - 10); break;
                case 'ArrowRight': v.currentTime = Math.min(seekEnd, v.currentTime + 10); break;
                case 'f': toggleFullscreen(); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [seekEnd]);

    // ---- Seek handling (touch + mouse) ----
    const seekTo = useCallback((clientX: number) => {
        const bar = seekBarRef.current;
        const v = videoRef.current;
        if (!bar || !v || effectiveEnd <= 0) return;

        const rect = bar.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const target = pct * effectiveEnd;
        // Clamp to seekable range
        const clamped = Math.min(target, seekEnd);
        v.currentTime = clamped;
        setCurTime(clamped);
    }, [effectiveEnd, seekEnd]);

    const onSeekStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
        e.stopPropagation();
        setIsSeeking(true);
        const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
        seekTo(x);

        const onMove = (ev: TouchEvent | MouseEvent) => {
            const mx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
            seekTo(mx);
        };
        const onEnd = () => {
            setIsSeeking(false);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
        };
        document.addEventListener('touchmove', onMove, { passive: true });
        document.addEventListener('touchend', onEnd);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
    }, [seekTo]);

    // ---- Actions ----
    const togglePlay = () => { const v = videoRef.current; if (v) v.paused ? v.play() : v.pause(); };
    const skip = (s: number) => { const v = videoRef.current; if (v) v.currentTime = Math.min(Math.max(0, v.currentTime + s), seekEnd); };

    const toggleFullscreen = async () => {
        const v = videoRef.current, c = containerRef.current;
        if (onIOS && v) { const vv = v as any; if (vv.webkitEnterFullscreen) { try { vv.webkitEnterFullscreen(); } catch { } return; } }
        if (c) {
            try {
                if (document.fullscreenElement) await document.exitFullscreen();
                else { const el = c as any; if (el.requestFullscreen) await el.requestFullscreen(); else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen(); }
            } catch { const vv = v as any; if (vv?.webkitEnterFullscreen) vv.webkitEnterFullscreen(); }
        }
    };

    const togglePip = async () => {
        const v = videoRef.current; if (!v) return;
        try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await v.requestPictureInPicture(); } catch { }
    };

    const requestAirPlay = () => { const v = videoRef.current as any; if (v?.webkitShowPlaybackTargetPicker) v.webkitShowPlaybackTargetPicker(); };

    const [airPlay, setAirPlay] = useState(false);
    useEffect(() => { const v = videoRef.current as any; if (v?.webkitShowPlaybackTargetPicker) setAirPlay(true); }, []);

    // ---- Is transcoding complete? ----
    const isComplete = totalDur > 0 && isFinite(totalDur) && seekEnd >= totalDur - 1;

    return (
        <div className="flex flex-col min-h-screen min-h-[100dvh] bg-black">
            {/* Video area */}
            <div ref={containerRef} className="relative w-full bg-black flex items-center justify-center" onClick={togglePlay}>

                {/* Loading overlay */}
                {loading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 aspect-video animate-fade-in">
                        <div className="relative w-14 h-14 mb-3">
                            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                            <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </div>
                        <p className="text-white/50 text-sm">Preparing stream...</p>
                        <p className="text-white/20 text-xs mt-1">First time may take a moment</p>
                    </div>
                )}

                {/* Error overlay */}
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 aspect-video">
                        <span className="material-symbols-outlined text-3xl text-red-400 mb-2">error</span>
                        <p className="text-white/70 text-sm">Stream Error</p>
                        <button onClick={(e) => { e.stopPropagation(); window.location.reload(); }}
                            className="mt-3 px-4 py-1.5 bg-white/10 active:bg-white/20 text-white rounded-xl text-sm">Retry</button>
                    </div>
                )}

                {/* Video (NO native controls — we build our own) */}
                <video ref={videoRef} className="w-full max-h-[60vh] object-contain"
                    src={isMp4 ? streamUrl : undefined} autoPlay={isMp4} playsInline
                    onError={isMp4 ? () => setError(true) : undefined} />

                {/* Play/Pause indicator (brief flash on tap) */}
                {!loading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className={`w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300 ${isSeeking ? 'opacity-0' : 'opacity-0'}`}>
                            <span className="material-symbols-outlined text-white text-3xl filled">
                                {playing ? 'pause' : 'play_arrow'}
                            </span>
                        </div>
                    </div>
                )}
                {/* Resume position toast */}
                {resumedAt > 0 && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 bg-black/70 backdrop-blur-md rounded-xl border border-white/10 animate-fade-in">
                        <p className="text-white/80 text-sm whitespace-nowrap">
                            <span className="text-primary mr-1">▶</span>
                            Resumed from {fmt(resumedAt)}
                        </p>
                    </div>
                )}
            </div>

            {/* Controls panel below video */}
            <div className="bg-bg-app px-4 pt-3 pb-2 space-y-3 animate-slide-up">

                {/* ---- Seekbar ---- */}
                <div className="space-y-1">
                    <div
                        ref={seekBarRef}
                        className="relative h-8 flex items-center cursor-pointer group"
                        onMouseDown={onSeekStart}
                        onTouchStart={onSeekStart}
                    >
                        {/* Track background */}
                        <div className="absolute left-0 right-0 h-1 group-hover:h-1.5 group-active:h-2 bg-white/10 rounded-full transition-all">
                            {/* Transcoded range (light bg) */}
                            <div className="absolute left-0 top-0 h-full bg-white/15 rounded-full transition-all"
                                style={{ width: `${Math.min(transcodedPct, 100)}%` }} />

                            {/* Buffered range */}
                            <div className="absolute left-0 top-0 h-full bg-white/10 rounded-full"
                                style={{ width: `${effectiveEnd > 0 ? (buffered / effectiveEnd) * 100 : 0}%` }} />

                            {/* Played range (gradient) */}
                            <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-accent rounded-full"
                                style={{ width: `${Math.min(progress, 100)}%` }} />

                            {/* Thumb */}
                            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-all group-hover:w-4 group-hover:h-4 group-active:w-4 group-active:h-4"
                                style={{ left: `${Math.min(progress, 100)}%`, transform: `translateX(-50%) translateY(-50%)` }} />
                        </div>

                        {/* Transcoded boundary marker */}
                        {!isComplete && transcodedPct < 100 && (
                            <div className="absolute top-0 bottom-0 flex items-center"
                                style={{ left: `${transcodedPct}%` }}>
                                <div className="w-0.5 h-3 bg-emerald-400/40 rounded-full" />
                            </div>
                        )}
                    </div>

                    {/* Time labels */}
                    <div className="flex items-center justify-between px-0.5">
                        <span className="text-[11px] text-white/50 font-mono tabular-nums">{fmt(curTime)}</span>
                        <div className="flex items-center gap-1.5">
                            {!isComplete && seekEnd > 0 && (
                                <>
                                    <span className="text-[10px] text-emerald-400/60 font-mono tabular-nums">
                                        {fmt(seekEnd)} transcoded
                                    </span>
                                    <span className="text-white/10">·</span>
                                </>
                            )}
                            <span className="text-[11px] text-white/30 font-mono tabular-nums">
                                {totalDur > 0 && isFinite(totalDur) ? fmt(totalDur) : fmt(seekEnd)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ---- Playback controls ---- */}
                <div className="flex items-center justify-between">
                    {/* Left: Back */}
                    <button onClick={(e) => { e.stopPropagation(); navigate(-1); }}
                        className="p-2 rounded-xl bg-white/5 active:bg-white/15 transition-all">
                        <span className="material-symbols-outlined text-white/50 text-xl">arrow_back</span>
                    </button>

                    {/* Center: Skip / Play / Skip */}
                    <div className="flex items-center gap-4">
                        <button onClick={(e) => { e.stopPropagation(); skip(-10); }}
                            className="p-2 active:scale-90 transition-transform">
                            <span className="material-symbols-outlined text-white/60 text-2xl">replay_10</span>
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                            className="p-3 rounded-full bg-white/10 active:bg-white/20 active:scale-90 transition-all">
                            <span className="material-symbols-outlined text-white text-3xl filled">
                                {playing ? 'pause' : 'play_arrow'}
                            </span>
                        </button>

                        <button onClick={(e) => { e.stopPropagation(); skip(10); }}
                            className="p-2 active:scale-90 transition-transform">
                            <span className="material-symbols-outlined text-white/60 text-2xl">forward_10</span>
                        </button>
                    </div>

                    {/* Right: Fullscreen */}
                    <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                        className="p-2 rounded-xl bg-white/5 active:bg-white/15 transition-all">
                        <span className="material-symbols-outlined text-white/50 text-xl">fullscreen</span>
                    </button>
                </div>

                {/* ---- Extra actions ---- */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    {airPlay && (
                        <button onClick={requestAirPlay}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 active:bg-white/15 transition-all">
                            <span className="material-symbols-outlined text-base text-accent">airplay</span>
                            <span className="text-white/40 text-xs">AirPlay</span>
                        </button>
                    )}
                    {!onIOS && (
                        <button onClick={togglePip}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 active:bg-white/15 transition-all">
                            <span className="material-symbols-outlined text-base text-primary">picture_in_picture_alt</span>
                            <span className="text-white/40 text-xs">PiP</span>
                        </button>
                    )}

                    <div className="ml-auto flex items-center gap-1.5">
                        <span className="text-[10px] text-white/15 px-1.5 py-0.5 rounded bg-white/5">
                            {mode === 'direct' ? 'MP4' : mode === 'native-hls' ? 'HLS' : mode === 'hls' ? 'HLS' : 'CACHE'}
                        </span>
                        {resumed > 0 && (
                            <span className="text-[10px] text-emerald-400/40 px-1.5 py-0.5 rounded bg-emerald-500/5">
                                ⏩ {resumed} segs cached
                            </span>
                        )}
                        {!isComplete && seekEnd > 0 && (
                            <span className="text-[10px] text-amber-400/40 px-1.5 py-0.5 rounded bg-amber-500/5 animate-pulse">
                                ● Transcoding...
                            </span>
                        )}
                    </div>
                </div>

                {/* Title */}
                <div className="pt-1">
                    <h1 className="text-sm font-semibold text-white/80 leading-tight truncate">{fileName}</h1>
                    <p className="text-[10px] text-white/15 mt-0.5 truncate">{filePath}</p>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
