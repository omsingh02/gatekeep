/**
 * Client-side types and fetch helpers for the owner API (app/api/deliveries/**, /api/activity,
 * /api/status, /api/settings, /api/files, /api/folders). Types are derived from the server
 * serializers with type-only imports, so they can't drift from the real responses.
 */
import type { ActivityItem as ServerActivityItem } from '@/lib/deliveries/activity-query';
import type { serializeDeliverySummary, serializeRecipient } from '@/lib/deliveries/deliveries';
import type { deliveryDetail, recipientResult, DeliveryFile as ServerDeliveryFile, ReceivedFile as ServerReceivedFile } from '@/lib/deliveries/owner';
import type { StatusCheck } from '@/lib/deliveries/status';
import type { AccessMethod } from '@/lib/types';

export type { AccessMethod };
export type DeliveryKind = 'send' | 'request';
export type Recipient = ReturnType<typeof serializeRecipient>;
export type RecipientResult = ReturnType<typeof recipientResult>;
export type DeliverySummary = ReturnType<typeof serializeDeliverySummary>;
export type DeliveryDetail = Awaited<ReturnType<typeof deliveryDetail>>;
export type DeliveryFile = ServerDeliveryFile;
export type ReceivedFile = ServerReceivedFile;
export type ActivityItem = ServerActivityItem;

/** GET /api/deliveries item */
export interface DeliveryListItem extends DeliverySummary {
    fileCount: number;
    recipientCount: number;
    activeRecipientCount: number;
    opens: number;
    downloads: number;
    lastOpenedAt: string | null;
    recipientPreview: string[];
    status: 'active' | 'ended' | 'no_recipients';
}

/** GET /api/files and /api/folders/{id}/contents file */
export interface LibraryFile {
    id: string;
    originalFilename: string;
    fileSize: number;
    mimeType: string;
    createdAt: string;
    folderId: string | null;
    folderName?: string | null;
}

export interface LibraryFolder {
    id: string;
    name: string;
    parentId: string | null;
    fileCount?: number;
    subfolderCount?: number;
}

export interface OwnerSettingsView {
    displayName: string | null;
    organization: string | null;
    defaultMethod: AccessMethod;
    defaultEndsInDays: number | null;
    defaultDownloadLimit: number | null;
    emailConfigured: boolean;
    senderPreview: string;
}

/** Recipient input accepted by POST /api/deliveries and POST /api/deliveries/{id}/recipients */
export interface PersonInput {
    identifier: string;
    identifierType: 'email' | 'username';
    method: AccessMethod;
    password?: string;
    endsAt?: string | null;
    downloadLimit?: number | null;
}

export interface AnyoneInput {
    password: string;
    endsAt?: string | null;
    downloadLimit?: number | null;
}

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string,
    ) {
        super(message);
    }
}

const GENERIC = 'Something went wrong on our side. Try again in a moment.';
const OFFLINE = "We couldn't reach Gatekeep. Check your connection and try again.";

/**
 * fetch + JSON. Errors from the deliveries API are already written for people, so they're
 * passed through; unexpected server errors get the generic sentence.
 */
export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
    const { json, headers, ...rest } = init;
    let res: Response;
    try {
        res = await fetch(url, {
            ...rest,
            headers: json !== undefined ? { 'Content-Type': 'application/json', ...headers } : headers,
            body: json !== undefined ? JSON.stringify(json) : rest.body,
        });
    } catch {
        throw new ApiError(OFFLINE, 0);
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    if (!res.ok) {
        const human = res.status < 500 && typeof body.error === 'string' && body.code !== 'ERR_DB_ERROR' ? body.error : GENERIC;
        throw new ApiError(res.status === 401 ? 'Your session ended. Sign in again to continue.' : human, res.status, body.code);
    }
    return body as T;
}

export function errorMessage(err: unknown): string {
    return err instanceof ApiError ? err.message : GENERIC;
}

/** Whether this instance can send email, from the system status (GET /api/status). */
export async function fetchEmailConfigured(): Promise<boolean> {
    const status = await api<{ checks: StatusCheck[] }>('/api/status');
    return Boolean(status.checks.find((c) => c.id === 'email')?.ok);
}

// No 0/O, 1/l/I: generated passwords get read out and typed by people (matches lib/deliveries/codes.ts)
const READABLE = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** A password people can read out and type: three groups of four, e.g. "x7Kq-mP3a-Zt9w". */
export function readablePassword(): string {
    const out: string[] = [];
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) out.push('-');
        out.push(READABLE[bytes[i] % READABLE.length]);
    }
    return out.join('');
}
