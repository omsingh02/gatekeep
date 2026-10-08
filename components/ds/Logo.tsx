import { cn } from './cn';

/** The gate + keyhole glyph, drawn on a 64×64 grid. Even-odd fill knocks the keyhole out of the door. */
export const LOGO_GLYPH_PATH = 'M17.5 31a14.5 14.5 0 0 1 29 0v20a2 2 0 0 1-2 2h-25a2 2 0 0 1-2-2zM29.75 37.4a5.6 5.6 0 1 1 4.5 0L36 45.5h-8z';
/** Enlarges the glyph 15% and centres it optically in the tile (legible at 16px). */
export const LOGO_GLYPH_TRANSFORM = 'translate(32 32.5) scale(1.15) translate(-32 -34.75)';

export interface LogoMarkProps {
    size?: number;
    /** Dark tile with a white glyph, for light backgrounds (emails, light README) */
    inverted?: boolean;
    className?: string;
}

/** Monochrome tile with the gate + keyhole knocked out. */
export function LogoMark({ size = 28, inverted = false, className }: LogoMarkProps) {
    return (
        <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={cn('shrink-0', className)}>
            <rect width="64" height="64" rx="14" fill={inverted ? '#1a1a1a' : '#f5f5f5'} />
            <path fill={inverted ? '#ffffff' : '#1a1a1a'} fillRule="evenodd" d={LOGO_GLYPH_PATH} transform={LOGO_GLYPH_TRANSFORM} />
        </svg>
    );
}

export interface LogoProps extends LogoMarkProps {
    /** Show the "Gatekeep" wordmark next to the mark */
    wordmark?: boolean;
}

/** Mark + "Gatekeep" wordmark (Inter 600, tight tracking). The name is always "Gatekeep". */
export function Logo({ size = 28, inverted, wordmark = true, className }: LogoProps) {
    return (
        <span className={cn('inline-flex items-center', className)} style={{ gap: Math.round(size * 0.32) }}>
            <LogoMark size={size} inverted={inverted} />
            {wordmark ? (
                <span
                    className={cn('font-semibold leading-none tracking-[-0.02em]', inverted ? 'text-gray-1' : 'text-strong')}
                    style={{ fontSize: Math.round(size * 0.62) }}
                >
                    Gatekeep
                </span>
            ) : (
                <span className="sr-only">Gatekeep</span>
            )}
        </span>
    );
}
