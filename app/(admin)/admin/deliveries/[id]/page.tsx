import type { Metadata } from 'next';
import { DeliveryDetailView } from '@/components/product/deliveries/DeliveryDetailView';

export const metadata: Metadata = { title: 'Delivery' };

export default async function DeliveryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return <DeliveryDetailView id={id} kind="send" />;
}
