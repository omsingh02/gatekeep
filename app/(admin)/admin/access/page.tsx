'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ConfirmDialog, EmptyState, Skeleton, useToast } from '@/components/ui';
import { formatDateTime } from '@/lib/utils/date';
import { useDebouncedValue } from '@/lib/utils/hooks';

interface ShareWithFile {
    id: string;
    fileId: string;
    type: 'user' | 'group';
    userIdentifier?: string;
    groupId?: string;
    groupName?: string;
    expiresAt: string | null;
    accessCount: number;
    downloadCount?: number;
    maxDownloads?: number | null;
    lastAccessed: string | null;
    createdAt: string;
    status: 'active' | 'expired' | 'limit_reached';
    file: {
        id: string;
        originalFilename: string;
        shortCode: string;
    };
}

type StatusFilter = 'all' | 'active' | 'expired' | 'limit_reached';

export default function AllSharesPage() {
    const [shares, setShares] = useState<ShareWithFile[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const debouncedSearch = useDebouncedValue(searchInput, 300);
    
    // Stats
    const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, limitReached: 0 });
    
    // Dialogs
    const [revokeConfirm, setRevokeConfirm] = useState<{ isOpen: boolean; shareId: string | null; userName: string }>({
        isOpen: false,
        shareId: null,
        userName: '',
    });
    const toast = useToast();

    const itemsPerPage = 20;

    const fetchShares = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('limit', itemsPerPage.toString());
            
            if (debouncedSearch.trim()) {
                params.append('search', debouncedSearch.trim());
            }
            
            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }

            const response = await fetch(`/api/access?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                setShares(data.access || []);
                setTotalCount(data.totalCount || 0);
                setTotalPages(data.totalPages || 1);
            }
        } catch (error) {
            // Error handled silently
        } finally {
            setIsLoading(false);
        }
    }, [currentPage, debouncedSearch, statusFilter]);

    const fetchStats = useCallback(async () => {
        try {
            // Fetch all shares to compute stats
            const response = await fetch('/api/access?limit=1000');
            if (response.ok) {
                const data = await response.json();
                const allShares = data.access || [];
                const active = allShares.filter((s: ShareWithFile) => s.status === 'active').length;
                const expired = allShares.filter((s: ShareWithFile) => s.status === 'expired').length;
                const limitReached = allShares.filter((s: ShareWithFile) => s.status === 'limit_reached').length;
                
                setStats({
                    total: allShares.length,
                    active,
                    expired,
                    limitReached,
                });
            }
        } catch (error) {
            // Error handled silently
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        fetchShares();
    }, [fetchShares]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, statusFilter]);

    const handleRevoke = async (shareId: string) => {
        try {
            const response = await fetch(`/api/access?id=${shareId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setShares(shares.filter(s => s.id !== shareId));
                setTotalCount(prev => prev - 1);
                fetchStats();
                toast.success('Access revoked successfully');
            } else {
                toast.error('Failed to revoke access');
            }
        } catch (error) {
            toast.error('Failed to revoke access');
        } finally {
            setRevokeConfirm({ isOpen: false, shareId: null, userName: '' });
        }
    };

    const confirmRevoke = (share: ShareWithFile) => {
        setRevokeConfirm({ isOpen: true, shareId: share.id, userName: share.userIdentifier || share.groupName || 'Unknown' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'expired':
                return { bg: '#7f1d1d', color: '#fca5a5', text: 'Expired' };
            case 'limit_reached':
                return { bg: '#78350f', color: '#fcd34d', text: 'Limit Reached' };
            default:
                return { bg: '#14532d', color: '#86efac', text: 'Active' };
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header with Back Link */}
            <div>
                <Link
                    href="/admin"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#9ca3af',
                        textDecoration: 'none',
                        marginBottom: '0.5rem',
                        transition: 'color 0.2s',
                    }}
                >
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Admin
                </Link>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    margin: 0,
                }}>Access Management</h1>
                <p style={{
                    fontSize: '0.875rem',
                    color: '#9ca3af',
                    marginTop: '0.5rem',
                }}>
                    View and manage all your file access grants
                </p>
            </div>

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div
                    onClick={() => setStatusFilter('all')}
                    style={{
                        backgroundColor: statusFilter === 'all' ? '#1e3a5f' : '#2a2a2a',
                        borderRadius: '8px',
                        padding: '1.25rem',
                        border: `1px solid ${statusFilter === 'all' ? '#6366f1' : '#3a3a3a'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Total Shares</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#e0e0e0' }}>{stats.total}</p>
                </div>
                <div
                    onClick={() => setStatusFilter('active')}
                    style={{
                        backgroundColor: statusFilter === 'active' ? '#14532d' : '#2a2a2a',
                        borderRadius: '8px',
                        padding: '1.25rem',
                        border: `1px solid ${statusFilter === 'active' ? '#22c55e' : '#3a3a3a'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Active</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#86efac' }}>{stats.active}</p>
                </div>
                <div
                    onClick={() => setStatusFilter('expired')}
                    style={{
                        backgroundColor: statusFilter === 'expired' ? '#7f1d1d' : '#2a2a2a',
                        borderRadius: '8px',
                        padding: '1.25rem',
                        border: `1px solid ${statusFilter === 'expired' ? '#ef4444' : '#3a3a3a'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Expired</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fca5a5' }}>{stats.expired}</p>
                </div>
                <div
                    onClick={() => setStatusFilter('limit_reached')}
                    style={{
                        backgroundColor: statusFilter === 'limit_reached' ? '#78350f' : '#2a2a2a',
                        borderRadius: '8px',
                        padding: '1.25rem',
                        border: `1px solid ${statusFilter === 'limit_reached' ? '#f59e0b' : '#3a3a3a'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.25rem' }}>Limit Reached</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 600, color: '#fcd34d' }}>{stats.limitReached}</p>
                </div>
            </div>

            {/* Shares List */}
            <div style={{
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                padding: '1.5rem',
                border: '1px solid #3a3a3a',
            }}>
                {/* Search and Filters */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Search by user or filename..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
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
                        }}
                    />
                    <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                        {totalCount} {statusFilter !== 'all' ? statusFilter.replace('_', ' ') : ''} shares
                    </span>
                </div>

                {/* Table */}
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#252525', borderRadius: '6px' }}>
                                <Skeleton width="40px" height="40px" />
                                <div style={{ flex: 1 }}>
                                    <Skeleton variant="text" width="60%" height="1rem" />
                                    <div style={{ marginTop: '0.5rem' }}><Skeleton variant="text" width="30%" height="0.75rem" /></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : shares.length === 0 ? (
                    <EmptyState
                        type={searchInput || statusFilter !== 'all' ? 'no-results' : 'no-access'}
                        title="No shares found"
                        description={searchInput || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Grant access to your files to start sharing'}
                    />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #3a3a3a' }}>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>USER/GROUP</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>FILE</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>STATUS</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>VIEWS</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>DOWNLOADS</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>EXPIRES</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500 }}>CREATED</th>
                                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: '#9ca3af', fontWeight: 500 }}>ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shares.map((share) => {
                                    const badge = getStatusBadge(share.status);
                                    return (
                                        <tr
                                            key={share.id}
                                            style={{
                                                borderBottom: '1px solid #2a2a2a',
                                                opacity: share.status !== 'active' ? 0.7 : 1,
                                            }}
                                        >
                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '50%',
                                                        backgroundColor: share.type === 'group' ? '#7c3aed' : '#6366f1',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}>
                                                        {share.type === 'group' ? (
                                                            <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                            </svg>
                                                        ) : (
                                                            <svg width="16" height="16" fill="none" stroke="#fff" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ color: '#e0e0e0', fontWeight: 500 }}>
                                                            {share.userIdentifier || share.groupName || 'Unknown'}
                                                        </div>
                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                            {share.type === 'group' ? 'Group' : 'User'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', maxWidth: '200px' }}>
                                                <div style={{ color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {share.file.originalFilename}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem' }}>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '0.125rem 0.5rem',
                                                    borderRadius: '3px',
                                                    backgroundColor: badge.bg,
                                                    color: badge.color,
                                                }}>
                                                    {badge.text}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', color: '#9ca3af' }}>{share.accessCount}</td>
                                            <td style={{ padding: '0.75rem 0.5rem', color: '#9ca3af' }}>
                                                {share.maxDownloads ? `${share.downloadCount || 0}/${share.maxDownloads}` : share.downloadCount || 0}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                                {share.expiresAt ? formatDateTime(share.expiresAt) : '—'}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                                                {formatDateTime(share.createdAt)}
                                            </td>
                                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                                                <button
                                                    onClick={() => confirmRevoke(share)}
                                                    title="Revoke access"
                                                    style={{
                                                        padding: '0.4rem 0.75rem',
                                                        fontSize: '0.75rem',
                                                        color: '#ef4444',
                                                        backgroundColor: 'transparent',
                                                        border: '1px solid #3a3a3a',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    Revoke
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        marginTop: '1.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        backgroundColor: '#252525',
                        borderRadius: '6px',
                        border: '1px solid #3a3a3a',
                    }}>
                        <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                            Page {currentPage} of {totalPages}
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
                                }}
                            >
                                First
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    fontSize: '0.8rem',
                                    color: currentPage === 1 ? '#555' : '#9ca3af',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '4px',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                Prev
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    fontSize: '0.8rem',
                                    color: currentPage === totalPages ? '#555' : '#9ca3af',
                                    backgroundColor: 'transparent',
                                    border: '1px solid #3a3a3a',
                                    borderRadius: '4px',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
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
                                }}
                            >
                                Last
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Revoke Confirmation Dialog */}
            <ConfirmDialog
                isOpen={revokeConfirm.isOpen}
                onClose={() => setRevokeConfirm({ isOpen: false, shareId: null, userName: '' })}
                onConfirm={() => revokeConfirm.shareId && handleRevoke(revokeConfirm.shareId)}
                title="Revoke Access"
                message={`Are you sure you want to revoke access for "${revokeConfirm.userName}"?`}
                confirmText="Revoke"
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
}
