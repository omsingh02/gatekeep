/**
 * Small client helpers for the owner's file and folder API, with error copy that follows
 * docs/VOICE.md (say what happened and what to do next; never show internals).
 */

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code?: string
    ) {
        super(message);
    }
}

/** Fetch JSON; throws ApiError (status + code from the response) when the request fails. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
        response = await fetch(url, init);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        throw new ApiError('network', 0);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(typeof data.error === 'string' ? data.error : '', response.status, data.code);
    return data as T;
}

export function jsonInit(method: string, body?: unknown): RequestInit {
    return { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) };
}

/** A plain-language reason for a failed request, to follow "We couldn't …". */
export function reason(error: unknown): string {
    if (!(error instanceof ApiError)) return 'Try again.';
    if (error.status === 0) return 'Check your connection and try again.';
    if (error.status === 401) return 'You were signed out. Sign in again and retry.';
    if (error.status === 404) return 'It may have been deleted. Refresh the page and try again.';
    if (error.status === 429) return 'Too many requests in a short time. Wait a minute and try again.';
    return 'Try again.';
}

/** Error copy for folder create, rename and move. */
export function folderError(error: unknown, name: string, action: 'create' | 'rename' | 'move'): string {
    if (error instanceof ApiError) {
        if (error.code === 'ERR_CONFLICT') return `There's already a folder named ${name} here. Pick another name.`;
        if (error.code === 'ERR_MAX_DEPTH') return `${name} can't go there: folders can only be one level deep. Pick All files or a top-level folder.`;
        if (error.code === 'ERR_CIRCULAR_REF') return `A folder can't move into itself.`;
        if (error.code === 'ERR_INVALID_INPUT' && action !== 'move') return 'Enter a folder name without / \\ < > : " | ? or *.';
    }
    const verb = action === 'create' ? 'create' : action === 'rename' ? 'rename' : 'move';
    return `We couldn't ${verb} ${name}. ${reason(error)}`;
}

/** A 60-second signed URL for one of the owner's files. */
export async function fileUrl(id: string, action: 'preview' | 'download', signal?: AbortSignal): Promise<string> {
    const { url } = await requestJson<{ url: string }>(`/api/files/${encodeURIComponent(id)}/url?action=${action}`, { signal });
    return url;
}

/** Download a file under its original name (the signed URL carries Content-Disposition). */
export async function downloadFile(id: string): Promise<void> {
    const url = await fileUrl(id, 'download');
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
}
