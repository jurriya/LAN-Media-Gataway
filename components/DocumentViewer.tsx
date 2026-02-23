
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getStreamUrl } from '../services/apiService';

const DocumentViewer: React.FC = () => {
    const { path: encodedPath } = useParams();
    const navigate = useNavigate();
    const filePath = decodeURIComponent(encodedPath || '');
    const fileName = filePath.split('/').pop() || filePath;
    const fileUrl = getStreamUrl(filePath);
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    const isPdf = ext === 'pdf';
    const [textContent, setTextContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(!isPdf);

    useEffect(() => {
        if (!isPdf) {
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => {
                    setTextContent(text);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Failed to load document:', err);
                    setLoading(false);
                });
        }
    }, [fileUrl, isPdf]);

    return (
        <div className="fixed inset-0 z-[60] bg-[#0f0f1a] flex flex-col overflow-hidden">
            {/* Top Bar */}
            <header className="h-12 flex items-center justify-between px-3 glass border-b border-white/5 shrink-0 safe-top z-10 bg-[#1a1a2e]/80 backdrop-blur-md">
                <div className="flex items-center gap-2 overflow-hidden">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">arrow_back</span>
                    </button>
                    <h1 className="text-white/80 text-xs font-medium truncate">{fileName}</h1>
                </div>
                <div className="flex items-center gap-1">
                    <a
                        href={fileUrl}
                        download={fileName}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-white/60 transition-colors"
                        title="Download"
                    >
                        <span className="material-symbols-outlined text-xl">download</span>
                    </a>
                </div>
            </header>

            {/* Viewer Area */}
            <main className="flex-1 relative overflow-auto bg-[#0a0a0f]">
                {isPdf ? (
                    <iframe
                        src={`${fileUrl}#toolbar=0`}
                        className="w-full h-full border-none bg-white"
                        title={fileName}
                    />
                ) : loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : (
                    <div className="p-4 md:p-8 max-w-4xl mx-auto">
                        <pre className="text-white/80 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed selection:bg-primary/30">
                            {textContent}
                        </pre>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DocumentViewer;
