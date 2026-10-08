'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFileTypeInfo, formatFileSize } from '@/lib/utils/fileTypes';
import { sanitizeDownloadFilename } from '@/lib/utils/headers';
import Link from 'next/link';
import { Download, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { FileTypeIcon } from '@/components/ui/FileTypeIcon';

interface FilePreviewProps {
    fileData: {
        fileUrl: string;
        file: {
            originalFilename: string;
            mimeType: string;
            fileSize: number;
        };
    };
    shortCode: string;
    userIdentifier: string;
}

export default function FilePreview({ fileData, shortCode, userIdentifier }: FilePreviewProps) {
    const { file } = fileData;
    const typeInfo = getFileTypeInfo(file.mimeType);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [textContent, setTextContent] = useState<string>('');
    const [isLoadingText, setIsLoadingText] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoadingPreview, setIsLoadingPreview] = useState(false);
    const [downloadError, setDownloadError] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [hasAttemptedPreview, setHasAttemptedPreview] = useState(false);

    // Check if file is text-based
    const isTextFile = file.mimeType.startsWith('text/') || 
                      file.mimeType === 'application/json' ||
                      file.mimeType === 'application/javascript' ||
                      file.mimeType === 'application/xml';

    // Check if it's a Microsoft Office file
    const isMicrosoftDoc = file.mimeType.includes('officedocument') ||
                          file.mimeType.includes('msword') ||
                          file.mimeType.includes('ms-excel') ||
                          file.mimeType.includes('ms-powerpoint');

    // Fetch a tracked URL for preview/download
    const fetchTrackedUrl = useCallback(async (action: 'preview' | 'download'): Promise<string | null> => {
        try {
            const response = await fetch('/api/access/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Include httpOnly cookie
                body: JSON.stringify({
                    shortCode,
                    userIdentifier: userIdentifier || undefined, // Send undefined for public access
                    action,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({ error: 'Request failed' }));
                throw new Error(data.error || `Request failed with status ${response.status}`);
            }

            const data = await response.json();
            return data.fileUrl;
        } catch (error) {
            const errorMessage = (error instanceof Error && error.message) || 'Failed to access file';
            if (action === 'preview') {
                setPreviewError(errorMessage);
            } else {
                setDownloadError(errorMessage);
            }
            return null;
        }
    }, [shortCode, userIdentifier]);

    // Load preview URL when preview is shown (tracks the view)
    useEffect(() => {
        if (showPreview && !previewUrl && !isLoadingPreview && !hasAttemptedPreview && !previewError) {
            setIsLoadingPreview(true);
            setPreviewError(null);
            setHasAttemptedPreview(true);
            
            fetchTrackedUrl('preview').then(url => {
                if (url) {
                    setPreviewUrl(url);
                }
                setIsLoadingPreview(false);
            }).catch(() => {
                setIsLoadingPreview(false);
            });
        }
    }, [showPreview, previewUrl, isLoadingPreview, hasAttemptedPreview, previewError, fetchTrackedUrl]);

    // Reset preview state when hiding preview
    useEffect(() => {
        if (!showPreview) {
            setHasAttemptedPreview(false);
            setPreviewError(null);
        }
    }, [showPreview]);

    // Load text content for text-based files (only when preview URL is ready)
    useEffect(() => {
        if (isTextFile && showPreview && previewUrl && !textContent) {
            setIsLoadingText(true);
            fetch(previewUrl)
                .then(res => res.text())
                .then(text => setTextContent(text))
                .catch(() => setTextContent('Failed to load file content'))
                .finally(() => setIsLoadingText(false));
        }
    }, [previewUrl, isTextFile, showPreview, textContent]);

    const handleDownload = async () => {
        setIsDownloading(true);
        setDownloadError(null);
        try {
            // Get a fresh tracked URL for download (increments download count)
            const trackedUrl = await fetchTrackedUrl('download');
            if (!trackedUrl) {
                throw new Error('Failed to get download URL');
            }
            
            const response = await fetch(trackedUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Sanitize filename while preserving international characters
            a.download = sanitizeDownloadFilename(file.originalFilename);
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            setDownloadError((error instanceof Error && error.message) || 'Failed to download file');
        } finally {
            setIsDownloading(false);
        }
    };

    const renderPreview = () => {
        // Common styles to prevent content extraction
        const protectedStyles: React.CSSProperties = {
            userSelect: 'none',
            WebkitUserSelect: 'none',
            pointerEvents: 'none',
        };

        // Show error state if preview failed to load
        if (previewError) {
            return (
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: '300px',
                    padding: '2rem',
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#7f1d1d',
                        borderRadius: '50%',
                        margin: '0 auto 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg style={{ width: '40px', height: '40px', color: '#fecaca' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 500,
                        color: '#fecaca',
                        marginBottom: '0.5rem',
                        textAlign: 'center',
                    }}>
                        Preview Failed
                    </h3>
                    <p style={{ 
                        color: '#fca5a5', 
                        margin: '0 0 1rem 0',
                        textAlign: 'center',
                        fontSize: '0.875rem',
                    }}>
                        {previewError}
                    </p>
                    <button
                        onClick={() => {
                            setPreviewError(null);
                            setHasAttemptedPreview(false);
                            setIsLoadingPreview(false);
                        }}
                        style={{
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'white',
                            backgroundColor: '#6366f1',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        // Show loading state while fetching preview URL
        if (isLoadingPreview || !previewUrl) {
            return (
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    height: '100%',
                    minHeight: '200px',
                }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            border: '3px solid #3a3a3a',
                            borderTopColor: '#6366f1',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 1rem',
                        }} />
                        <p style={{ color: '#9ca3af', margin: 0 }}>Loading preview...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                </div>
            );
        }

        // Images - centered with aspect ratio preserved
        if (typeInfo.category === 'image') {
            return (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '1rem',
                    backgroundColor: '#0b0c11',
                }}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL to a private file; must not go through the public image optimizer */}
                    <img
                        src={previewUrl}
                        alt={file.originalFilename}
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                            maxWidth: '100%',
                            // Cap the image, not the frame, so wide images don't sit in a tall empty box on mobile
                            maxHeight: '75vh',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            display: 'block',
                            ...protectedStyles,
                        }}
                    />
                </div>
            );
        }

        // Videos - centered with aspect ratio preserved
        if (typeInfo.category === 'video') {
            return (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#000',
                }}>
                    <video
                        src={previewUrl}
                        controls
                        controlsList="nodownload noplaybackrate"
                        disablePictureInPicture
                        preload="metadata"
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            display: 'block',
                        }}
                    >
                        Your browser does not support video playback.
                    </video>
                </div>
            );
        }

        // Audio - centered with custom layout
        if (typeInfo.category === 'audio') {
            return (
                <div style={{ 
                    padding: '3rem 2rem', 
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '300px',
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#0b0c11',
                        borderRadius: '8px',
                        margin: '0 auto 1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg style={{ width: '40px', height: '40px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <h3 style={{
                        fontSize: '1.125rem',
                        fontWeight: 500,
                        color: '#e0e0e0',
                        margin: '0 0 2rem 0',
                        maxWidth: '90%',
                        ...protectedStyles,
                    }}>{file.originalFilename}</h3>
                    <audio
                        src={previewUrl}
                        controls
                        controlsList="nodownload noplaybackrate"
                        preload="metadata"
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ width: '100%', maxWidth: '600px', outline: 'none' }}
                    >
                        Your browser does not support audio playback.
                    </audio>
                </div>
            );
        }

        // Text files (markdown, code, txt, json, etc.)
        if (isTextFile) {
            if (isLoadingText) {
                return (
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '300px',
                        textAlign: 'center',
                        padding: '3rem 1rem',
                    }}>
                        <p style={{ color: '#9ca3af', margin: 0 }}>Loading preview...</p>
                    </div>
                );
            }

            return (
                <div style={{ 
                    padding: '1.5rem',
                    width: '100%',
                    maxWidth: '100%',
                }}>
                    <pre style={{
                        backgroundColor: '#0b0c11',
                        color: '#e0e0e0',
                        padding: '1.5rem',
                        borderRadius: '6px',
                        overflow: 'auto',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        fontFamily: 'ui-monospace, SFMono-Regular, Monaco, Menlo, "Courier New", monospace',
                        margin: 0,
                        maxHeight: '65vh',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        ...protectedStyles,
                        pointerEvents: 'auto', // Allow scrolling
                    }}>
                        <code>{textContent}</code>
                    </pre>
                </div>
            );
        }

        // Microsoft Office files - use Office Online Viewer (wrapped to prevent easy extraction)
        if (isMicrosoftDoc) {
            const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`;
            return (
                <div 
                    style={{ width: '100%', height: '100%', position: 'relative' }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <iframe
                        src={officeViewerUrl}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                        }}
                        title={file.originalFilename}
                        sandbox="allow-scripts allow-same-origin"
                    />
                </div>
            );
        }

        // PDF - use browser's built-in viewer (wrapped to prevent easy extraction)
        if (typeInfo.category === 'pdf') {
            return (
                <div 
                    style={{ width: '100%', height: '100%', position: 'relative' }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <iframe
                        src={`${previewUrl}#toolbar=0&navpanes=0`}
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 'none',
                        }}
                        title={file.originalFilename}
                    />
                </div>
            );
        }

        // Fallback for unsupported types
        return (
            <div style={{ 
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center', 
                padding: '4rem 2rem',
                minHeight: '400px',
                ...protectedStyles,
            }}>
                <div style={{
                    width: '96px',
                    height: '96px',
                    backgroundColor: '#0b0c11',
                    borderRadius: '8px',
                    margin: '0 auto 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <FileTypeIcon category={typeInfo.category} size={44} />
                </div>
                <h3 style={{
                    fontSize: '1.25rem',
                    fontWeight: 500,
                    color: '#e0e0e0',
                    marginBottom: '0.75rem',
                }}>
                    {file.originalFilename}
                </h3>
                <p style={{
                    fontSize: '0.875rem',
                    color: '#9ca3af',
                    marginBottom: '1.5rem',
                }}>
                    {formatFileSize(file.fileSize)} • {typeInfo.category}
                </p>
                <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                }}>
                    Preview not available for this file type
                </p>
            </div>
        );
    };

    return (
        <div
            onContextMenu={(e) => e.preventDefault()}
            className="relative min-h-screen overflow-hidden bg-[#07080c] px-3 py-5 text-zinc-100 sm:px-6 sm:py-8"
        >
            <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-0 h-[360px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(99,102,241,0.18),transparent)]"
            />
            <div className="relative mx-auto max-w-6xl">
                <div className="mb-6 flex items-center justify-between">
                    <Link href="/" className="text-white" aria-label="Gatekeep home">
                        <Logo size={26} />
                    </Link>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Unlocked
                    </span>
                </div>

                {/* Header */}
                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div className="min-w-0 flex-[1_1_200px]">
                        <h1 className="break-words text-lg font-semibold tracking-tight text-white sm:text-xl">
                            {file.originalFilename}
                        </h1>
                        <p className="mt-1 text-sm capitalize text-zinc-400">
                            {formatFileSize(file.fileSize)} · {typeInfo.category}
                        </p>
                    </div>

                    <div className="flex flex-shrink-0 flex-wrap gap-2.5">
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="inline-flex h-10 min-w-[120px] flex-auto items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
                        >
                            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            {showPreview ? 'Hide preview' : 'Show preview'}
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="inline-flex h-10 min-w-[120px] flex-auto items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900 shadow-[0_8px_30px_-6px_rgba(99,102,241,0.6)] transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            {isDownloading ? 'Downloading…' : 'Download'}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {downloadError && (
                    <div role="alert" className="mb-5 rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {downloadError}
                    </div>
                )}

                {/* Preview */}
                {showPreview && (
                    <div
                        className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0f15] shadow-2xl shadow-black/50"
                        style={{
                            minHeight: ['audio', 'image'].includes(typeInfo.category) ? 'auto' : '50vh',
                            maxHeight: typeInfo.category === 'video' ? '80vh' : typeInfo.category === 'image' ? 'none' : '75vh',
                            height: ['video', 'pdf'].includes(typeInfo.category) ? '75vh' : 'auto',
                        }}
                    >
                        {renderPreview()}
                    </div>
                )}

                {/* File Info Card (shown when preview is hidden) */}
                {!showPreview && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-[#0d0f15] px-8 py-12 text-center">
                        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                            <FileTypeIcon category={typeInfo.category} size={36} />
                        </div>
                        <h3 className="mb-2 text-lg font-medium text-white">{file.originalFilename}</h3>
                        <p className="mb-2 text-sm capitalize text-zinc-400">
                            {formatFileSize(file.fileSize)} · {typeInfo.category}
                        </p>
                        <p className="text-sm text-zinc-500">Click &ldquo;Show preview&rdquo; to view the file</p>
                    </div>
                )}

                <p className="text-center text-xs text-zinc-500">
                    Shared securely with Gatekeep. Don&apos;t share your access details.
                </p>
            </div>
        </div>
    );
}
