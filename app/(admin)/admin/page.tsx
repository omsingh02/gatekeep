'use client';

import { useState, useEffect } from 'react';
import { Send, Share2, Upload } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui';
import FileUploader from '@/components/admin/FileUploader';
import FileList from '@/components/admin/FileList';
import ShareList from '@/components/admin/ShareList';

export default function DashboardPage() {
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
        } catch {
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
            {/* Header */}
            <div>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    margin: 0,
                    marginBottom: '0.5rem',
                }}>Overview</h1>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0 }}>
                    Upload files, then share each one with exactly the people who need it.
                </p>
            </div>

            {/* First run: no files yet */}
            {!isLoading && stats.totalFiles === 0 && (
                <section
                    aria-labelledby="get-started"
                    className="rounded-2xl border border-indigo-400/20 bg-[radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.14),transparent_60%)] p-6"
                >
                    <h2 id="get-started" className="text-base font-semibold text-white">Get started in three steps</h2>
                    <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                        {[
                            { icon: Upload, title: 'Upload a file', body: 'Drop it in the box below, or pick files or a whole folder.' },
                            { icon: Share2, title: 'Click Share', body: 'Add a person by email or username with a password — or make a public, password-only link.' },
                            { icon: Send, title: 'Send the invite', body: 'Copy the ready-made invite. Every unlock attempt shows up in Analytics.' },
                        ].map(({ icon: Icon, title, body }, i) => (
                            <li key={title} className="flex gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
                                    <Icon className="h-4 w-4 text-indigo-300" aria-hidden />
                                </span>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        <span className="mr-1.5 text-zinc-500">{i + 1}.</span>
                                        {title}
                                    </p>
                                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">{body}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

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
