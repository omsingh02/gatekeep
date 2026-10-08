'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent, type ReactNode } from 'react';
import {
    CloudOff,
    Download,
    Eye,
    Folder as FolderIcon,
    FolderInput,
    FolderOpen,
    FolderPlus,
    FolderX,
    LayoutGrid,
    List,
    LogIn,
    Pencil,
    Search,
    SearchX,
    Send,
    Trash2,
    Upload,
    X,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import {
    Breadcrumb,
    Button,
    Card,
    Checkbox,
    ConfirmDialog,
    EmptyState,
    IconButton,
    Input,
    Menu,
    PageHeader,
    PromptDialog,
    SegmentedControl,
    Select,
    Skeleton,
    TBody,
    TD,
    TH,
    THead,
    TR,
    Table,
    Toolbar,
    Tooltip,
    cn,
    useToast,
    type Crumb,
    type MenuItem,
    type SortDirection,
} from '@/components/ds';
import type { FileMetadata, FileTypeFilter, Folder } from '@/lib/types';
import { useDebouncedValue } from '@/lib/utils/hooks';
import FileUploader from './FileUploader';
import FilePreviewDialog from './files/FilePreviewDialog';
import MoveDialog, { type MoveResult } from './files/MoveDialog';
import { FileTypeIcon } from './files/FileTypeIcon';
import { ApiError, downloadFile, folderError, jsonInit, reason, requestJson } from './files/api';
import { count, describeItems, formatFullDate, formatShortDate, formatSize, sendHref } from './files/format';
import { filesFromDrop, useUploads, type Uploads, type UploadTarget } from './files/useUploads';

const ICON = { 'aria-hidden': true, strokeWidth: 1.75, className: 'h-4 w-4' } as const;
const PAGE_SIZE = 50;

type View = 'table' | 'grid';
type SortKey = 'name' | 'size' | 'modified';
interface Sort {
    key: SortKey;
    dir: 'asc' | 'desc';
}

const SORT_OPTIONS: { value: string; label: string; sort: Sort }[] = [
    { value: 'modified-desc', label: 'Newest first', sort: { key: 'modified', dir: 'desc' } },
    { value: 'modified-asc', label: 'Oldest first', sort: { key: 'modified', dir: 'asc' } },
    { value: 'name-asc', label: 'Name, A to Z', sort: { key: 'name', dir: 'asc' } },
    { value: 'name-desc', label: 'Name, Z to A', sort: { key: 'name', dir: 'desc' } },
    { value: 'size-desc', label: 'Largest first', sort: { key: 'size', dir: 'desc' } },
    { value: 'size-asc', label: 'Smallest first', sort: { key: 'size', dir: 'asc' } },
];

const TYPE_OPTIONS: { value: FileTypeFilter; label: string }[] = [
    { value: 'all', label: 'All types' },
    { value: 'image', label: 'Images' },
    { value: 'video', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'pdf', label: 'PDFs' },
    { value: 'document', label: 'Documents' },
    { value: 'archive', label: 'Archives' },
];

const TYPE_NOUNS: Partial<Record<FileTypeFilter, string>> = {
    image: 'images',
    video: 'videos',
    audio: 'audio files',
    pdf: 'PDFs',
    document: 'documents',
    archive: 'archives',
};

const folderHref = (id: string) => `/admin/files?folder=${encodeURIComponent(id)}`;

// The table/grid choice is remembered on this device
const VIEW_KEY = 'gatekeep:files-view';
const viewStore = {
    subscribe(callback: () => void) {
        window.addEventListener('storage', callback);
        window.addEventListener(VIEW_KEY, callback);
        return () => {
            window.removeEventListener('storage', callback);
            window.removeEventListener(VIEW_KEY, callback);
        };
    },
    get: (): View => (window.localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'table'),
    set(view: View) {
        window.localStorage.setItem(VIEW_KEY, view);
        window.dispatchEvent(new Event(VIEW_KEY));
    },
};

type Location = { status: 'loading' } | { status: 'missing' | 'error' } | { status: 'ready'; name: string; path: { id: string; name: string }[] };

/**
 * The Files page: folders and files in the current folder, upload, preview, send, rename, move
 * and delete. The folder comes from the URL (?folder=id) so breadcrumbs are plain links.
 */
export default function FileList({ folderId, startUpload = false }: { folderId: string | null; startUpload?: boolean }) {
    const router = useRouter();
    const toast = useToast();
    const view = useSyncExternalStore(viewStore.subscribe, viewStore.get, () => 'table' as View);
    const [sort, setSort] = useState<Sort>({ key: 'modified', dir: 'desc' });
    const [reloadKey, setReloadKey] = useState(0);
    const reload = () => setReloadKey((k) => k + 1);

    // The upload dialog can open straight away (?upload=1, e.g. from the Overview guide)
    const [uploadOpen, setUploadOpen] = useState(startUpload);
    const uploadOpenRef = useRef(uploadOpen);
    useEffect(() => {
        uploadOpenRef.current = uploadOpen;
    }, [uploadOpen]);
    useEffect(() => {
        if (startUpload) router.replace(folderId ? folderHref(folderId) : '/admin/files', { scroll: false });
    }, [startUpload, folderId, router]);

    const uploads = useUploads({
        onUploaded: reload,
        onSettled: (items) => {
            // With the dialog open, its own summary says what happened
            if (uploadOpenRef.current) return;
            const done = items.filter((item) => item.status === 'done');
            const failed = items.filter((item) => item.status === 'error').length;
            if (done.length > 0) {
                const folders = new Set(done.map((item) => item.folderName));
                const ids = done.flatMap((item) => (item.fileId ? [item.fileId] : []));
                toast.success(`Uploaded ${count(done.length, 'file')}${folders.size === 1 ? ` to ${done[0].folderName}` : ''}`, {
                    action: { label: 'Send', onClick: () => router.push(sendHref(ids)) },
                });
            }
            if (failed > 0) {
                toast.error(`${failed === 1 ? "1 file couldn't" : `${failed} files couldn't`} be uploaded. Open Upload to see why and retry.`);
            }
            uploads.clearUploaded();
        },
    });

    const [fetched, setFetched] = useState<({ id: string } & Location) | null>(null);
    useEffect(() => {
        if (!folderId) return;
        const controller = new AbortController();
        requestJson<{ folder: Folder }>(`/api/folders/${encodeURIComponent(folderId)}`, { signal: controller.signal })
            .then(({ folder }) => setFetched({ id: folderId, status: 'ready', name: folder.name, path: folder.path ?? [{ id: folder.id, name: folder.name }] }))
            .catch((error) => {
                if (controller.signal.aborted) return;
                setFetched({ id: folderId, status: error instanceof ApiError && error.status === 404 ? 'missing' : 'error' });
            });
        return () => controller.abort();
    }, [folderId]);

    const location: Location = !folderId
        ? { status: 'ready', name: 'All files', path: [] }
        : fetched?.id === folderId
          ? fetched
          : { status: 'loading' };
    const target: UploadTarget = { id: folderId, name: location.status === 'ready' ? location.name : 'this folder' };

    return (
        <>
            <FolderBrowser
                key={folderId ?? 'root'}
                folderId={folderId}
                location={location}
                target={target}
                view={view}
                sort={sort}
                onSort={setSort}
                reloadKey={reloadKey}
                onReload={reload}
                uploads={uploads}
                onUpload={() => setUploadOpen(true)}
            />
            <FileUploader open={uploadOpen} onClose={() => setUploadOpen(false)} target={target} uploads={uploads} />
        </>
    );
}

type DialogState =
    | { type: 'new-folder' }
    | { type: 'rename-file'; file: FileMetadata }
    | { type: 'rename-folder'; folder: Folder }
    | { type: 'delete-file'; file: FileMetadata }
    | { type: 'delete-folder'; folder: Folder }
    | { type: 'delete-selection'; files: FileMetadata[]; folders: Folder[] }
    | { type: 'move'; files: FileMetadata[]; folders: Folder[] }
    | null;

type Result =
    | { key: string; status: 'ready'; files: FileMetadata[]; folders: Folder[]; total: number; totalPages: number }
    | { key: string; status: 'error'; signedOut: boolean };

interface FolderBrowserProps {
    folderId: string | null;
    location: Location;
    target: UploadTarget;
    view: View;
    sort: Sort;
    onSort: (sort: Sort) => void;
    reloadKey: number;
    onReload: () => void;
    uploads: Uploads;
    onUpload: () => void;
}

function FolderBrowser({ folderId, location, target, view, sort, onSort, reloadKey, onReload, uploads, onUpload }: FolderBrowserProps) {
    const router = useRouter();
    const toast = useToast();
    const [search, setSearch] = useState('');
    const query = useDebouncedValue(search.trim(), 250);
    const [type, setType] = useState<FileTypeFilter>('all');
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<Result | null>(null);
    const [selection, setSelection] = useState<{ key: string; files: Set<string>; folders: Set<string> } | null>(null);
    const [dialog, setDialog] = useState<DialogState>(null);
    const [preview, setPreview] = useState<{ file: FileMetadata; key: number } | null>(null);
    const [dragging, setDragging] = useState(false);

    const queryKey = [folderId, query, type, sort.key, sort.dir, page].join('|');

    useEffect(() => {
        const controller = new AbortController();
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page), sort: sort.key, order: sort.dir });
        if (folderId) params.set('folderId', folderId);
        if (query) params.set('search', query);
        if (type !== 'all') params.set('fileType', type);
        const folderParams = folderId ? `?parentId=${encodeURIComponent(folderId)}` : '';
        Promise.all([
            requestJson<{ files: FileMetadata[]; totalCount: number; totalPages: number }>(`/api/files?${params}`, { signal: controller.signal }),
            requestJson<{ folders: Folder[] }>(`/api/folders${folderParams}`, { signal: controller.signal }),
        ])
            .then(([files, folders]) =>
                setResult({ key: queryKey, status: 'ready', files: files.files, folders: folders.folders, total: files.totalCount, totalPages: files.totalPages })
            )
            .catch((error) => {
                if (!controller.signal.aborted) setResult({ key: queryKey, status: 'error', signedOut: error instanceof ApiError && error.status === 401 });
            });
        return () => controller.abort();
    }, [folderId, query, type, sort.key, sort.dir, page, queryKey, reloadKey]);

    const filtering = search.trim() !== '' || query !== '' || type !== 'all';
    const ready = result?.status === 'ready' ? result : null;
    const stale = result !== null && result.key !== queryKey;

    const files = ready?.files ?? [];
    const folders = page === 1 && ready ? sortFolders(filterFolders(ready.folders, query, type), sort) : [];

    const current = selection?.key === queryKey ? selection : null;
    const selectedFiles = files.filter((f) => current?.files.has(f.id));
    const selectedFolders = folders.filter((f) => current?.folders.has(f.id));
    const selectedCount = selectedFiles.length + selectedFolders.length;
    const allSelected = files.length + folders.length > 0 && selectedCount === files.length + folders.length;
    // Nothing here at all: no toolbar, just the empty state
    const empty = ready !== null && !stale && files.length === 0 && folders.length === 0;

    const toggle = (kind: 'files' | 'folders', id: string) =>
        setSelection((prev) => {
            const base = prev?.key === queryKey ? prev : { key: queryKey, files: new Set<string>(), folders: new Set<string>() };
            const next = new Set(base[kind]);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return { ...base, [kind]: next };
        });
    const toggleAll = () =>
        setSelection(
            allSelected
                ? null
                : { key: queryKey, files: new Set(files.map((f) => f.id)), folders: new Set(folders.map((f) => f.id)) }
        );
    const clearSelection = () => setSelection(null);

    const sortBy = (key: SortKey) =>
        onSort(sort.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' });
    const thSort = (key: SortKey): SortDirection => (sort.key === key ? sort.dir : null);

    // Actions -----------------------------------------------------------------------------------
    const openPreview = (file: FileMetadata) => setPreview({ file, key: Date.now() });
    const send = (ids: string[]) => router.push(sendHref(ids));
    const download = async (file: FileMetadata) => {
        try {
            await downloadFile(file.id);
        } catch (error) {
            toast.error(`We couldn't download ${file.originalFilename}. ${reason(error)}`);
        }
    };

    const createFolder = async (name: string) => {
        try {
            const { folder } = await requestJson<{ folder: Folder }>('/api/folders', jsonInit('POST', { name, parentId: folderId }));
            toast.success(`Created ${folder.name}`);
            setDialog(null);
            onReload();
        } catch (error) {
            toast.error(folderError(error, name, 'create'));
        }
    };

    const renameFile = async (file: FileMetadata, name: string) => {
        try {
            const { file: updated } = await requestJson<{ file: { original_filename: string } }>(`/api/files/${file.id}`, jsonInit('PATCH', { name }));
            toast.success(`Renamed ${file.originalFilename} to ${updated.original_filename}`);
            setDialog(null);
            onReload();
        } catch (error) {
            toast.error(`We couldn't rename ${file.originalFilename}. ${reason(error)}`);
        }
    };

    const renameFolder = async (folder: Folder, name: string) => {
        try {
            const { folder: updated } = await requestJson<{ folder: Folder }>(`/api/folders/${folder.id}`, jsonInit('PATCH', { name }));
            toast.success(`Renamed ${folder.name} to ${updated.name}`);
            setDialog(null);
            onReload();
        } catch (error) {
            toast.error(folderError(error, name, 'rename'));
        }
    };

    const deleteItems = async (filesToDelete: FileMetadata[], foldersToDelete: Folder[]) => {
        let failed = 0;
        for (const file of filesToDelete) {
            try {
                await requestJson(`/api/files/${file.id}`, { method: 'DELETE' });
            } catch {
                failed += 1;
            }
        }
        for (const folder of foldersToDelete) {
            try {
                await requestJson(`/api/folders/${folder.id}`, { method: 'DELETE' });
            } catch {
                failed += 1;
            }
        }
        const total = filesToDelete.length + foldersToDelete.length;
        const name = total === 1 ? (filesToDelete[0]?.originalFilename ?? foldersToDelete[0]?.name) : describeItems(filesToDelete.length, foldersToDelete.length);
        if (failed === 0) toast.success(`Deleted ${name}`);
        else if (failed === total) toast.error(`We couldn't delete ${name}. Try again.`);
        else toast.warning(`Deleted ${total - failed} of ${total} items. ${failed} couldn't be deleted. Try again.`);
        setDialog(null);
        clearSelection();
        onReload();
    };

    const onMoved = ({ moved, failed, destination, error }: MoveResult) => {
        if (failed === 0) toast.success(`Moved ${moved === 1 ? (dialog?.type === 'move' ? (dialog.files[0]?.originalFilename ?? dialog.folders[0]?.name) : 'it') : `${moved} items`} to ${destination}`);
        else if (moved === 0) toast.error(error ?? `We couldn't move those items. Try again.`);
        else toast.warning(`Moved ${moved} of ${moved + failed} items to ${destination}. ${error ?? ''}`.trim());
        setDialog(null);
        clearSelection();
        onReload();
    };

    const fileMenu = (file: FileMetadata, withSend = false): MenuItem[] => [
        ...(withSend ? [{ label: 'Send', icon: <Send {...ICON} />, onSelect: () => send([file.id]) }] : []),
        { label: 'Preview', icon: <Eye {...ICON} />, onSelect: () => openPreview(file) },
        { label: 'Download', icon: <Download {...ICON} />, onSelect: () => void download(file) },
        { label: 'Rename', icon: <Pencil {...ICON} />, onSelect: () => setDialog({ type: 'rename-file', file }) },
        { label: 'Move', icon: <FolderInput {...ICON} />, onSelect: () => setDialog({ type: 'move', files: [file], folders: [] }) },
        { type: 'separator' },
        { label: 'Delete', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setDialog({ type: 'delete-file', file }) },
    ];

    const folderMenu = (folder: Folder): MenuItem[] => [
        { label: 'Open', icon: <FolderOpen {...ICON} />, onSelect: () => router.push(folderHref(folder.id)) },
        { label: 'Rename', icon: <Pencil {...ICON} />, onSelect: () => setDialog({ type: 'rename-folder', folder }) },
        { label: 'Move', icon: <FolderInput {...ICON} />, onSelect: () => setDialog({ type: 'move', files: [], folders: [folder] }) },
        { type: 'separator' },
        { label: 'Delete', icon: <Trash2 {...ICON} />, danger: true, onSelect: () => setDialog({ type: 'delete-folder', folder }) },
    ];

    // Dropping files anywhere on the page uploads them here
    const onDragEnter = (event: DragEvent) => {
        if (!event.dataTransfer.types.includes('Files') || location.status !== 'ready') return;
        event.preventDefault();
        setDragging(true);
    };
    const onDrop = async (event: DragEvent) => {
        if (!dragging) return;
        event.preventDefault();
        setDragging(false);
        const { files: dropped, folderName } = await filesFromDrop(event.dataTransfer);
        if (dropped.length === 0) return;
        onUpload();
        if (folderName) {
            try {
                await uploads.enqueueFolder(folderName, dropped, target);
            } catch (error) {
                toast.error(`We couldn't create the folder ${folderName}. ${reason(error)}`);
            }
        } else {
            uploads.enqueue(dropped, target);
        }
    };

    // Rendering ---------------------------------------------------------------------------------
    const locationName = location.status === 'ready' ? location.name : null;
    const crumbs: Crumb[] =
        location.status === 'ready'
            ? location.path.length === 0
                ? [{ label: 'All files' }]
                : [
                      { label: 'All files', href: '/admin/files' },
                      ...location.path.slice(0, -1).map((p) => ({ label: p.name, href: folderHref(p.id) })),
                      { label: location.name },
                  ]
            : [{ label: 'All files', href: '/admin/files' }, { label: location.status === 'loading' ? <Skeleton className="h-3.5 w-24" /> : 'Folder not found' }];

    let content: ReactNode;
    if (location.status === 'missing') {
        content = (
            <Card flush>
                <EmptyState
                    icon={FolderX}
                    title="This folder doesn't exist"
                    description="It may have been deleted, or the link is out of date."
                    action={
                        <Button variant="secondary" onClick={() => router.push('/admin/files')}>
                            Go to All files
                        </Button>
                    }
                />
            </Card>
        );
    } else if (result?.status === 'error' && !stale && result.signedOut) {
        content = (
            <Card flush>
                <EmptyState
                    icon={LogIn}
                    title="You were signed out"
                    description="Sign in again to see your files."
                    action={<Button onClick={() => router.push('/login')}>Sign in</Button>}
                />
            </Card>
        );
    } else if (location.status === 'error' || (result?.status === 'error' && !stale)) {
        content = (
            <Card flush>
                <EmptyState
                    icon={CloudOff}
                    title="We couldn't load your files"
                    description="Check your connection and try again."
                    action={<Button onClick={onReload}>Try again</Button>}
                />
            </Card>
        );
    } else if (!ready) {
        content = view === 'grid' ? <GridSkeleton /> : <TableSkeleton sortBy={sortBy} thSort={thSort} />;
    } else if (files.length === 0 && folders.length === 0) {
        content = (
            <Card flush>
                {filtering ? (
                    <EmptyState
                        icon={SearchX}
                        title={query ? `No files match “${query}”` : `No ${TYPE_NOUNS[type] ?? 'files'} here`}
                        description={folderId ? `Try another name or type, or search from All files.` : 'Try another name or file type.'}
                        action={
                            <Button
                                onClick={() => {
                                    setSearch('');
                                    setType('all');
                                    setPage(1);
                                }}
                            >
                                Clear filters
                            </Button>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={folderId ? FolderOpen : Upload}
                        title={folderId ? 'This folder is empty' : 'No files yet'}
                        description={
                            folderId
                                ? 'Upload files here, or move files in from another folder.'
                                : 'Upload the files you want to send. They stay private until you deliver them.'
                        }
                        action={
                            <Button icon={<Upload {...ICON} />} onClick={onUpload}>
                                Upload files
                            </Button>
                        }
                    />
                )}
            </Card>
        );
    } else {
        const shared = {
            files,
            folders,
            selectedFiles: current?.files,
            selectedFolders: current?.folders,
            onToggle: toggle,
            onPreview: openPreview,
            onSend: send,
            fileMenu,
            folderMenu,
            showFolderOf: query !== '' && !folderId,
        };
        content = (
            <div className={cn('transition-opacity', stale && 'opacity-60')} aria-busy={stale || undefined}>
                {view === 'table' ? (
                    <FilesTable {...shared} allSelected={allSelected} someSelected={selectedCount > 0} onToggleAll={toggleAll} sortBy={sortBy} thSort={thSort} />
                ) : (
                    <FilesGrid {...shared} />
                )}
            </div>
        );
    }

    const totalPages = ready?.totalPages ?? 1;

    return (
        <div
            className="relative flex flex-col gap-6"
            onDragEnter={onDragEnter}
            onDragOver={(event) => dragging && event.preventDefault()}
            onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(event) => void onDrop(event)}
        >
            <PageHeader
                title="Files"
                description="Files stay private until you deliver them."
                actions={
                    <>
                        <Button icon={<FolderPlus {...ICON} />} onClick={() => setDialog({ type: 'new-folder' })} disabled={location.status !== 'ready'}>
                            New folder
                        </Button>
                        <Button variant="primary" icon={<Upload {...ICON} />} onClick={onUpload} disabled={location.status !== 'ready'}>
                            Upload
                        </Button>
                    </>
                }
            />

            <div className="flex flex-col gap-3">
                <Breadcrumb items={crumbs} />

                {selectedCount > 0 ? (
                    <div role="toolbar" aria-label="Selected items" className="flex min-h-8 flex-wrap items-center gap-2">
                        <span className="mr-1 text-body-sm font-medium tabular-nums text-strong" aria-live="polite">
                            {selectedCount} selected
                        </span>
                        {selectedFiles.length > 0 ? (
                            <Button icon={<Send {...ICON} />} onClick={() => send(selectedFiles.map((f) => f.id))}>
                                Send
                            </Button>
                        ) : (
                            <Tooltip content="Select files to send. Folders can't be sent yet.">
                                <Button icon={<Send {...ICON} />} disabled>
                                    Send
                                </Button>
                            </Tooltip>
                        )}
                        <Button icon={<FolderInput {...ICON} />} onClick={() => setDialog({ type: 'move', files: selectedFiles, folders: selectedFolders })}>
                            Move
                        </Button>
                        <Button
                            variant="danger"
                            icon={<Trash2 {...ICON} />}
                            onClick={() => setDialog({ type: 'delete-selection', files: selectedFiles, folders: selectedFolders })}
                        >
                            Delete
                        </Button>
                        <Button variant="ghost" className="ml-auto" icon={<X {...ICON} />} onClick={clearSelection}>
                            Clear selection
                        </Button>
                    </div>
                ) : empty && !filtering ? null : (
                    <Toolbar>
                        <div className="w-full sm:w-72">
                            <Input
                                aria-label={folderId ? `Search in ${locationName ?? 'this folder'}` : 'Search all files'}
                                placeholder={folderId ? `Search in ${locationName ?? 'this folder'}` : 'Search all files'}
                                leading={<Search {...ICON} />}
                                value={search}
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape' && search) setSearch('');
                                }}
                                trailing={
                                    search ? (
                                        <IconButton
                                            size="sm"
                                            label="Clear search"
                                            icon={<X {...ICON} />}
                                            onClick={() => {
                                                setSearch('');
                                                setPage(1);
                                            }}
                                        />
                                    ) : undefined
                                }
                            />
                        </div>
                        <div className="min-w-0 flex-1 sm:w-36 sm:flex-none">
                            <Select
                                aria-label="File type"
                                value={type}
                                onChange={(event) => {
                                    setType(event.target.value as FileTypeFilter);
                                    setPage(1);
                                }}
                            >
                                {TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <div className="min-w-0 flex-1 sm:w-40 sm:flex-none">
                            <Select
                                aria-label="Sort files"
                                value={`${sort.key}-${sort.dir}`}
                                onChange={(event) => {
                                    const option = SORT_OPTIONS.find((o) => o.value === event.target.value);
                                    if (option) onSort(option.sort);
                                    setPage(1);
                                }}
                            >
                                {SORT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                        <SegmentedControl
                            className="sm:ml-auto"
                            label="View"
                            value={view}
                            onChange={viewStore.set}
                            options={[
                                { value: 'table', label: <span className="sr-only sm:not-sr-only">Table</span>, icon: <List {...ICON} /> },
                                { value: 'grid', label: <span className="sr-only sm:not-sr-only">Grid</span>, icon: <LayoutGrid {...ICON} /> },
                            ]}
                        />
                    </Toolbar>
                )}

                {content}

                {ready && (files.length > 0 || folders.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-caption tabular-nums text-tertiary">
                            {[folders.length > 0 && count(folders.length, 'folder'), ready.total > 0 && count(ready.total, 'file')].filter(Boolean).join(' · ')}
                            {query && !folderId ? ' in all folders' : ''}
                        </p>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-2">
                                <span className="text-caption tabular-nums text-secondary">
                                    Page {page} of {totalPages}
                                </span>
                                <Button size="sm" icon={<ChevronLeft {...ICON} />} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                                    Previous
                                </Button>
                                <Button size="sm" iconRight={<ChevronRight {...ICON} />} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                                    Next
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {dragging && (
                <div aria-hidden className="pointer-events-none absolute -inset-2 z-20 flex items-center justify-center rounded-lg border border-dashed border-gray-8 bg-canvas/90">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-default bg-raised text-secondary">
                            <Upload aria-hidden strokeWidth={1.75} className="h-5 w-5" />
                        </span>
                        <p className="text-h3 text-strong">Drop to upload to {locationName}</p>
                    </div>
                </div>
            )}

            {/* Dialogs: one at a time */}
            <PromptDialog
                open={dialog?.type === 'new-folder'}
                onClose={() => setDialog(null)}
                title="New folder"
                label="Folder name"
                placeholder="Contracts"
                submitLabel="Create folder"
                validate={(value) =>
                    (ready?.folders ?? []).some((f) => f.name.toLowerCase() === value.trim().toLowerCase())
                        ? `There's already a folder named ${value.trim()} here.`
                        : null
                }
                onSubmit={createFolder}
            />
            <PromptDialog
                open={dialog?.type === 'rename-file'}
                onClose={() => setDialog(null)}
                title="Rename file"
                label="Name"
                initialValue={dialog?.type === 'rename-file' ? dialog.file.originalFilename : ''}
                submitLabel="Rename file"
                onSubmit={(name) => (dialog?.type === 'rename-file' ? renameFile(dialog.file, name) : undefined)}
            />
            <PromptDialog
                open={dialog?.type === 'rename-folder'}
                onClose={() => setDialog(null)}
                title="Rename folder"
                label="Folder name"
                initialValue={dialog?.type === 'rename-folder' ? dialog.folder.name : ''}
                submitLabel="Rename folder"
                onSubmit={(name) => (dialog?.type === 'rename-folder' ? renameFolder(dialog.folder, name) : undefined)}
            />
            <ConfirmDialog
                open={dialog?.type === 'delete-file'}
                onClose={() => setDialog(null)}
                destructive
                title={dialog?.type === 'delete-file' ? `Delete ${dialog.file.originalFilename}?` : ''}
                confirmLabel="Delete file"
                onConfirm={() => (dialog?.type === 'delete-file' ? deleteItems([dialog.file], []) : undefined)}
            >
                Anyone with a delivery that includes it will lose access to this file. This can&apos;t be undone.
            </ConfirmDialog>
            <ConfirmDialog
                open={dialog?.type === 'delete-folder'}
                onClose={() => setDialog(null)}
                destructive
                title={dialog?.type === 'delete-folder' ? `Delete ${dialog.folder.name}?` : ''}
                confirmLabel="Delete folder"
                onConfirm={() => (dialog?.type === 'delete-folder' ? deleteItems([], [dialog.folder]) : undefined)}
            >
                The folder and any folders inside it are deleted. The files in them move to All files, so no delivery loses a file.
            </ConfirmDialog>
            <ConfirmDialog
                open={dialog?.type === 'delete-selection'}
                onClose={() => setDialog(null)}
                destructive
                title={dialog?.type === 'delete-selection' ? `Delete ${describeItems(dialog.files.length, dialog.folders.length)}?` : ''}
                confirmLabel={dialog?.type === 'delete-selection' ? `Delete ${describeItems(dialog.files.length, dialog.folders.length)}` : 'Delete'}
                onConfirm={() => (dialog?.type === 'delete-selection' ? deleteItems(dialog.files, dialog.folders) : undefined)}
            >
                {dialog?.type === 'delete-selection' && (
                    <>
                        {dialog.files.length > 0 && 'Anyone with a delivery that includes these files will lose access to them. '}
                        {dialog.folders.length > 0 && 'Files inside the folders move to All files. '}
                        {dialog.files.length > 0 && "This can't be undone."}
                    </>
                )}
            </ConfirmDialog>
            {dialog?.type === 'move' && (
                <MoveDialog
                    files={dialog.files.map((f) => ({ id: f.id, name: f.originalFilename, folderId: f.folderId ?? null }))}
                    folders={dialog.folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId }))}
                    onClose={() => setDialog(null)}
                    onDone={onMoved}
                />
            )}
            {preview && <FilePreviewDialog key={preview.key} file={preview.file} onClose={() => setPreview(null)} />}
        </div>
    );
}

