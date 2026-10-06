// Database types
// Mirrors supabase/migrations. Keep in sync when adding a migration.
type Timestamp = string;

type FilesRow = {
    id: string;
    filename: string;
    original_filename: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    short_code: string;
    uploaded_by: string;
    created_at: Timestamp;
    updated_at: Timestamp;
    expires_at: Timestamp | null;
    deleted_at: Timestamp | null;
    folder_id: string | null;
};

type FileAccessRow = {
    id: string;
    file_id: string;
    user_identifier: string | null;
    identifier_type: 'email' | 'username' | null;
    is_public: boolean;
    notify_on_grant: boolean | null;
    password_hash: string;
    expires_at: Timestamp | null;
    access_count: number;
    download_count: number;
    max_downloads: number | null;
    last_accessed: Timestamp | null;
    created_at: Timestamp;
    session_token: string | null;
    session_expires_at: Timestamp | null;
};

type FoldersRow = {
    id: string;
    name: string;
    parent_id: string | null;
    uploaded_by: string;
    created_at: Timestamp;
    updated_at: Timestamp;
    deleted_at: Timestamp | null;
};

type AccessLogRow = {
    id: string;
    file_id: string;
    user_identifier: string;
    access_granted: boolean;
    ip_address: string | null;
    user_agent: string | null;
    accessed_at: Timestamp;
    denial_reason: string | null;
    request_id: string | null;
};

/** Columns with a database default become optional on insert. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

type DeleteResult = { success: boolean; filename: string | null; error_message: string | null }[];

export type Database = {
    public: {
        Tables: {
            files: {
                Row: FilesRow;
                Insert: InsertOf<FilesRow, 'filename' | 'original_filename' | 'file_path' | 'file_size' | 'mime_type' | 'short_code' | 'uploaded_by'>;
                Update: Partial<FilesRow>;
                Relationships: [
                    { foreignKeyName: 'files_folder_id_fkey'; columns: ['folder_id']; isOneToOne: false; referencedRelation: 'folders'; referencedColumns: ['id'] },
                ];
            };
            file_access: {
                Row: FileAccessRow;
                Insert: InsertOf<FileAccessRow, 'file_id' | 'password_hash'>;
                Update: Partial<FileAccessRow>;
                Relationships: [
                    { foreignKeyName: 'file_access_file_id_fkey'; columns: ['file_id']; isOneToOne: false; referencedRelation: 'files'; referencedColumns: ['id'] },
                ];
            };
            folders: {
                Row: FoldersRow;
                Insert: InsertOf<FoldersRow, 'name' | 'uploaded_by'>;
                Update: Partial<FoldersRow>;
                Relationships: [
                    { foreignKeyName: 'folders_parent_id_fkey'; columns: ['parent_id']; isOneToOne: false; referencedRelation: 'folders'; referencedColumns: ['id'] },
                ];
            };
            access_log: {
                Row: AccessLogRow;
                Insert: InsertOf<AccessLogRow, 'file_id' | 'user_identifier'>;
                Update: Partial<AccessLogRow>;
                Relationships: [
                    { foreignKeyName: 'access_log_file_id_fkey'; columns: ['file_id']; isOneToOne: false; referencedRelation: 'files'; referencedColumns: ['id'] },
                ];
            };
        };
        Views: Record<never, never>;
        Functions: {
            soft_delete_file: { Args: { p_file_id: string; p_user_id: string }; Returns: DeleteResult };
            delete_file_cascade: { Args: { p_file_id: string; p_user_id: string }; Returns: DeleteResult };
            complete_file_deletion: { Args: { p_file_id: string }; Returns: boolean };
            cleanup_soft_deleted_files: { Args: { older_than_hours?: number }; Returns: number };
            cleanup_expired_data: { Args: Record<never, never>; Returns: undefined };
        };
        Enums: Record<never, never>;
        CompositeTypes: Record<never, never>;
    };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

// Application types
export interface FileMetadata {
    id: string;
    filename: string;
    originalFilename: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    shortCode: string;
    uploadedBy: string;
    createdAt: string;
    updatedAt: string;
    shortUrl?: string;
    folderId?: string | null;
    folderName?: string | null;
}

export interface FileAccess {
    id: string;
    fileId: string;
    type: 'user' | 'public';
    userIdentifier?: string;
    isPublic?: boolean;
    expiresAt: string | null;
    accessCount: number;
    downloadCount?: number;
    maxDownloads?: number | null;
    lastAccessed: string | null;
    createdAt: string;
}

export interface CreateFileAccessInput {
    fileId: string;
    userIdentifier: string;
    password: string;
    expiresAt?: string;
}

export interface VerifyAccessInput {
    shortCode: string;
    userIdentifier: string;
    password: string;
}

export interface VerifyAccessResponse {
    success: boolean;
    fileUrl?: string;
    file?: FileMetadata;
    error?: string;
}

export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'other';

export type FileTypeFilter = 'all' | FileCategory | 'archive';

export type DateFilter = 'all' | 'today' | 'week' | 'month' | '3months' | 'custom';

export interface FileTypeInfo {
    category: FileCategory;
    canPreview: boolean;
    icon: string;
}

export interface Folder {
    id: string;
    name: string;
    parentId: string | null;
    uploadedBy: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
    // Extended fields (from GET single folder or contents)
    subfolderCount?: number;
    fileCount?: number;
    path?: Array<{ id: string; name: string }>;
}

export interface FolderContents {
    folder: {
        id: string;
        name: string;
        parentId: string | null;
    };
    path: Array<{ id: string; name: string }>;
    subfolders: Folder[];
    files: FileMetadata[];
    totalItems: number;
}
