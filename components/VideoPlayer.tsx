
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppSettings } from '../types';
import { apiService } from '../services/apiService';
import Hls from 'hls.js';

interface VideoPlayerProps {
    settings: AppSettings;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ settings }) => {
    const { path: encodedPath } = useParams();
    const navigate = useNavigate();
    const filePath = decodeURIComponent(encodedPath || '');
    const fileName = filePath.split('/').pop() || filePath;
    const isMp4 = fileName.toLowerCase().endsWith('.mp4');

    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const hlsSessionRef = useRef<string | null>(null);


    const [streamError, setStreamError] = useState(false);
    const [loading, setLoading] = useState(!isMp4);
    const [streamMode, setStreamMode] = useState<'direct' | 'hls' | 'cached'>('direct');

    const streamUrl = apiService.getStreamUrl(filePath);

    // For MP4: use direct <video src={...}>
    // For non-MP4: use HLS via hls.js
    useEffect(() => {
        if (isMp4) {
            setLoading(false);
            setStreamMode('direct');
            return;
        }

        let mounted = true;

        const startHls = async () => {
            try {
                setLoading(true);
                setStreamError(false);

                const res = await fetch(`/api/hls/start?path=${encodeURIComponent(filePath)}`);
                if (!res.ok) throw new Error('Failed to start HLS');
                const data = await res.json();
                if (!mounted) return;

                // If server says cached version is available, use direct stream
                if (data.mode === 'cached') {
                    setStreamMode('cached');
                    setLoading(false);
                    // Set src on video element
                    if (videoRef.current) {
                        videoRef.current.src = data.streamUrl;
                        videoRef.current.load();
                        videoRef.current.play().catch(() => { });
                    }
                    return;
                }

                // HLS mode
                hlsSessionRef.current = data.sessionId;
                setStreamMode('hls');

                const video = videoRef.current;
                if (!video) return;

                if (Hls.isSupported()) {
                    const hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: true,
                        maxBufferLength: 30,
                        maxMaxBufferLength: 60,
                    });

                    hls.loadSource(data.playlistUrl);
                    hls.attachMedia(video);

                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        console.log('HLS manifest parsed, starting playback');
                        setLoading(false);
                        video.play().catch(() => { });
                    });

                    hls.on(Hls.Events.ERROR, (_, errData) => {
                        console.error('HLS error:', errData);
                        if (errData.fatal) {
                            if (errData.type === Hls.ErrorTypes.NETWORK_ERROR) {
                                // Try to recover
                                hls.startLoad();
                            } else {
                                if (mounted) setStreamError(true);
                                setLoading(false);
                            }
                        }
                    });

                    hlsRef.current = hls;
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    // Native HLS support (Safari)
                    video.src = data.playlistUrl;
                    video.addEventListener('loadedmetadata', () => {
                        setLoading(false);
                        video.play().catch(() => { });
                    });
                    video.addEventListener('error', () => {
                        if (mounted) setStreamError(true);
                        setLoading(false);
                    });
                } else {
                    console.error('HLS not supported on this browser');
                    setStreamError(true);
                    setLoading(false);
                }
            } catch (err) {
                console.error('HLS start error:', err);
                if (mounted) {
                    setStreamError(true);
                    setLoading(false);
                }
            }
        };

        startHls();

        return () => {
            mounted = false;
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            // Tell server to stop active transcoding (cache is preserved if complete)
            fetch(`/api/hls/stop?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' }).catch(() => { });
        };
    }, [filePath, isMp4]);



    return (
        <div className="max-w-5xl mx-auto w-full p-4 md:p-6 space-y-6">
            <header className="flex items-center gap-3 mb-4">
                <button
                    onClick={() => navigate('/')}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="text-lg font-semibold truncate text-slate-900 dark:text-slate-100">
                    {fileName}
                </h1>
            </header>

            <section className="relative bg-black md:rounded-xl overflow-hidden shadow-2xl border border-slate-800 aspect-video flex items-center justify-center">
                {streamError ? (
                    <div className="text-center text-red-500">
                        <span className="material-symbols-outlined text-4xl mb-2">error</span>
                        <p>Error loading video stream.</p>
                        <p className="text-xs mt-2">Check server logs or try optimizing first.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm"
                        >
                            Retry
                        </button>
                    </div>
                ) : (
                    <>
                        {loading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                                <p className="text-slate-400 text-sm">Preparing stream...</p>
                                <p className="text-slate-600 text-xs mt-1">Transcoding to HLS for cross-device playback</p>
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            className="w-full h-full"
                            src={isMp4 ? streamUrl : undefined}
                            controls
                            autoPlay={isMp4}
                            playsInline
                            onError={isMp4 ? () => setStreamError(true) : undefined}
                        />
                    </>
                )}


            </section>

            <div className="p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-1">Info</h3>
                    <p className="text-sm text-slate-900 dark:text-slate-200 break-all">{filePath}</p>
                    <p className="text-xs text-slate-500 mt-1">
                        {streamMode === 'direct' && 'Direct Play (Original MP4)'}
                        {streamMode === 'hls' && 'HLS Stream (Cross-device Compatible)'}
                        {streamMode === 'cached' && 'Playing from Optimized Cache'}
                    </p>
                </div>


            </div>
        </div>
    );
};

export default VideoPlayer;
