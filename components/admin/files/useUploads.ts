'use client';

import { useEffect, useRef, useState } from 'react';
import type { LibraryFile, LibraryFolder } from '@/lib/files/library';
import { getFileExtension, getMaxFileSize, isExtensionAllowed } from '@/lib/utils/fileTypes';
import { ApiError, jsonInit, requestJson } from './api';
import { formatSize } from './format';

export type UploadStatus = 'queued' | 'uploading' | 'done' | 'error' | 'canceled';

export interface UploadItem {
    id: string;
    file: File;
    name: string;
    size: number;
    /** Where the file lands: a folder id, or null for All files */
    folderId: string | null;
    folderName: string;
    status: UploadStatus;
    /** 0–100 */
    progress: number;
    error?: string;
    /** False when retrying can't help (an empty file, a blocked type) */
    retryable: boolean;
    /** The new file's id once it's saved */
    fileId?: string;
}

export interface UploadTarget {
    id: string | null;
    name: string;
}

/** POST /api/files/presign */
interface PresignResponse {
    uploadUrl: string;
    path: string;
}

const CONCURRENCY = 3;

const isActive = (item: UploadItem) => item.status === 'queued' || item.status === 'uploading';

/** Checks the browser can do before uploading (the server checks again). */
function problemWith(file: File): string | null {
    if (file.size === 0) return 'This file is empty.';
    if (file.size > getMaxFileSize()) return `This file is over ${formatSize(getMaxFileSize())}, the limit per file.`;
    const ext = getFileExtension(file.name);
    if (!ext) return "This file has no extension, like .pdf, so it can't be uploaded.";
    if (!isExtensionAllowed(ext)) return `.${ext} files can't be uploaded.`;
    return null;
}

