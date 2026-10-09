'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, EyeOff, RotateCw, Send } from 'lucide-react';
import { Button, Callout, Dialog, EmptyState, Skeleton, useToast } from '@/components/ds';
import { ResumableMedia } from '@/components/product/ResumableMedia';
import type { LibraryFile } from '@/lib/files/library';
import { downloadFile, fileUrl, reason } from './api';
import { FileTypeIcon, fileKind, fileKindLabel, isPreviewable } from './FileTypeIcon';
import { formatFullDate, formatSize, sendHref } from './format';

const ICON = { 'aria-hidden': true, strokeWidth: 1.75, className: 'h-4 w-4' } as const;
const TEXT_LIMIT = 200_000;

/** Any file with these fields: a library file (GET /api/files) or a file received on a request */
export type PreviewableFile = Pick<LibraryFile, 'id' | 'name' | 'mimeType' | 'size' | 'updatedAt'>;

type Loaded = { attempt: number } & ({ status: 'ready'; url: string; text?: string; truncated?: boolean } | { status: 'error'; message: string });

/**
 * The owner's own file: preview (image, video, audio, PDF, text) with Send and Download.
 * Mount it when a file is picked (with a fresh `key` each time) and unmount it on close, so every
 * opening gets a fresh signed URL. Video and audio ask for another one if theirs expires mid-play.
 */
export default function FilePreviewDialog({ file, onClose }: { file: PreviewableFile; onClose: () => void }) {
    const router = useRouter();
    const toast = useToast();
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [mediaFailed, setMediaFailed] = useState<number | null>(null);
    const [downloading, setDownloading] = useState(false);

    const kind = fileKind(file.mimeType, file.name);
    const previewable = isPreviewable(file.mimeType, file.name);

    useEffect(() => {
        if (!previewable) return;
        const controller = new AbortController();
        (async () => {
            try {
                const url = await fileUrl(file.id, 'preview', controller.signal);
                if (kind === 'text' || kind === 'code') {
                    const response = await fetch(url, { signal: controller.signal });
                    if (!response.ok) throw new Error('text');
                    const body = await response.text();
                    setLoaded({ attempt, status: 'ready', url, text: body.slice(0, TEXT_LIMIT), truncated: body.length > TEXT_LIMIT });
                } else {
                    setLoaded({ attempt, status: 'ready', url });
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                setLoaded({ attempt, status: 'error', message: `We couldn't load the preview. ${reason(error)}` });
            }
        })();
        return () => controller.abort();
    }, [file.id, previewable, kind, attempt]);

    const current = loaded?.attempt === attempt ? loaded : null;
    const failed = current?.status === 'error' || (current?.status === 'ready' && mediaFailed === attempt);

    const download = async () => {
        setDownloading(true);
        try {
            await downloadFile(file.id);
        } catch (error) {
            toast.error(`We couldn't download ${file.name}. ${reason(error)}`);
        } finally {
            setDownloading(false);
        }
    };

    const retry = () => {
        setMediaFailed(null);
        setAttempt((a) => a + 1);
    };
    const onMediaError = () => setMediaFailed(attempt);
    const refreshMediaUrl = () => fileUrl(file.id, 'preview').catch(() => null);

    return (
        <Dialog
            open
            onClose={onClose}
            size="md"
            title={<span className="break-all">{file.name}</span>}
            description={
                <span className="tabular-nums">
                    {fileKindLabel(kind, file.name)} · {formatSize(file.size)} · Modified {formatFullDate(file.updatedAt)}
                </span>
            }
            footer={
                <>
                    <Button variant="secondary" icon={<Send {...ICON} />} onClick={() => router.push(sendHref([file.id]))}>
                        Send
                    </Button>
                    <Button variant="primary" icon={<Download {...ICON} />} loading={downloading} onClick={() => void download()}>
                        Download
                    </Button>
                </>
            }
        >
            <div className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg border border-subtle bg-inset">
                {!previewable ? (
                    <EmptyState
                        icon={EyeOff}
                        title="No preview for this type of file"
                        description={`Download ${file.name} to open it on your device.`}
                    />
                ) : failed ? (
                    <div className="w-full p-4">
                        <Callout
                            tone="danger"
                            action={
                                <Button size="sm" icon={<RotateCw {...ICON} />} onClick={retry}>
                                    Try again
                                </Button>
                            }
                        >
                            {current?.status === 'error' ? current.message : "We couldn't play or show this file. Try again, or download it."}
                        </Callout>
                    </div>
                ) : !current ? (
                    <PreviewSkeleton kind={kind} />
                ) : current.status === 'ready' && (kind === 'text' || kind === 'code') ? (
                    <div className="max-h-[60vh] w-full self-stretch overflow-auto">
                        <pre className="whitespace-pre-wrap break-words p-4 font-mono text-body-sm text-primary">{current.text || ' '}</pre>
                        {current.truncated && (
                            <p className="border-t border-subtle px-4 py-2 text-caption text-tertiary">Showing the first 200 KB. Download the file to see all of it.</p>
                        )}
                    </div>
                ) : current.status === 'ready' && kind === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset
                    <img src={current.url} alt={file.name} onError={onMediaError} className="max-h-[60vh] w-auto max-w-full object-contain" />
                ) : current.status === 'ready' && kind === 'video' ? (
                    <ResumableMedia
                        kind="video"
                        key={current.url}
                        src={current.url}
                        refresh={refreshMediaUrl}
                        onFail={onMediaError}
                        controls
                        preload="metadata"
                        className="max-h-[60vh] w-full bg-black"
                    >
                        <track kind="captions" />
                    </ResumableMedia>
                ) : current.status === 'ready' && kind === 'audio' ? (
                    <div className="flex w-full flex-col items-center gap-4 p-6">
                        <FileTypeIcon mimeType={file.mimeType} name={file.name} className="h-8 w-8 text-tertiary" />
                        <ResumableMedia
                            kind="audio"
                            key={current.url}
                            src={current.url}
                            refresh={refreshMediaUrl}
                            onFail={onMediaError}
                            controls
                            preload="metadata"
                            className="w-full"
                        />
                    </div>
                ) : current.status === 'ready' ? (
                    <iframe src={current.url} title={file.name} className="h-[60vh] w-full bg-white" />
                ) : null}
            </div>
        </Dialog>
    );
}

function PreviewSkeleton({ kind }: { kind: string }) {
    if (kind === 'text' || kind === 'code') {
        return (
            <div className="flex w-full flex-col gap-2.5 self-start p-4" aria-label="Loading preview" role="status">
                {[92, 80, 86, 60, 74, 40].map((w) => (
                    <Skeleton key={w} className={w > 80 ? 'h-3 w-11/12' : w > 60 ? 'h-3 w-4/5' : 'h-3 w-1/2'} />
                ))}
            </div>
        );
    }
    return (
        <div className="w-full self-stretch p-4" aria-label="Loading preview" role="status">
            <Skeleton className={kind === 'audio' ? 'h-24 w-full' : 'h-[50vh] w-full'} />
        </div>
    );
}
