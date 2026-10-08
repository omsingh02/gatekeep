import { KeyRound } from 'lucide-react';
import { Avatar, cn } from '@/components/ds';
import { ANYONE_LABEL } from './format';

/** A person's initial, or a key for "Anyone with the password" (it isn't a person). */
export function PersonAvatar({ label, className }: { label: string; className?: string }) {
    if (label === ANYONE_LABEL) {
        return (
            <span aria-hidden className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-4 text-primary', className)}>
                <KeyRound strokeWidth={1.75} className="h-3 w-3" />
            </span>
        );
    }
    return <Avatar name={label} size="sm" className={className} />;
}
