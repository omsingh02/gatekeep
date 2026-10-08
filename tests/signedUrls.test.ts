import { describe, expect, it } from 'vitest';
import { MEDIA_PREVIEW_URL_SECONDS, SIGNED_URL_SECONDS, isStreamedMedia, signedUrlSeconds } from '@/lib/utils/signedUrls';

describe('signedUrlSeconds', () => {
    it('gives video and audio previews 15 minutes, so seeking deep into them keeps working', () => {
        expect(MEDIA_PREVIEW_URL_SECONDS).toBe(900);
        for (const mime of ['video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'Video/QuickTime']) {
            expect(signedUrlSeconds('preview', mime)).toBe(MEDIA_PREVIEW_URL_SECONDS);
        }
    });

    it('keeps downloads and other previews to a minute', () => {
        expect(SIGNED_URL_SECONDS).toBe(60);
        expect(signedUrlSeconds('download', 'video/mp4')).toBe(SIGNED_URL_SECONDS);
        expect(signedUrlSeconds('download', 'audio/mpeg')).toBe(SIGNED_URL_SECONDS);
        for (const mime of ['image/png', 'application/pdf', 'text/plain', '', null, undefined]) {
            expect(signedUrlSeconds('preview', mime)).toBe(SIGNED_URL_SECONDS);
        }
    });

    it('only treats real media types as streamed', () => {
        expect(isStreamedMedia('audio/ogg')).toBe(true);
        expect(isStreamedMedia('application/x-video')).toBe(false);
        expect(isStreamedMedia('text/video')).toBe(false);
    });
});
