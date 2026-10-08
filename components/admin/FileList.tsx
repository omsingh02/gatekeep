'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Share2 } from 'lucide-react';
import { Skeleton, ConfirmDialog, PromptDialog, Modal, useToast, EmptyState, FileTypeIcon } from '@/components/ui';
import { FileMetadata, FileTypeFilter, DateFilter, Folder } from '@/lib/types';
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
    showFolderNavigation?: boolean;
}

export default function FileList({
    limit,
    showViewAll = false,
    viewAllHref = '/admin/files',
    enablePagination = false,
    itemsPerPage = 20,
    showFolderNavigation = true,
}: FileListProps) {
    const [files, setFiles] = useState<FileMetadata[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
    const [showAccessManager, setShowAccessManager] = useState(false);

    // Responsive: detect mobile to default to grid view

    // View mode state - default to grid on mobile
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    const [hasSetInitialViewMode, setHasSetInitialViewMode] = useState(false);

    // Set initial view mode based on screen size (only once on mount). useIsMobile is still
    // false on this first pass (it measures in its own effect), so read the width directly.
    useEffect(() => {
        if (!hasSetInitialViewMode) {
            setViewMode(window.innerWidth < 768 ? 'grid' : 'table');
            setHasSetInitialViewMode(true);
        }
    }, [hasSetInitialViewMode]);

    // Selection state
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

    // Search and filter state
    const [searchInput, setSearchInput] = useState('');
    const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const debouncedSearch = useDebouncedValue(searchInput, 300);

    // Folder state
    const [folders, setFolders] = useState<Folder[]>([]);
    const [currentFolder, setCurrentFolder] = useState<{ id: string | null; name: string }>({ id: null, name: 'Home' });
    const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Home' }]);
    const [, setIsFoldersLoading] = useState(false);

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
    }, [currentFolder.id, debouncedSearch, fileTypeFilter, dateFilter]);

    useEffect(() => {
        fetchFiles();
        if (showFolderNavigation) {
            fetchFolders();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [limit, currentPage, debouncedSearch, fileTypeFilter, dateFilter, currentFolder.id, showFolderNavigation]);

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
        } catch {
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

            if (dateFilter !== 'all') {
                params.append('dateFilter', dateFilter);
            }

            if (currentFolder.id) {
                params.append('folderId', currentFolder.id);
            }

            // For recent files view (no folder navigation), show all files across folders
            if (!showFolderNavigation) {
                params.append('showAll', 'true');
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
        } catch {
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
        } catch {
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
        } catch {
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
        const targetFolderCount = showFolderNavigation ? folders.length : 0;
        if (selectedFileIds.size === files.length && selectedFolderIds.size === targetFolderCount) {
            setSelectedFileIds(new Set());
            setSelectedFolderIds(new Set());
        } else {
            setSelectedFileIds(new Set(files.map((f) => f.id)));
            if (showFolderNavigation) {
                setSelectedFolderIds(new Set(folders.map((f) => f.id)));
            }
        }
    };

    const clearSelection = () => {
        setSelectedFileIds(new Set());
        setSelectedFolderIds(new Set());
    };

    const hasSelection = selectedFileIds.size > 0 || selectedFolderIds.size > 0;
    const targetFolderCountForAll = showFolderNavigation ? folders.length : 0;
    const allSelected = files.length > 0 && selectedFileIds.size === files.length && selectedFolderIds.size === targetFolderCountForAll;

    // Fetch all folders for move dialog
    const fetchAllFolders = useCallback(async () => {
        try {
            const response = await fetch('/api/folders?all=true');
            if (response.ok) {
                const data = await response.json();
                setAllFolders(data.folders || []);
            }
        } catch {
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
            const total = selectedFileIds.size + selectedFolderIds.size;
            let failed = 0;

            // Move files
            for (const fileId of selectedFileIds) {
                const res = await fetch(`/api/files/${fileId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderId: moveTargetFolder }),
                });
                if (!res.ok) failed++;
            }

            // Move folders
            for (const folderId of selectedFolderIds) {
                const res = await fetch(`/api/folders/${folderId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ parentId: moveTargetFolder }),
                });
                if (!res.ok) failed++;
            }

            if (failed === 0) {
                toast.success(`Moved ${total} ${total === 1 ? 'item' : 'items'}`);
            } else if (failed === total) {
                toast.error(`Couldn't move ${total === 1 ? 'that item' : 'those items'}. Try again.`);
            } else {
                toast.warning(`Moved ${total - failed} of ${total} items. ${failed} couldn't be moved.`);
            }
            clearSelection();
            await fetchFiles();
            await fetchFolders();
        } catch {
            toast.error('Failed to move some items');
        } finally {
            setMoveDialog({ isOpen: false, isLoading: false });
        }
    };

    // Bulk delete
    const handleBulkDelete = async () => {
        try {
            const total = selectedFileIds.size + selectedFolderIds.size;
            let failed = 0;
            for (const fileId of selectedFileIds) {
                const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
                if (!res.ok) failed++;
            }
            for (const folderId of selectedFolderIds) {
                const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
                if (!res.ok) failed++;
            }

            if (failed === 0) {
                toast.success(`Deleted ${total} ${total === 1 ? 'item' : 'items'}`);
            } else if (failed === total) {
                toast.error(`Couldn't delete ${total === 1 ? 'that item' : 'those items'}. Try again.`);
            } else {
                toast.warning(`Deleted ${total - failed} of ${total} items. ${failed} couldn't be deleted.`);
            }
            clearSelection();
            await fetchFiles();
            await fetchFolders();
        } catch {
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
                            backgroundColor: '#12141c',
                            borderRadius: '6px',
                            border: '1px solid #23263a',
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

    const hasActiveFilters = searchInput.trim() || fileTypeFilter !== 'all' || dateFilter !== 'all';

    return (
        <>
            {/* Search and Filter Controls */}
            {enablePagination && (
                <div
                    style={{
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '0.75rem',
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
                            flex: '1 1 180px',
                            minWidth: '140px',
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.875rem',
                            color: '#e0e0e0',
                            backgroundColor: '#0b0c11',
                            border: '1px solid #23263a',
                            borderRadius: '4px',
                            outline: 'none',
                            opacity: isLoading ? 0.5 : 1,
                            cursor: isLoading ? 'not-allowed' : 'text',
                        }}
                        onFocus={(e) => !isLoading && (e.currentTarget.style.borderColor = '#6366f1')}
                        onBlur={(e) => (e.currentTarget.style.borderColor = '#23263a')}
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
                            backgroundColor: '#0b0c11',
                            border: '1px solid #23263a',
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

                    <select
                        value={dateFilter}
                        onChange={(e) => {
                            setDateFilter(e.target.value as DateFilter);
                            setCurrentPage(1);
                        }}
                        disabled={isLoading}
                        style={{
                            padding: '0.5rem 0.75rem',
                            fontSize: '0.875rem',
                            color: '#e0e0e0',
                            backgroundColor: '#0b0c11',
                            border: '1px solid #23263a',
                            borderRadius: '4px',
                            outline: 'none',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.5 : 1,
                        }}
                    >
                        <option value="all">Any Date</option>
                        <option value="today">Today</option>
                        <option value="week">Last 7 Days</option>
                        <option value="month">Last 30 Days</option>
                        <option value="3months">Last 90 Days</option>
                    </select>

                    {(searchInput || fileTypeFilter !== 'all' || dateFilter !== 'all') && (
                        <button
                            onClick={() => {
                                setSearchInput('');
                                setFileTypeFilter('all');
                                setDateFilter('all');
                                setCurrentPage(1);
                            }}
                            disabled={isLoading}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #23263a',
                                borderRadius: '4px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                opacity: isLoading ? 0.5 : 1,
                            }}
                            onMouseEnter={(e) => {
                                if (!isLoading) {
                                    e.currentTarget.style.backgroundColor = '#0b0c11';
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
                        <span style={{ fontSize: '0.875rem', color: '#9ca3af', whiteSpace: 'nowrap', order: 10 }}>
                            {totalCount} {totalCount === 1 ? 'file' : 'files'}
                        </span>
                    )}

                    {/* View Toggle */}
                    <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#0b0c11', borderRadius: '4px', padding: '0.25rem', order: 11 }}>
                        <button
                            onClick={() => setViewMode('table')}
                            title="Table view"
                            style={{
                                padding: '0.35rem 0.5rem',
                                backgroundColor: viewMode === 'table' ? '#23263a' : 'transparent',
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
                                backgroundColor: viewMode === 'grid' ? '#23263a' : 'transparent',
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
                        backgroundColor: '#1e1b4b',
                        border: '1px solid #6366f1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '1rem',
                    }}
                >
                    <span style={{ fontSize: '0.875rem', color: '#e0e0e0' }}>
                        {selectedFileIds.size + selectedFolderIds.size} item{selectedFileIds.size + selectedFolderIds.size !== 1 ? 's' : ''} selected
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={openMoveDialog}
                            style={{
                                padding: '0.4rem 0.75rem',
                                fontSize: '0.8rem',
                                color: '#e0e0e0',
                                backgroundColor: '#4f46e5',
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
                                border: '1px solid #23263a',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* Folder Navigation - Breadcrumbs and New Folder */}
            {showFolderNavigation && (
            <div
                style={{
                    marginBottom: '1rem',
                    padding: 'clamp(0.75rem, 2vw, 1rem)',
                    borderRadius: '6px',
                    border: '1px solid #23263a',
                    backgroundColor: '#0f1117',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
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
                                    backgroundColor: idx === breadcrumbs.length - 1 ? '#6366f1' : 'transparent',
                                    border: '1px solid #23263a',
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

                <button
                    onClick={() => setFolderPrompt({ isOpen: true, isLoading: false, mode: 'create' })}
                    style={{
                        padding: '0.5rem 0.85rem',
                        fontSize: '0.85rem',
                        color: '#e0e0e0',
                        backgroundColor: '#4f46e5',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 500,
                    }}
                >
                    New Folder
                </button>
            </div>
            )}

            {/* File and Folder List */}
            {files.length === 0 && (!showFolderNavigation || folders.length === 0) ? (
                hasActiveFilters ? (
                    <EmptyState
                        type="no-results"
                        title="No files match your search"
                        description="Try adjusting your filters or search term"
                        action={
                            <button
                                onClick={() => {
                                    setSearchInput('');
                                    setFileTypeFilter('all');
                                    setDateFilter('all');
                                    setCurrentPage(1);
                                }}
                                style={{
                                    padding: '0.5rem 1rem',
                                    fontSize: '0.875rem',
                                    color: '#6366f1',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #6366f1',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#6366f1';
                                    e.currentTarget.style.color = '#ffffff';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                    e.currentTarget.style.color = '#6366f1';
                                }}
                            >
                                Clear All Filters
                            </button>
                        }
                    />
                ) : (
                    <EmptyState
                        type="empty-folder"
                        title="No files in this folder"
                        description="Upload or move files here to get started"
                    />
                )
            ) : (
                <>
                    {viewMode === 'table' ? (
                        /* Table View */
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #23263a' }}>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', width: '40px' }}>
                                            <div
                                                onClick={selectAll}
                                                style={{
                                                    width: '18px',
                                                    height: '18px',
                                                    borderRadius: '4px',
                                                    border: `2px solid ${allSelected && (files.length > 0 || folders.length > 0) ? '#6366f1' : '#2f3349'}`,
                                                    backgroundColor: allSelected && (files.length > 0 || folders.length > 0) ? '#6366f1' : 'transparent',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                {allSelected && (files.length > 0 || folders.length > 0) && (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                            </div>
                                        </th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>NAME</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500, width: '100px' }}>SIZE</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500, width: '140px' }}>CREATED AT</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500, width: '140px' }}>UPDATED AT</th>
                                        <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#9ca3af', fontWeight: 500, width: '100px' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Folders first */}
                                    {showFolderNavigation && folders.map((folder) => {
                                        const isSelected = selectedFolderIds.has(folder.id);
                                        return (
                                            <tr
                                                key={`folder-${folder.id}`}
                                                style={{
                                                    borderBottom: '1px solid #12141c',
                                                    backgroundColor: isSelected ? '#1e1b4b' : 'transparent',
                                                    transition: 'background-color 0.15s',
                                                    cursor: 'pointer',
                                                }}
                                                onDoubleClick={() => handleEnterFolder(folder)}
                                            >
                                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                                    <div
                                                        onClick={(e) => { e.stopPropagation(); toggleFolderSelection(folder.id); }}
                                                        style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '4px',
                                                            border: `2px solid ${isSelected ? '#6366f1' : '#2f3349'}`,
                                                            backgroundColor: isSelected ? '#6366f1' : 'transparent',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        {isSelected && (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                                    <button
                                                        onClick={() => handleEnterFolder(folder)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem',
                                                            background: 'none',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            padding: 0,
                                                        }}
                                                    >
                                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#818cf8" stroke="none">
                                                            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                                        </svg>
                                                        <span style={{ color: '#e0e0e0', fontWeight: 500 }}>{folder.name}</span>
                                                    </button>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280' }}>—</td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>{formatDateTime(folder.createdAt)}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>{formatDateTime(folder.createdAt)}</td>
                                                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }}
                                                            title="Rename"
                                                            style={{ padding: '0.3rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#6b7280' }}
                                                        >
                                                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); confirmDeleteFolder(folder); }}
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
                                    {/* Files */}
                                    {files.map((file) => {
                                        const typeInfo = getFileTypeInfo(file.mimeType);
                                        const isSelected = selectedFileIds.has(file.id);
                                        return (
                                            <tr
                                                key={file.id}
                                                style={{
                                                    borderBottom: '1px solid #12141c',
                                                    backgroundColor: isSelected ? '#1e1b4b' : 'transparent',
                                                    transition: 'background-color 0.15s',
                                                }}
                                            >
                                                <td style={{ padding: '0.75rem 0.5rem' }}>
                                                    <div
                                                        onClick={() => toggleFileSelection(file.id)}
                                                        style={{
                                                            width: '18px',
                                                            height: '18px',
                                                            borderRadius: '4px',
                                                            border: `2px solid ${isSelected ? '#6366f1' : '#2f3349'}`,
                                                            backgroundColor: isSelected ? '#6366f1' : 'transparent',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        {isSelected && (
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '0.75rem 0.5rem', maxWidth: '200px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <FileTypeIcon category={typeInfo.category} size={18} />
                                                        <div style={{ minWidth: 0, width: '100%' }}>
                                                            <div 
                                                                title={file.originalFilename}
                                                                style={{ color: '#e0e0e0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                                            >
                                                                {file.originalFilename}
                                                            </div>
                                                            {file.folderName && (
                                                                <span style={{ fontSize: '0.75rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="#818cf8" stroke="none"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                                                    {file.folderName}
                                                                </span>
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
                                                            aria-label={`Share ${file.originalFilename}`}
                                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', marginRight: '0.25rem', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(129, 140, 248, 0.35)', borderRadius: '6px', cursor: 'pointer', color: '#c7d2fe', fontSize: '0.75rem', fontWeight: 600 }}
                                                        >
                                                            <Share2 size={13} aria-hidden />
                                                            Share
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
                        /* Card Grid View */
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {/* Folder Cards */}
                            {showFolderNavigation && folders.map((folder) => {
                                const isSelected = selectedFolderIds.has(folder.id);
                                return (
                                    <div
                                        key={`folder-${folder.id}`}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            border: `1px solid ${isSelected ? '#6366f1' : '#23263a'}`,
                                            backgroundColor: isSelected ? '#1e1b4b' : '#151823',
                                            transition: 'all 0.15s',
                                            position: 'relative',
                                            cursor: 'pointer',
                                        }}
                                        onDoubleClick={() => handleEnterFolder(folder)}
                                    >
                                        {/* Checkbox */}
                                        <div
                                            onClick={(e) => { e.stopPropagation(); toggleFolderSelection(folder.id); }}
                                            style={{
                                                position: 'absolute',
                                                top: '0.75rem',
                                                left: '0.75rem',
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '4px',
                                                border: `2px solid ${isSelected ? '#6366f1' : '#2f3349'}`,
                                                backgroundColor: isSelected ? '#6366f1' : 'rgba(26, 26, 26, 0.8)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s',
                                                zIndex: 1,
                                            }}
                                        >
                                            {isSelected && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* Folder Icon */}
                                        <div 
                                            onClick={() => handleEnterFolder(folder)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: '80px',
                                                marginBottom: '0.75rem',
                                                backgroundColor: '#0b0c11',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="#818cf8" stroke="none">
                                                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                            </svg>
                                        </div>

                                        {/* Folder Name */}
                                        <h3 
                                            onClick={() => handleEnterFolder(folder)}
                                            style={{
                                                fontWeight: 500,
                                                color: '#e0e0e0',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                margin: 0,
                                                fontSize: '0.9rem',
                                                marginBottom: '0.5rem',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {folder.name}
                                        </h3>

                                        {/* Meta info */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.7rem', color: '#818cf8', padding: '0.1rem 0.4rem', borderRadius: '3px', backgroundColor: 'rgba(99, 102, 241, 0.1)' }}>Folder</span>
                                        </div>

                                        {/* Date */}
                                        <span style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.75rem' }}>{formatDateTime(folder.createdAt)}</span>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', borderTop: '1px solid #23263a', paddingTop: '0.75rem', marginTop: 'auto' }}>
                                            <button onClick={(e) => { e.stopPropagation(); handleRenameFolder(folder); }} title="Rename" style={{ padding: '0.4rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#6b7280' }}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); confirmDeleteFolder(folder); }} title="Delete" style={{ padding: '0.4rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#ef4444' }}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* File Cards */}
                            {files.map((file) => {
                                const typeInfo = getFileTypeInfo(file.mimeType);
                                const isSelected = selectedFileIds.has(file.id);
                                return (
                                    <div
                                        key={file.id}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            border: `1px solid ${isSelected ? '#6366f1' : '#23263a'}`,
                                            backgroundColor: isSelected ? '#1e1b4b' : '#151823',
                                            transition: 'all 0.15s',
                                            position: 'relative',
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <div
                                            onClick={() => toggleFileSelection(file.id)}
                                            style={{
                                                position: 'absolute',
                                                top: '0.75rem',
                                                left: '0.75rem',
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '4px',
                                                border: `2px solid ${isSelected ? '#6366f1' : '#2f3349'}`,
                                                backgroundColor: isSelected ? '#6366f1' : 'rgba(26, 26, 26, 0.8)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.15s',
                                                zIndex: 1,
                                            }}
                                        >
                                            {isSelected && (
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            )}
                                        </div>

                                        {/* File Icon/Thumbnail */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '80px',
                                            marginBottom: '0.75rem',
                                            backgroundColor: '#0b0c11',
                                            borderRadius: '6px',
                                        }}>
                                            <FileTypeIcon category={typeInfo.category} size={36} />
                                        </div>

                                        {/* File Name */}
                                        <h3 style={{
                                            fontWeight: 500,
                                            color: '#e0e0e0',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            margin: 0,
                                            fontSize: '0.9rem',
                                            marginBottom: '0.5rem',
                                        }}>
                                            {file.originalFilename}
                                        </h3>

                                        {/* Meta info */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{formatFileSize(file.fileSize)}</span>
                                            <span style={{ fontSize: '0.7rem', color: '#6b7280', padding: '0.1rem 0.4rem', borderRadius: '3px', backgroundColor: '#0b0c11' }}>{typeInfo.category}</span>
                                        </div>

                                        {/* Folder badge */}
                                        {file.folderName && (
                                            <div style={{ marginBottom: '0.5rem' }}>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    color: '#818cf8',
                                                    padding: '0.15rem 0.4rem',
                                                    borderRadius: '3px',
                                                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '0.25rem',
                                                }}>
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#818cf8" stroke="none"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                                                    {file.folderName}
                                                </span>
                                            </div>
                                        )}

                                        {/* Date */}
                                        <span style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.75rem' }}>{formatDateTime(file.createdAt)}</span>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.25rem', borderTop: '1px solid #23263a', paddingTop: '0.75rem', marginTop: 'auto' }}>
                                            <button onClick={() => copyShortLink(file.shortCode)} title="Copy link" style={{ padding: '0.4rem', backgroundColor: 'transparent', border: 'none', borderRadius: '3px', cursor: 'pointer', color: '#6b7280' }}>
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                            </button>
                                            <button onClick={() => handleManageAccess(file)} title="Manage access" aria-label={`Share ${file.originalFilename}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.3rem 0.65rem', marginRight: '0.25rem', backgroundColor: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(129, 140, 248, 0.35)', borderRadius: '6px', cursor: 'pointer', color: '#c7d2fe', fontSize: '0.75rem', fontWeight: 600 }}>
                                                <Share2 size={14} aria-hidden />
                                                Share
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
                        flexWrap: 'wrap',
                        gap: '1rem',
                        padding: '1rem',
                        backgroundColor: '#151823',
                        borderRadius: '6px',
                        border: '1px solid #23263a',
                    }}
                >
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af', minWidth: 0 }}>
                        Page {currentPage} of {totalPages}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.8rem',
                                color: currentPage === 1 ? '#555' : '#9ca3af',
                                backgroundColor: 'transparent',
                                border: '1px solid #23263a',
                                borderRadius: '4px',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.backgroundColor = '#0b0c11';
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
                                border: '1px solid #23263a',
                                borderRadius: '4px',
                                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== 1) {
                                    e.currentTarget.style.backgroundColor = '#0b0c11';
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
                                border: '1px solid #23263a',
                                borderRadius: '4px',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.backgroundColor = '#0b0c11';
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
                                border: '1px solid #23263a',
                                borderRadius: '4px',
                                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                fontWeight: 500,
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== totalPages) {
                                    e.currentTarget.style.backgroundColor = '#0b0c11';
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
                            color: '#6366f1',
                            backgroundColor: 'transparent',
                            border: '1px solid #23263a',
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
                    <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #23263a', borderRadius: '6px' }}>
                        <button
                            onClick={() => setMoveTargetFolder(null)}
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                backgroundColor: moveTargetFolder === null ? '#1e1b4b' : 'transparent',
                                border: 'none',
                                borderBottom: '1px solid #12141c',
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                            </svg>
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
                                        backgroundColor: moveTargetFolder === folder.id ? '#1e1b4b' : 'transparent',
                                        border: 'none',
                                        borderBottom: '1px solid #12141c',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#818cf8" stroke="none">
                                        <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
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
                                border: '1px solid #23263a',
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
                                backgroundColor: '#4f46e5',
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
