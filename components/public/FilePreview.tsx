'use client';

import { useState, useEffect } from 'react';
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
}

export default function FilePreview({ fileData }: FilePreviewProps) {
    const { fileUrl, file } = fileData;
    const typeInfo = getFileTypeInfo(file.mimeType);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [textContent, setTextContent] = useState<string>('');
    const [isLoadingText, setIsLoadingText] = useState(false);

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

    // Load text content for text-based files (only when preview is shown)
    useEffect(() => {
        if (isTextFile && showPreview && !textContent) {
            setIsLoadingText(true);
            fetch(fileUrl)
                .then(res => res.text())
                .then(text => setTextContent(text))
                .catch(() => setTextContent('Failed to load file content'))
                .finally(() => setIsLoadingText(false));
        }
    }, [fileUrl, isTextFile, showPreview, textContent]);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            const response = await fetch(fileUrl);
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
            alert('Failed to download file');
        } finally {
            setIsDownloading(false);
        }
    };

    const renderPreview = () => {
        // Images
        if (typeInfo.category === 'image') {
            return (
                <img
                    src={fileUrl}
                    alt="User uploaded image"
                    style={{
                        maxWidth: '100%',
                        height: 'auto',
                        display: 'block',
                    }}
                />
            );
        }

        // Videos
        if (typeInfo.category === 'video') {
            return (
                <video
                    src={fileUrl}
                    controls
                    preload="metadata"
                    style={{
                        width: '100%',
                        height: '100%',
                        maxHeight: '75vh',
                        objectFit: 'contain',
                        backgroundColor: '#000',
                    }}
                >
                    Your browser does not support video playback.
                </video>
            );
        }

        // Audio
        if (typeInfo.category === 'audio') {
            return (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#1a1a1a',
                        borderRadius: '6px',
                        margin: '0 auto 1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg style={{ width: '32px', height: '32px', color: '#9ca3af' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                    </div>
                    <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 500,
                        color: '#e0e0e0',
                        margin: '0 0 1.5rem 0',
                    }}>{file.originalFilename}</h3>
                    <audio
                        src={fileUrl}
                        controls
                        preload="metadata"
                        style={{ width: '100%', outline: 'none' }}
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
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <p style={{ color: '#9ca3af' }}>Loading preview...</p>
                    </div>
                );
            }

            return (
                <div style={{ padding: '1.5rem' }}>
                    <pre style={{
                        backgroundColor: '#1a1a1a',
                        color: '#e0e0e0',
                        padding: '1.5rem',
                        borderRadius: '6px',
                        overflow: 'auto',
                        fontSize: '0.875rem',
                        lineHeight: '1.6',
                        fontFamily: 'Monaco, Menlo, "Courier New", monospace',
                        margin: 0,
                        maxHeight: '70vh',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}>
                        <code>{textContent}</code>
                    </pre>
                </div>
            );
        }

        // Microsoft Office files - use Office Online Viewer
        if (isMicrosoftDoc) {
            const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
            return (
                <iframe
                    src={officeViewerUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                    }}
                    title={file.originalFilename}
                />
            );
        }

        // PDF - use browser's built-in viewer
        if (typeInfo.category === 'pdf') {
            return (
                <iframe
                    src={fileUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                    }}
                    title={file.originalFilename}
                />
            );
        }

        // Fallback for unsupported types
        return (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#1a1a1a',
                    borderRadius: '6px',
                    margin: '0 auto 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    <div style={{ fontSize: '2rem', opacity: 0.7 }}>{typeInfo.icon}</div>
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
        <div style={{
            minHeight: '100vh',
            padding: '2rem 1rem',
            backgroundColor: '#1a1a1a',
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '1rem',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '1.25rem',
                            fontWeight: 600,
                            color: '#e0e0e0',
                            marginBottom: '0.25rem',
                            margin: '0 0 0.25rem 0',
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

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            style={{
                                padding: '0.625rem 1.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: showPreview ? 'white' : '#e0e0e0',
                                backgroundColor: showPreview ? '#059669' : 'transparent',
                                border: '1px solid',
                                borderColor: showPreview ? '#059669' : '#3a3a3a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
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
                                padding: '0.625rem 1.5rem',
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                color: 'white',
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isDownloading ? 'not-allowed' : 'pointer',
                                opacity: isDownloading ? 0.6 : 1,
                                transition: 'all 0.2s',
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

                {/* Preview */}
                {showPreview && (
                    <div style={{
                        backgroundColor: '#2a2a2a',
                        borderRadius: '8px',
                        border: '1px solid #3a3a3a',
                        overflow: 'hidden',
                        height: '75vh',
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
                            Click "Show Preview" to view the file
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
