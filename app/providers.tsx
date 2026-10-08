'use client';

import { ToastProvider as LegacyToastProvider } from '@/components/ui';
import { ToastProvider } from '@/components/ds';

// The legacy provider stays until every screen uses components/ds (v2 Phase B)
export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <LegacyToastProvider>
            <ToastProvider>{children}</ToastProvider>
        </LegacyToastProvider>
    );
}
