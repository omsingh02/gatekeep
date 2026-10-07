'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { Card, LoadingSpinner } from '@/components/ui';
import FileUploader from '@/components/admin/FileUploader';
import FileList from '@/components/admin/FileList';
import ShareList from '@/components/admin/ShareList';

// Lazy load analytics - only loaded when user clicks the tab
const AnalyticsDashboard = lazy(() => import('@/components/admin/AnalyticsDashboard'));

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');
    const [stats, setStats] = useState({
        totalFiles: 0,
        totalSize: 0,
        totalAccess: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetchStats();
    }, [refreshKey]);

    const fetchStats = async () => {
        try {
            const response = await fetch('/api/files/stats');
            if (response.ok) {
                const data = await response.json();
                setStats(data);
            }
        } catch (error) {
            // Error handled silently
        } finally {
            setIsLoading(false);
        }
    };

    const handleUploadComplete = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header with Tabs */}
            <div>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    margin: 0,
                    marginBottom: '1rem',
                }}>Dashboard</h1>
                
                <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '0.25rem',
                    backgroundColor: '#0b0c11',
                    borderRadius: '8px',
                    border: '1px solid #12141c',
                    width: 'fit-content',
                }}>
                    <button
                        onClick={() => setActiveTab('overview')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: activeTab === 'overview' ? '#ffffff' : '#9ca3af',
                            backgroundColor: activeTab === 'overview' ? '#12141c' : 'transparent',
                            border: activeTab === 'overview' ? '1px solid #23263a' : '1px solid transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        style={{
                            padding: '0.625rem 1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: activeTab === 'analytics' ? '#ffffff' : '#9ca3af',
                            backgroundColor: activeTab === 'analytics' ? '#12141c' : 'transparent',
                            border: activeTab === 'analytics' ? '1px solid #23263a' : '1px solid transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        Analytics
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                <>
            {/* Stats Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
            }}>
                <div style={{
                    backgroundColor: '#12141c',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid #23263a',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                            <p style={{
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                marginBottom: '0.5rem',
                            }}>Total Files</p>
                            {isLoading ? (
                                <LoadingSpinner size="sm" />
                            ) : (
                                <p style={{
                                    fontSize: '1.875rem',
                                    fontWeight: 600,
                                    color: '#e0e0e0',
                                }}>{stats.totalFiles}</p>
                            )}
                        </div>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: '#6366f1',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#12141c',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid #23263a',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                            <p style={{
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                marginBottom: '0.5rem',
                            }}>Storage Used</p>
                            {isLoading ? (
                                <LoadingSpinner size="sm" />
                            ) : (
                                <p style={{
                                    fontSize: '1.875rem',
                                    fontWeight: 600,
                                    color: '#e0e0e0',
                                }}>{formatBytes(stats.totalSize)}</p>
                            )}
                        </div>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: '#8b5cf6',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div style={{
                    backgroundColor: '#12141c',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    border: '1px solid #23263a',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                            <p style={{
                                fontSize: '0.875rem',
                                color: '#9ca3af',
                                marginBottom: '0.5rem',
                            }}>Access Grants</p>
                            {isLoading ? (
                                <LoadingSpinner size="sm" />
                            ) : (
                                <p style={{
                                    fontSize: '1.875rem',
                                    fontWeight: 600,
                                    color: '#e0e0e0',
                                }}>{stats.totalAccess}</p>
                            )}
                        </div>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            backgroundColor: '#10b981',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Section */}
            <div style={{
                backgroundColor: '#12141c',
                borderRadius: '8px',
                padding: '1.5rem',
                border: '1px solid #23263a',
            }}>
                <h2 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    marginBottom: '1rem',
                }}>Upload Files</h2>
                <FileUploader onUploadComplete={handleUploadComplete} />
            </div>

            {/* Files List */}
            <div style={{
                backgroundColor: '#12141c',
                borderRadius: '8px',
                padding: '1.5rem',
                border: '1px solid #23263a',
            }}>
                <h2 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    marginBottom: '1rem',
                }}>Recent Uploads</h2>
                <FileList key={refreshKey} limit={5} showViewAll={true} viewAllHref="/admin/files" showFolderNavigation={false} />
            </div>

            {/* Shares List */}
            <div style={{
                backgroundColor: '#12141c',
                borderRadius: '8px',
                padding: '1.5rem',
                border: '1px solid #23263a',
            }}>
                <h2 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    marginBottom: '1rem',
                }}>Recent Shares</h2>
                <ShareList key={refreshKey} limit={5} showViewAll={true} viewAllHref="/admin/access" />
            </div>
                </>
            ) : (
                <Suspense fallback={
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <LoadingSpinner />
                    </div>
                }>
                    <AnalyticsDashboard />
                </Suspense>
            )}
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
