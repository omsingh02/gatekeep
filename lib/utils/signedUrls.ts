/**
 * How long signed Storage URLs for private files live. See docs/ARCHITECTURE.md → "Signed URLs".
 *
 * Downloads and most previews get a minute: long enough to start loading, too short to pass around.
 * Video and audio previews get longer, because browsers fetch media in ranges while it plays and
 * whenever you seek, and every one of those requests needs a URL that still works. The preview
 * players also ask for a fresh URL (and carry on from the same moment) if one expires anyway.
 */
export const SIGNED_URL_SECONDS = 60;
export const MEDIA_PREVIEW_URL_SECONDS = 15 * 60;

export type FileUrlAction = 'preview' | 'download';

/** Video and audio stream in ranges, so their previews need a URL that outlives the first request. */
export function isStreamedMedia(mimeType: string | null | undefined): boolean {
    return /^(video|audio)\//i.test(mimeType ?? '');
}

export function signedUrlSeconds(action: FileUrlAction, mimeType: string | null | undefined): number {
    return action === 'preview' && isStreamedMedia(mimeType) ? MEDIA_PREVIEW_URL_SECONDS : SIGNED_URL_SECONDS;
}
