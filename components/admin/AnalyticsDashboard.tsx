'use client';

import { useState, useEffect } from 'react';
import { Card, LoadingSpinner } from '@/components/ui';

interface ActivityLog {
    id: string;
    fileId: string;
    filename: string;
    userIdentifier: string;
    accessGranted: boolean;
    ipAddress: string;
    accessedAt: string;
    denialReason?: string;
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

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
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

    const successCount = data.recentActivity.filter(a => a.accessGranted).length;
    const failedCount = data.recentActivity.filter(a => !a.accessGranted).length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <Card>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Total Files
                    </p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
                        {data.totalFiles}
                    </p>
                </Card>
                
                <Card>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Recent Activity
                    </p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#e0e0e0', margin: 0 }}>
                        {data.recentActivity.length}
                    </p>
                </Card>

                <Card>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Successful
                    </p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
                        {successCount}
                    </p>
                </Card>

                <Card>
                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Denied
                    </p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 700, color: '#ef4444', margin: 0 }}>
                        {failedCount}
                    </p>
                </Card>
            </div>

            {/* Top Files by Access */}
            <Card>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e0e0e0', marginBottom: '1rem' }}>
                    Most Accessed Files
                </h2>
                {data.topFiles.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', padding: '1.5rem 0' }}>
                        No access data yet
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #3a3a3a' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        File
                                    </th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Total
                                    </th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Success
                                    </th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Failed
                                    </th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Users
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.topFiles.map((file) => (
                                    <tr key={file.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#e0e0e0', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {file.filename}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#e0e0e0', fontWeight: 600 }}>
                                            {file.totalAccesses}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#10b981', fontWeight: 500 }}>
                                            {file.successfulAccesses}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#ef4444', fontWeight: 500 }}>
                                            {file.failedAccesses}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#3b82f6', fontWeight: 500 }}>
                                            {file.uniqueUsers}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Recent Activity - Compact Table */}
            <Card>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#e0e0e0', marginBottom: '1rem' }}>
                    Recent Access Log
                </h2>
                {data.recentActivity.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: '#6b7280', textAlign: 'center', padding: '1.5rem 0' }}>
                        No recent activity
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #3a3a3a' }}>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Status
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Reason
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        File
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        User
                                    </th>
                                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        IP Address
                                    </th>
                                    <th style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Time
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.recentActivity.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                                        <td style={{ padding: '0.5rem 0.75rem' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '0.125rem 0.5rem',
                                                borderRadius: '3px',
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                backgroundColor: log.accessGranted ? '#064e3b' : '#7f1d1d',
                                                color: log.accessGranted ? '#6ee7b7' : '#fecaca',
                                            }}>
                                                {log.accessGranted ? 'OK' : 'DENIED'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#9ca3af' }}>
                                            {log.denialReason ? log.denialReason.replace(/_/g, ' ') : '-'}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#e0e0e0', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.filename}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.8rem', color: '#9ca3af', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {log.userIdentifier}
                                        </td>
                                        <td style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                            {log.ipAddress}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                            {formatRelativeTime(log.accessedAt)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
