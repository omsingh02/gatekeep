'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ds';

/**
 * Gatekeep Mono toasts for a section of the dashboard. The root providers still mount the v1
 * toast system for the screens that haven't moved over yet; once the dashboard shell mounts the
 * Mono ToastProvider at the root, this can go.
 */
export function ToastBoundary({ children }: { children: ReactNode }) {
    return <ToastProvider>{children}</ToastProvider>;
}
