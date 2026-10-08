import { createAdminClient } from '@/lib/supabase/admin';
import { formatFileSize, getMaxFileSize, validateFileMetadata } from '@/lib/utils/fileTypes';
import { RECIPIENT_MESSAGES } from './labels';
import type { Delivery, Recipient } from './deliveries';

/** Storage paths we hand out for request uploads: `{timestamp}-{uuid}.{ext}` at the bucket root. */
export const UPLOAD_PATH = /^\d{10,16}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,10})?$/;

export function requestMaxBytes(delivery: Pick<Delivery, 'request_max_file_mb'>): number {
    const cap = getMaxFileSize();
    return delivery.request_max_file_mb ? Math.min(delivery.request_max_file_mb * 1024 * 1024, cap) : cap;
}

export async function uploadedCount(deliveryId: string, recipientId: string): Promise<number> {
    const { count } = await createAdminClient()
        .from('files')
        .select('id', { count: 'exact', head: true })
        .eq('received_via_delivery_id', deliveryId)
        .eq('received_from_recipient_id', recipientId)
        .is('deleted_at', null);
    return count ?? 0;
}

/** Whether this recipient may upload this file to this request. Returns an error message or null. */
export async function uploadProblem(
    delivery: Delivery,
    recipient: Recipient,
    file: { filename: unknown; size: unknown; mimeType: unknown },
): Promise<string | null> {
    if (delivery.kind !== 'request') return RECIPIENT_MESSAGES.notARequest;
    if (typeof file.filename !== 'string' || typeof file.mimeType !== 'string' || typeof file.size !== 'number') {
        return 'Choose a file to upload.';
    }
    const valid = validateFileMetadata(file.filename, file.size, file.mimeType);
    if (!valid.valid) return valid.error ?? "This file can't be uploaded.";
    const max = requestMaxBytes(delivery);
    if (file.size > max) return `${file.filename} is larger than ${formatFileSize(max)}, the most this request allows.`;
    if (delivery.request_max_files && (await uploadedCount(delivery.id, recipient.id)) >= delivery.request_max_files) {
        return RECIPIENT_MESSAGES.requestFull(delivery.request_max_files);
    }
    return null;
}
