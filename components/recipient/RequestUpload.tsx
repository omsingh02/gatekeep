'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import { CircleCheck, CircleAlert, FileUp, Plus, RotateCw, Upload, X } from 'lucide-react';
import { Button, Callout, Card, CardHeader, IconButton, cn } from '@/components/ds';
import { getFileExtension, isExtensionAllowed } from '@/lib/utils/fileTypes';
import { recipientApi, type Failure, type UploadedFile, type VerifiedView } from './api';
import { DeliveryHeading, MetaRow, SignedInFrame, endsItem } from './Frame';
import { FileTile, fileMeta, formatFileSize, guessMimeType, plural } from './format';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
/** The most any request accepts per file, whatever its own limit says (lib/utils/fileTypes). */
const SERVER_MAX_BYTES = 100 * 1024 * 1024;

type ItemStatus = 'queued' | 'uploading' | 'done' | 'error';

interface Item {
    id: string;
    file: File;
    status: ItemStatus;
    progress: number;
    error?: string;
}

export interface RequestUploadProps {
    code: string;
    view: VerifiedView;
    onFailure: (failure: Failure) => void;
    onSignedOut: () => void;
}

/** PUT the file straight to storage, reporting progress (fetch can't report upload progress). */
function putFile(url: string, file: File, mimeType: string, onProgress: (fraction: number) => void): Promise<boolean> {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', mimeType);
        xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(event.loaded / event.total);
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.onabort = () => resolve(false);
        xhr.send(file);
    });
}

let nextId = 0;

