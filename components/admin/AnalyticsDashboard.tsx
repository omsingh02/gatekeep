'use client';

import { useState, useEffect } from 'react';
import { Card, LoadingSpinner } from '@/components/ui';
import { formatDateTime } from '@/lib/utils/date';

interface ActivityLog {
    id: string;
    fileId: string;
    filename: string;
    userIdentifier: string;
    accessGranted: boolean;
    ipAddress: string;
    accessedAt: string;
}

interface FileStats {
    id: string;
    filename: string;
    shortCode: string;
    totalAccesses: number;
    successfulAccesses: number;
    failedAccesses: number;
    uniqueUsers: number;
}

interface AnalyticsData {
    totalFiles: number;
    recentActivity: ActivityLog[];
    topFiles: FileStats[];
}

export default function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            const response = await fetch('/api/analytics');
            if (response.ok) {
                const analyticsData = await response.json();
                setData(analyticsData);
            }
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <LoadingSpinner />
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: '#9ca3af' }}>Failed to load analytics</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <Card>
                    <h3 style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 500 }}>
                        Total Files
                    </h3>
                    <p style={{ fontSize: '2rem', fontWeight: 600, color: '#e0e0e0', margin: 0 }}>
                        {data.totalFiles}
                    </p>
                </Card>
                
                <Card>
                    <h3 style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem', fontWeight: 500 }}>
                        Recent Activity
                    </h3>
                    <p style={{ fontSize: '2rem', fontWeight: 600, color: '#e0e0e0', margin: 0 }}>
                        {data.recentActivity.length}
                    </p>
                </Card>
            </div>

            {/* Top Files by Access */}
            <Card>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#e0e0e0', marginBottom: '1rem' }}>
                    Most Accessed Files
                </h2>
                {data.topFiles.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>
                        No access data yet
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #3a3a3a' }}>
                                    <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500 }}>
                                        File
                                    </th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500 }}>
                                        Total Accesses
                                    </th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500 }}>
                                        Successful
                                    </th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500 }}>
                                        Failed
                                    </th>
                                    <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#9ca3af', fontWeight: 500 }}>
                                        Unique Users
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topFiles.map((file) => (
                                    <tr key={file.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                        <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#e0e0e0' }}>
                                            {file.filename}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#e0e0e0' }}>
                                            {file.totalAccesses}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#10b981' }}>
                                            {file.successfulAccesses}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#ef4444' }}>
                                            {file.failedAccesses}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#3b82f6' }}>
                                            {file.uniqueUsers}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Recent Activity */}
            <Card>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#e0e0e0', marginBottom: '1rem' }}>
                    Recent Access Attempts
                </h2>
                {data.recentActivity.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center', padding: '2rem 0' }}>
                        No recent activity
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {data.recentActivity.map((log) => (
                            <div
                                key={log.id}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '4px',
                                    backgroundColor: '#252525',
                                    border: '1px solid #3a3a3a',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1rem',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <div
                                    style={{
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: log.accessGranted ? '#10b981' : '#ef4444',
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ flex: 1, minWidth: '200px' }}>
                                    <p style={{ fontSize: '0.875rem', color: '#e0e0e0', marginBottom: '0.25rem', fontWeight: 500 }}>
                                        {log.filename}
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                                        {log.userIdentifier} • {log.ipAddress}
                                    </p>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                    {formatDateTime(log.accessedAt)}
                                </div>
                                <div
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '3px',
                                        fontSize: '0.75rem',
                                        backgroundColor: log.accessGranted ? '#064e3b' : '#7f1d1d',
                                        color: log.accessGranted ? '#6ee7b7' : '#fecaca',
                                    }}
                                >
                                    {log.accessGranted ? 'Success' : 'Denied'}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
}
