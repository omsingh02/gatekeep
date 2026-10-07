/* eslint-disable @next/next/no-img-element -- tiny static SVG; next/image adds nothing here */

type LogoProps = {
    /** Height of the mark in px; the wordmark scales with it */
    size?: number;
    /** Show the "gatekeep" wordmark next to the mark */
    wordmark?: boolean;
    className?: string;
};

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
    return (
        <img
            src="/brand/logo-mark.svg"
            alt=""
            aria-hidden="true"
            width={size}
            height={size}
            className={className}
            style={{ width: size, height: size }}
        />
    );
}

export function Logo({ size = 28, wordmark = true, className = '' }: LogoProps) {
    return (
        <span className={`inline-flex items-center gap-2.5 ${className}`}>
            <LogoMark size={size} />
            {wordmark ? (
                <span
                    className="font-bold tracking-[-0.04em] leading-none"
                    style={{ fontSize: Math.round(size * 0.72) }}
                >
                    gatekeep
                </span>
            ) : (
                <span className="sr-only">Gatekeep</span>
            )}
        </span>
    );
}
