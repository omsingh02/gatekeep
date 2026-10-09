'use client';

import { useEffect, useState } from 'react';
import { Folder as FolderIcon, Files } from 'lucide-react';
import { Button, Callout, Dialog, Radio, Skeleton, cn } from '@/components/ds';
import type { LibraryFolder as Folder } from '@/lib/files/library';
import { folderError, jsonInit, reason, requestJson } from './api';
import { describeItems } from './format';

export interface MoveResult {
    moved: number;
    failed: number;
    destination: string;
    /** Error copy when something couldn't move */
    error?: string;
}

interface MoveDialogProps {
    files: { id: string; name: string; folderId: string | null }[];
    folders: { id: string; name: string; parentId: string | null }[];
    onClose: () => void;
    onDone: (result: MoveResult) => void;
}

const ROOT = 'root';

/** Pick a destination folder for files and folders. Mount it to open; unmount to close. */
export default function MoveDialog({ files, folders: moving, onClose, onDone }: MoveDialogProps) {
    const [all, setAll] = useState<Folder[] | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [destination, setDestination] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        requestJson<{ folders: Folder[] }>('/api/folders?all=true', { signal: controller.signal })
            .then((data) => setAll(data.folders))
            .catch((error) => {
                if (!controller.signal.aborted) setLoadError(`We couldn't load your folders. ${reason(error)}`);
            });
        return () => controller.abort();
    }, [attempt]);

    const total = files.length + moving.length;
    const single = total === 1 ? (files[0]?.name ?? moving[0]?.name) : null;
    const movingIds = new Set(moving.map((f) => f.id));
    const sources = new Set([...files.map((f) => f.folderId ?? ROOT), ...moving.map((f) => f.parentId ?? ROOT)]);

    const options = all ? flatten(all) : [];
    const byId = new Map((all ?? []).map((f) => [f.id, f]));
    const insideMoving = (id: string) => {
        for (let current = byId.get(id); current; current = current.parentId ? byId.get(current.parentId) : undefined) {
            if (movingIds.has(current.id)) return true;
        }
        return false;
    };
    /** Why a destination can't be picked, or null */
    const blocked = (id: string, parentId: string | null): string | null => {
        if (sources.size === 1 && sources.has(id)) return 'Already here';
        if (moving.length > 0 && id !== ROOT) {
            if (insideMoving(id)) return "Can't move a folder into itself";
            // Folders are at most one level deep
            if (parentId) return 'Folders can only be one level deep';
        }
        return null;
    };

    const destinationName = destination === ROOT ? 'All files' : (byId.get(destination ?? '')?.name ?? '');

    const submit = async () => {
        if (!destination) return;
        setBusy(true);
        const target = destination === ROOT ? null : destination;
        let failed = 0;
        let error: string | undefined;
        for (const file of files) {
            try {
                await requestJson(`/api/files/${file.id}`, jsonInit('PATCH', { folderId: target }));
            } catch (e) {
                failed += 1;
                error ??= `We couldn't move ${file.name}. ${reason(e)}`;
            }
        }
        for (const folder of moving) {
            try {
                await requestJson(`/api/folders/${folder.id}`, jsonInit('PATCH', { parentId: target }));
            } catch (e) {
                failed += 1;
                error ??= folderError(e, folder.name, 'move');
            }
        }
        setBusy(false);
        onDone({ moved: total - failed, failed, destination: destinationName, error });
    };

    const label = single ? 'Move' : `Move ${describeItems(files.length, moving.length)}`;

    return (
        <Dialog
            open
            onClose={onClose}
            busy={busy}
            title={single ? `Move ${single}` : `Move ${describeItems(files.length, moving.length)}`}
            description={files.length > 0 ? 'Deliveries that include these files keep working.' : 'Files inside move with the folder.'}
            footer={
                <>
                    <Button variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={() => void submit()} loading={busy} disabled={!destination}>
                        {destination ? `${label} to ${destinationName}` : label}
                    </Button>
                </>
            }
        >
            {loadError ? (
                <Callout
                    tone="danger"
                    action={
                        <Button
                            size="sm"
                            onClick={() => {
                                setLoadError(null);
                                setAttempt((a) => a + 1);
                            }}
                        >
                            Try again
                        </Button>
                    }
                >
                    {loadError}
                </Callout>
            ) : !all ? (
                <div className="flex flex-col gap-3 rounded-lg border border-default p-3" role="status" aria-label="Loading folders">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2.5">
                            <Skeleton className="h-4 w-4 rounded-full" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                    ))}
                </div>
            ) : (
                <fieldset className="max-h-80 overflow-y-auto rounded-lg border border-default">
                    <legend className="sr-only">Destination</legend>
                    {[{ id: ROOT, name: 'All files', parentId: null, depth: 0 }, ...options.map((o) => ({ ...o, depth: o.depth + 1 }))].map((option) => {
                        const why = blocked(option.id, option.id === ROOT ? null : option.parentId);
                        return (
                            <div
                                key={option.id}
                                className={cn('border-b border-subtle px-3 py-2.5 last:border-b-0', destination === option.id && 'bg-raised')}
                            >
                                <Radio
                                    name="destination"
                                    value={option.id}
                                    checked={destination === option.id}
                                    disabled={why !== null}
                                    onChange={() => setDestination(option.id)}
                                    className={cn(option.depth === 2 && 'pl-6', option.depth > 2 && 'pl-12')}
                                    label={
                                        <span className="flex items-center gap-2">
                                            {option.id === ROOT ? (
                                                <Files aria-hidden strokeWidth={1.75} className="h-4 w-4 text-secondary" />
                                            ) : (
                                                <FolderIcon aria-hidden strokeWidth={1.75} className="h-4 w-4 text-secondary" />
                                            )}
                                            {option.name}
                                        </span>
                                    }
                                    description={why ?? undefined}
                                />
                            </div>
                        );
                    })}
                </fieldset>
            )}
        </Dialog>
    );
}

/** Folders in tree order (parents before their children), alphabetical at each level. */
function flatten(folders: Folder[]): Array<Folder & { depth: number }> {
    const children = new Map<string | null, Folder[]>();
    for (const folder of folders) {
        const key = folder.parentId && folders.some((f) => f.id === folder.parentId) ? folder.parentId : null;
        children.set(key, [...(children.get(key) ?? []), folder]);
    }
    const out: Array<Folder & { depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
        for (const folder of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
            out.push({ ...folder, depth });
            walk(folder.id, depth + 1);
        }
    };
    walk(null, 0);
    return out;
}
