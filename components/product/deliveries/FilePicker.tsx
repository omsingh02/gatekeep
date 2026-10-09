'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, FolderOpen, Search, X } from 'lucide-react';
import { Breadcrumb, Button, Callout, Checkbox, EmptyState, IconButton, Input, Skeleton, cn, type Crumb } from '@/components/ds';
import { useDebouncedValue } from '@/lib/utils/hooks';
import { api, errorMessage, type FolderCounts, type LibraryFile, type LibraryFolder, type LibraryFolderDetail, type LibraryFolderWithCounts } from './api';
import { FileIcon } from './FileIcon';
import { formatSize, plural, shortDate } from './format';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

/** Load files by id (for ?files=id1,id2). Files that no longer exist are skipped. */
export async function loadFilesById(ids: string[]): Promise<LibraryFile[]> {
    const results = await Promise.all(
        ids.map((id) =>
            api<{ file: LibraryFile }>(`/api/files/${encodeURIComponent(id)}`)
                .then(({ file }) => file)
                .catch(() => null),
        ),
    );
    return results.filter((f): f is LibraryFile => f !== null);
}

interface Listing {
    /** Folders inside a folder come with their counts; top-level ones without */
    folders: (LibraryFolder & Partial<FolderCounts>)[];
    files: LibraryFile[];
    path: { id: string; name: string }[];
}

export interface FilePickerProps {
    selected: LibraryFile[];
    onChange: (files: LibraryFile[]) => void;
    /** Files that are already part of the delivery (shown as included, not selectable) */
    exclude?: string[];
    className?: string;
}