function uploadError(error: unknown): string {
    if (error instanceof ApiError) {
        if (error.status === 0) return 'The upload stopped. Check your connection and retry.';
        if (error.status === 401) return 'You were signed out. Sign in again, then retry.';
        // The only thing presign and confirm look up is the folder
        if (error.status === 404) return "This folder doesn't exist any more. Upload to another folder.";
        if (error.status === 413) return 'This file is larger than your storage allows.';
        if (error.status === 429) return 'Too many uploads in a short time. Wait a few minutes, then retry.';
        if (error.code === 'ERR_INVALID_FILE') return "This type of file can't be uploaded.";
    }
    return 'Something went wrong on our side. Retry in a moment.';
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

let nextId = 1;

export interface UseUploadsOptions {
    /** One file finished uploading */
    onUploaded?: (item: UploadItem) => void;
    /** Nothing is queued or uploading any more */
    onSettled?: (items: UploadItem[]) => void;
}

/**
 * The upload queue: presign → direct upload to storage (with progress) → confirm, three at a time.
 * Each file can be canceled, retried or cleared on its own.
 */
export function useUploads(options: UseUploadsOptions = {}) {
    const [items, setItems] = useState<UploadItem[]>([]);
    const itemsRef = useRef<UploadItem[]>([]);
    const aborts = useRef(new Map<string, () => void>());
    const optionsRef = useRef(options);
    useEffect(() => {
        optionsRef.current = options;
    });

    function commit(update: (list: UploadItem[]) => UploadItem[]) {
        itemsRef.current = update(itemsRef.current);
        setItems(itemsRef.current);
    }

    function patch(id: string, changes: Partial<UploadItem>) {
        commit((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    }

    function pump() {
        let running = itemsRef.current.filter((item) => item.status === 'uploading').length;
        for (const item of itemsRef.current) {
            if (running >= CONCURRENCY) break;
            if (item.status !== 'queued') continue;
            running += 1;
            patch(item.id, { status: 'uploading', progress: 0, error: undefined });
            void run(item);
        }
    }

    async function run(item: UploadItem) {
        const controller = new AbortController();
        let xhr: XMLHttpRequest | null = null;
        aborts.current.set(item.id, () => {
            controller.abort();
            xhr?.abort();
        });

        const upload = { name: item.file.name, mimeType: item.file.type || 'application/octet-stream', folderId: item.folderId };
        try {
            const presign = await requestJson<PresignResponse>('/api/files/presign', {
                ...jsonInit('POST', { ...upload, size: item.file.size }),
                signal: controller.signal,
            });

            await new Promise<void>((resolve, reject) => {
                const request = new XMLHttpRequest();
                xhr = request;
                request.upload.addEventListener('progress', (event) => {
                    // Keep the last few percent for saving the file
                    if (event.lengthComputable) patch(item.id, { progress: Math.round((event.loaded / event.total) * 95) });
                });
                request.addEventListener('load', () =>
                    request.status >= 200 && request.status < 300 ? resolve() : reject(new ApiError('storage', request.status))
                );
                request.addEventListener('error', () => reject(new ApiError('network', 0)));
                request.addEventListener('abort', () => reject(new DOMException('Canceled', 'AbortError')));
                request.open('PUT', presign.uploadUrl);
                request.setRequestHeader('Content-Type', upload.mimeType);
                request.send(item.file);
            });

            patch(item.id, { progress: 97 });
            const confirmed = await requestJson<{ file: LibraryFile }>('/api/files/confirm', {
                ...jsonInit('POST', { ...upload, path: presign.path }),
                signal: controller.signal,
            });
            patch(item.id, { status: 'done', progress: 100, fileId: confirmed.file.id });
            const done = itemsRef.current.find((i) => i.id === item.id);
            if (done) optionsRef.current.onUploaded?.(done);
        } catch (error) {
            if (isAbort(error)) patch(item.id, { status: 'canceled', progress: 0 });
            else patch(item.id, { status: 'error', progress: 0, error: uploadError(error), retryable: true });
        } finally {
            aborts.current.delete(item.id);
            pump();
            if (!itemsRef.current.some(isActive)) optionsRef.current.onSettled?.(itemsRef.current);
        }
    }

    /** Queue files for one folder. Files that can't be uploaded are listed with the reason. */
    function enqueue(files: File[], target: UploadTarget) {
        const added: UploadItem[] = files.map((file) => {
            const problem = problemWith(file);
            return {
                id: `upload-${nextId++}`,
                file,
                name: file.name,
                size: file.size,
                folderId: target.id,
                folderName: target.name,
                status: problem ? 'error' : 'queued',
                progress: 0,
                error: problem ?? undefined,
                retryable: !problem,
            };
        });
        commit((list) => [...list, ...added]);
        pump();
    }

    /**
     * Upload a dropped or chosen folder: create a folder with its name inside `parent`
     * (or reuse one with that name) and queue its files there.
     */
    async function enqueueFolder(folderName: string, files: File[], parent: UploadTarget) {
        let folderId: string;
        try {
            const created = await requestJson<{ folder: LibraryFolder }>('/api/folders', jsonInit('POST', { name: folderName, parentId: parent.id }));
            folderId = created.folder.id;
        } catch (error) {
            if (!(error instanceof ApiError && error.code === 'ERR_CONFLICT')) throw error;
            const query = parent.id ? `?parentId=${encodeURIComponent(parent.id)}` : '';
            const { folders } = await requestJson<{ folders: LibraryFolder[] }>(`/api/folders${query}`);
            const existing = folders.find((f) => f.name === folderName);
            if (!existing) throw error;
            folderId = existing.id;
        }
        enqueue(files, { id: folderId, name: folderName });
    }

    function cancel(id: string) {
        const item = itemsRef.current.find((i) => i.id === id);
        if (!item || !isActive(item)) return;
        patch(id, { status: 'canceled', progress: 0 });
        aborts.current.get(id)?.();
        if (!itemsRef.current.some(isActive)) optionsRef.current.onSettled?.(itemsRef.current);
    }

    function retry(id: string) {
        patch(id, { status: 'queued', progress: 0, error: undefined });
        pump();
    }

    function remove(id: string) {
        commit((list) => list.filter((item) => item.id !== id || isActive(item)));
    }

    /** Drop everything that has finished (uploaded, failed or canceled). */
    function clearFinished() {
        commit((list) => list.filter(isActive));
    }

    /** Drop the files that uploaded, keeping failures to retry. */
    function clearUploaded() {
        commit((list) => list.filter((item) => item.status !== 'done'));
    }

    const active = items.filter(isActive).length;
    return { items, active, enqueue, enqueueFolder, cancel, retry, remove, clearFinished, clearUploaded };
}

export type Uploads = ReturnType<typeof useUploads>;

/**
 * Files from a drop. A single dropped folder is returned with its name (its files, from any depth,
 * go into one folder); otherwise the dropped files. Reads entries synchronously, as the browser requires.
 */
export async function filesFromDrop(dataTransfer: DataTransfer): Promise<{ files: File[]; folderName: string | null }> {
    const entries: FileSystemEntry[] = [];
    if (dataTransfer.items?.length && typeof dataTransfer.items[0].webkitGetAsEntry === 'function') {
        for (const item of Array.from(dataTransfer.items)) {
            const entry = item.webkitGetAsEntry();
            if (entry) entries.push(entry);
        }
    }
    if (entries.length === 0) return { files: Array.from(dataTransfer.files), folderName: null };

    const folderName = entries.length === 1 && entries[0].isDirectory ? entries[0].name : null;
    const files: File[] = [];
    for (const entry of entries) files.push(...(await readEntry(entry)));
    return { files, folderName };
}

/** System files like .DS_Store that come along with a folder */
const isHidden = (name: string) => name.startsWith('.');

async function readEntry(entry: FileSystemEntry): Promise<File[]> {
    if (entry.isFile) {
        return [await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))];
    }
    if (!entry.isDirectory) return [];
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // readEntries returns results in batches until an empty batch
    for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        children.push(...batch);
    }
    const nested = await Promise.all(children.filter((child) => !isHidden(child.name)).map(readEntry));
    return nested.flat();
}

/** Files from a folder picker (<input webkitdirectory>): the folder's name and its files. */
export function filesFromFolderInput(list: FileList): { files: File[]; folderName: string | null } {
    const files = Array.from(list).filter((file) => !isHidden(file.name));
    const root = files[0]?.webkitRelativePath?.split('/')[0] || null;
    const sameRoot = root !== null && files.every((f) => f.webkitRelativePath.startsWith(`${root}/`));
    return { files, folderName: sameRoot ? root : null };
}
