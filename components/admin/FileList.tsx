'use client';

import { useState, useEffect } from 'react';
import { Button, Badge, FileListSkeleton } from '@/components/ui';
import { FileMetadata } from '@/lib/types';
import { formatFileSize, getFileTypeInfo } from '@/lib/utils/fileTypes';
import AccessManager from './AccessManager';
import Link from 'next/link';

interface FileListProps {
    limit?: number;
    showViewAll?: boolean;
    viewAllHref?: string;
}

export default function FileList({ limit, showViewAll = false, viewAllHref = '/dashboard/files' }: FileListProps) {
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
    const [showAccessManager, setShowAccessManager] = useState(false);

    useEffect(() => {
        fetchFiles();
    }, [limit]);

    const fetchFiles = async () => {
        try {
            const url = limit ? `/api/files?limit=${limit}` : '/api/files';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
                setTotalCount(data.totalCount || data.files?.length || 0);
            }
        } catch (error) {
            // Error handled silently
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (fileId: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return;

        try {
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setFiles(files.filter(f => f.id !== fileId));
            }
        } catch (error) {
            // Error handled silently
        }
    };

    const copyShortLink = (shortCode: string) => {
        const url = `${window.location.origin}/${shortCode}`;
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
    };

    const handleManageAccess = (file: FileMetadata) => {
        setSelectedFile(file);
        setShowAccessManager(true);
    };

    if (isLoading) {
        return <FileListSkeleton count={limit || 3} />;
    }

    if (files.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-[var(--background)] rounded mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                </div>
                <p className="text-base text-[var(--text-secondary)]">No files uploaded yet</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">Upload your first file to get started</p>
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {files.map((file) => {
                    const typeInfo = getFileTypeInfo(file.mimeType);

                    return (
                        <div
                            key={file.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1rem',
                                borderRadius: '6px',
                                border: '1px solid #3a3a3a',
                                backgroundColor: '#252525',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#2d2d2d';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#252525';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '1.5rem', opacity: 0.7 }}>{typeInfo.icon}</div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h3 style={{
                                        fontWeight: 500,
                                        color: '#e0e0e0',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        margin: 0,
                                        fontSize: '0.95rem',
                                    }}>
                                        {file.originalFilename}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                                            {formatFileSize(file.fileSize)}
                                        </span>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            color: '#6b7280',
                                            padding: '0.125rem 0.5rem',
                                            borderRadius: '3px',
                                            backgroundColor: '#1a1a1a',
                                        }}>{typeInfo.category}</span>
                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            {new Date(file.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '1rem' }}>
                                <button
                                    onClick={() => copyShortLink(file.shortCode)}
                                    title="Copy short link"
                                    style={{
                                        padding: '0.5rem 0.875rem',
                                        fontSize: '0.8rem',
                                        color: '#9ca3af',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#1a1a1a';
                                        e.currentTarget.style.color = '#e0e0e0';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#9ca3af';
                                    }}
                                >
                                    Copy Link
                                </button>

                                <button
                                    onClick={() => handleManageAccess(file)}
                                    title="Manage access"
                                    style={{
                                        padding: '0.5rem 0.875rem',
                                        fontSize: '0.8rem',
                                        color: '#9ca3af',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#1a1a1a';
                                        e.currentTarget.style.color = '#e0e0e0';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.color = '#9ca3af';
                                    }}
                                >
                                    Access
                                </button>

                                <button
                                    onClick={() => handleDelete(file.id)}
                                    title="Delete file"
                                    style={{
                                        padding: '0.5rem 0.875rem',
                                        fontSize: '0.8rem',
                                        color: '#ef4444',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #3a3a3a',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#7f1d1d';
                                        e.currentTarget.style.borderColor = '#ef4444';
                                        e.currentTarget.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'transparent';
                                        e.currentTarget.style.borderColor = '#3a3a3a';
                                        e.currentTarget.style.color = '#ef4444';
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showViewAll && totalCount > (limit || 0) && (
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    <Link
                        href={viewAllHref}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            fontSize: '0.875rem',
                            color: '#3b82f6',
                            backgroundColor: 'transparent',
                            border: '1px solid #3a3a3a',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                        }}
                    >
                        View All {totalCount} Files
                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            )}

            {selectedFile && (
                <AccessManager
                    file={selectedFile}
                    isOpen={showAccessManager}
                    onClose={() => {
                        setShowAccessManager(false);
                        setSelectedFile(null);
                    }}
                />
            )}
        </>
    );
}
