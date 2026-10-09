import { createAdminClient } from '@/lib/supabase/admin';
import { isUuid } from '@/lib/api/http';
import type { Tables } from '@/lib/types';

/**
 * The owner's file library (Files and Folders): what the API reads, and the shapes it answers with.
 * Rows are read with the service role, so every query here is scoped to the owner and skips deleted rows.
 * Client code imports the types only (`import type`).
 */

/** The columns a file is read with. Never the storage path or the owner's id: those stay on the server. */
export const FILE_COLUMNS = 'id, original_filename, file_size, mime_type, folder_id, created_at, updated_at, folders!folder_id(name)';
export const FOLDER_COLUMNS = 'id, name, parent_id, created_at, updated_at';

export type FileRow = Pick<
    Tables<'files'>,
    'id' | 'original_filename' | 'file_size' | 'mime_type' | 'folder_id' | 'created_at' | 'updated_at'
> & { folders: { name: string } | null };
export type FolderRow = Pick<Tables<'folders'>, 'id' | 'name' | 'parent_id' | 'created_at' | 'updated_at'>;

/** A file, as every Files and Folders route returns it (`{ file }`, `{ files }`). */
export interface LibraryFile {
    id: string;
    name: string;
    /** In bytes */
    size: number;
    mimeType: string;
    /** null when the file is at the top level, in All files */
    folderId: string | null;
    folderName: string | null;
    createdAt: string;
    updatedAt: string;
}

/** A folder, as every Folders route returns it (`{ folder }`, `{ folders }`). */
export interface LibraryFolder {
    id: string;
    name: string;
    /** null for a top-level folder */
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
}

/** What's directly inside a folder */
export interface FolderCounts {
    fileCount: number;
    subfolderCount: number;
}

export type LibraryFolderWithCounts = LibraryFolder & FolderCounts;

export interface FolderPathItem {
    id: string;
    name: string;
}

/** One folder in full: its counts, and its path from the top level down to itself (for breadcrumbs). */
export interface LibraryFolderDetail extends LibraryFolderWithCounts {
    path: FolderPathItem[];
}

export function serializeFile(row: FileRow): LibraryFile {
    return {
        id: row.id,
        name: row.original_filename,
        size: row.file_size,
        mimeType: row.mime_type,
        folderId: row.folder_id,
        folderName: row.folders?.name ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export function serializeFolder(row: FolderRow): LibraryFolder {
    return {
        id: row.id,
        name: row.name,
        parentId: row.parent_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

/** One of the owner's files, or null when it doesn't exist, was deleted, is someone else's or the id isn't a UUID. */
export async function loadOwnedFile(ownerId: string, id: unknown): Promise<FileRow | null> {
    if (!isUuid(id)) return null;
    const { data, error } = await createAdminClient()
        .from('files')
        .select(FILE_COLUMNS)
        .eq('id', id)
        .eq('uploaded_by', ownerId)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** One of the owner's folders, or null (same rules as loadOwnedFile). */
export async function loadOwnedFolder(ownerId: string, id: unknown): Promise<FolderRow | null> {
    if (!isUuid(id)) return null;
    const { data, error } = await createAdminClient()
        .from('folders')
        .select(FOLDER_COLUMNS)
        .eq('id', id)
        .eq('uploaded_by', ownerId)
        .is('deleted_at', null)
        .maybeSingle();
    if (error) throw error;
    return data;
}

/** How many files and folders are directly inside each folder. */
export async function folderCounts(ownerId: string, ids: string[]): Promise<Map<string, FolderCounts>> {
    const admin = createAdminClient();
    const entries = await Promise.all(
        ids.map(async (id) => {
            const [files, folders] = await Promise.all([
                admin.from('files').select('id', { count: 'exact', head: true }).eq('folder_id', id).eq('uploaded_by', ownerId).is('deleted_at', null),
                admin.from('folders').select('id', { count: 'exact', head: true }).eq('parent_id', id).eq('uploaded_by', ownerId).is('deleted_at', null),
            ]);
            if (files.error) throw files.error;
            if (folders.error) throw folders.error;
            return [id, { fileCount: files.count ?? 0, subfolderCount: folders.count ?? 0 }] as const;
        }),
    );
    return new Map(entries);
}

/** The folder in full: counts and breadcrumbs. */
export async function folderDetail(ownerId: string, folder: FolderRow): Promise<LibraryFolderDetail> {
    const [counts, path] = await Promise.all([folderCounts(ownerId, [folder.id]), folderPath(ownerId, folder)]);
    return { ...serializeFolder(folder), ...counts.get(folder.id)!, path };
}

/** From the top level down to this folder. */
async function folderPath(ownerId: string, folder: FolderRow): Promise<FolderPathItem[]> {
    const path: FolderPathItem[] = [{ id: folder.id, name: folder.name }];
    const seen = new Set([folder.id]);
    for (let parentId = folder.parent_id; parentId && !seen.has(parentId); ) {
        seen.add(parentId);
        const parent = await loadOwnedFolder(ownerId, parentId);
        if (!parent) break;
        path.unshift({ id: parent.id, name: parent.name });
        parentId = parent.parent_id;
    }
    return path;
}

/**
 * Whether another live folder in this parent already has the name. Case is ignored, like the database's
 * unique index on folder names.
 */
export async function folderNameInUse(ownerId: string, name: string, parentId: string | null, exceptId?: string): Promise<boolean> {
    let query = createAdminClient()
        .from('folders')
        .select('id')
        .eq('uploaded_by', ownerId)
        .ilike('name', name.replace(/[%_\\]/g, (c) => `\\${c}`))
        .is('deleted_at', null);
    query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
    if (exceptId) query = query.neq('id', exceptId);
    const { data, error } = await query.limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
}
