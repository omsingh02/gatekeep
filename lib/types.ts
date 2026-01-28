// Database types
export interface Database {
    public: {
        Tables: {
            files: {
                Row: {
                    id: string;
                    filename: string;
                    original_filename: string;
                    file_path: string;
                    file_size: number;
                    mime_type: string;
                    short_code: string;
                    uploaded_by: string;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                    folder_id: string | null;
                };
                Insert: Omit<Database['public']['Tables']['files']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['files']['Insert']>;
            };
            file_access: {
                Row: {
                    id: string;
                    file_id: string;
                    user_identifier: string | null;
                    password_hash: string;
                    expires_at: string | null;
                    access_count: number;
                    download_count: number | null;
                    max_downloads: number | null;
                    last_accessed: string | null;
                    created_at: string;
                    session_token: string | null;
                    session_expires_at: string | null;
                };
                Insert: Omit<Database['public']['Tables']['file_access']['Row'], 'id' | 'access_count' | 'download_count' | 'last_accessed' | 'created_at' | 'session_token' | 'session_expires_at'>;
                Update: Partial<Database['public']['Tables']['file_access']['Insert']>;
            };
            folders: {
                Row: {
                    id: string;
                    name: string;
                    parent_id: string | null;
                    uploaded_by: string;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                };
                Insert: Omit<Database['public']['Tables']['folders']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['folders']['Insert']>;
            };
        };
    };
}

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
    passwordHash: string;
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
