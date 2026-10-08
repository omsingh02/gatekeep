'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, CircleAlert, Download, ExternalLink, RotateCw, X } from 'lucide-react';
import { Button, Callout, IconButton, Skeleton } from '@/components/ds';
import { ResumableMedia } from '@/components/product/ResumableMedia';
import { recipientApi, type DeliveryFile, type Failure } from './api';
import { FileTile, fileMeta, previewKind } from './format';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), video[controls], audio[controls], iframe, [tabindex]:not([tabindex="-1"])';
/** Text previews stop here; the download has the rest. */
const TEXT_PREVIEW_CHARS = 200_000;

type Loaded = { key: string } & (
    | { status: 'loading' }
    | { status: 'ready'; url: string; text?: string; truncated?: boolean }
    | { status: 'error'; message: string }
);

export interface PreviewStageProps {
    code: string;
    files: DeliveryFile[];
    index: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
    onDownload: (file: DeliveryFile) => void;
    canDownload: boolean;
    downloadingId: string | null;
    /** Access changed while previewing (removed, ended, signed out) */
    onFailure: (failure: Failure) => void;
}

/**
 * Full-viewport preview of one file at a time, max 1120px wide. Arrow keys move between files,
 * Escape closes, focus stays inside and returns to the opener afterwards.
 */
