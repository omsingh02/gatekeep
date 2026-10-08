'use client';

import { ToastProvider } from '@/components/ds';

// One toast system for the whole app (dashboard, recipient and sign-in pages)
export function Providers({ children }: { children: React.ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}
