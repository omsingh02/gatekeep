import Image, { type StaticImageData } from 'next/image';
import { cn } from '@/components/ds';

export interface ScreenshotProps {
    /** A static import from public/screenshots (scripts/screenshots.mjs), so the size is known */
    image: StaticImageData;
    alt: string;
    /** Shown in the flat browser bar, e.g. "files.northwind.example/admin" */
    address: string;
    priority?: boolean;
    /** Passed to next/image so phones don't download the 2x desktop file */
    sizes?: string;
    className?: string;
}

/**
 * A product screenshot in a flat 1px frame with a neutral browser bar (DESIGN.md: no traffic-light
 * colours, no shadow, no glow).
 */
export function Screenshot({ image, alt, address, priority, sizes = '(min-width: 1120px) 1056px, 100vw', className }: ScreenshotProps) {
    return (
        <figure className={cn('overflow-hidden rounded-lg border border-default bg-surface', className)}>
            <div aria-hidden className="flex h-8 items-center gap-3 border-b border-default px-3">
                <span className="flex shrink-0 gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-5" />
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-5" />
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-5" />
                </span>
                <span className="mx-auto flex h-5 min-w-0 max-w-sm flex-1 items-center justify-center rounded-sm bg-raised px-2">
                    <span className="truncate font-mono text-caption text-tertiary">{address}</span>
                </span>
                <span className="w-[42px] shrink-0" />
            </div>
            <Image src={image} alt={alt} sizes={sizes} priority={priority} placeholder="empty" className="block h-auto w-full" />
        </figure>
    );
}
