'use client';

import { useRef, useState, type ComponentPropsWithoutRef } from 'react';

/** Two failures this close together mean the file itself is the problem, not an expired URL. */
const RETRY_WINDOW_MS = 10_000;

type MediaAttributes = Omit<ComponentPropsWithoutRef<'video'>, 'src' | 'onError' | 'onLoadedMetadata' | 'ref'>;

export interface ResumableMediaProps extends MediaAttributes {
    kind: 'video' | 'audio';
    /** The first signed URL. Give the component a new `key` when the file (or a manual retry) changes. */
    src: string;
    /** A fresh signed URL for the same file, or null if there isn't one (the caller says why). */
    refresh: () => Promise<string | null>;
    /** Playback can't continue: show an error instead. */
    onFail: () => void;
}

/**
 * A `<video>` or `<audio>` element on a short-lived signed URL. Browsers fetch media in ranges as it
 * plays and whenever you seek, so once the URL expires, seeking (or playing on) fails. When that
 * happens, this asks for a fresh URL and carries on from the same moment, still playing if it was.
 * Media that never loaded, or that fails again straight after a fresh URL, is a real error: `onFail`.
 */
export function ResumableMedia({ kind, src: firstSrc, refresh, onFail, ...attributes }: ResumableMediaProps) {
    const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null);
    const [src, setSrc] = useState(firstSrc);
    const loaded = useRef(false);
    const busy = useRef(false);
    const lastRefresh = useRef(0);
    const resume = useRef<{ time: number; playing: boolean } | null>(null);

    const onLoadedMetadata = () => {
        loaded.current = true;
        const element = ref.current;
        const position = resume.current;
        resume.current = null;
        if (!element || !position) return;
        if (position.time > 0) {
            element.currentTime = Number.isFinite(element.duration) ? Math.min(position.time, element.duration) : position.time;
        }
        if (position.playing) element.play().catch(() => {});
    };

    const onError = async () => {
        const element = ref.current;
        if (busy.current) return;
        if (!element || !loaded.current || Date.now() - lastRefresh.current < RETRY_WINDOW_MS) {
            onFail();
            return;
        }
        busy.current = true;
        lastRefresh.current = Date.now();
        // While seeking, currentTime is already the position asked for
        resume.current = { time: element.currentTime, playing: !element.paused };
        loaded.current = false;
        const fresh = await refresh().catch(() => null);
        busy.current = false;
        if (!fresh) {
            resume.current = null;
            onFail();
            return;
        }
        // A URL signed in the same second can come back identical: reload it explicitly
        if (fresh === src) element.load();
        else setSrc(fresh);
    };

    const props = { ...attributes, ref, src, onLoadedMetadata, onError: () => void onError() };
    return kind === 'video' ? <video {...props} /> : <audio {...props} />;
}