/** Browse folders or search all files, and tick the ones to send. */
export function FilePicker({ selected, onChange, exclude = [], className }: FilePickerProps) {
    const [folderId, setFolderId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const search = useDebouncedValue(query.trim(), 250);
    const [listing, setListing] = useState<Listing | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const load = async (): Promise<Listing> => {
            if (search) {
                const res = await api<{ files: LibraryFile[] }>(`/api/files?search=${encodeURIComponent(search)}&limit=50`);
                return { folders: [], files: res.files, path: [] };
            }
            if (folderId) {
                const res = await api<{ folder: LibraryFolderDetail; folders: LibraryFolderWithCounts[]; files: LibraryFile[] }>(
                    `/api/folders/${encodeURIComponent(folderId)}/contents`,
                );
                return { folders: res.folders, files: res.files, path: res.folder.path };
            }
            const [folders, files] = await Promise.all([
                api<{ folders: LibraryFolder[] }>('/api/folders'),
                api<{ files: LibraryFile[] }>('/api/files?limit=100'),
            ]);
            return { folders: folders.folders, files: files.files, path: [] };
        };
        load()
            .then((result) => {
                if (cancelled) return;
                setListing(result);
                setError(null);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(errorMessage(err));
                setListing({ folders: [], files: [], path: [] });
            });
        return () => {
            cancelled = true;
        };
    }, [folderId, search, reload]);

    const selectedIds = useMemo(() => new Set(selected.map((f) => f.id)), [selected]);
    const excluded = useMemo(() => new Set(exclude), [exclude]);
    const loading = listing === null;

    const toggle = (file: LibraryFile) =>
        onChange(selectedIds.has(file.id) ? selected.filter((f) => f.id !== file.id) : [...selected, file]);

    const open = (id: string | null) => {
        setListing(null);
        setFolderId(id);
    };

    const crumbs: Crumb[] = [
        { label: 'All files', onClick: () => open(null) },
        ...(listing?.path ?? []).map((p) => ({ label: p.name, onClick: () => open(p.id) })),
    ];
    const selectable = (listing?.files ?? []).filter((f) => !excluded.has(f.id));
    const allHere = selectable.length > 0 && selectable.every((f) => selectedIds.has(f.id));

    return (
        <div className={cn('flex flex-col gap-3', className)}>
            <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1 basis-56">
                    <Input
                        aria-label="Search files"
                        placeholder="Search all files"
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            if (event.target.value.trim() !== search) setListing(null);
                        }}
                        leading={<Search {...ICON} />}
                        trailing={
                            query ? <IconButton label="Clear search" size="sm" icon={<X {...ICON} />} onClick={() => setQuery('')} /> : undefined
                        }
                    />
                </div>
                {selectable.length > 1 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                            onChange(
                                allHere
                                    ? selected.filter((f) => !selectable.some((s) => s.id === f.id))
                                    : [...selected, ...selectable.filter((f) => !selectedIds.has(f.id))],
                            )
                        }
                    >
                        {allHere ? 'Clear these' : `Select all ${selectable.length}`}
                    </Button>
                )}
            </div>

            {!search && <Breadcrumb items={folderId ? crumbs : [{ label: 'All files' }]} />}
            {search && (
                <p className="text-body-sm text-secondary" aria-live="polite">
                    {loading ? 'Searching…' : `${plural(listing.files.length, 'file')} matching “${search}”`}
                </p>
            )}

            {error && (
                <Callout tone="danger" action={<Button variant="link" size="sm" onClick={() => setReload((n) => n + 1)}>Try again</Button>}>
                    {error}
                </Callout>
            )}

            <div className="max-h-[360px] overflow-y-auto rounded-lg border border-default bg-surface">
                {loading ? (
                    <ul aria-label="Loading files" className="divide-y divide-gray-4">
                        {Array.from({ length: 5 }, (_, i) => (
                            <li key={i} className="flex h-12 items-center gap-3 px-3">
                                <Skeleton className="h-4 w-4" />
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-3.5 w-48" />
                                <Skeleton className="ml-auto h-3 w-12" />
                            </li>
                        ))}
                    </ul>
                ) : listing.folders.length === 0 && listing.files.length === 0 ? (
                    <EmptyState
                        icon={search ? Search : FolderOpen}
                        title={search ? 'No files match' : folderId ? 'This folder is empty' : 'No files yet'}
                        description={
                            search ? 'Try another name, or browse your folders.' : folderId ? 'Go back to choose files from another folder.' : 'Upload files in Files, then send them from here.'
                        }
                        className="py-8"
                    />
                ) : (
                    <ul className="divide-y divide-gray-4" aria-label={search ? 'Search results' : 'Folders and files'}>
                        {listing.folders.map((folder) => (
                            <li key={folder.id}>
                                <button
                                    type="button"
                                    onClick={() => open(folder.id)}
                                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-raised focus-ring"
                                >
                                    <span className="w-4" aria-hidden />
                                    <FileIcon folder />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-body text-primary">{folder.name}</span>
                                        {folder.fileCount !== undefined && (
                                            <span className="block text-caption text-tertiary">
                                                {plural(folder.fileCount, 'file')}
                                                {folder.subfolderCount ? ` · ${plural(folder.subfolderCount, 'folder')}` : ''}
                                            </span>
                                        )}
                                    </span>
                                    <ChevronRight {...ICON} className="h-4 w-4 text-tertiary" />
                                    <span className="sr-only">Open folder</span>
                                </button>
                            </li>
                        ))}
                        {listing.files.map((file) => {
                            const already = excluded.has(file.id);
                            const checked = already || selectedIds.has(file.id);
                            return (
                                <li key={file.id}>
                                    <label
                                        className={cn(
                                            'flex min-h-12 items-center gap-3 px-3 py-2 transition-colors',
                                            already ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-raised',
                                            checked && !already && 'bg-raised',
                                        )}
                                    >
                                        <Checkbox checked={checked} disabled={already} onChange={() => toggle(file)} aria-label={`Select ${file.name}`} />
                                        <FileIcon mimeType={file.mimeType} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-body text-primary">{file.name}</span>
                                            <span className="block truncate text-caption text-tertiary">
                                                {already
                                                    ? 'Already in this delivery'
                                                    : [search ? (file.folderName ?? 'All files') : null, shortDate(file.createdAt)].filter(Boolean).join(' · ')}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-body-sm tabular-nums text-secondary">{formatSize(file.size)}</span>
                                    </label>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}

/** The chosen files, in order, with a remove button each. */
export function SelectedFiles({ files, onRemove, className }: { files: LibraryFile[]; onRemove: (id: string) => void; className?: string }) {
    if (files.length === 0) return null;
    const total = files.reduce((sum, f) => sum + f.size, 0);
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <ul className="divide-y divide-gray-4 rounded-lg border border-default bg-surface" aria-label="Files in this delivery">
                {files.map((file) => (
                    <li key={file.id} className="flex min-h-12 items-center gap-3 px-3 py-2">
                        <FileIcon mimeType={file.mimeType} />
                        <span className="min-w-0 flex-1 truncate text-body text-primary">{file.name}</span>
                        <span className="shrink-0 text-body-sm tabular-nums text-secondary">{formatSize(file.size)}</span>
                        <IconButton label={`Remove ${file.name}`} size="sm" icon={<X {...ICON} />} onClick={() => onRemove(file.id)} />
                    </li>
                ))}
            </ul>
            <p className="text-caption text-tertiary">
                {plural(files.length, 'file')} · {formatSize(total)}
            </p>
        </div>
    );
}
