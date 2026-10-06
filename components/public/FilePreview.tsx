'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFileTypeInfo, formatFileSize } from '@/lib/utils/fileTypes';
import { sanitizeDownloadFilename } from '@/lib/utils/headers';

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
                            backgroundColor: '#3b82f6',
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
                            borderTopColor: '#3b82f6',
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
                    height: '100%',
                    padding: '1rem',
                    backgroundColor: '#1a1a1a',
                }}>
                    <img
                        src={previewUrl}
                        alt="User uploaded image"
                        draggable={false}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
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
                        backgroundColor: '#1a1a1a',
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
                        backgroundColor: '#1a1a1a',
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
                    backgroundColor: '#1a1a1a',
                    borderRadius: '8px',
                    margin: '0 auto 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{ fontSize: '3rem', opacity: 0.7 }}>{typeInfo.icon}</div>
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
            style={{
                minHeight: '100vh',
                padding: 'clamp(1rem, 3vw, 2rem) clamp(0.75rem, 2vw, 1rem)',
                backgroundColor: '#1a1a1a',
            }}
        >
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                }}>
                    <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                        <h1 style={{
                            fontSize: 'clamp(1rem, 3vw, 1.25rem)',
                            fontWeight: 600,
                            color: '#e0e0e0',
                            marginBottom: '0.25rem',
                            margin: '0 0 0.25rem 0',
                            wordBreak: 'break-word',
                        }}>
                            {file.originalFilename}
                        </h1>
                        <p style={{
                            fontSize: '0.875rem',
                            color: '#9ca3af',
                            margin: 0,
                        }}>
                            {formatFileSize(file.fileSize)} • {typeInfo.category}
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: showPreview ? 'white' : '#e0e0e0',
                                backgroundColor: showPreview ? '#059669' : 'transparent',
                                border: '1px solid',
                                borderColor: showPreview ? '#059669' : '#3a3a3a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                flex: '1 1 auto',
                                minWidth: '120px',
                            }}
                            onMouseEnter={(e) => {
                                if (!showPreview) {
                                    e.currentTarget.style.borderColor = '#4b5563';
                                    e.currentTarget.style.backgroundColor = '#1f2937';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!showPreview) {
                                    e.currentTarget.style.borderColor = '#3a3a3a';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }}
                        >
                            {showPreview ? 'Hide Preview' : 'Show Preview'}
                        </button>

                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            style={{
                                padding: '0.625rem 1rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'white',
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isDownloading ? 'not-allowed' : 'pointer',
                                opacity: isDownloading ? 0.6 : 1,
                                transition: 'all 0.2s',
                                flex: '1 1 auto',
                                minWidth: '120px',
                            }}
                            onMouseEnter={(e) => {
                                if (!isDownloading) e.currentTarget.style.backgroundColor = '#2563eb';
                            }}
                            onMouseLeave={(e) => {
                                if (!isDownloading) e.currentTarget.style.backgroundColor = '#3b82f6';
                            }}
                        >
                            {isDownloading ? 'Downloading...' : 'Download'}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {downloadError && (
                    <div style={{
                        backgroundColor: '#7f1d1d',
                        border: '1px solid #991b1b',
                        borderRadius: '6px',
                        padding: '0.75rem 1rem',
                        marginBottom: '1.5rem',
                    }}>
                        <p style={{
                            color: '#fecaca',
                            fontSize: '0.875rem',
                            margin: 0,
                        }}>
                            {downloadError}
                        </p>
                    </div>
                )}

                {/* Preview */}
                {showPreview && (
                    <div style={{
                        backgroundColor: '#2a2a2a',
                        borderRadius: '8px',
                        border: '1px solid #3a3a3a',
                        overflow: 'hidden',
                        minHeight: typeInfo.category === 'audio' ? 'auto' : '50vh',
                        maxHeight: typeInfo.category === 'image' || typeInfo.category === 'video' ? '80vh' : '75vh',
                        height: ['image', 'video', 'pdf'].includes(typeInfo.category) ? '75vh' : 'auto',
                        marginBottom: '1.5rem',
                    }}>
                        {renderPreview()}
                    </div>
                )}

                {/* File Info Card (shown when preview is hidden) */}
                {!showPreview && (
                    <div style={{
                        backgroundColor: '#2a2a2a',
                        borderRadius: '8px',
                        border: '1px solid #3a3a3a',
                        padding: '3rem 2rem',
                        textAlign: 'center',
                        marginBottom: '1.5rem',
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            backgroundColor: '#1a1a1a',
                            borderRadius: '8px',
                            margin: '0 auto 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <div style={{ fontSize: '2.5rem', opacity: 0.7 }}>{typeInfo.icon}</div>
                        </div>
                        <h3 style={{
                            fontSize: '1.125rem',
                            fontWeight: 500,
                            color: '#e0e0e0',
                            marginBottom: '0.5rem',
                        }}>
                            {file.originalFilename}
                        </h3>
                        <p style={{
                            fontSize: '0.875rem',
                            color: '#9ca3af',
                            marginBottom: '0.5rem',
                        }}>
                            {formatFileSize(file.fileSize)} • {typeInfo.category}
                        </p>
                        <p style={{
                            fontSize: '0.875rem',
                            color: '#6b7280',
                        }}>
                            Click &ldquo;Show Preview&rdquo; to view the file
                        </p>
                    </div>
                )}

                {/* Info */}
                <div style={{ textAlign: 'center' }}>
                    <p style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        margin: 0,
                    }}>
                        This file was shared securely. Do not share your access credentials.
                    </p>
                </div>
            </div>
        </div>
    );
}
