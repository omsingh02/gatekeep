import type { Metadata } from 'next';
import { ToastBoundary } from '@/components/product/ToastBoundary';

export const metadata: Metadata = { title: 'Deliveries' };

export default function DeliveriesLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastBoundary>
            <div className="mx-auto w-full max-w-app text-primary">{children}</div>
        </ToastBoundary>
    );
}
