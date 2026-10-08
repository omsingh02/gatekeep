import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import DesignPreview from './DesignPreview';

export const metadata: Metadata = {
    title: 'Gatekeep Mono — design system',
    robots: { index: false, follow: false },
};

/** Development-only catalogue of every Gatekeep Mono component and state. Never shipped. */
export default function DesignPage() {
    if (process.env.NODE_ENV === 'production') notFound();
    return <DesignPreview />;
}
