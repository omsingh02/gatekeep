import type { Metadata } from 'next';
import SystemStatus from './SystemStatus';

export const metadata: Metadata = { title: 'System status' };

export default function SystemStatusPage() {
    return <SystemStatus />;
}
