'use client';

import { useCallback, useRef, useState } from 'react';
import { Download, Eye, Files, Inbox } from 'lucide-react';
import { Button, Callout, Card, EmptyState, IconButton } from '@/components/ds';
import { recipientApi, startDownload, type DeliveryFile, type Failure, type VerifiedView } from './api';
import { DeliveryHeading, MetaRow, SignedInFrame, endsItem } from './Frame';
import { FileTile, fileMeta, formatFileSize, plural, previewKind } from './format';
import { PreviewStage } from './PreviewStage';
import { ZIP_IN_BROWSER_LIMIT, ZipFileError, saveSeparately, saveZip } from './zip';

const ICON = { strokeWidth: 1.75, className: 'h-4 w-4', 'aria-hidden': true } as const;

type ZipState =
    | { status: 'idle' }
    | { status: 'preparing' }
    | { status: 'zipping'; percent: number; count: number }
    | { status: 'separate'; count: number }
    | { status: 'done'; message: string };

export interface DeliveryViewProps {
    code: string;
    view: VerifiedView;
    onDownloads: (downloadsLeft: number | null, downloadCount: number) => void;
    onFailure: (failure: Failure) => void;
    onSignedOut: () => void;
}

export function DeliveryView({ code, view, onDownloads, onFailure, onSignedOut }: DeliveryViewProps) {
    const { delivery, sender, recipient } = view;
    const files = delivery.files;
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [zip, setZip] = useState<ZipState>({ status: 'idle' });
    const [error, setError] = useState<string | null>(null);
    const [announcement, setAnnouncement] = useState('');
    const abortRef = useRef<AbortController | null>(null);

    const limitReached = recipient.downloadsLeft === 0;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const zipBusy = zip.status === 'preparing' || zip.status === 'zipping' || zip.status === 'separate';

    /** Map a failed call to the right place: a whole-page state, the limit banner, or an inline error. */
    const handleFailure = useCallback(
        (failure: Failure) => {
            if (failure.kind === 'limit') {
                onDownloads(0, recipient.downloadLimit ?? recipient.downloadCount);
                setAnnouncement(failure.message);
            } else if (failure.kind === 'removed' || failure.kind === 'ended' || failure.kind === 'signed-out') {
                onFailure(failure);
            } else {
                setError(failure.message);
            }
        },
        [onDownloads, onFailure, recipient.downloadCount, recipient.downloadLimit],
    );

    const download = async (file: DeliveryFile) => {
        setError(null);
        setDownloadingId(file.id);
        const result = await recipientApi.fileUrl(code, file.id, 'download');
        setDownloadingId(null);
        if ('failure' in result) return handleFailure(result.failure);
        onDownloads(result.data.downloadsLeft, result.data.downloadCount);
        startDownload(result.data.url, file.name);
        setAnnouncement(`Downloading ${file.name}`);
    };

    const downloadAll = async () => {
        setError(null);
        setZip({ status: 'preparing' });
        setAnnouncement('Preparing your download…');
        const result = await recipientApi.downloadAll(code);
        if ('failure' in result) {
            setZip({ status: 'idle' });
            return handleFailure(result.failure);
        }
        onDownloads(result.data.downloadsLeft, result.data.downloadCount);
        const entries = result.data.files;
        const controller = new AbortController();
        abortRef.current = controller;

        if (entries.reduce((sum, e) => sum + e.size, 0) > ZIP_IN_BROWSER_LIMIT) {
            setZip({ status: 'separate', count: entries.length });
            setAnnouncement(`Downloading ${plural(entries.length, 'file')} one at a time`);
            await saveSeparately(entries, { signal: controller.signal });
            setZip({
                status: 'done',
                message: `This delivery is too large to zip in your browser, so we downloaded ${plural(entries.length, 'file')} one at a time.`,
            });
            return;
        }

        let lastPercent = -1;
        setZip({ status: 'zipping', percent: 0, count: entries.length });
        try {
            await saveZip(result.data.zipName, entries, {
                signal: controller.signal,
                onProgress: (fraction) => {
                    const percent = Math.floor(fraction * 100);
                    if (percent === lastPercent) return;
                    lastPercent = percent;
                    setZip({ status: 'zipping', percent, count: entries.length });
                },
            });
            if (controller.signal.aborted) return;
            setZip({ status: 'done', message: `Saved ${result.data.zipName}` });
            setAnnouncement(`Saved ${result.data.zipName}`);
        } catch (err) {
            if (controller.signal.aborted) {
                setZip({ status: 'idle' });
                setAnnouncement('Download canceled');
                return;
            }
            setZip({ status: 'idle' });
            setError(
                err instanceof ZipFileError
                    ? `We couldn't download ${err.fileName}. Check your connection and try again.`
                    : "We couldn't finish the zip. Check your connection and try again.",
            );
        } finally {
            abortRef.current = null;
        }
    };

    const downloadsItem =
        recipient.downloadsLeft === null
            ? []
            : [
                  {
                      icon: Download,
                      text: limitReached ? 'No downloads left' : `${recipient.downloadsLeft} of ${plural(recipient.downloadLimit ?? 0, 'download')} left`,
                      tone: limitReached || recipient.downloadsLeft === 1 ? ('warning' as const) : undefined,
                  },
              ];

    const primary =
        files.length > 1 ? (
            <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                icon={<Download {...ICON} />}
                loading={zipBusy}
                disabled={limitReached}
                onClick={() => void downloadAll()}
            >
                Download all
            </Button>
        ) : files.length === 1 ? (
            <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                icon={<Download {...ICON} />}
                loading={downloadingId === files[0].id}
                disabled={limitReached}
                onClick={() => void download(files[0])}
            >
                Download
            </Button>
        ) : null;

    return (
        <SignedInFrame code={code} sender={sender} onSignedOut={onSignedOut}>
            <p className="sr-only" role="status" aria-live="polite">
                {announcement}
            </p>

            <DeliveryHeading eyebrow={`${sender.name} sent you files`} title={delivery.title} message={delivery.message} actions={primary} />

            <MetaRow
                items={[
                    ...(files.length ? [{ icon: Files, text: `${plural(files.length, 'file')} · ${formatFileSize(totalSize)}` }] : []),
                    ...endsItem(recipient.endsAt),
                    ...downloadsItem,
                ]}
            />

            {limitReached && (
                <Callout tone="warning" title="You've used all your downloads">
                    You can still preview the files. Ask {sender.name} if you need more.
                </Callout>
            )}

            {error && <Callout tone="danger">{error}</Callout>}

            {zip.status === 'zipping' && (
                <Card className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-body text-primary">Zipping {plural(zip.count, 'file')}…</p>
                        <span className="text-body-sm tabular-nums text-secondary">{zip.percent}%</span>
                    </div>
                    <progress
                        value={zip.percent}
                        max={100}
                        aria-label="Zip progress"
                        className="h-1.5 w-full appearance-none overflow-hidden rounded-full bg-raised [&::-moz-progress-bar]:bg-gray-10 [&::-webkit-progress-bar]:bg-raised [&::-webkit-progress-value]:bg-gray-10"
                    />
                    <div className="flex items-center justify-between gap-3">
                        <p className="text-caption text-tertiary">Keep this page open until your browser saves the zip.</p>
                        <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
                            Cancel
                        </Button>
                    </div>
                </Card>
            )}
            {zip.status === 'separate' && <Callout>Downloading {plural(zip.count, 'file')} one at a time…</Callout>}
            {zip.status === 'done' && <Callout tone="success">{zip.message}</Callout>}

            {files.length === 0 ? (
                <Card>
                    <EmptyState
                        icon={Inbox}
                        title="No files here right now"
                        description={`${sender.name} may still be adding them. Check back later, or ask them.`}
                    />
                </Card>
            ) : (
                <Card flush>
                    <ul aria-label="Files" className="divide-y divide-gray-4">
                        {files.map((file, index) => {
                            const canPreview = previewKind(file.mimeType) !== 'none';
                            const busy = downloadingId === file.id;
                            return (
                                <li key={file.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                                    <FileTile mimeType={file.mimeType} />
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewIndex(index)}
                                            className="max-w-full self-start truncate rounded-sm text-left text-body font-medium text-primary underline-offset-4 hover:text-strong hover:underline focus-ring"
                                        >
                                            {file.name}
                                        </button>
                                        <span className="text-caption tabular-nums text-tertiary">{fileMeta(file)}</span>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                                        {/* Labelled buttons from 640px; 40px icon buttons on phones */}
                                        <span className="hidden items-center gap-2 sm:flex">
                                            {canPreview && (
                                                <Button
                                                    icon={<Eye {...ICON} />}
                                                    aria-label={`Preview ${file.name}`}
                                                    onClick={() => setPreviewIndex(index)}
                                                >
                                                    Preview
                                                </Button>
                                            )}
                                            <Button
                                                icon={<Download {...ICON} />}
                                                loading={busy}
                                                disabled={limitReached}
                                                aria-label={`Download ${file.name}`}
                                                onClick={() => void download(file)}
                                            >
                                                Download
                                            </Button>
                                        </span>
                                        <span className="flex items-center gap-1 sm:hidden">
                                            {canPreview && (
                                                <IconButton
                                                    size="lg"
                                                    label={`Preview ${file.name}`}
                                                    icon={<Eye {...ICON} />}
                                                    onClick={() => setPreviewIndex(index)}
                                                />
                                            )}
                                            <IconButton
                                                size="lg"
                                                label={`Download ${file.name}`}
                                                icon={<Download {...ICON} />}
                                                disabled={limitReached || busy}
                                                onClick={() => void download(file)}
                                            />
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}

            {previewIndex !== null && files[previewIndex] && (
                <PreviewStage
                    code={code}
                    files={files}
                    index={previewIndex}
                    onIndexChange={setPreviewIndex}
                    onClose={() => setPreviewIndex(null)}
                    onDownload={(file) => void download(file)}
                    canDownload={!limitReached}
                    downloadingId={downloadingId}
                    onFailure={onFailure}
                />
            )}
        </SignedInFrame>
    );
}
