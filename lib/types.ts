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
    /** Only v1 files have one (their link became a delivery with the same code). New files get none. */
    short_code: string | null;
    uploaded_by: string;
    created_at: Timestamp;
    updated_at: Timestamp;
    expires_at: Timestamp | null;
    deleted_at: Timestamp | null;
    folder_id: string | null;
    received_via_delivery_id: string | null;
    received_from_recipient_id: string | null;
};

/**
 * @deprecated v1 grants. Read-only since v2: migrate_v1_to_v2() copied them to `delivery_recipients`,
 * nothing in the app writes or reads them any more, and the table is dropped in v2.1.
 */
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

/**
 * @deprecated v1 access log. Read-only since v2: migrate_v1_to_v2() copied it to `activity`,
 * nothing in the app writes or reads it any more, and the table is dropped in v2.1.
 */
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

// v2: deliveries (docs/decisions/0001-deliveries.md)
export type DeliveryKind = 'send' | 'request';
export type RecipientKind = 'person' | 'anyone';
export type AccessMethod = 'email_code' | 'password';
export type IdentifierType = 'email' | 'username';
export type ActivityType =
    | 'opened' | 'previewed' | 'downloaded' | 'downloaded_all' | 'denied' | 'code_sent'
    | 'uploaded' | 'access_given' | 'access_removed' | 'invite_sent';
export type ActivityReason =
    | 'wrong_password' | 'wrong_code' | 'not_on_delivery' | 'ended' | 'download_limit'
    | 'removed' | 'throttled' | 'code_expired' | 'session_ended';

type DeliveriesRow = {
    id: string;
    owner_id: string;
    short_code: string;
    kind: DeliveryKind;
    title: string;
    message: string | null;
    request_folder_id: string | null;
    request_max_files: number | null;
    request_max_file_mb: number | null;
    created_at: Timestamp;
    updated_at: Timestamp;
    deleted_at: Timestamp | null;
};

type DeliveryFilesRow = {
    delivery_id: string;
    file_id: string;
    position: number;
    created_at: Timestamp;
};

type DeliveryRecipientsRow = {
    id: string;
    delivery_id: string;
    kind: RecipientKind;
    identifier: string | null;
    identifier_type: IdentifierType | null;
    method: AccessMethod;
    password_hash: string | null;
    ends_at: Timestamp | null;
    download_limit: number | null;
    download_count: number;
    open_count: number;
    last_opened_at: Timestamp | null;
    session_token_hash: string | null;
    session_expires_at: Timestamp | null;
    removed_at: Timestamp | null;
    ending_notice_sent_at: Timestamp | null;
    legacy_access_id: string | null;
    created_at: Timestamp;
    updated_at: Timestamp;
};

type VerificationCodesRow = {
    id: string;
    recipient_id: string;
    code_hash: string;
    expires_at: Timestamp;
    attempts: number;
    consumed_at: Timestamp | null;
    created_at: Timestamp;
};

type ActivityRow = {
    id: string;
    owner_id: string;
    delivery_id: string | null;
    recipient_id: string | null;
    file_id: string | null;
    type: ActivityType;
    reason: ActivityReason | null;
    actor: string | null;
    ip: string | null;
    user_agent: string | null;
    request_id: string | null;
    notified_at: Timestamp | null;
    legacy_log_id: string | null;
    created_at: Timestamp;
};

type OwnerSettingsRow = {
    owner_id: string;
    display_name: string | null;
    organization: string | null;
    logo_path: string | null;
    recipient_message: string | null;
    default_method: AccessMethod;
    default_ends_in_days: number | null;
    default_download_limit: number | null;
    notify_opened: boolean;
    notify_downloaded: boolean;
    notify_denied: boolean;
    notify_uploaded: boolean;
    homepage: 'landing' | 'branded';
    created_at: Timestamp;
    updated_at: Timestamp;
};

/** Columns with a database default become optional on insert. */
type InsertOf<Row, Required extends keyof Row> = Pick<Row, Required> & Partial<Omit<Row, Required>>;

type DeleteResult = { success: boolean; filename: string | null; error_message: string | null }[];

