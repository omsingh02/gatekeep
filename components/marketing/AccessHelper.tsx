'use client';

import { ArrowUpRight } from 'lucide-react';
import { buttonStyles } from '@/components/ds';
import { AccessMethodHelper, type AccessMethodChoice } from '@/components/product/AccessMethodHelper';
import { ACCESS_METHODS_URL } from './links';

const GUIDE_ANCHOR: Record<AccessMethodChoice, string> = {
    email_code: '#email-code-recommended',
    password: '#password',
};

function GuideLink({ method }: { method: AccessMethodChoice }) {
    return (
        <a
            href={`${ACCESS_METHODS_URL}${GUIDE_ANCHOR[method]}`}
            target="_blank"
            rel="noreferrer"
            className={buttonStyles({ variant: 'secondary' })}
        >
            {method === 'email_code' ? 'How email codes work' : 'How passwords work'}
            <ArrowUpRight aria-hidden strokeWidth={1.75} className="h-4 w-4" />
        </a>
    );
}

/**
 * "Which should I use?" on the public site. The question about email sending is asked (there's
 * no instance to check), and the result links to the guide instead of applying a setting.
 */
export function AccessHelper({ variant = 'inline', className }: { variant?: 'inline' | 'dialog'; className?: string }) {
    return (
        <AccessMethodHelper
            variant={variant}
            triggerStyle="button"
            audience="website"
            renderAction={(method) => <GuideLink method={method} />}
            className={className}
        />
    );
}
