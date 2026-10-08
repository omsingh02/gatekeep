import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Deliveries' };

export default function DeliveriesLayout({ children }: { children: React.ReactNode }) {
    // Toasts come from the dashboard layout's ToastProvider
    return <div className="mx-auto w-full max-w-app text-primary">{children}</div>;
}
