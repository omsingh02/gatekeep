import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    formatFileSize,
    getFileExtension,
    getFileTypeInfo,
    getMaxFileSize,
    isExtensionAllowed,
    validateFileMetadata,
} from '@/lib/utils/fileTypes';

const MB = 1024 * 1024;

describe('validateFileMetadata', () => {
    beforeEach(() => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('accepts an ordinary image', () => {
        expect(validateFileMetadata('photo.png', 2 * MB, 'image/png')).toEqual({ valid: true });
    });

    it('enforces the 100 MB size limit', () => {
        expect(getMaxFileSize()).toBe(100 * MB);
        expect(validateFileMetadata('big.zip', 100 * MB, 'application/zip').valid).toBe(true);
        const tooBig = validateFileMetadata('big.zip', 100 * MB + 1, 'application/zip');
        expect(tooBig.valid).toBe(false);
        expect(tooBig.error).toMatch(/exceeds maximum/);
    });

    it('rejects empty files', () => {
        expect(validateFileMetadata('empty.txt', 0, 'text/plain')).toEqual({ valid: false, error: 'File is empty' });
    });

    it('blocks executable extensions, including disguised ones', () => {
        for (const name of ['setup.exe', 'run.sh', 'script.js', 'photo.png.exe']) {
            const result = validateFileMetadata(name, MB, 'application/octet-stream');
            expect(result.valid, name).toBe(false);
            expect(result.error, name).toMatch(/not allowed for security reasons/);
        }
    });

    it('rejects files without an extension or with an unknown one', () => {
        expect(validateFileMetadata('README', MB, 'text/plain').error).toBe('File must have an extension');
        expect(validateFileMetadata('model.blend', MB, '').error).toMatch(/not supported/);
    });

    it('is case-insensitive about extensions', () => {
        expect(validateFileMetadata('PHOTO.JPG', MB, 'image/jpeg').valid).toBe(true);
    });

    it('allows a valid extension even when the MIME type is unknown', () => {
        expect(validateFileMetadata('notes.md', MB, 'application/x-weird').valid).toBe(true);
        expect(console.warn).toHaveBeenCalled();
    });
});

describe('isExtensionAllowed', () => {
    it('accepts allowed extensions with or without a dot', () => {
        expect(isExtensionAllowed('pdf')).toBe(true);
        expect(isExtensionAllowed('.PDF')).toBe(true);
    });

    it('rejects blocked and unknown extensions', () => {
        expect(isExtensionAllowed('exe')).toBe(false);
        expect(isExtensionAllowed('blend')).toBe(false);
    });
});

describe('getFileTypeInfo', () => {
    it('categorises known MIME types and marks previewable ones', () => {
        expect(getFileTypeInfo('image/png')).toMatchObject({ category: 'image', canPreview: true });
        expect(getFileTypeInfo('application/pdf')).toMatchObject({ category: 'pdf', canPreview: true });
        expect(getFileTypeInfo('text/plain')).toMatchObject({ category: 'document', canPreview: true });
        expect(getFileTypeInfo('application/zip')).toMatchObject({ category: 'other', canPreview: false });
    });

    it('falls back to "other" for unknown types', () => {
        expect(getFileTypeInfo('application/x-unknown')).toMatchObject({ category: 'other', canPreview: false });
    });
});

describe('helpers', () => {
    it('formats file sizes', () => {
        expect(formatFileSize(0)).toBe('0 bytes');
        expect(formatFileSize(512)).toBe('512 bytes');
        expect(formatFileSize(42_425_000)).toBe('40.5 MB');
        expect(formatFileSize(200 * MB)).toBe('200 MB');
        expect(formatFileSize(1536)).toBe('1.5 KB');
        expect(formatFileSize(100 * MB)).toBe('100 MB');
    });

    it('extracts lowercase extensions', () => {
        expect(getFileExtension('archive.tar.GZ')).toBe('gz');
        expect(getFileExtension('noext')).toBe('');
    });
});