// Table and grid --------------------------------------------------------------------------------

interface ItemsProps {
    files: FileMetadata[];
    folders: Folder[];
    selectedFiles?: Set<string>;
    selectedFolders?: Set<string>;
    onToggle: (kind: 'files' | 'folders', id: string) => void;
    onPreview: (file: FileMetadata) => void;
    onSend: (ids: string[]) => void;
    fileMenu: (file: FileMetadata, withSend?: boolean) => MenuItem[];
    folderMenu: (folder: Folder) => MenuItem[];
    /** Searching across All files: say which folder each file is in */
    showFolderOf: boolean;
}

function FilesTable({
    files,
    folders,
    selectedFiles,
    selectedFolders,
    onToggle,
    onPreview,
    onSend,
    fileMenu,
    folderMenu,
    showFolderOf,
    allSelected,
    someSelected,
    onToggleAll,
    sortBy,
    thSort,
}: ItemsProps & {
    allSelected: boolean;
    someSelected: boolean;
    onToggleAll: () => void;
    sortBy: (key: SortKey) => void;
    thSort: (key: SortKey) => SortDirection;
}) {
    return (
        <Card flush className="overflow-hidden">
            <Table>
                <THead>
                    <tr>
                        <TH className="w-10 pr-0">
                            <Checkbox className="flex" aria-label="Select all" checked={allSelected} indeterminate={someSelected && !allSelected} onChange={onToggleAll} />
                        </TH>
                        <TH sort={thSort('name')} onSort={() => sortBy('name')}>
                            Name
                        </TH>
                        <TH numeric className="hidden sm:table-cell" sort={thSort('size')} onSort={() => sortBy('size')}>
                            Size
                        </TH>
                        <TH className="hidden sm:table-cell" sort={thSort('modified')} onSort={() => sortBy('modified')}>
                            Modified
                        </TH>
                        <TH className="w-px">
                            <span className="sr-only">Actions</span>
                        </TH>
                    </tr>
                </THead>
                <TBody>
                    {folders.map((folder) => {
                        const selected = selectedFolders?.has(folder.id) ?? false;
                        return (
                            <TR key={folder.id} selected={selected} className="hover:bg-raised">
                                <TD className="pr-0">
                                    <Checkbox className="flex" aria-label={`Select ${folder.name}`} checked={selected} onChange={() => onToggle('folders', folder.id)} />
                                </TD>
                                <TD strong className="w-full max-w-0">
                                    <Link
                                        href={folderHref(folder.id)}
                                        className="flex min-w-0 items-center gap-2.5 rounded-sm font-medium text-primary underline-offset-4 hover:text-strong hover:underline focus-ring"
                                    >
                                        <FolderIcon aria-hidden strokeWidth={1.75} className="h-4 w-4 shrink-0 text-secondary" />
                                        <span className="truncate">{folder.name}</span>
                                    </Link>
                                </TD>
                                <TD numeric className="hidden whitespace-nowrap text-tertiary sm:table-cell">
                                    <span aria-hidden>—</span>
                                </TD>
                                <TD className="hidden whitespace-nowrap sm:table-cell">
                                    <time dateTime={folder.updatedAt} title={formatFullDate(folder.updatedAt)}>
                                        {formatShortDate(folder.updatedAt)}
                                    </time>
                                </TD>
                                <TD className="whitespace-nowrap py-1.5!">
                                    <div className="flex items-center justify-end gap-1">
                                        <Menu label={`More actions for ${folder.name}`} items={folderMenu(folder)} />
                                    </div>
                                </TD>
                            </TR>
                        );
                    })}
                    {files.map((file) => {
                        const selected = selectedFiles?.has(file.id) ?? false;
                        const folderName = showFolderOf ? (file.folderName ?? 'All files') : null;
                        return (
                            <TR key={file.id} selected={selected} className="hover:bg-raised">
                                <TD className="pr-0">
                                    <Checkbox className="flex" aria-label={`Select ${file.originalFilename}`} checked={selected} onChange={() => onToggle('files', file.id)} />
                                </TD>
                                <TD strong className="w-full max-w-0">
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <FileTypeIcon mimeType={file.mimeType} name={file.originalFilename} />
                                        <div className="min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => onPreview(file)}
                                                title={file.originalFilename}
                                                className="block max-w-full truncate rounded-sm text-left text-primary underline-offset-4 hover:text-strong hover:underline focus-ring"
                                            >
                                                {file.originalFilename}
                                            </button>
                                            <p className={cn('truncate text-caption tabular-nums text-tertiary', !folderName && 'sm:hidden')}>
                                                <span className="sm:hidden">
                                                    {formatSize(file.fileSize)} · {formatShortDate(file.updatedAt)}
                                                    {folderName && ' · '}
                                                </span>
                                                {folderName && `In ${folderName}`}
                                            </p>
                                        </div>
                                    </div>
                                </TD>
                                <TD numeric className="hidden whitespace-nowrap sm:table-cell">
                                    {formatSize(file.fileSize)}
                                </TD>
                                <TD className="hidden whitespace-nowrap sm:table-cell">
                                    <time dateTime={file.updatedAt} title={formatFullDate(file.updatedAt)}>
                                        {formatShortDate(file.updatedAt)}
                                    </time>
                                </TD>
                                <TD className="whitespace-nowrap py-1.5!">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button size="sm" icon={<Send {...ICON} />} aria-label={`Send ${file.originalFilename}`} onClick={() => onSend([file.id])}>
                                            Send
                                        </Button>
                                        <Menu label={`More actions for ${file.originalFilename}`} items={fileMenu(file)} />
                                    </div>
                                </TD>
                            </TR>
                        );
                    })}
                </TBody>
            </Table>
        </Card>
    );
}

