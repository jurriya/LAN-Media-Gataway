
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppSettings } from '../types';
import { getStreamUrl, requestHls } from '../services/apiService';

interface VideoPlayerProps {
    settings: AppSettings;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ settings }) => {
    const { path: encodedPath } = useParams();
    const navigate = useNavigate();
    const filePath = decodeURIComponent(encodedPath || '');
    const fileName = filePath.split('/').pop() || filePath;

    const videoRef = useRef<HTMLVideoElement>(null);
    const [hlsEnabled, setHlsEnabled] = useState(settings.defaultHls);
    const [hlsLoading, setHlsLoading] = useState(false);
    const [hlsUrl, setHlsUrl] = useState<string | null>(null);
    const [hlsError, setHlsError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const streamUrl = getStreamUrl(filePath);

    // When HLS is toggled on, request transcoding
    useEffect(() => {
        if (!hlsEnabled) {
            setHlsUrl(null);
            setHlsError(null);
            return;
        }
        setHlsLoading(true);
        setHlsError(null);
        requestHls(filePath)
            .then(data => {
                setHlsUrl(data.m3u8_url);
            })
            .catch(err => {
                setHlsError(err.message || 'HLS transcoding failed');
            })
            .finally(() => setHlsLoading(false));
    }, [hlsEnabled, filePath]);

    // Load HLS.js when we have a m3u8 URL
    useEffect(() => {
        if (!hlsUrl || !videoRef.current) return;
        const video = videoRef.current;

        // Check native HLS support (Safari/iOS)
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            return;
        }

        // Dynamically load HLS.js
        let hls: any = null;
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
        script.onload = () => {
            const Hls = (window as any).Hls;
            if (Hls && Hls.isSupported()) {
                hls = new Hls();
                hls.loadSource(hlsUrl);
                hls.attachMedia(video);
            }
        };
        document.head.appendChild(script);

        return () => {
            if (hls) hls.destroy();
        };
    }, [hlsUrl]);

    const videoSrc = hlsEnabled && hlsUrl ? hlsUrl : streamUrl;
    const showNativeVideo = !hlsEnabled || (hlsEnabled && hlsUrl);

    const handlePlayPause = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play();
            setIsPlaying(true);
        } else {
            video.pause();
            setIsPlaying(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto w-full p-0 md:p-6 space-y-6">
            <header className="flex items-center justify-between px-4 md:px-0 mb-4">
                <div className="flex items-center gap-3 overflow-hidden">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-800 dark:text-slate-100"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="text-sm md:text-base font-semibold truncate max-w-xs md:max-w-md text-slate-900 dark:text-slate-100">
                        {fileName}
                    </h1>
                </div>
                <div className="flex items-center gap-1 text-slate-800 dark:text-slate-100">
                    <a
                        href={streamUrl}
                        download={fileName}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                        title="Download original"
                    >
                        <span className="material-symbols-outlined">download</span>
                    </a>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <span className="material-symbols-outlined">more_vert</span>
                    </button>
                </div>
            </header>

            {/* Video Player */}
            <section className="relative aspect-video bg-black md:rounded-xl overflow-hidden shadow-2xl border border-slate-800">
                {hlsLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-3">
                        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                        <p className="text-white/70 text-sm">Transcoding to HLS…</p>
                        <p className="text-white/40 text-xs">This may take a while for the first time</p>
                    </div>
                )}
                {hlsError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-3">
                        <span className="material-symbols-outlined text-4xl text-red-400">error</span>
                        <p className="text-white/70 text-sm text-center px-6">{hlsError}</p>
                        <button
                            onClick={() => { setHlsEnabled(false); }}
                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
                        >
                            Use Original Stream
                        </button>
                    </div>
                )}
                {showNativeVideo && !hlsLoading && !hlsError && (
                    <video
                        ref={videoRef}
                        className="w-full h-full"
                        controls
                        autoPlay={false}
                        src={hlsEnabled ? undefined : streamUrl}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                )}
            </section>

            {/* Action Grid */}
            <div className="px-4 md:px-0 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <span className="material-symbols-outlined">bolt</span>
                        </div>
                        <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">HLS Streaming</p>
                            <p className="text-xs text-slate-500">Transcoded for browser playback</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setHlsEnabled(!hlsEnabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${hlsEnabled ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'}`}
                    >
                        <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${hlsEnabled ? 'translate-x-6' : ''}`}></div>
                    </button>
                </div>
                <div className="flex gap-2">
                    <a
                        href={streamUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-primary/50 transition-colors text-slate-900 dark:text-white"
                    >
                        <span className="material-symbols-outlined">rocket_launch</span>
                        <span className="text-sm font-semibold">Original</span>
                    </a>
                    <a
                        href={streamUrl}
                        download={fileName}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-4 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-primary/50 transition-colors text-slate-900 dark:text-white"
                    >
                        <span className="material-symbols-outlined">download</span>
                        <span className="text-sm font-semibold">Download</span>
                    </a>
                </div>
            </div>

            {/* Metadata Info */}
            <div className="px-4 md:px-0">
                <div className="p-5 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400">File Metadata</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">folder</span> Path
                            </p>
                            <p className="text-sm font-medium break-all text-slate-900 dark:text-slate-200">{filePath}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm">movie</span> Stream Mode
                            </p>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                                {hlsEnabled ? 'HLS (Transcoded)' : 'Original (Direct Stream)'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
