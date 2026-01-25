'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui';
import { validateFile, formatFileSize, getMaxFileSize } from '@/lib/utils/fileTypes';

interface FileUploaderProps {
    onUploadComplete?: () => void;
}

interface PresignResponse {
    uploadUrl: string;
    token: string;
    path: string;
    fileKey: string;
    metadata: {
        uniqueFilename: string;
        sanitizedFilename: string;
        shortCode: string;
        fileSize: number;
        mimeType: string;
        userId: string;
    };
}

export default function FileUploader({ onUploadComplete }: FileUploaderProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
    const [error, setError] = useState('');
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        handleFiles(files);
    }, []);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            handleFiles(files);
        }
    }, []);

    /**
     * Upload a single file using presigned URL (direct to Supabase)
     */
    const uploadFileWithPresignedUrl = async (file: File): Promise<void> => {
        // Step 1: Get presigned upload URL from our API
        const presignResponse = await fetch('/api/files/presign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: file.name,
                fileSize: file.size,
                mimeType: file.type || 'application/octet-stream',
            }),
        });

        if (!presignResponse.ok) {
            const errorData = await presignResponse.json();
            throw new Error(errorData.error || 'Failed to get upload URL');
        }

        const presignData: PresignResponse = await presignResponse.json();

        // Step 2: Upload file directly to Supabase using XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // Track upload progress
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 95); // Reserve 5% for confirm
                    setUploadProgress(prev => ({ ...prev, [file.name]: percentComplete }));
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve();
                } else {
                    reject(new Error(`Upload failed with status ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed - network error'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            // Open connection and set headers
            xhr.open('PUT', presignData.uploadUrl);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            
            // Send the file
            xhr.send(file);

            // Store abort controller reference for potential cancellation
            abortControllerRef.current = {
                abort: () => xhr.abort(),
            } as AbortController;
        });

        // Step 3: Confirm upload and save metadata
        setUploadProgress(prev => ({ ...prev, [file.name]: 97 }));
        
        const confirmResponse = await fetch('/api/files/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                metadata: presignData.metadata,
            }),
        });

        if (!confirmResponse.ok) {
            const errorData = await confirmResponse.json();
            throw new Error(errorData.error || 'Failed to confirm upload');
        }

        setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
    };

    const handleFiles = async (files: File[]) => {
        setError('');
        setIsUploading(true);

        try {
            for (const file of files) {
                // Client-side validation
                const validation = validateFile(file);
                if (!validation.valid) {
                    throw new Error(validation.error);
                }

                setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

                // Use presigned URL upload for all files
                await uploadFileWithPresignedUrl(file);
            }

            setTimeout(() => {
                setUploadProgress({});
                onUploadComplete?.();
            }, 1000);
        } catch (err: any) {
            setError(err.message || 'Failed to upload files');
        } finally {
            setIsUploading(false);
            abortControllerRef.current = null;
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                style={{
                    border: isDragging ? '2px dashed #3b82f6' : '2px dashed #3a3a3a',
                    borderRadius: '6px',
                    padding: '2rem',
                    textAlign: 'center',
                    backgroundColor: isDragging ? '#1e3a5f' : 'transparent',
                    transition: 'all 0.2s',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '6px',
                        backgroundColor: '#3a3a3a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <svg style={{ width: '32px', height: '32px', color: '#6b7280' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>

                    <div>
                        <p style={{
                            fontSize: '1rem',
                            fontWeight: 500,
                            color: '#e0e0e0',
                            marginBottom: '0.25rem',
                        }}>
                            Drop files here or click to browse
                        </p>
                        <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                            Max {formatFileSize(getMaxFileSize())} • Images, Videos, Audio, Documents, PDFs
                        </p>
                    </div>

                    <input
                        type="file"
                        id="file-upload"
                        multiple
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        disabled={isUploading}
                    />

                    <button
                        type="button"
                        onClick={() => document.getElementById('file-upload')?.click()}
                        disabled={isUploading}
                        style={{
                            padding: '0.625rem 1.5rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: 'white',
                            backgroundColor: '#3b82f6',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                            opacity: isUploading ? 0.6 : 1,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            if (!isUploading) e.currentTarget.style.backgroundColor = '#2563eb';
                        }}
                        onMouseLeave={(e) => {
                            if (!isUploading) e.currentTarget.style.backgroundColor = '#3b82f6';
                        }}
                    >
                        {isUploading ? 'Uploading...' : 'Select Files'}
                    </button>
                </div>
            </div>

            {/* Upload Progress */}
            {Object.keys(uploadProgress).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(uploadProgress).map(([filename, progress]) => (
                        <div key={filename} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                                <span style={{
                                    color: '#e0e0e0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}>{filename}</span>
                                <span style={{ color: '#9ca3af' }}>{progress}%</span>
                            </div>
                            <div style={{
                                height: '0.5rem',
                                backgroundColor: '#1a1a1a',
                                borderRadius: '4px',
                                overflow: 'hidden',
                            }}>
                                <div
                                    style={{
                                        height: '100%',
                                        backgroundColor: '#3b82f6',
                                        width: `${progress}%`,
                                        transition: 'width 0.3s',
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '0.75rem',
                    borderRadius: '4px',
                    backgroundColor: '#7f1d1d',
                    border: '1px solid #ef4444',
                }}>
                    <p style={{ fontSize: '0.875rem', color: '#fecaca', margin: 0 }}>{error}</p>
                </div>
            )}
        </div>
    );
}
