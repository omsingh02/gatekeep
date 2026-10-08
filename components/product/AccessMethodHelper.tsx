'use client';

import { useId, useState } from 'react';
import { Check, KeyRound, Mail, RotateCcw, X } from 'lucide-react';
import { Badge, Button, Dialog, IconButton, cn } from '@/components/ds';

/**
 * "Which should I use?": the email code vs password decision from docs/ACCESS-METHODS.md as a
 * short interactive helper. At most three yes/no questions, then one recommendation with one
 * sentence of why and a button to apply it.
 *
 * - Dashboard: pass `emailConfigured` from GET /api/status; question 2 is then answered for you.
 * - Landing page / FAQ: leave `emailConfigured` undefined and the question is asked.
 */
export type AccessMethodChoice = 'email_code' | 'password';

export interface AccessMethodHelperProps {
    /** Whether this Gatekeep can send email. Undefined = ask the question. */
    emailConfigured?: boolean;
    /** Called with the recommendation when the button is pressed. Without it, the button isn't shown. */
    onApply?: (method: AccessMethodChoice) => void;
    /** `dialog`: a "Help me choose" link that opens the helper in a dialog. `inline`: the helper itself. */
    variant?: 'dialog' | 'inline';
    /** dialog variant: the trigger's text */
    triggerLabel?: string;
    /** inline variant: shows a close button (e.g. when it's expanded inside a form) */
    onClose?: () => void;
    className?: string;
}

type Answer = boolean | undefined;
interface Answers {
    knowsEmail: Answer;
    canEmail: Answer;
    secondChannel: Answer;
}

interface Recommendation {
    method: AccessMethodChoice;
    reason: string;
    hint?: string;
}

const QUESTIONS = {
    knowsEmail: {
        text: "Do you know each recipient's email address?",
        help: 'An address they can read now, where mail from people they don’t know still arrives.',
    },
    canEmail: {
        text: 'Can this Gatekeep send email?',
        help: 'It can once RESEND_API_KEY and EMAIL_FROM are set.',
    },
    secondChannel: {
        text: 'Do you want the secret to travel on a different channel than the link?',
        help: 'For very sensitive files: the link by email, the password by phone, text message or in person.',
    },
} as const;

type QuestionId = keyof typeof QUESTIONS;
const ORDER: QuestionId[] = ['knowsEmail', 'canEmail', 'secondChannel'];

function recommend(a: Answers): Recommendation | null {
    if (a.knowsEmail === false) {
        return {
            method: 'password',
            reason: "Without an email address there's nowhere to send a code, so give each person their own password.",
        };
    }
    if (a.knowsEmail === undefined) return null;
    if (a.canEmail === false) {
        return {
            method: 'password',
            reason: "This Gatekeep can't send email yet, so a code would never arrive. Give each person their own password.",
            hint: 'To use email codes later, set RESEND_API_KEY and EMAIL_FROM (see System status in Settings).',
        };
    }
    if (a.canEmail === undefined) return null;
    if (a.secondChannel === true) {
        return {
            method: 'password',
            reason: 'Send the link by email and the password another way, so one inbox never holds both.',
        };
    }
    if (a.secondChannel === false) {
        return {
            method: 'email_code',
            reason: "They get a 6-digit code at their email address, so there's no password to make up, send or lose.",
        };
    }
    return null;
}

