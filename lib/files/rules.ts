import { sanitizeFilename, sanitizeFolderName } from '@/lib/utils/sanitization';

/**
 * The rules for files and folders and the words for breaking them, in one place: the Files and Folders
 * API answers with these, and the dashboard shows the same sentences (docs/VOICE.md). Safe to import
 * in the browser.
 */
export const FILE_MESSAGES = {
    fileNotFound: "That file doesn't exist anymore. Refresh and try again.",
    folderNotFound: "That folder doesn't exist anymore. Refresh and try again.",
    fileNameMissing: 'Enter a file name.',
    fileNameUnusable: 'Enter a file name without / \\ < > : " | ? or *.',
    folderNameMissing: 'Enter a folder name.',
    folderNameUnusable: 'Enter a folder name without / \\ < > : " | ? or *.',
    folderIntoItself: "A folder can't move into itself.",
    nothingToChange: 'Nothing to change.',
    searchTooLong: 'Keep the search to 100 characters or fewer.',
    chooseAction: 'Ask for a preview or a download.',
    chooseFile: 'Choose a file to upload.',
    uploadNotFinished: "That upload didn't finish. Try again.",
    tooManyUploads: 'Too many uploads in a short time. Wait a few minutes, then try again.',
    uploadNotStarted: "We couldn't start the upload. Try again in a moment.",
    fileNotOpened: "We couldn't open this file. Try again in a moment.",
} as const;

/** Folder names are unique within their parent, ignoring case. */
export function folderNameTaken(name: string): string {
    return `There's already a folder named ${name} here. Pick another name.`;
}

/** Folders are one level deep: a folder can't go inside a folder that is itself inside one. */
export function folderTooDeep(name: string): string {
    return `${name} can't go there: folders can only be one level deep. Pick All files or a top-level folder.`;
}

/** A folder with folders inside stays at the top level. */
export function folderHasFolders(name: string): string {
    return `${name} has folders inside it, so it stays in All files: folders can only be one level deep.`;
}

/** Most characters a search may have. */
export const MAX_SEARCH = 100;

export type ParsedName = { value: string } | { error: string };

/**
 * A name as typed: trimmed, with characters that can't be used dropped and long names shortened
 * (files keep their extension). Refused only when nothing is left.
 */
function parseName(value: unknown, clean: (name: string) => string, missing: string, unusable: string): ParsedName {
    if (typeof value !== 'string' || !value.trim()) return { error: missing };
    const cleaned = clean(value);
    // The sanitizers answer "unnamed" when nothing usable is left
    if (cleaned === 'unnamed' && value.trim() !== 'unnamed') return { error: unusable };
    return { value: cleaned };
}

export function parseFileName(value: unknown): ParsedName {
    return parseName(value, sanitizeFilename, FILE_MESSAGES.fileNameMissing, FILE_MESSAGES.fileNameUnusable);
}

export function parseFolderName(value: unknown): ParsedName {
    return parseName(value, sanitizeFolderName, FILE_MESSAGES.folderNameMissing, FILE_MESSAGES.folderNameUnusable);
}
