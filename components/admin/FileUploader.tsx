'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, FolderUp, RotateCw, Send, Upload, X } from 'lucide-react';
import { Button, Dialog, IconButton, cn, useToast } from '@/components/ds';
import { getMaxFileSize } from '@/lib/utils/fileTypes';
import { FileTypeIcon } from './files/FileTypeIcon';
import { count, formatSize, sendHref } from './files/format';
import { reason } from './files/api';
import { filesFromDrop, filesFromFolderInput, type UploadItem, type UploadTarget, type Uploads } from './files/useUploads';

const ICON = { 'aria-hidden': true, strokeWidth: 1.75, className: 'h-4 w-4' } as const;

export interface FileUploaderProps {
    open: boolean;
    onClose: () => void;
    /** The folder files go to (the folder you're in) */
    target: UploadTarget;
    uploads: Uploads;
}

/**
 * "Upload files" dialog: drop zone or pickers, then one row per file with progress, cancel,
 * retry and clear. Uploads keep going if the dialog closes; the Files page toasts when they finish.
 */
export default function FileUploader({ open, onClose, target, uploads }: FileUploaderProps) {
    const router = useRouter();
    const toast = useToast();
    const fileInput = useRef<HTMLInputElement>(null);
    const folderInput = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);

    const { items, active } = uploads;
    const done = items.filter((item) => item.status === 'done');
    const failed = items.filter((item) => item.status === 'error').length;

    const close = () => {
        // Keep the list while files are still uploading, so it's there if you come back
        if (!active) uploads.clearFinished();
        onClose();
    };

    const addFolder = async (files: File[], folderName: string) => {
        try {
            await uploads.enqueueFolder(folderName, files, target);
        } catch (error) {
            toast.error(`We couldn't create the folder ${folderName}. ${reason(error)}`);
        }
    };

    const onDrop = async (event: DragEvent) => {
        event.preventDefault();
        setDragging(false);
        const { files, folderName } = await filesFromDrop(event.dataTransfer);
        if (files.length === 0) return;
        if (folderName) await addFolder(files, folderName);
        else uploads.enqueue(files, target);
    };

    return (
        <Dialog
            open={open}
            onClose={close}
            size="md"
            title="Upload files"
            description={
                <>
                    Files go to <span className="font-medium text-primary">{target.name}</span> and stay private until you deliver them.
                </>
            }
            footer={
                done.length > 0 && !active ? (
                    <>
                        <Button variant="secondary" onClick={close}>
                            Done
                        </Button>
                        <Button
                            variant="primary"
                            icon={<Send {...ICON} />}
                            onClick={() => {
                                const ids = done.flatMap((item) => (item.fileId ? [item.fileId] : []));
                                close();
                                router.push(sendHref(ids));
                            }}
                        >
                            {done.length === 1 ? 'Send file' : `Send ${done.length} files`}
                        </Button>
                    </>
                ) : (
                    <Button variant="secondary" onClick={close}>
                        Close
                    </Button>
                )
            }
        >
            <div
                onDragEnter={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
                }}
                onDrop={(event) => void onDrop(event)}
                className={cn(
                    'flex flex-col items-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors',
                    dragging ? 'border-gray-8 bg-raised' : 'border-default bg-inset'
                )}
            >
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-default bg-raised text-secondary">
                    <Upload aria-hidden strokeWidth={1.75} className="h-5 w-5" />
                </span>
                <p className="mt-3 text-body text-primary">{dragging ? 'Drop to upload' : 'Drop files or a folder here'}</p>
                <p className="mt-1 text-caption text-tertiary">Up to {formatSize(getMaxFileSize())} per file</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button variant="secondary" icon={<Upload {...ICON} />} onClick={() => fileInput.current?.click()}>
                        Choose files
                    </Button>
                    <Button variant="ghost" icon={<FolderUp {...ICON} />} onClick={() => folderInput.current?.click()}>
                        Choose a folder
                    </Button>
                </div>
                <input
                    ref={fileInput}
                    type="file"
                    multiple
                    hidden
                    onChange={(event) => {
                        if (event.target.files?.length) uploads.enqueue(Array.from(event.target.files), target);
                        event.target.value = '';
                    }}
                />
                <input
                    ref={(el) => {
                        folderInput.current = el;
                        el?.setAttribute('webkitdirectory', '');
                    }}
                    type="file"
                    hidden
                    onChange={(event) => {
                        const list = event.target.files;
                        if (list?.length) {
                            const { files, folderName } = filesFromFolderInput(list);
                            if (folderName) void addFolder(files, folderName);
                            else uploads.enqueue(files, target);
                        }
                        event.target.value = '';
                    }}
                />
            </div>

            {items.length > 0 && (
                <section aria-label="Uploads" className="mt-4">
                    <div className="mb-2 flex min-h-7 items-center justify-between gap-3">
                        <p className="flex items-center gap-1.5 text-body-sm text-secondary" aria-live="polite">
                            {active > 0 ? (
                                `Uploading ${count(items.length - failed, 'file')}… ${done.length} done`
                            ) : failed > 0 ? (
                                <>
                                    <AlertTriangle aria-hidden strokeWidth={1.75} className="h-4 w-4 text-warning" />
                                    {done.length > 0 ? `Uploaded ${done.length} of ${done.length + failed} files. ` : ''}
                                    {failed === 1 ? "1 file couldn't be uploaded." : `${failed} files couldn't be uploaded.`}
                                </>
                            ) : done.length > 0 ? (
                                <>
                                    <CheckCircle2 aria-hidden strokeWidth={1.75} className="h-4 w-4 text-success" />
                                    Uploaded {count(done.length, 'file')}
                                </>
                            ) : (
                                'Nothing uploaded'
                            )}
                        </p>
                        {active === 0 && (
                            <Button variant="ghost" size="sm" onClick={uploads.clearFinished}>
                                Clear list
                            </Button>
                        )}
                    </div>
                    <ul className="max-h-72 overflow-y-auto rounded-lg border border-default">
                        {items.map((item) => (
                            <UploadRow key={item.id} item={item} uploads={uploads} />
                        ))}
                    </ul>
                    {active > 0 && <p className="mt-2 text-caption text-tertiary">You can close this and keep working. Uploads continue in the background.</p>}
                </section>
            )}
        </Dialog>
    );
}