export function RequestUpload({ code, view, onFailure, onSignedOut }: RequestUploadProps) {
    const { delivery, sender, recipient } = view;
    const limits = delivery.request ?? { maxFiles: null, maxFileMb: 100, uploaded: null };
    const maxBytes = Math.min(limits.maxFileMb * 1024 * 1024, SERVER_MAX_BYTES);

    const [sent, setSent] = useState<UploadedFile[]>(limits.uploaded?.files ?? []);
    const [items, setItems] = useState<Item[]>([]);
    const [rejected, setRejected] = useState<string[]>([]);
    const [dragging, setDragging] = useState(false);
    const [batchDone, setBatchDone] = useState<number | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const running = useRef(false);
    const batchCount = useRef(0);

    const active = items.filter((i) => i.status === 'queued' || i.status === 'uploading');
    const remaining = limits.maxFiles === null ? null : Math.max(limits.maxFiles - sent.length - active.length, 0);
    const full = remaining === 0;

    const update = (id: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    const addFiles = (list: FileList | File[]) => {
        const incoming = Array.from(list);
        if (incoming.length === 0) return;
        const problems: string[] = [];
        const accepted: Item[] = [];
        let room = remaining;
        for (const file of incoming) {
            const extension = getFileExtension(file.name);
            if (room !== null && room <= 0) {
                problems.push(`${file.name} wasn't added. This request takes up to ${plural(limits.maxFiles ?? 0, 'file')}.`);
            } else if (file.size === 0) {
                problems.push(`${file.name} is empty.`);
            } else if (!extension || !isExtensionAllowed(extension)) {
                problems.push(`${file.name} can't be sent. This type of file isn't accepted.`);
            } else if (file.size > maxBytes) {
                problems.push(`${file.name} is larger than ${formatFileSize(maxBytes)}, the most this request allows.`);
            } else {
                accepted.push({ id: `u${++nextId}`, file, status: 'queued', progress: 0 });
                if (room !== null) room -= 1;
            }
        }
        setRejected(problems);
        if (accepted.length) {
            setBatchDone(null);
            setItems((list) => [...list.filter((i) => i.status !== 'done'), ...accepted]);
            setAnnouncement(`Sending ${plural(accepted.length, 'file')}…`);
        }
    };

    const uploadOne = async (item: Item): Promise<boolean> => {
        const mimeType = guessMimeType(item.file);
        update(item.id, { status: 'uploading', progress: 0, error: undefined });
        const fail = (message: string) => {
            update(item.id, { status: 'error', error: message });
            setAnnouncement(`Couldn't send ${item.file.name}`);
            return false;
        };

        const started = await recipientApi.startUpload(code, { filename: item.file.name, size: item.file.size, mimeType });
        if ('failure' in started) {
            if (['removed', 'ended', 'signed-out'].includes(started.failure.kind)) {
                onFailure(started.failure);
                return false;
            }
            return fail(started.failure.kind === 'network' ? `We couldn't send ${item.file.name}. Check your connection and try again.` : started.failure.message);
        }
        const stored = await putFile(started.data.uploadUrl, item.file, mimeType, (fraction) =>
            update(item.id, { progress: Math.min(Math.round(fraction * 100), 99) }),
        );
        if (!stored) return fail(`We couldn't send ${item.file.name}. Check your connection and try again.`);

        const confirmed = await recipientApi.confirmUpload(code, { path: started.data.path, filename: item.file.name, mimeType });
        if ('failure' in confirmed) {
            if (['removed', 'ended', 'signed-out'].includes(confirmed.failure.kind)) {
                onFailure(confirmed.failure);
                return false;
            }
            return fail(confirmed.failure.message);
        }
        update(item.id, { status: 'done', progress: 100 });
        setSent((list) => [...list, { id: confirmed.data.file.id, name: item.file.name, size: confirmed.data.file.size ?? item.file.size }]);
        setAnnouncement(`Sent ${item.file.name}`);
        return true;
    };

    // Work through the queue one file at a time; tell the sender once per batch
    useEffect(() => {
        if (running.current) return;
        const next = items.find((i) => i.status === 'queued');
        if (!next) return;
        running.current = true;
        void (async () => {
            const ok = await uploadOne(next);
            if (ok) batchCount.current += 1;
            running.current = false;
            setItems((list) => [...list]); // re-run for the next file
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- uploadOne reads the latest state through setters
    }, [items]);

    useEffect(() => {
        if (running.current || batchCount.current === 0) return;
        if (items.some((i) => i.status === 'queued' || i.status === 'uploading')) return;
        batchCount.current = 0;
        void recipientApi.completeUploads(code);
        const count = items.filter((i) => i.status === 'done').length;
        if (count > 0 && items.every((i) => i.status === 'done')) {
            setBatchDone(count);
            setAnnouncement(`Sent ${plural(count, 'file')} to ${sender.name}`);
        }
    }, [items, code, sender.name]);

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setDragging(false);
        if (!full) addFiles(event.dataTransfer.files);
    };

    const limitText = [
        limits.maxFiles !== null ? `Up to ${plural(limits.maxFiles, 'file')}` : null,
        `${formatFileSize(maxBytes)} each`,
    ]
        .filter(Boolean)
        .join(', ');

    const failedItems = items.filter((i) => i.status === 'error');
    const showSuccess = batchDone !== null && failedItems.length === 0 && active.length === 0;

    return (
        <SignedInFrame code={code} sender={sender} onSignedOut={onSignedOut}>
            <p className="sr-only" role="status" aria-live="polite">
                {announcement}
            </p>

            <DeliveryHeading eyebrow={`${sender.name} asked you for files`} title={delivery.title} message={delivery.message} />

            <MetaRow items={[{ icon: Upload, text: limitText }, ...endsItem(recipient.endsAt)]} />

            {showSuccess ? (
                <Card className="flex flex-col items-start gap-4 p-5 sm:p-6">
                    <span className="flex h-10 w-10 items-center justify-center rounded-md border border-success-border bg-success-bg text-success">
                        <CircleCheck strokeWidth={1.75} aria-hidden className="h-5 w-5" />
                    </span>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-h2 text-strong">
                            Sent {plural(batchDone, 'file')} to {sender.name}
                        </h2>
                        <p className="text-body text-secondary">
                            {sender.name} can see {batchDone === 1 ? 'it' : 'them'} now. You can close this page.
                        </p>
                    </div>
                    {!full && (
                        <Button
                            size="lg"
                            icon={<Plus {...ICON} />}
                            onClick={() => {
                                setBatchDone(null);
                                setItems([]);
                                inputRef.current?.click();
                            }}
                        >
                            Add more files
                        </Button>
                    )}
                </Card>
            ) : full && active.length === 0 ? (
                <Callout title="You've sent all the files this request takes">
                    This request takes up to {plural(limits.maxFiles ?? 0, 'file')}. Ask {sender.name} if you need to send more.
                </Callout>
            ) : (
                <div
                    onDragEnter={(e) => {
                        e.preventDefault();
                        if (!full) setDragging(true);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
                    }}
                    onDrop={onDrop}
                    className={cn(
                        'flex flex-col items-center gap-4 rounded-lg border border-dashed px-6 py-10 text-center transition-colors duration-150 sm:py-14',
                        dragging ? 'border-gray-8 bg-raised' : 'border-strong bg-surface',
                    )}
                >
                    <span className="flex h-12 w-12 items-center justify-center rounded-md border border-default bg-raised text-secondary">
                        <FileUp strokeWidth={1.75} aria-hidden className="h-6 w-6" />
                    </span>
                    <div className="flex flex-col gap-1">
                        <p className="text-h3 text-strong">
                            <span className="hidden sm:inline">Drag files here, or choose them</span>
                            <span className="sm:hidden">Choose files to send</span>
                        </p>
                        <p className="text-body-sm text-secondary">
                            {limitText}
                            {remaining !== null && remaining < (limits.maxFiles ?? 0) ? ` · ${remaining} more allowed` : ''}
                        </p>
                    </div>
                    <Button variant="primary" size="lg" icon={<Upload {...ICON} />} onClick={() => inputRef.current?.click()}>
                        Choose files
                    </Button>
                </div>
            )}

            <input
                ref={inputRef}
                type="file"
                multiple
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = '';
                }}
            />

            {rejected.length > 0 && (
                <Callout tone="warning" title={rejected.length === 1 ? "One file wasn't added" : `${rejected.length} files weren't added`}>
                    <ul className="flex flex-col gap-0.5">
                        {rejected.map((problem, i) => (
                            <li key={i}>{problem}</li>
                        ))}
                    </ul>
                </Callout>
            )}

            {items.length > 0 && !showSuccess && (
                <Card flush>
                    <CardHeader
                        title={active.length ? `Sending ${plural(items.length, 'file')}` : plural(items.length, 'file')}
                        description={failedItems.length ? `${failedItems.length} didn't send. Try again, or remove ${failedItems.length === 1 ? 'it' : 'them'}.` : undefined}
                    />
                    <ul aria-label="Files you're sending" className="divide-y divide-gray-4">
                        {items.map((item) => (
                            <UploadRow
                                key={item.id}
                                item={item}
                                onRetry={() => update(item.id, { status: 'queued', progress: 0, error: undefined })}
                                onRemove={() => setItems((list) => list.filter((i) => i.id !== item.id))}
                            />
                        ))}
                    </ul>
                </Card>
            )}

            {sent.length > 0 && (
                <Card flush>
                    <CardHeader title="You've sent" description={`${plural(sent.length, 'file')} to ${sender.name}`} />
                    <ul aria-label="Files you've sent" className="divide-y divide-gray-4">
                        {sent.map((file) => {
                            return (
                                <li key={file.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                                    <FileTile mimeType={guessMimeType({ name: file.name, type: '' })} />
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-body font-medium text-primary">{file.name}</span>
                                        <span className="text-caption tabular-nums text-tertiary">{fileMeta(file)}</span>
                                    </div>
                                    <CircleCheck strokeWidth={1.75} aria-label="Sent" className="h-4 w-4 shrink-0 text-success" />
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}
        </SignedInFrame>
    );
}

function UploadRow({ item, onRetry, onRemove }: { item: Item; onRetry: () => void; onRemove: () => void }) {
    return (
        <li className="flex flex-col gap-2 px-3 py-3 sm:px-4">
            <div className="flex items-center gap-3">
                <FileTile mimeType={guessMimeType(item.file)} />
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-medium text-primary">{item.file.name}</span>
                    <span className={cn('text-caption tabular-nums', item.status === 'error' ? 'text-danger' : 'text-tertiary')}>
                        {item.status === 'error'
                            ? item.error
                            : item.status === 'done'
                              ? `Sent · ${formatFileSize(item.file.size)}`
                              : item.status === 'uploading'
                                ? `${item.progress}% of ${formatFileSize(item.file.size)}`
                                : `Waiting · ${formatFileSize(item.file.size)}`}
                    </span>
                </div>
                {item.status === 'done' && <CircleCheck strokeWidth={1.75} aria-label="Sent" className="h-4 w-4 shrink-0 text-success" />}
                {item.status === 'error' && (
                    <div className="flex shrink-0 items-center gap-1">
                        <CircleAlert strokeWidth={1.75} aria-hidden className="hidden h-4 w-4 text-danger sm:block" />
                        <Button size="lg" variant="ghost" icon={<RotateCw {...ICON} />} onClick={onRetry}>
                            Retry
                        </Button>
                        <IconButton size="lg" label={`Remove ${item.file.name}`} icon={<X {...ICON} />} onClick={onRemove} />
                    </div>
                )}
                {item.status === 'queued' && <IconButton size="lg" label={`Remove ${item.file.name}`} icon={<X {...ICON} />} onClick={onRemove} />}
            </div>
            {item.status === 'uploading' && (
                <progress
                    value={item.progress}
                    max={100}
                    aria-label={`Sending ${item.file.name}`}
                    className="h-1 w-full appearance-none overflow-hidden rounded-full bg-raised [&::-moz-progress-bar]:bg-gray-10 [&::-webkit-progress-bar]:bg-raised [&::-webkit-progress-value]:bg-gray-10"
                />
            )}
        </li>
    );
}
