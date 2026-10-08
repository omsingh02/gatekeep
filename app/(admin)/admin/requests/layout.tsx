import type { Metadata } from 'next';
import { ToastBoundary } from '@/components/product/ToastBoundary';

export const metadata: Metadata = { title: 'Requests' };

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
    return (
        <ToastBoundary>
            <div className="mx-auto w-full max-w-app text-primary">{children}</div>
        </ToastBoundary>
    );
}
