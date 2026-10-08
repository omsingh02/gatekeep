import { cn } from './cn';

/** The one spinner in the product: 16px, used inside buttons while an action runs. */
export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
    return (
        <svg
            viewBox="0 0 16 16"
            width={16}
            height={16}
            role="status"
            aria-label={label}
            className={cn('shrink-0 animate-spin', className)}
        >
            <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} />
            <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
    );
}
