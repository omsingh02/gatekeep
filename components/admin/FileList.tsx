'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton, ConfirmDialog, PromptDialog, useToast } from '@/components/ui';
import { FileMetadata, FileTypeFilter, Folder } from '@/lib/types';
import { formatFileSize, getFileTypeInfo } from '@/lib/utils/fileTypes';
import { formatDateTime } from '@/lib/utils/date';
import { useDebouncedValue } from '@/lib/utils/hooks';
import AccessManager from './AccessManager';

interface FileListProps {
    limit?: number;
    showViewAll?: boolean;
    viewAllHref?: string;
    enablePagination?: boolean;
    itemsPerPage?: number;
}

export default function FileList({
    limit,
    showViewAll = false,
    viewAllHref = '/dashboard/files',
    enablePagination = false,
    itemsPerPage = 20,
}: FileListProps) {
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
    const [showAccessManager, setShowAccessManager] = useState(false);

    // Search and filter state
    const [searchInput, setSearchInput] = useState('');
    const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
    const debouncedSearch = useDebouncedValue(searchInput, 300);

    // Folder state
    const [folders, setFolders] = useState<Folder[]>([]);
    const [currentFolder, setCurrentFolder] = useState<{ id: string | null; name: string }>({ id: null, name: 'Home' });
    const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Home' }]);
    const [isFoldersLoading, setIsFoldersLoading] = useState(false);

    // Dialog state
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; fileId: string | null; fileName: string }>({
        isOpen: false,
        fileId: null,
        fileName: '',
    });
    const [folderPrompt, setFolderPrompt] = useState<{ isOpen: boolean; isLoading: boolean }>({
        isOpen: false,
        isLoading: false,
    });
    const toast = useToast();

    useEffect(() => {
        fetchFiles();
        fetchFolders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [limit, currentPage, debouncedSearch, fileTypeFilter, currentFolder.id]);

    const fetchFolders = async () => {
        try {
            setIsFoldersLoading(true);
            let url = '/api/folders';
            const params = new URLSearchParams();

            if (currentFolder.id) {
                params.append('parentId', currentFolder.id);
            }

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setFolders(data.folders || []);
            } else {
                setFolders([]);
            }
        } catch (error) {
            setFolders([]);
        } finally {
            setIsFoldersLoading(false);
        }
    };

    const fetchFiles = async () => {
        try {
            setIsLoading(true);
            let url = '/api/files';
            const params = new URLSearchParams();

            if (limit) {
                params.append('limit', limit.toString());
            } else if (enablePagination) {
                params.append('page', currentPage.toString());
                params.append('limit', itemsPerPage.toString());
            }

            if (debouncedSearch.trim()) {
                params.append('search', debouncedSearch.trim());
            }

            if (fileTypeFilter !== 'all') {
                params.append('fileType', fileTypeFilter);
            }

            if (currentFolder.id) {
                params.append('folderId', currentFolder.id);
            }

            if (params.toString()) {
                url += `?${params.toString()}`;
            }

            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
                setTotalCount(data.totalCount || data.files?.length || 0);
                setTotalPages(data.totalPages || 1);
            }
        } catch (error) {
            // Error handled silently
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (fileId: string) => {
        try {
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                const newFiles = files.filter((f) => f.id !== fileId);
                setFiles(newFiles);
                toast.success('File deleted successfully');
                if (newFiles.length === 0 && currentPage > 1) {
                    setCurrentPage(currentPage - 1);
                } else {
                    fetchFiles();
                }
            } else {
                toast.error('Failed to delete file');
            }
        } catch (error) {
            toast.error('Failed to delete file');
        } finally {
            setDeleteConfirm({ isOpen: false, fileId: null, fileName: '' });
        }
    };

    const confirmDelete = (file: FileMetadata) => {
        setDeleteConfirm({ isOpen: true, fileId: file.id, fileName: file.originalFilename });
    };

    const copyShortLink = (shortCode: string) => {
        const url = `${window.location.origin}/${shortCode}`;
        navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
    };

    const handleEnterFolder = (folder: Folder) => {
        setCurrentFolder({ id: folder.id, name: folder.name });
        setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
        setCurrentPage(1);
    };

    const handleBreadcrumbClick = (index: number) => {
        const target = breadcrumbs[index];
        setBreadcrumbs((prev) => prev.slice(0, index + 1));
        setCurrentFolder({ id: target.id, name: target.name });
        setCurrentPage(1);
    };

    const handleCreateFolder = async (name: string) => {
        setFolderPrompt((prev) => ({ ...prev, isLoading: true }));
        try {
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    parentId: currentFolder.id,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                toast.error(data.error || 'Failed to create folder');
                return;
            }

            toast.success('Folder created successfully');
            setFolderPrompt({ isOpen: false, isLoading: false });
            await fetchFolders();
        } catch (error) {
            toast.error('Failed to create folder');
        } finally {
            setFolderPrompt((prev) => ({ ...prev, isLoading: false }));
        }
    };

    const handleManageAccess = (file: FileMetadata) => {
        setSelectedFile(file);
        setShowAccessManager(true);
    };

    if (isLoading) {
        const skeletonCount = limit || 3;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Array.from({ length: skeletonCount }).map((_, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            padding: '1rem',
                            backgroundColor: '#2a2a2a',
                            borderRadius: '6px',
                            border: '1px solid #3a3a3a',
                        }}
                    >
                        <Skeleton width="40px" height="40px" />
                        <div style={{ flex: 1 }}>
                            <Skeleton variant="text" width="60%" height="1rem" />
                            <div style={{ marginTop: '0.5rem' }}>
                                <Skeleton variant="text" width="30%" height="0.75rem" />
                            </div>
                        </div>
                        <Skeleton width="80px" height="32px" />
                    </div>
                ))}
            </div>
        );
    }

    const hasActiveFilters = searchInput.trim() || fileTypeFilter !== 'all';

    return (
        <>
            {/* Search and Filter Controls */}
            {enablePagination && (
                <div
                    style={{
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '1rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                    }}
                >
                    <input
                        type="text"
                        placeholder="Search files..."
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value);
                            setCurrentPage(1);
                        }}
                        disabled={isLoading}
                        style={{
                            flex: '1',
                            minWidth: '200px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.875rem',
                            color: '#e0e0e0',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '4px',
                            outline: 'none',
                            opacity: isLoading ? 0.5 : 1,
                            cursor: isLoading ? 'not-allowed' : 'text',
                        }}
                        onFocus={(e) => !isLoading && (e.currentTarget.style.borderColor = '#3b82f6')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#3a3a3a')}
                    />

                    <select
                        value={fileTypeFilter}
                        onChange={(e) => {
                            setFileTypeFilter(e.target.value as FileTypeFilter);
                            setCurrentPage(1);
                        }}
                        disabled={isLoading}
                        style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.875rem',
                            color: '#e0e0e0',
                            backgroundColor: '#1a1a1a',
                            border: '1px solid #3a3a3a',
                            borderRadius: '4px',
                            outline: 'none',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.5 : 1,
                        }}
                    >
                        <option value="all">All Types</option>
                        <option value="image">Images</option>
                        <option value="video">Videos</option>
                        <option value="audio">Audio</option>
                        <option value="pdf">PDFs</option>
                        <option value="document">Documents</option>
                        <option value="archive">Archives</option>
                    </select>

                    {(searchInput || fileTypeFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchInput('');
                                setFileTypeFilter('all');
                                setCurrentPage(1);
                            }}
                            disabled={isLoading}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                opacity: isLoading ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.color = '#e0e0e0';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#9ca3af';
                                }
                            }}
                        >
                            Clear Filters
                        </button>
                    )}

                    {totalCount > 0 && (
                        <span style={{ fontSize: '0.875rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                            {totalCount} {totalCount === 1 ? 'file' : 'files'}
                        </span>
                    )}
                </div>
            )}

            {/* Folder Navigation */}
            <div
                style={{
                    marginBottom: '1rem',
                    padding: '1rem',
                    borderRadius: '6px',
                    border: '1px solid #3a3a3a',
                    backgroundColor: '#1f1f1f',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {breadcrumbs.map((crumb, idx) => (
                        <span key={`${crumb.id || 'root'}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <button
                                onClick={() => handleBreadcrumbClick(idx)}
                                style={{
                                    padding: '0.4rem 0.65rem',
                                    fontSize: '0.85rem',
                                    color: '#e0e0e0',
                                    backgroundColor: idx === breadcrumbs.length - 1 ? '#3b82f6' : 'transparent',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '4px',
                                    cursor: idx === breadcrumbs.length - 1 ? 'default' : 'pointer',
                                    opacity: idx === breadcrumbs.length - 1 ? 0.9 : 1,
                                }}
                                disabled={idx === breadcrumbs.length - 1}
                            >
                                {crumb.name}
                            </button>
                            {idx < breadcrumbs.length - 1 && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>/</span>}
                        </span>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => setFolderPrompt({ isOpen: true, isLoading: false })}
                        style={{
                            padding: '0.5rem 0.85rem',
                            fontSize: '0.85rem',
                            color: '#e0e0e0',
                            backgroundColor: '#2563eb',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 500,
                        }}
                    >
                        New Folder
                    </button>

                    {currentFolder.id && breadcrumbs.length > 1 && (
                        <button
                            onClick={() => handleBreadcrumbClick(Math.max(0, breadcrumbs.length - 2))}
                            style={{
                                padding: '0.5rem 0.85rem',
                                fontSize: '0.85rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Up one level
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {isFoldersLoading ? (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        minWidth: '180px',
                                        flex: '1',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #3a3a3a',
                                        backgroundColor: '#252525',
                                    }}
                                >
                                    <Skeleton width="80px" height="14px" />
                                </div>
                            ))}
                        </div>
                    ) : folders.length === 0 ? (
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>No folders here yet</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                            {folders.map((folder) => (
                                <button
                                    key={folder.id}
                                    onClick={() => handleEnterFolder(folder)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.65rem',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        border: '1px solid #3a3a3a',
                                        backgroundColor: '#252525',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ fontSize: '1.1rem' }}>📁</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                                        <span
                                            style={{
                                                color: '#e0e0e0',
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {folder.name}
                                        </span>
                                        <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>Open folder</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* File List */}
            {files.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-[var(--background)] rounded mx-auto mb-4 flex items-center justify-center">
                        <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={hasActiveFilters ? 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' : 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'}
                            />
                        </svg>
                    </div>
                    {hasActiveFilters ? (
                        <>
                            <p className="text-base text-[var(--text-secondary)]">No files match your search</p>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Try adjusting your filters or search term</p>
                            <button
                                onClick={() => {
                                    setSearchInput('');
                                    setFileTypeFilter('all');
                                    setCurrentPage(1);
                                }}
                                style={{
                                    marginTop: '1rem',
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.875rem',
                                    color: '#3b82f6',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #3b82f6',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#3b82f6';
                                    e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#3b82f6';
                                }}
                            >
                                Clear All Filters
                            </button>
                        </>
                    ) : (
                        <>
                            <p className="text-base text-[var(--text-secondary)]">No files in this folder</p>
                            <p className="text-sm text-[var(--text-muted)] mt-1">Upload or move files here to get started</p>
                        </>
                    )}
                </div>
            ) : (
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
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.borderColor = '#3b82f6';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.borderColor = '#3a3a3a';
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '1.5rem', opacity: 0.7 }}>{typeInfo.icon}</div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <h3
                                            style={{
                                                fontWeight: 500,
                                                color: '#e0e0e0',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                margin: 0,
                                                fontSize: '0.95rem',
                                            }}
                                        >
                                            {file.originalFilename}
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{formatFileSize(file.fileSize)}</span>
                                            <span
                                                style={{
                                                    fontSize: '0.75rem',
                                                    color: '#6b7280',
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '3px',
                                                    backgroundColor: '#1a1a1a',
                                                }}
                                            >
                                                {typeInfo.category}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatDateTime(file.createdAt)}</span>
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
                                        onClick={() => confirmDelete(file)}
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
            )}

            {enablePagination && totalPages > 1 && (
                <div
                    style={{
                        marginTop: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        backgroundColor: '#252525',
                        borderRadius: '6px',
                        border: '1px solid #3a3a3a',
                    }}
                >
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                        Page {currentPage} of {totalPages} ({totalCount} total files)
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                color: currentPage === 1 ? '#555' : '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.color = '#e0e0e0';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#9ca3af';
                                }
                            }}
                        >
                            First
                        </button>

                        <button
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                color: currentPage === 1 ? '#555' : '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.color = '#e0e0e0';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#9ca3af';
                                }
                            }}
                        >
                            Previous
                        </button>

                        <button
                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                color: currentPage === totalPages ? '#555' : '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.color = '#e0e0e0';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#9ca3af';
                                }
                            }}
                        >
                            Next
                        </button>

                        <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                color: currentPage === totalPages ? '#555' : '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                                    e.currentTarget.style.color = '#e0e0e0';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#9ca3af';
                                }
                            }}
                        >
                            Last
                        </button>
                    </div>
                </div>
            )}

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

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, fileId: null, fileName: '' })}
                onConfirm={() => deleteConfirm.fileId && handleDelete(deleteConfirm.fileId)}
                title="Delete File"
                message={`Are you sure you want to delete "${deleteConfirm.fileName}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Create Folder Dialog */}
            <PromptDialog
                isOpen={folderPrompt.isOpen}
                onClose={() => setFolderPrompt({ isOpen: false, isLoading: false })}
                onSubmit={handleCreateFolder}
                title="Create New Folder"
                message="Enter a name for the new folder."
                placeholder="Folder name"
                submitText="Create"
                isLoading={folderPrompt.isLoading}
            />
        </>
    );
}
