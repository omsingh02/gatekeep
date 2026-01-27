'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Skeleton, ConfirmDialog, PromptDialog, Modal, useToast } from '@/components/ui';
import { FileMetadata, FileTypeFilter, Folder } from '@/lib/types';
import { formatFileSize, getFileTypeInfo } from '@/lib/utils/fileTypes';
import { formatDateTime } from '@/lib/utils/date';
import { useDebouncedValue } from '@/lib/utils/hooks';
import AccessManager from './AccessManager';

type ViewMode = 'table' | 'grid';

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
    viewAllHref = '/admin/files',
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

    // View mode state
    const [viewMode, setViewMode] = useState<ViewMode>('table');

    // Selection state
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

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
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; fileId: string | null; fileName: string; type: 'file' | 'folder' }>({
        isOpen: false,
        fileId: null,
        fileName: '',
        type: 'file',
    });
    const [folderPrompt, setFolderPrompt] = useState<{ isOpen: boolean; isLoading: boolean; mode: 'create' | 'rename'; folderId?: string; initialValue?: string }>({
        isOpen: false,
        isLoading: false,
        mode: 'create',
    });
    const [moveDialog, setMoveDialog] = useState<{ isOpen: boolean; isLoading: boolean }>({
        isOpen: false,
        isLoading: false,
    });
    const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null);
    const [allFolders, setAllFolders] = useState<Folder[]>([]);
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

    const toast = useToast();

    // Clear selection when changing folder or filters
    useEffect(() => {
        setSelectedFileIds(new Set());
        setSelectedFolderIds(new Set());
    }, [currentFolder.id, debouncedSearch, fileTypeFilter]);

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

    const handleDelete = async (fileId: string, type: 'file' | 'folder' = 'file') => {
        try {
            const endpoint = type === 'folder' ? `/api/folders/${fileId}` : `/api/files/${fileId}`;
            const response = await fetch(endpoint, {
                method: 'DELETE',
            });

            if (response.ok) {
                if (type === 'folder') {
                    toast.success('Folder deleted successfully');
                    await fetchFolders();
                } else {
                    const newFiles = files.filter((f) => f.id !== fileId);
                    setFiles(newFiles);
                    toast.success('File deleted successfully');
                    if (newFiles.length === 0 && currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                    } else {
                        fetchFiles();
                    }
                }
            } else {
                toast.error(`Failed to delete ${type}`);
            }
        } catch (error) {
            toast.error(`Failed to delete ${type}`);
        } finally {
            setDeleteConfirm({ isOpen: false, fileId: null, fileName: '', type: 'file' });
        }
    };

    const confirmDelete = (file: FileMetadata) => {
        setDeleteConfirm({ isOpen: true, fileId: file.id, fileName: file.originalFilename, type: 'file' });
    };

    const confirmDeleteFolder = (folder: Folder) => {
        setDeleteConfirm({ isOpen: true, fileId: folder.id, fileName: folder.name, type: 'folder' });
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

    const handleFolderSubmit = async (name: string) => {
        setFolderPrompt((prev) => ({ ...prev, isLoading: true }));
        try {
            if (folderPrompt.mode === 'rename' && folderPrompt.folderId) {
                const response = await fetch(`/api/folders/${folderPrompt.folderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                });

                if (!response.ok) {
                    const data = await response.json();
                    toast.error(data.error || 'Failed to rename folder');
                    return;
                }

                toast.success('Folder renamed successfully');
            } else {
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
            }

            setFolderPrompt({ isOpen: false, isLoading: false, mode: 'create' });
            await fetchFolders();
        } catch (error) {
            toast.error(folderPrompt.mode === 'rename' ? 'Failed to rename folder' : 'Failed to create folder');
        } finally {
            setFolderPrompt((prev) => ({ ...prev, isLoading: false }));
        }
    };

    const handleRenameFolder = (folder: Folder) => {
        setFolderPrompt({ isOpen: true, isLoading: false, mode: 'rename', folderId: folder.id, initialValue: folder.name });
    };

    // Selection handlers
    const toggleFileSelection = (fileId: string) => {
        setSelectedFileIds((prev) => {
            const next = new Set(prev);
            if (next.has(fileId)) {
                next.delete(fileId);
            } else {
                next.add(fileId);
            }
            return next;
        });
    };

    const toggleFolderSelection = (folderId: string) => {
        setSelectedFolderIds((prev) => {
            const next = new Set(prev);
            if (next.has(folderId)) {
                next.delete(folderId);
            } else {
                next.add(folderId);
            }
            return next;
        });
    };

    const selectAll = () => {
        if (selectedFileIds.size === files.length && selectedFolderIds.size === folders.length) {
            setSelectedFileIds(new Set());
            setSelectedFolderIds(new Set());
        } else {
            setSelectedFileIds(new Set(files.map((f) => f.id)));
            setSelectedFolderIds(new Set(folders.map((f) => f.id)));
        }
    };

    const clearSelection = () => {
        setSelectedFileIds(new Set());
        setSelectedFolderIds(new Set());
    };

    const hasSelection = selectedFileIds.size > 0 || selectedFolderIds.size > 0;
    const allSelected = files.length > 0 && folders.length >= 0 && selectedFileIds.size === files.length && selectedFolderIds.size === folders.length;

    // Fetch all folders for move dialog
    const fetchAllFolders = useCallback(async () => {
        try {
            const response = await fetch('/api/folders?all=true');
            if (response.ok) {
                const data = await response.json();
                setAllFolders(data.folders || []);
            }
        } catch (error) {
            // Silently fail
        }
    }, []);

    // Move handlers
    const openMoveDialog = async () => {
        setMoveDialog({ isOpen: true, isLoading: false });
        setMoveTargetFolder(null);
        await fetchAllFolders();
    };

    const handleMove = async () => {
        setMoveDialog((prev) => ({ ...prev, isLoading: true }));
        try {
            // Move files
            for (const fileId of selectedFileIds) {
                await fetch(`/api/files/${fileId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderId: moveTargetFolder }),
                });
            }

            // Move folders
            for (const folderId of selectedFolderIds) {
                await fetch(`/api/folders/${folderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentId: moveTargetFolder }),
                });
            }

            toast.success(`Moved ${selectedFileIds.size + selectedFolderIds.size} items`);
            clearSelection();
            await fetchFiles();
            await fetchFolders();
        } catch (error) {
            toast.error('Failed to move some items');
        } finally {
            setMoveDialog({ isOpen: false, isLoading: false });
        }
    };

    // Bulk delete
    const handleBulkDelete = async () => {
        try {
            for (const fileId of selectedFileIds) {
                await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
            }
            for (const folderId of selectedFolderIds) {
                await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
            }

            toast.success(`Deleted ${selectedFileIds.size + selectedFolderIds.size} items`);
            clearSelection();
            await fetchFiles();
            await fetchFolders();
        } catch (error) {
            toast.error('Failed to delete some items');
        } finally {
            setBulkDeleteConfirm(false);
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

                    {/* View Toggle */}
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem', backgroundColor: '#1a1a1a', borderRadius: '4px', padding: '0.25rem' }}>
                        <button
                            onClick={() => setViewMode('table')}
                            title="Table view"
                            style={{
                                padding: '0.35rem 0.5rem',
                                backgroundColor: viewMode === 'table' ? '#3a3a3a' : 'transparent',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={viewMode === 'table' ? '#e0e0e0' : '#6b7280'} strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <line x1="3" y1="9" x2="21" y2="9" />
                                <line x1="3" y1="15" x2="21" y2="15" />
                                <line x1="9" y1="3" x2="9" y2="21" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            title="Grid view"
                            style={{
                                padding: '0.35rem 0.5rem',
                                backgroundColor: viewMode === 'grid' ? '#3a3a3a' : 'transparent',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={viewMode === 'grid' ? '#e0e0e0' : '#6b7280'} strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Bulk Action Bar */}
            {hasSelection && (
                <div
                    style={{
                        marginBottom: '1rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '6px',
                        backgroundColor: '#1e3a5f',
                        border: '1px solid #3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                    }}
                >
                    <span style={{ fontSize: '0.875rem', color: '#e0e0e0' }}>
                        {selectedFileIds.size + selectedFolderIds.size} item{selectedFileIds.size + selectedFolderIds.size !== 1 ? 's' : ''} selected
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={openMoveDialog}
                            style={{
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.8rem',
                                color: '#e0e0e0',
                                backgroundColor: '#2563eb',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            Move
                        </button>
                        <button
                            onClick={() => setBulkDeleteConfirm(true)}
                            style={{
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.8rem',
                                color: '#ffffff',
                                backgroundColor: '#dc2626',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 500,
                            }}
                        >
                            Delete
                        </button>
                        <button
                            onClick={clearSelection}
                            style={{
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.8rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Clear
                        </button>
                    </div>
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
                        <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                            {folders.map((folder) => (
                                <div
                                    key={folder.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.6rem 0.75rem',
                                        borderRadius: '6px',
                                        border: `1px solid ${selectedFolderIds.has(folder.id) ? '#3b82f6' : '#3a3a3a'}`,
                                        backgroundColor: selectedFolderIds.has(folder.id) ? '#1e3a5f' : '#252525',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedFolderIds.has(folder.id)}
                                        onChange={() => toggleFolderSelection(folder.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                    />
                                    <button
                                        onClick={() => handleEnterFolder(folder)}
                                        style={{
                                            flex: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            padding: 0,
                                            minWidth: 0,
                                        }}
                                    >
                                        <span style={{ fontSize: '1.1rem' }}>📁</span>
                                        <span
                                            style={{
                                                color: '#e0e0e0',
                                                fontWeight: 500,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontSize: '0.9rem',
                                            }}
                                        >
                                            {folder.name}
                                        </span>
                                    </button>
                                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                                        <button
                                            onClick={() => handleRenameFolder(folder)}
                                            title="Rename"
                                            style={{
                                                padding: '0.3rem',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                color: '#6b7280',
                                            }}
                                        >
                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => confirmDeleteFolder(folder)}
                                            title="Delete"
                                            style={{
                                                padding: '0.3rem',
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                color: '#ef4444',
                                            }}
                                        >
                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
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
                <>
                    {viewMode === 'table' ? (
                        /* Table View */
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #3a3a3a' }}>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', width: '40px' }}>
                                            <input
                                                type="checkbox"
                                                checked={allSelected && (files.length > 0 || folders.length > 0)}
                                                onChange={selectAll}
                                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                            />
                                        </th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>NAME</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500, width: '100px' }}>SIZE</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500, width: '140px' }}>CREATED AT</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500, width: '140px' }}>UPDATED AT</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#9ca3af', fontWeight: 500, width: '100px' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {files.map((file) => {
                                        const typeInfo = getFileTypeInfo(file.mimeType);
                                        const isSelected = selectedFileIds.has(file.id);
                                        return (
                                            <tr
                                                key={file.id}
                                                style={{
                                                    borderBottom: '1px solid #2a2a2a',
                                                    backgroundColor: isSelected ? '#1e3a5f' : 'transparent',
                                                    transition: 'background-color 0.15s',
                                                }}
                                            >
                                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleFileSelection(file.id)}
                                                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontSize: '1.1rem', opacity: 0.7 }}>{typeInfo.icon}</span>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {file.originalFilename}
                                                            </div>
                                                            {file.folderName && (
                                                                <span style={{ fontSize: '0.75rem', color: '#60a5fa' }}>📁 {file.folderName}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: '#9ca3af' }}>{formatFileSize(file.fileSize)}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>{formatDateTime(file.createdAt)}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>{formatDateTime(file.updatedAt)}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                                        <button
                                                            onClick={() => copyShortLink(file.shortCode)}
                                                            title="Copy link"
                                                            style={{ padding: '0.3rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#6b7280' }}
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => handleManageAccess(file)}
                                                            title="Manage access"
                                                            style={{ padding: '0.3rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#6b7280' }}
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => confirmDelete(file)}
                                                            title="Delete"
                                                            style={{ padding: '0.3rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#ef4444' }}
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Grid View */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {files.map((file) => {
                                const typeInfo = getFileTypeInfo(file.mimeType);
                                const isSelected = selectedFileIds.has(file.id);
                                return (
                                    <div
                                        key={file.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '1rem',
                                            borderRadius: '6px',
                                            border: `1px solid ${isSelected ? '#3b82f6' : '#3a3a3a'}`,
                                            backgroundColor: isSelected ? '#1e3a5f' : '#252525',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleFileSelection(file.id)}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                                        />
                                        <div style={{ fontSize: '1.5rem', opacity: 0.7 }}>{typeInfo.icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <h3 style={{ fontWeight: 500, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0, fontSize: '0.95rem' }}>
                                                {file.originalFilename}
                                            </h3>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{formatFileSize(file.fileSize)}</span>
                                                <span style={{ fontSize: '0.75rem', color: '#6b7280', padding: '0.125rem 0.5rem', borderRadius: '3px', backgroundColor: '#1a1a1a' }}>{typeInfo.category}</span>
                                                {file.folderName && (
                                                    <span style={{ fontSize: '0.75rem', color: '#60a5fa', padding: '0.125rem 0.5rem', borderRadius: '3px', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
                                                        📁 {file.folderName}
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{formatDateTime(file.createdAt)}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <button onClick={() => copyShortLink(file.shortCode)} title="Copy link" style={{ padding: '0.4rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#6b7280' }}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            </button>
                                            <button onClick={() => handleManageAccess(file)} title="Manage access" style={{ padding: '0.4rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#6b7280' }}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            </button>
                                            <button onClick={() => confirmDelete(file)} title="Delete" style={{ padding: '0.4rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#ef4444' }}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
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
                onClose={() => setDeleteConfirm({ isOpen: false, fileId: null, fileName: '', type: 'file' })}
                onConfirm={() => deleteConfirm.fileId && handleDelete(deleteConfirm.fileId, deleteConfirm.type)}
                title={`Delete ${deleteConfirm.type === 'folder' ? 'Folder' : 'File'}`}
                message={`Are you sure you want to delete "${deleteConfirm.fileName}"?${deleteConfirm.type === 'folder' ? ' All subfolders will also be deleted and files will be moved to root.' : ''} This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Bulk Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={bulkDeleteConfirm}
                onClose={() => setBulkDeleteConfirm(false)}
                onConfirm={handleBulkDelete}
                title="Delete Selected Items"
                message={`Are you sure you want to delete ${selectedFileIds.size + selectedFolderIds.size} selected items? This action cannot be undone.`}
                confirmText="Delete All"
                cancelText="Cancel"
                variant="danger"
            />

            {/* Create/Rename Folder Dialog */}
            <PromptDialog
                isOpen={folderPrompt.isOpen}
                onClose={() => setFolderPrompt({ isOpen: false, isLoading: false, mode: 'create' })}
                onSubmit={handleFolderSubmit}
                title={folderPrompt.mode === 'rename' ? 'Rename Folder' : 'Create New Folder'}
                message={folderPrompt.mode === 'rename' ? 'Enter a new name for the folder.' : 'Enter a name for the new folder.'}
                placeholder="Folder name"
                submitText={folderPrompt.mode === 'rename' ? 'Rename' : 'Create'}
                isLoading={folderPrompt.isLoading}
                defaultValue={folderPrompt.initialValue}
            />

            {/* Move Dialog */}
            <Modal
                isOpen={moveDialog.isOpen}
                onClose={() => setMoveDialog({ isOpen: false, isLoading: false })}
                title="Move Items"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>
                        Select a destination folder for {selectedFileIds.size + selectedFolderIds.size} selected items:
                    </p>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #3a3a3a', borderRadius: '6px' }}>
                        <button
                            onClick={() => setMoveTargetFolder(null)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: moveTargetFolder === null ? '#1e3a5f' : 'transparent',
                                border: 'none',
                                borderBottom: '1px solid #2a2a2a',
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                        >
                            <span style={{ fontSize: '1rem' }}>🏠</span>
                            <span style={{ color: '#e0e0e0', fontWeight: 500 }}>Root (Home)</span>
                        </button>
                        {allFolders
                            .filter((f) => !selectedFolderIds.has(f.id))
                            .map((folder) => (
                                <button
                                    key={folder.id}
                                    onClick={() => setMoveTargetFolder(folder.id)}
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        paddingLeft: folder.parentId ? '1.5rem' : '0.75rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        backgroundColor: moveTargetFolder === folder.id ? '#1e3a5f' : 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid #2a2a2a',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ fontSize: '1rem' }}>📁</span>
                                    <span style={{ color: '#e0e0e0' }}>{folder.name}</span>
                                </button>
                            ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                            onClick={() => setMoveDialog({ isOpen: false, isLoading: false })}
                            disabled={moveDialog.isLoading}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #3a3a3a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleMove}
                            disabled={moveDialog.isLoading}
                            style={{
                                padding: '0.5rem 1rem',
                                fontSize: '0.875rem',
                                color: '#ffffff',
                                backgroundColor: '#2563eb',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: moveDialog.isLoading ? 'not-allowed' : 'pointer',
                                opacity: moveDialog.isLoading ? 0.7 : 1,
                            }}
                        >
                            {moveDialog.isLoading ? 'Moving...' : 'Move Here'}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
