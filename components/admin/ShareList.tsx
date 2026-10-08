'use client';

import { useState, useEffect, useCallback } from 'react';
import { Skeleton, ConfirmDialog, useToast } from '@/components/ui';
import { formatDateTime } from '@/lib/utils/date';
import Link from 'next/link';

interface ShareWithFile {
    id: string;
    fileId: string;
    userIdentifier?: string;
    isPublic?: boolean;
    expiresAt: string | null;
    accessCount: number;
    downloadCount?: number;
    maxDownloads?: number | null;
    lastAccessed: string | null;
    createdAt: string;
    file: {
        id: string;
        originalFilename: string;
        shortCode: string;
    };
}

interface ShareListProps {
    limit?: number;
    showViewAll?: boolean;
    viewAllHref?: string;
}

export default function ShareList({ limit, showViewAll = false, viewAllHref = '/admin/access' }: ShareListProps) {
    const [shares, setShares] = useState<ShareWithFile[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog state
    const [revokeConfirm, setRevokeConfirm] = useState<{ isOpen: boolean; shareId: string | null; userName: string }>({
        isOpen: false,
        shareId: null,
        userName: '',
    });
    const toast = useToast();

    const fetchShares = useCallback(async () => {
        try {
            const url = limit ? `/api/access?limit=${limit}` : '/api/access';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setShares(data.access || []);
                setTotalCount(data.totalCount || data.access?.length || 0);
            }
        } catch {
            // Error handled silently
        } finally {
            setIsLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchShares();
    }, [fetchShares]);

    const handleRevoke = async (shareId: string) => {
        try {
            const response = await fetch(`/api/access?id=${shareId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setShares(shares.filter(s => s.id !== shareId));
                setTotalCount(prev => prev - 1);
                toast.success('Access revoked successfully');
            } else {
                toast.error('Failed to revoke access');
            }
        } catch {
            toast.error('Failed to revoke access');
        } finally {
            setRevokeConfirm({ isOpen: false, shareId: null, userName: '' });
        }
    };

    const confirmRevoke = (share: ShareWithFile) => {
        setRevokeConfirm({ isOpen: true, shareId: share.id, userName: share.userIdentifier || 'the public link' });
    };

    const isExpired = (expiresAt: string | null) => {
        if (!expiresAt) return false;
        return new Date(expiresAt) < new Date();
    };

    const isDownloadLimitReached = (share: ShareWithFile) => {
        if (!share.maxDownloads) return false;
        return (share.downloadCount || 0) >= share.maxDownloads;
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

    if (shares.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="w-16 h-16 bg-[var(--background)] rounded mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-8 h-8 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                </div>
                <p className="text-base text-[var(--text-secondary)]">No shares yet</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">Grant access to your files to start sharing</p>
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {shares.map((share) => {
                    const expired = isExpired(share.expiresAt);
                    const limitReached = isDownloadLimitReached(share);
                    const isInactive = expired || limitReached;

                    return (
                        <div
                            key={share.id}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                padding: 'clamp(0.75rem, 2vw, 1rem)',
                                borderRadius: '6px',
                                border: '1px solid #23263a',
                                backgroundColor: isInactive ? '#0f1117' : '#151823',
                                opacity: isInactive ? 0.7 : 1,
                                transition: 'all 0.2s',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = isInactive ? '#151823' : '#2d2d2d';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = isInactive ? '#0f1117' : '#151823';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: '1 1 250px', minWidth: 0 }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    backgroundColor: isInactive ? '#12141c' : '#6366f1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <svg style={{ width: '20px', height: '20px', color: isInactive ? '#6b7280' : 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                        <h3 style={{
                                            fontWeight: 500,
                                            color: '#e0e0e0',
                                            margin: 0,
                                            fontSize: '0.95rem',
                                        }}>
                                            {share.userIdentifier || 'Public link'}
                                        </h3>
                                        {expired && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '3px',
                                                backgroundColor: '#7f1d1d',
                                                color: '#fca5a5',
                                            }}>
                                                Expired
                                            </span>
                                        )}
                                        {limitReached && !expired && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '3px',
                                                backgroundColor: '#78350f',
                                                color: '#fcd34d',
                                            }}>
                                                Limit Reached
                                            </span>
                                        )}
                                        {!isInactive && (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '3px',
                                                backgroundColor: '#14532d',
                                                color: '#86efac',
                                            }}>
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                                        <span style={{
                                            fontSize: '0.8rem',
                                            color: '#9ca3af',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            maxWidth: 'min(200px, 40vw)',
                                        }}>
                                            {share.file.originalFilename}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            {share.accessCount} {share.accessCount === 1 ? 'view' : 'views'}
                                        </span>
                                        {share.maxDownloads && (
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                {share.downloadCount || 0}/{share.maxDownloads} downloads
                                            </span>
                                        )}
                                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                            Created {formatDateTime(share.createdAt)}
                                        </span>
                                        {share.expiresAt && !expired && (
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                Expires {formatDateTime(share.expiresAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                <button
                                    onClick={() => confirmRevoke(share)}
                                    title="Revoke access"
                                    style={{
                                        padding: '0.5rem 0.875rem',
                                        fontSize: '0.8rem',
                                        color: '#ef4444',
                                        backgroundColor: 'transparent',
                                        border: '1px solid #23263a',
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
                                        e.currentTarget.style.borderColor = '#23263a';
                                        e.currentTarget.style.color = '#ef4444';
                                    }}
                                >
                                    Revoke
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
                            color: '#6366f1',
                            backgroundColor: 'transparent',
                            border: '1px solid #23263a',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            transition: 'all 0.2s',
                        }}
                    >
                        View All {totalCount} Shares
                        <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            )}

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
        </>
    );
}
