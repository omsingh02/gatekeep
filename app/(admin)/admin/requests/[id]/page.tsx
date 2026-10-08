import type { Metadata } from 'next';
import { DeliveryDetailView } from '@/components/product/deliveries/DeliveryDetailView';

export const metadata: Metadata = { title: 'Request' };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <DeliveryDetailView id={id} kind="request" />;
}