export type Database = {
    public: {
        Tables: {
            files: {
                Row: FilesRow;
                Insert: InsertOf<FilesRow, 'filename' | 'original_filename' | 'file_path' | 'file_size' | 'mime_type' | 'uploaded_by'>;
                Update: Partial<FilesRow>;
                Relationships: [
                    { foreignKeyName: 'files_folder_id_fkey'; columns: ['folder_id']; isOneToOne: false; referencedRelation: 'folders'; referencedColumns: ['id'] },
                ];
            };
            /** @deprecated v1, read-only; dropped in v2.1 (see FileAccessRow) */
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
            /** @deprecated v1, read-only; dropped in v2.1 (see AccessLogRow) */
            access_log: {
                Row: AccessLogRow;
                Insert: InsertOf<AccessLogRow, 'file_id' | 'user_identifier'>;
                Update: Partial<AccessLogRow>;
                Relationships: [
                    { foreignKeyName: 'access_log_file_id_fkey'; columns: ['file_id']; isOneToOne: false; referencedRelation: 'files'; referencedColumns: ['id'] },
                ];
            };
            deliveries: {
                Row: DeliveriesRow;
                Insert: InsertOf<DeliveriesRow, 'owner_id' | 'short_code' | 'title'>;
                Update: Partial<DeliveriesRow>;
                Relationships: [
                    { foreignKeyName: 'deliveries_request_folder_id_fkey'; columns: ['request_folder_id']; isOneToOne: false; referencedRelation: 'folders'; referencedColumns: ['id'] },
                ];
            };
            delivery_files: {
                Row: DeliveryFilesRow;
                Insert: InsertOf<DeliveryFilesRow, 'delivery_id' | 'file_id'>;
                Update: Partial<DeliveryFilesRow>;
                Relationships: [
                    { foreignKeyName: 'delivery_files_delivery_id_fkey'; columns: ['delivery_id']; isOneToOne: false; referencedRelation: 'deliveries'; referencedColumns: ['id'] },
                    { foreignKeyName: 'delivery_files_file_id_fkey'; columns: ['file_id']; isOneToOne: false; referencedRelation: 'files'; referencedColumns: ['id'] },
                ];
            };
            delivery_recipients: {
                Row: DeliveryRecipientsRow;
                Insert: InsertOf<DeliveryRecipientsRow, 'delivery_id' | 'method'>;
                Update: Partial<DeliveryRecipientsRow>;
                Relationships: [
                    { foreignKeyName: 'delivery_recipients_delivery_id_fkey'; columns: ['delivery_id']; isOneToOne: false; referencedRelation: 'deliveries'; referencedColumns: ['id'] },
                ];
            };
            verification_codes: {
                Row: VerificationCodesRow;
                Insert: InsertOf<VerificationCodesRow, 'recipient_id' | 'code_hash' | 'expires_at'>;
                Update: Partial<VerificationCodesRow>;
                Relationships: [
                    { foreignKeyName: 'verification_codes_recipient_id_fkey'; columns: ['recipient_id']; isOneToOne: false; referencedRelation: 'delivery_recipients'; referencedColumns: ['id'] },
                ];
            };
            activity: {
                Row: ActivityRow;
                Insert: InsertOf<ActivityRow, 'owner_id' | 'type'>;
                Update: Partial<ActivityRow>;
                Relationships: [
                    { foreignKeyName: 'activity_delivery_id_fkey'; columns: ['delivery_id']; isOneToOne: false; referencedRelation: 'deliveries'; referencedColumns: ['id'] },
                    { foreignKeyName: 'activity_recipient_id_fkey'; columns: ['recipient_id']; isOneToOne: false; referencedRelation: 'delivery_recipients'; referencedColumns: ['id'] },
                    { foreignKeyName: 'activity_file_id_fkey'; columns: ['file_id']; isOneToOne: false; referencedRelation: 'files'; referencedColumns: ['id'] },
                ];
            };
            owner_settings: {
                Row: OwnerSettingsRow;
                Insert: InsertOf<OwnerSettingsRow, 'owner_id'>;
                Update: Partial<OwnerSettingsRow>;
                Relationships: [];
            };
        };
        Views: Record<never, never>;
        Functions: {
            soft_delete_file: { Args: { p_file_id: string; p_user_id: string }; Returns: DeleteResult };
            delete_file_cascade: { Args: { p_file_id: string; p_user_id: string }; Returns: DeleteResult };
            complete_file_deletion: { Args: { p_file_id: string }; Returns: boolean };
            cleanup_soft_deleted_files: { Args: { older_than_hours?: number }; Returns: number };
            cleanup_expired_data: { Args: Record<never, never>; Returns: undefined };
            migrate_v1_to_v2: { Args: Record<never, never>; Returns: undefined };
            gatekeep_schema_version: { Args: Record<never, never>; Returns: string };
            gk_count_download: { Args: { p_recipient_id: string }; Returns: number };
            gk_count_open: { Args: { p_recipient_id: string }; Returns: number };
            gk_library_totals: { Args: { p_owner: string }; Returns: { file_count: number; total_size: number }[] };
        };
        Enums: Record<never, never>;
        CompositeTypes: Record<never, never>;
    };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

// Application types
export type FileCategory = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'other';

export type FileTypeFilter = 'all' | FileCategory | 'archive';

export interface FileTypeInfo {
    category: FileCategory;
    canPreview: boolean;
    icon: string;
}