function UploadRow({ item, uploads }: { item: UploadItem; uploads: Uploads }) {
    const size = formatSize(item.size);
    return (
        <li className="flex items-center gap-3 border-b border-subtle px-3 py-2.5 last:border-b-0">
            <FileTypeIcon mimeType={item.file.type} name={item.name} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-body-sm text-primary" title={item.name}>
                    {item.name}
                </p>
                {item.status === 'uploading' ? (
                    <div className="mt-1.5 flex items-center gap-2">
                        <progress
                            value={item.progress}
                            max={100}
                            aria-label={`Uploading ${item.name}`}
                            className="h-1 w-full appearance-none overflow-hidden rounded-full bg-gray-4 [&::-moz-progress-bar]:bg-gray-10 [&::-webkit-progress-bar]:bg-gray-4 [&::-webkit-progress-value]:bg-gray-10 [&::-webkit-progress-value]:transition-[width]"
                        />
                        <span className="w-9 shrink-0 text-right text-caption tabular-nums text-secondary">{item.progress}%</span>
                    </div>
                ) : item.status === 'error' ? (
                    <p className="mt-0.5 text-caption text-danger">{item.error}</p>
                ) : (
                    <p className="mt-0.5 flex items-center gap-1 text-caption text-tertiary">
                        {item.status === 'done' && <CheckCircle2 aria-hidden strokeWidth={1.75} className="h-3.5 w-3.5 text-success" />}
                        <span className="tabular-nums">{size}</span>
                        <span aria-hidden>·</span>
                        {item.status === 'queued' ? 'Waiting…' : item.status === 'done' ? 'Uploaded' : 'Canceled'}
                    </p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                {(item.status === 'queued' || item.status === 'uploading') && (
                    <IconButton size="sm" label={`Cancel ${item.name}`} icon={<X {...ICON} />} onClick={() => uploads.cancel(item.id)} />
                )}
                {((item.status === 'error' && item.retryable) || item.status === 'canceled') && (
                    <IconButton size="sm" label={`Retry ${item.name}`} icon={<RotateCw {...ICON} />} onClick={() => uploads.retry(item.id)} />
                )}
                {(item.status === 'error' || item.status === 'canceled') && (
                    <IconButton size="sm" label={`Clear ${item.name}`} icon={<X {...ICON} />} onClick={() => uploads.remove(item.id)} />
                )}
            </div>
        </li>
    );
}