function FilesGrid({ files, folders, selectedFiles, selectedFolders, onToggle, onPreview, fileMenu, folderMenu, showFolderOf }: ItemsProps) {
    const anySelected = (selectedFiles?.size ?? 0) + (selectedFolders?.size ?? 0) > 0;
    return (
        <div className="flex flex-col gap-6">
            {folders.length > 0 && (
                <section aria-label="Folders">
                    <h2 className="mb-2 text-caption font-medium text-secondary">Folders</h2>
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {folders.map((folder) => {
                            const selected = selectedFolders?.has(folder.id) ?? false;
                            return (
                                <li
                                    key={folder.id}
                                    className={cn(
                                        'group relative flex h-12 items-center gap-2.5 rounded-lg border pl-3 pr-1 transition-colors',
                                        selected ? 'border-gray-8 bg-raised' : 'border-default bg-surface hover:border-strong'
                                    )}
                                >
                                    <Checkbox
                                        aria-label={`Select ${folder.name}`}
                                        checked={selected}
                                        onChange={() => onToggle('folders', folder.id)}
                                        className="relative z-10 flex"
                                    />
                                    <FolderIcon aria-hidden strokeWidth={1.75} className="h-4 w-4 shrink-0 text-secondary" />
                                    <Link
                                        href={folderHref(folder.id)}
                                        className="min-w-0 flex-1 truncate rounded-sm text-body-sm font-medium text-primary after:absolute after:inset-0 after:rounded-lg focus-ring"
                                    >
                                        {folder.name}
                                    </Link>
                                    <div className="relative z-10">
                                        <Menu label={`More actions for ${folder.name}`} items={folderMenu(folder)} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
            {files.length > 0 && (
                <section aria-label="Files">
                    {folders.length > 0 && <h2 className="mb-2 text-caption font-medium text-secondary">Files</h2>}
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {files.map((file) => {
                            const selected = selectedFiles?.has(file.id) ?? false;
                            return (
                                <li
                                    key={file.id}
                                    className={cn(
                                        'group relative flex flex-col overflow-hidden rounded-lg border transition-colors',
                                        selected ? 'border-gray-8 bg-raised' : 'border-default bg-surface hover:border-strong'
                                    )}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onPreview(file)}
                                        aria-label={`Preview ${file.originalFilename}`}
                                        className="flex aspect-[4/3] items-center justify-center bg-inset focus-ring [outline-offset:-2px]"
                                    >
                                        <FileTypeIcon mimeType={file.mimeType} name={file.originalFilename} className="h-8 w-8 text-tertiary" />
                                    </button>
                                    <div
                                        className={cn(
                                            'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-default bg-surface transition-opacity',
                                            !selected && !anySelected && 'sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100'
                                        )}
                                    >
                                        <Checkbox className="flex" aria-label={`Select ${file.originalFilename}`} checked={selected} onChange={() => onToggle('files', file.id)} />
                                    </div>
                                    <div className="flex items-start gap-1 border-t border-subtle py-2 pl-3 pr-1">
                                        <div className="min-w-0 flex-1 py-0.5">
                                            <p className="truncate text-body-sm text-primary" title={file.originalFilename}>
                                                {file.originalFilename}
                                            </p>
                                            <p className="truncate text-caption tabular-nums text-tertiary">
                                                {showFolderOf
                                                    ? `In ${file.folderName ?? 'All files'}`
                                                    : `${formatSize(file.fileSize)} · ${formatShortDate(file.updatedAt)}`}
                                            </p>
                                        </div>
                                        <Menu label={`More actions for ${file.originalFilename}`} items={fileMenu(file, true)} />
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}
        </div>
    );
}

function TableSkeleton({ sortBy, thSort }: { sortBy: (key: SortKey) => void; thSort: (key: SortKey) => SortDirection }) {
    const widths = ['w-48', 'w-36', 'w-56', 'w-40', 'w-32', 'w-52', 'w-44', 'w-28'];
    return (
        <Card flush className="overflow-hidden" aria-label="Loading files" role="status">
            <Table>
                <THead>
                    <tr>
                        <TH className="w-10 pr-0">
                            <Skeleton className="h-4 w-4 rounded-sm" />
                        </TH>
                        <TH sort={thSort('name')} onSort={() => sortBy('name')}>
                            Name
                        </TH>
                        <TH numeric className="hidden sm:table-cell" sort={thSort('size')} onSort={() => sortBy('size')}>
                            Size
                        </TH>
                        <TH className="hidden sm:table-cell" sort={thSort('modified')} onSort={() => sortBy('modified')}>
                            Modified
                        </TH>
                        <TH className="w-px">
                            <span className="sr-only">Actions</span>
                        </TH>
                    </tr>
                </THead>
                <TBody>
                    {widths.map((width) => (
                        <TR key={width}>
                            <TD className="pr-0">
                                <Skeleton className="h-4 w-4 rounded-sm" />
                            </TD>
                            <TD className="w-full max-w-0">
                                <div className="flex items-center gap-2.5">
                                    <Skeleton className="h-4 w-4 shrink-0" />
                                    <Skeleton className={cn('h-3 max-w-full', width)} />
                                </div>
                            </TD>
                            <TD className="hidden sm:table-cell">
                                <Skeleton className="ml-auto h-3 w-14" />
                            </TD>
                            <TD className="hidden sm:table-cell">
                                <Skeleton className="h-3 w-12" />
                            </TD>
                            <TD className="py-1.5!">
                                <div className="flex items-center justify-end gap-1">
                                    <Skeleton className="h-7 w-[4.75rem]" />
                                    <Skeleton className="h-8 w-8" />
                                </div>
                            </TD>
                        </TR>
                    ))}
                </TBody>
            </Table>
        </Card>
    );
}

function GridSkeleton() {
    return (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="Loading files" role="status">
            {Array.from({ length: 10 }, (_, i) => (
                <li key={i} className="overflow-hidden rounded-lg border border-default bg-surface">
                    <Skeleton className="aspect-[4/3] w-full rounded-none" />
                    <div className="flex flex-col gap-2 border-t border-subtle p-3">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                </li>
            ))}
        </ul>
    );
}

// Helpers ---------------------------------------------------------------------------------------

function filterFolders(folders: Folder[], query: string, type: FileTypeFilter): Folder[] {
    if (type !== 'all') return [];
    if (!query) return folders;
    const q = query.toLowerCase();
    return folders.filter((f) => f.name.toLowerCase().includes(q));
}

function sortFolders(folders: Folder[], sort: Sort): Folder[] {
    const sorted = [...folders];
    if (sort.key === 'modified') {
        sorted.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) * (sort.dir === 'asc' ? 1 : -1));
    } else {
        const dir = sort.key === 'name' && sort.dir === 'desc' ? -1 : 1;
        sorted.sort((a, b) => a.name.localeCompare(b.name) * dir);
    }
    return sorted;
}
