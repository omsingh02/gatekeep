/**
 * Client side of the recipient API (app/api/d/[code]/**). Shapes mirror lib/deliveries/recipient-api.ts.
 * Every call returns a result instead of throwing, so screens can map failures to the right state.
 */

export interface PublicSender {
    name: string;
    label: string;
    logoUrl: string | null;
    message: string | null;
}

export interface AccessOptions {
    emailCode: boolean;
    password: boolean;
    anyone: boolean;
}

export interface DeliveryFile {
    id: string;
    name: string;
    size: number;
    mimeType: string;
}

export interface UploadedFile {
    id: string;
    name: string;
    size: number;
}

export interface VerifiedView {
    verified: true;
    delivery: {
        kind: 'send' | 'request';
        title: string;
        message: string | null;
        files: DeliveryFile[];
        request: {
            maxFiles: number | null;
            maxFileMb: number;
            uploaded: { count: number; files: UploadedFile[] } | null;
        } | null;
    };
    sender: PublicSender;
    recipient: {
        kind: 'person' | 'anyone';
        label: string;
        endsAt: string | null;
        downloadLimit: number | null;
        downloadCount: number;
        downloadsLeft: number | null;
    };
}

export interface PublicView {
    verified: false;
    kind: 'send' | 'request';
    sender: PublicSender;
    access: AccessOptions;
    notice: string | null;
}

/** Why a request didn't work, in terms the page can act on. */
export type Failure =
    | { kind: 'removed'; message: string }
    | { kind: 'ended'; message: string }
    | { kind: 'signed-out'; message: string }
    | { kind: 'limit'; message: string }
    | { kind: 'not-found'; message: string }
    | { kind: 'throttled'; message: string }
    | { kind: 'invalid'; message: string }
    | { kind: 'network'; message: string };

export type Result<T> = { ok: true; data: T } | { ok: false; failure: Failure };

/** Shown on the sign-in step when a visit's sign-in ran out or was replaced (never says "session"). */
export const SIGNED_OUT_NOTICE = "You were signed out. Confirm it's you again to continue.";

export const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
const SERVER_MESSAGE = 'Something went wrong on our side. Try again in a moment.';

function failureFrom(status: number, body: { error?: unknown; code?: unknown }): Failure {
    const message = typeof body.error === 'string' && body.error ? body.error : SERVER_MESSAGE;
    switch (body.code) {
        case 'ERR_REMOVED':
            return { kind: 'removed', message };
        case 'ERR_ENDED':
            return { kind: 'ended', message };
        case 'ERR_SIGNED_OUT':
        case 'ERR_SESSION_ENDED':
            return { kind: 'signed-out', message };
        case 'ERR_DOWNLOAD_LIMIT':
            return { kind: 'limit', message };
        case 'ERR_RATE_LIMIT':
            return { kind: 'throttled', message };
    }
    if (status === 404) return { kind: 'not-found', message };
    if (status === 429) return { kind: 'throttled', message };
    if (status >= 500) return { kind: 'network', message };
    return { kind: 'invalid', message };
}

async function call<T>(url: string, init?: RequestInit): Promise<Result<T>> {
    let response: Response;
    try {
        response = await fetch(url, {
            credentials: 'same-origin',
            cache: 'no-store',
            ...init,
            headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
        });
    } catch {
        return { ok: false, failure: { kind: 'network', message: NETWORK_MESSAGE } };
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, failure: failureFrom(response.status, body) };
    return { ok: true, data: body as T };
}

const base = (code: string) => `/api/d/${encodeURIComponent(code)}`;
const post = (body?: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body ?? {}) });

export const recipientApi = {
    view: (code: string) => call<VerifiedView | PublicView>(base(code)),
    requestCode: (code: string, email: string) => call<{ ok: true; message: string }>(`${base(code)}/code`, post({ email })),
    signIn: (code: string, body: { email: string; code: string } | { identifier: string; password: string } | { password: string }) =>
        call<VerifiedView>(`${base(code)}/session`, post(body)),
    signOut: (code: string) => call<{ ok: true }>(`${base(code)}/session`, { method: 'DELETE' }),
    fileUrl: (code: string, fileId: string, action: 'preview' | 'download') =>
        call<{ url: string; downloadsLeft: number | null; downloadCount: number }>(
            `${base(code)}/files/${encodeURIComponent(fileId)}`,
            post({ action }),
        ),
    downloadAll: (code: string) =>
        call<{
            zipName: string;
            files: { id: string; name: string; size: number; url: string }[];
            downloadsLeft: number | null;
            downloadCount: number;
        }>(`${base(code)}/download-all`, post()),
    startUpload: (code: string, file: { filename: string; size: number; mimeType: string }) =>
        call<{ uploadUrl: string; token: string; path: string }>(`${base(code)}/uploads`, post(file)),
    confirmUpload: (code: string, file: { path: string; filename: string; mimeType: string }) =>
        call<{ file: UploadedFile }>(`${base(code)}/uploads/confirm`, post(file)),
    completeUploads: (code: string) => call<{ ok: true }>(`${base(code)}/uploads/complete`, post()),
    streamUrl: (code: string) => `${base(code)}/stream`,
};

/** Start a browser download from a URL that answers with Content-Disposition: attachment. */
export function startDownload(url: string, filename?: string) {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    if (filename) link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
}