export function PreviewStage({ code, files, index, onIndexChange, onClose, onDownload, canDownload, downloadingId, onFailure }: PreviewStageProps) {
    const file = files[index];
    const kind = previewKind(file.mimeType);
    const [attempt, setAttempt] = useState(0);
    const [officeAllowed, setOfficeAllowed] = useState(false);
    const loadKey = `${file.id}:${attempt}`;
    const [result, setLoaded] = useState<Loaded>({ key: '', status: 'loading' });
    // Anything loaded for another file (or an earlier attempt) is stale: show loading instead
    const loaded: Loaded = result.key === loadKey ? result : { key: loadKey, status: 'loading' };
    const panelRef = useRef<HTMLDivElement>(null);
    const titleId = `preview-title-${file.id}`;
    const hasMany = files.length > 1;

    const go = useCallback(
        (delta: number) => {
            if (!hasMany) return;
            onIndexChange((index + delta + files.length) % files.length);
        },
        [files.length, hasMany, index, onIndexChange],
    );

    // Keys, focus trap, scroll lock and focus restore
    const onCloseRef = useRef(onClose);
    const goRef = useRef(go);
    const onFailureRef = useRef(onFailure);
    useEffect(() => {
        onCloseRef.current = onClose;
        goRef.current = go;
        onFailureRef.current = onFailure;
    });
    useEffect(() => {
        const previouslyFocused = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const frame = requestAnimationFrame(() => panelRef.current?.focus());

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (event.key === 'Escape') {
                event.preventDefault();
                onCloseRef.current();
                return;
            }
            const inMedia = target?.closest('video, audio, input');
            if (!inMedia && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                event.preventDefault();
                goRef.current(event.key === 'ArrowRight' ? 1 : -1);
                return;
            }
            if (event.key !== 'Tab' || !panelRef.current) return;
            const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        return () => {
            cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            previouslyFocused?.focus?.();
        };
    }, []);

    // Fetch a fresh, short-lived URL for this file (every preview is on the record)
    useEffect(() => {
        if (kind === 'none' || (kind === 'office' && !officeAllowed)) return;
        let cancelled = false;
        const key = `${file.id}:${attempt}`;
        (async () => {
            const signed = await recipientApi.fileUrl(code, file.id, 'preview');
            if (cancelled) return;
            if ('failure' in signed) {
                if (['removed', 'ended', 'signed-out'].includes(signed.failure.kind)) return onFailureRef.current(signed.failure);
                setLoaded({ key, status: 'error', message: signed.failure.message });
                return;
            }
            if (kind !== 'text') {
                setLoaded({ key, status: 'ready', url: signed.data.url });
                return;
            }
            try {
                const response = await fetch(signed.data.url);
                if (!response.ok) throw new Error(String(response.status));
                const text = await response.text();
                if (!cancelled) {
                    setLoaded({
                        key,
                        status: 'ready',
                        url: signed.data.url,
                        text: text.slice(0, TEXT_PREVIEW_CHARS),
                        truncated: text.length > TEXT_PREVIEW_CHARS,
                    });
                }
            } catch {
                if (!cancelled) setLoaded({ key, status: 'error', message: "We couldn't load this preview. Check your connection and try again." });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [code, file.id, kind, officeAllowed, attempt]);

    // Video and audio stream from their URL while they play: when it expires mid-way, get a fresh one
    const refreshMediaUrl = useCallback(async () => {
        const signed = await recipientApi.fileUrl(code, file.id, 'preview');
        if ('failure' in signed) {
            if (['removed', 'ended', 'signed-out'].includes(signed.failure.kind)) onFailureRef.current(signed.failure);
            return null;
        }
        return signed.data.url;
    }, [code, file.id]);
    const mediaFailed = useCallback(
        () => setLoaded({ key: loadKey, status: 'error', message: "We couldn't play this file. Try again, or download it." }),
        [loadKey],
    );

    const downloading = downloadingId === file.id;

    const failed = (message: string) => (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-danger-border bg-danger-bg text-danger">
                <CircleAlert {...ICON} className="h-5 w-5" />
            </span>
            <p className="text-body text-primary">{message}</p>
            <Button size="lg" icon={<RotateCw {...ICON} />} onClick={() => setAttempt((a) => a + 1)}>
                Try again
            </Button>
        </div>
    );

    const placeholder = (title: string, body: string, action?: ReactNode) => (
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
            <FileTile mimeType={file.mimeType} size="lg" />
            <div className="flex flex-col gap-1">
                <p className="text-h3 text-strong">{title}</p>
                <p className="text-body-sm text-secondary">{body}</p>
            </div>
            {action}
        </div>
    );

    const downloadAction = canDownload ? (
        <Button variant="primary" size="lg" loading={downloading} icon={<Download {...ICON} />} onClick={() => onDownload(file)}>
            Download
        </Button>
    ) : null;

    let content: ReactNode;
    if (kind === 'none') {
        content = placeholder(
            'No preview for this file type',
            canDownload ? 'Download it to open it on your device.' : "This file can't be shown in the browser.",
            downloadAction,
        );
    } else if (kind === 'office' && !officeAllowed) {
        content = (
            <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
                {placeholder(
                    'Preview with Microsoft Office',
                    'Office files open in Microsoft’s online viewer, which gets a link to this file that stops working after a minute.',
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button size="lg" icon={<ExternalLink {...ICON} />} onClick={() => setOfficeAllowed(true)}>
                        Open in Office viewer
                    </Button>
                    {downloadAction}
                </div>
            </div>
        );
    } else if (loaded.status === 'loading') {
        content = (
            <div className="flex h-full w-full items-center justify-center" aria-busy="true">
                <Skeleton className="h-full max-h-[70dvh] w-full rounded-lg" />
                <span className="sr-only">Loading preview…</span>
            </div>
        );
    } else if (loaded.status === 'error') {
        content = failed(loaded.message);
    } else if (kind === 'image') {
        content = (
            // eslint-disable-next-line @next/next/no-img-element -- a short-lived signed URL to a private file; never through the image optimizer
            <img
                src={loaded.url}
                alt={file.name}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                onError={() => setLoaded({ key: loadKey, status: 'error', message: "We couldn't load this preview. Try again." })}
                className="max-h-full max-w-full select-none rounded-md object-contain"
            />
        );
    } else if (kind === 'video') {
        content = (
            <ResumableMedia
                kind="video"
                key={loaded.url}
                src={loaded.url}
                refresh={refreshMediaUrl}
                onFail={mediaFailed}
                controls
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                preload="metadata"
                onContextMenu={(e) => e.preventDefault()}
                className="max-h-full max-w-full rounded-md bg-inset"
            >
                Your browser can&apos;t play this video. Download it to watch it.
            </ResumableMedia>
        );
    } else if (kind === 'audio') {
        content = (
            <div className="flex w-full max-w-lg flex-col items-center gap-5 rounded-lg border border-default bg-surface p-6 text-center">
                <FileTile mimeType={file.mimeType} size="lg" />
                <p className="max-w-full truncate text-h3 text-strong">{file.name}</p>
                <ResumableMedia
                    kind="audio"
                    key={loaded.url}
                    src={loaded.url}
                    refresh={refreshMediaUrl}
                    onFail={mediaFailed}
                    controls
                    controlsList="nodownload noplaybackrate"
                    preload="metadata"
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full"
                >
                    Your browser can&apos;t play this audio. Download it to listen.
                </ResumableMedia>
            </div>
        );
    } else if (kind === 'text') {
        content = (
            <div className="flex h-full w-full flex-col gap-2">
                {loaded.truncated && <Callout>Showing the start of this file. Download it to see everything.</Callout>}
                <pre
                    tabIndex={0}
                    aria-label={`Contents of ${file.name}`}
                    className="min-h-0 w-full flex-1 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-default bg-surface p-4 font-mono text-body-sm text-primary"
                >
                    {loaded.text}
                </pre>
            </div>
        );
    } else {
        const src =
            kind === 'pdf'
                ? `${loaded.url}#toolbar=0&navpanes=0`
                : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(loaded.url)}`;
        content = (
            <iframe
                key={src}
                src={src}
                title={file.name}
                className="h-full w-full rounded-lg border border-default bg-surface"
                {...(kind === 'office' ? { sandbox: 'allow-scripts allow-same-origin allow-popups' } : {})}
            />
        );
    }

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="ds-fade-in fixed inset-0 z-50 flex h-dvh flex-col bg-inset focus:outline-none"
        >
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-subtle bg-surface px-2 sm:gap-3 sm:px-4">
                <span className="hidden sm:block">
                    <FileTile mimeType={file.mimeType} size="sm" />
                </span>
                <div className="min-w-0 flex-1 pl-2 sm:pl-0">
                    <h2 id={titleId} className="truncate text-body font-medium text-strong">
                        {file.name}
                    </h2>
                    <p className="truncate text-caption tabular-nums text-tertiary">
                        {fileMeta(file)}
                        {hasMany && ` · ${index + 1} of ${files.length}`}
                    </p>
                </div>
                {canDownload && (
                    <>
                        <span className="hidden sm:flex">
                            <Button loading={downloading} icon={<Download {...ICON} />} onClick={() => onDownload(file)}>
                                Download
                            </Button>
                        </span>
                        <span className="flex sm:hidden">
                            <IconButton
                                size="lg"
                                label={`Download ${file.name}`}
                                icon={<Download {...ICON} />}
                                disabled={downloading}
                                onClick={() => onDownload(file)}
                            />
                        </span>
                    </>
                )}
                <IconButton size="lg" label="Close preview" icon={<X {...ICON} />} onClick={onClose} />
            </header>

            <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
                <div className="mx-auto flex h-full w-full max-w-marketing items-center justify-center">{content}</div>
            </div>

            {hasMany && (
                <footer className="flex h-14 shrink-0 items-center justify-between gap-2 border-t border-subtle bg-surface px-2 sm:px-4">
                    <Button size="lg" variant="ghost" icon={<ChevronLeft {...ICON} />} onClick={() => go(-1)} aria-label="Previous file">
                        <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <p className="text-body-sm tabular-nums text-secondary" aria-live="polite">
                        {index + 1} of {files.length}
                    </p>
                    <Button size="lg" variant="ghost" iconRight={<ChevronRight {...ICON} />} onClick={() => go(1)} aria-label="Next file">
                        <span className="hidden sm:inline">Next</span>
                    </Button>
                </footer>
            )}
        </div>,
        document.body,
    );
}
