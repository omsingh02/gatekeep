import type { Metadata } from 'next';
import AnalyticsDashboard from '@/components/admin/AnalyticsDashboard';

export const metadata: Metadata = { title: 'Analytics' };

export default function AnalyticsPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    margin: 0,
                    marginBottom: '0.5rem',
                }}>Analytics</h1>
                <p style={{ fontSize: '0.875rem', color: '#9ca3af', margin: 0 }}>
                    Every unlock attempt on your links — who got in, who was denied, and why.
                </p>
            </div>
            <AnalyticsDashboard />
        </div>
    );
}
