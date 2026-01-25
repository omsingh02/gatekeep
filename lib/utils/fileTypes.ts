import { FileCategory, FileTypeInfo } from '../types';

const MIME_TYPE_CATEGORIES: Record<string, FileCategory> = {
    // Images
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'image/svg+xml': 'image',
    'image/bmp': 'image',
    'image/tiff': 'image',

    // Videos
    'video/mp4': 'video',
    'video/webm': 'video',
    'video/ogg': 'video',
    'video/quicktime': 'video',
    'video/x-msvideo': 'video',
    'video/x-matroska': 'video',

    // Audio
    'audio/mpeg': 'audio',
    'audio/mp3': 'audio',
    'audio/wav': 'audio',
    'audio/ogg': 'audio',
    'audio/webm': 'audio',
    'audio/aac': 'audio',
    'audio/flac': 'audio',

    // PDFs
    'application/pdf': 'pdf',

    // Documents
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'application/vnd.ms-powerpoint': 'document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
    'text/plain': 'document',
    'text/csv': 'document',
    'text/markdown': 'document',
    'text/x-markdown': 'document',
    'application/json': 'document',
    'application/javascript': 'document',
    'text/javascript': 'document',
    'text/html': 'document',
    'text/css': 'document',
    'application/xml': 'document',
    'text/xml': 'document',

    // Archives
    'application/zip': 'other',
    'application/x-tar': 'other',
    'application/gzip': 'other',
    'application/x-gzip': 'other',
    'application/x-rar-compressed': 'other',
    'application/x-7z-compressed': 'other',
};

const PREVIEWABLE_TYPES: Set<FileCategory> = new Set(['image', 'video', 'audio', 'pdf', 'document']);

/**
 * Gets file type information from MIME type
 */
export function getFileTypeInfo(mimeType: string): FileTypeInfo {
    const category = MIME_TYPE_CATEGORIES[mimeType] || 'other';
    const canPreview = PREVIEWABLE_TYPES.has(category);

    return {
        category,
        canPreview,
        icon: getIconForCategory(category),
    };
}

/**
 * Gets an icon name for a file category
 */
function getIconForCategory(category: FileCategory): string {
    const icons: Record<FileCategory, string> = {
        image: '🖼️',
        video: '🎥',
        audio: '🎵',
        pdf: '📄',
        document: '📝',
        other: '📎',
    };
    return icons[category];
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Gets file extension from filename
 */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

// File validation constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TYPE_CATEGORIES));

// Dangerous file extensions that should be blocked
const BLOCKED_EXTENSIONS = new Set([
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    'msi', 'app', 'deb', 'rpm', 'dmg', 'pkg', 'sh', 'bash', 'ps1',
    'dll', 'sys', 'drv', 'ocx', 'cpl', 'inf', 'reg', 'scf',
]);

// Allowed safe extensions (whitelist approach)
const ALLOWED_EXTENSIONS = new Set([
    // Images
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff',
    // Videos
    'mp4', 'webm', 'ogv', 'mov', 'avi', 'mkv',
    // Audio
    'mp3', 'wav', 'ogg', 'oga', 'webm', 'aac', 'flac',
    // Documents
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'txt', 'csv', 'md', 'markdown',
    // Code files (text-based, relatively safe)
    'json', 'xml', 'html', 'htm', 'css',
    // Archives
    'zip', 'tar', 'gz', 'rar', '7z',
]);

export interface FileValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates file size, type, and extension
 */
export function validateFile(file: File): FileValidationResult {
    // Check file size
    if (file.size === 0) {
        return { valid: false, error: 'File is empty' };
    }

    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File size exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}`
        };
    }

    // Get file extension
    const extension = getFileExtension(file.name);
    
    if (!extension) {
        return { valid: false, error: 'File must have an extension' };
    }

    // Check against blocked extensions
    if (BLOCKED_EXTENSIONS.has(extension)) {
        return {
            valid: false,
            error: `File type '.${extension}' is not allowed for security reasons`
        };
    }

    // Check against allowed extensions (whitelist)
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        return {
            valid: false,
            error: `File type '.${extension}' is not supported`
        };
    }

    // Validate MIME type if provided by browser
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
        // For some files, browsers might not provide accurate MIME types
        // So we'll be lenient here and only warn, not reject
        console.warn(`File MIME type '${file.type}' not in allowed list, but extension is valid`);
    }

    return { valid: true };
}

/**
 * Gets the maximum allowed file size
 */
export function getMaxFileSize(): number {
    return MAX_FILE_SIZE;
}

/**
 * Checks if a file extension is allowed
 */
export function isExtensionAllowed(extension: string): boolean {
    const ext = extension.toLowerCase().replace(/^\./, '');
    return ALLOWED_EXTENSIONS.has(ext) && !BLOCKED_EXTENSIONS.has(ext);
}

/**
 * Validates file metadata without requiring the actual File object.
 * Useful for presigned upload flow where we validate before generating the URL.
 */
export function validateFileMetadata(
    filename: string,
    fileSize: number,
    mimeType: string
): FileValidationResult {
    // Check file size
    if (fileSize === 0) {
        return { valid: false, error: 'File is empty' };
    }

    if (fileSize > MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File size exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}`
        };
    }

    // Get file extension
    const extension = getFileExtension(filename);
    
    if (!extension) {
        return { valid: false, error: 'File must have an extension' };
    }

    // Check against blocked extensions
    if (BLOCKED_EXTENSIONS.has(extension)) {
        return {
            valid: false,
            error: `File type '.${extension}' is not allowed for security reasons`
        };
    }

    // Check against allowed extensions (whitelist)
    if (!ALLOWED_EXTENSIONS.has(extension)) {
        return {
            valid: false,
            error: `File type '.${extension}' is not supported`
        };
    }

    // Validate MIME type if provided
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
        // Be lenient - some MIME types might not be in our list
        console.warn(`MIME type '${mimeType}' not in allowed list, but extension is valid`);
    }

    return { valid: true };
}
