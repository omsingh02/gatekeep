import { downloadZip } from 'client-zip';
import { startDownload } from './api';

/**
 * Above this, a zip built in memory risks crashing the tab (especially on phones), so the
 * files are downloaded one by one instead. The download still counts once.
 */
export const ZIP_IN_BROWSER_LIMIT = 1024 * 1024 * 1024;

export interface ZipEntry {
    name: string;
    size: number;
    url: string;
}

/** "report.pdf", "report (2).pdf": zips can't hold two entries with the same name usefully. */
function uniqueNames(entries: ZipEntry[]): string[] {
    const seen = new Map<string, number>();
    return entries.map(({ name }) => {
        const key = name.toLowerCase();
        const count = (seen.get(key) ?? 0) + 1;
        seen.set(key, count);
        if (count === 1) return name;
        const dot = name.lastIndexOf('.');
        return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
    });
}

export class ZipFileError extends Error {
    constructor(public fileName: string) {
        super(`Could not fetch ${fileName}`);
    }
}

/**
 * Stream every file into a zip in the browser (client-zip), then save it.
 * `onProgress` gets a 0–1 fraction based on the bytes received.
 */
export async function saveZip(
    zipName: string,
    entries: ZipEntry[],
    { onProgress, signal }: { onProgress: (fraction: number) => void; signal: AbortSignal },
): Promise<void> {
    const names = uniqueNames(entries);
    const total = Math.max(entries.reduce((sum, e) => sum + e.size, 0), 1);
    let received = 0;

    async function* inputs() {
        for (const [i, entry] of entries.entries()) {
            const response = await fetch(entry.url, { signal }).catch(() => null);
            if (!response?.ok || !response.body) throw new ZipFileError(entry.name);
            const counter = new TransformStream<Uint8Array, Uint8Array>({
                transform(chunk, controller) {
                    received += chunk.byteLength;
                    onProgress(Math.min(received / total, 0.99));
                    controller.enqueue(chunk);
                },
            });
            yield { name: names[i], lastModified: new Date(), input: response.body.pipeThrough(counter) };
        }
    }

    const blob = await downloadZip(inputs()).blob();
    if (signal.aborted) return;
    onProgress(1);
    const url = URL.createObjectURL(blob);
    startDownload(url, zipName);
    // Give the browser time to start saving before releasing the memory
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Fallback for very large deliveries: one download per file, from the already-counted URLs. */
export async function saveSeparately(entries: ZipEntry[], { signal }: { signal: AbortSignal }): Promise<void> {
    for (const entry of entries) {
        if (signal.aborted) return;
        startDownload(entry.url, entry.name);
        // Browsers drop rapid back-to-back downloads; space them out
        await new Promise((resolve) => setTimeout(resolve, 800));
    }
}
