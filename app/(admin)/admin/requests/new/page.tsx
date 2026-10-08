import type { Metadata } from 'next';
import { Composer } from '@/components/product/deliveries/Composer';

export const metadata: Metadata = { title: 'New request' };

export default function NewRequestPage() {
    return <Composer kind="request" />;
}
