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
                    group_id: string | null;
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
            groups: {
                Row: {
                    id: string;
                    name: string;
                    description: string | null;
                    created_by: string;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                };
                Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['groups']['Insert']>;
            };
            group_members: {
                Row: {
                    id: string;
                    group_id: string;
                    member_identifier: string;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['group_members']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['group_members']['Insert']>;
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
}

export interface FileAccess {
    id: string;
    fileId: string;
    type: 'user' | 'group';
    userIdentifier?: string;
    groupId?: string | null;
    groupName?: string;
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
}

export interface Group {
    id: string;
    name: string;
    description?: string | null;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    deletedAt?: string | null;
}

export interface GroupMember {
    id: string;
    groupId: string;
    memberIdentifier: string;
    createdAt: string;
}