function HelperFlow({ emailConfigured, onApply, className }: Pick<AccessMethodHelperProps, 'emailConfigured' | 'onApply' | 'className'>) {
    const auto = emailConfigured !== undefined;
    const initial: Answers = { knowsEmail: undefined, canEmail: auto ? emailConfigured : undefined, secondChannel: undefined };
    const [answers, setAnswers] = useState<Answers>(initial);
    const questionId = useId();

    const result = recommend(answers);
    // The question being asked now: the first unanswered one, unless we already have a result
    const current = result ? null : ORDER.find((id) => answers[id] === undefined) ?? null;
    // Questions to list as answered: everything before the current one (or before the result)
    const answered = ORDER.filter((id, i) => {
        if (answers[id] === undefined) return false;
        if (current) return i < ORDER.indexOf(current);
        // With a result, show only the questions that led to it
        if (result && answers.knowsEmail === false) return id === 'knowsEmail';
        if (result && answers.canEmail === false) return id !== 'secondChannel';
        return true;
    });
    const stepNumber = current ? ORDER.filter((id) => id !== 'canEmail' || !auto).indexOf(current) + 1 : 0;
    const askedCount = auto ? 2 : 3;

    const answer = (id: QuestionId, value: boolean) => setAnswers((a) => ({ ...a, [id]: value }));
    const change = (id: QuestionId) => {
        const index = ORDER.indexOf(id);
        setAnswers((a) => {
            const next = { ...a };
            ORDER.slice(index).forEach((q) => {
                if (q !== 'canEmail' || !auto) next[q] = undefined;
            });
            return next;
        });
    };

    return (
        <div className={cn('flex flex-col gap-4', className)}>
            {answered.length > 0 && (
                <ol className="flex flex-col divide-y divide-gray-4 rounded-lg border border-default bg-surface" aria-label="Your answers">
                    {answered.map((id) => {
                        const isAuto = id === 'canEmail' && auto;
                        return (
                            <li key={id} className="flex items-start gap-3 px-3 py-2.5">
                                <Check aria-hidden strokeWidth={2} className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-body-sm text-secondary">{QUESTIONS[id].text}</p>
                                    <p className="text-body-sm font-medium text-strong">
                                        {answers[id] ? 'Yes' : 'No'}
                                        {isAuto && <span className="ml-2 text-caption font-normal text-tertiary">From system status</span>}
                                    </p>
                                </div>
                                {!isAuto && (
                                    <Button variant="link" size="sm" className="text-body-sm text-secondary" onClick={() => change(id)}>
                                        Change<span className="sr-only"> answer to “{QUESTIONS[id].text}”</span>
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ol>
            )}

            {current && (
                <div role="group" aria-labelledby={questionId} className="flex flex-col gap-3">
                    <div>
                        <p className="text-caption font-medium text-tertiary">
                            Question {stepNumber} of {askedCount}
                        </p>
                        <p id={questionId} className="mt-1 text-h3 text-strong">
                            {QUESTIONS[current].text}
                        </p>
                        <p className="mt-0.5 text-body-sm text-secondary">{QUESTIONS[current].help}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="secondary" className="min-w-20" onClick={() => answer(current, true)}>
                            Yes
                        </Button>
                        <Button variant="secondary" className="min-w-20" onClick={() => answer(current, false)}>
                            No
                        </Button>
                    </div>
                </div>
            )}

            <div aria-live="polite">
                {result && (
                    <div className="ds-pop-in flex flex-col gap-3 rounded-lg border border-strong bg-raised p-4" data-testid="access-method-result">
                        <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-default bg-surface text-strong">
                                {result.method === 'email_code' ? (
                                    <Mail aria-hidden strokeWidth={1.75} className="h-4 w-4" />
                                ) : (
                                    <KeyRound aria-hidden strokeWidth={1.75} className="h-4 w-4" />
                                )}
                            </span>
                            <div className="min-w-0">
                                <Badge>Recommended</Badge>
                                <p className="mt-1.5 text-h3 text-strong">
                                    {result.method === 'email_code' ? 'Use an email code' : 'Use a password'}
                                </p>
                                <p className="mt-0.5 text-body-sm text-secondary">{result.reason}</p>
                                {result.hint && <p className="mt-1.5 text-caption text-tertiary">{result.hint}</p>}
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:pl-12">
                            {onApply && (
                                <Button variant="primary" onClick={() => onApply(result.method)}>
                                    {result.method === 'email_code' ? 'Use email code' : 'Use password'}
                                </Button>
                            )}
                            <Button variant="ghost" icon={<RotateCcw aria-hidden strokeWidth={1.75} className="h-4 w-4" />} onClick={() => setAnswers(initial)}>
                                Start over
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** The helper, either as a "Help me choose" link + dialog, or inline. */
export function AccessMethodHelper({ variant = 'dialog', triggerLabel = 'Help me choose', onApply, onClose, emailConfigured, className }: AccessMethodHelperProps) {
    const [open, setOpen] = useState(false);

    if (variant === 'inline') {
        return (
            <section aria-label="Which should I use?" className={cn('rounded-lg border border-default bg-surface p-4', className)}>
                <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-h3 text-strong">Which should I use?</h3>
                        <p className="text-body-sm text-secondary">Email code or password, in at most three questions.</p>
                    </div>
                    {onClose && (
                        <IconButton label="Close the helper" size="sm" icon={<X aria-hidden strokeWidth={1.75} className="h-4 w-4" />} onClick={onClose} />
                    )}
                </div>
                <HelperFlow emailConfigured={emailConfigured} onApply={onApply} />
            </section>
        );
    }

    return (
        <>
            <Button variant="link" size="sm" className={cn('text-caption font-medium text-secondary', className)} onClick={() => setOpen(true)}>
                {triggerLabel}
            </Button>
            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                title="Which should I use?"
                description="Email code or password, in at most three questions."
            >
                {open && (
                    <HelperFlow
                        emailConfigured={emailConfigured}
                        onApply={
                            onApply
                                ? (method) => {
                                      onApply(method);
                                      setOpen(false);
                                  }
                                : undefined
                        }
                    />
                )}
            </Dialog>
        </>
    );
}

export default AccessMethodHelper;
