'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarX, FileQuestion, RotateCw, UserX, WifiOff } from 'lucide-react';
import { Button, Card, Skeleton } from '@/components/ds';
import { RECIPIENT_MESSAGES } from '@/lib/deliveries/labels';
import { SIGNED_OUT_NOTICE, recipientApi, type AccessOptions, type Failure, type PublicSender, type VerifiedView } from './api';
import { DeliveryView } from './DeliveryView';
import { RequestUpload } from './RequestUpload';
import { SignIn } from './SignIn';
import { StateCard } from './Shell';

export type InitialScreen = 'sign-in' | 'load' | 'removed' | 'ended';

type Screen =
    | { name: 'sign-in'; notice: string | null }
    | { name: 'loading' }
    | { name: 'view'; view: VerifiedView }
    | { name: 'removed' }
    | { name: 'ended' }
    | { name: 'gone' }
    | { name: 'error'; message: string };

export interface RecipientAppProps {
    code: string;
    kind: 'send' | 'request';
    sender: PublicSender;
    access: AccessOptions;
    initial: InitialScreen;
    notice: string | null;
}

/** What a client sees at /{code}: sign in, then the delivery (or the request), or why they can't. */
export function RecipientApp({ code, kind, sender: initialSender, access, initial, notice }: RecipientAppProps) {
    const [screen, setScreen] = useState<Screen>(() =>
        initial === 'load' ? { name: 'loading' } : initial === 'sign-in' ? { name: 'sign-in', notice } : { name: initial },
    );
    const [sender, setSender] = useState(initialSender);
    const [streamAttempt, setStreamAttempt] = useState(0);

    /** Move to the screen that matches a failed call. */
    const fail = useCallback((failure: Failure) => {
        switch (failure.kind) {
            case 'removed':
                return setScreen({ name: 'removed' });
            case 'ended':
                return setScreen({ name: 'ended' });
            case 'signed-out':
                return setScreen({ name: 'sign-in', notice: SIGNED_OUT_NOTICE });
            case 'not-found':
                return setScreen({ name: 'gone' });
            default:
                return setScreen({ name: 'error', message: failure.message });
        }
    }, []);

    /** Show whatever the server says about this visitor now. */
    const apply = useCallback(
        (result: Awaited<ReturnType<typeof recipientApi.view>>) => {
            if ('failure' in result) return fail(result.failure);
            const data = result.data;
            setSender(data.sender);
            if ('delivery' in data) return setScreen({ name: 'view', view: data });
            if (data.notice === RECIPIENT_MESSAGES.removed(data.sender.name)) return setScreen({ name: 'removed' });
            if (data.notice === RECIPIENT_MESSAGES.ended(data.sender.name)) return setScreen({ name: 'ended' });
            setScreen({ name: 'sign-in', notice: data.notice ? SIGNED_OUT_NOTICE : null });
        },
        [fail],
    );

    const load = useCallback(() => recipientApi.view(code).then(apply), [code, apply]);

    useEffect(() => {
        if (initial !== 'load') return;
        let cancelled = false;
        void recipientApi.view(code).then((result) => {
            if (!cancelled) apply(result);
        });
        return () => {
            cancelled = true;
        };
    }, [initial, code, apply]);

    // Live: the moment access is removed or ends, the open page says so
    const viewing = screen.name === 'view';
    useEffect(() => {
        if (!viewing || typeof EventSource === 'undefined') return;
        const source = new EventSource(recipientApi.streamUrl(code));
        source.onmessage = (event) => {
            let data: { ended?: boolean; reason?: string } = {};
            try {
                data = JSON.parse(event.data);
            } catch {
                return;
            }
            if (!data.ended) return;
            source.close();
            if (data.reason === 'removed') setScreen({ name: 'removed' });
            else if (data.reason === 'ended') setScreen({ name: 'ended' });
            else setScreen({ name: 'sign-in', notice: SIGNED_OUT_NOTICE });
        };
        let retry: ReturnType<typeof setTimeout> | undefined;
        source.onerror = () => {
            // The browser retries dropped connections itself; CLOSED means the server refused the stream
            if (source.readyState !== EventSource.CLOSED) return;
            // Find out why (signed out, removed); if they're still in, listen again shortly
            void load().then(() => {
                retry = setTimeout(() => setStreamAttempt((n) => n + 1), 5000);
            });
        };
        return () => {
            source.close();
            clearTimeout(retry);
        };
    }, [viewing, code, load, streamAttempt]);

    const signIn = () => setScreen({ name: 'sign-in', notice: null });

    switch (screen.name) {
        case 'sign-in':
            return (
                <SignIn
                    code={code}
                    kind={kind}
                    sender={sender}
                    access={access}
                    notice={screen.notice}
                    onSignedIn={(view) => {
                        setSender(view.sender);
                        setScreen({ name: 'view', view });
                    }}
                    onBlocked={fail}
                />
            );
        case 'loading':
            return <LoadingView />;
        case 'view': {
            const { view } = screen;
            if (view.delivery.kind === 'request') {
                return <RequestUpload code={code} view={view} onFailure={fail} onSignedOut={signIn} />;
            }
            return (
                <DeliveryView
                    code={code}
                    view={view}
                    onFailure={fail}
                    onSignedOut={signIn}
                    onDownloads={(downloadsLeft, downloadCount) =>
                        setScreen((current) =>
                            current.name === 'view'
                                ? { ...current, view: { ...current.view, recipient: { ...current.view.recipient, downloadsLeft, downloadCount } } }
                                : current,
                        )
                    }
                />
            );
        }
        case 'removed':
            return (
                <StateCard
                    icon={UserX}
                    sender={sender}
                    title="Your access was removed"
                    action={
                        <Button variant="link" className="min-h-10 self-start text-body-sm" onClick={signIn}>
                            I have a new invite
                        </Button>
                    }
                >
                    {RECIPIENT_MESSAGES.removed(sender.name)} If you still need the files, contact {sender.name}.
                </StateCard>
            );
        case 'ended':
            return (
                <StateCard
                    icon={CalendarX}
                    sender={sender}
                    title="Your access has ended"
                    action={
                        <Button variant="link" className="min-h-10 self-start text-body-sm" onClick={signIn}>
                            I have a new invite
                        </Button>
                    }
                >
                    {RECIPIENT_MESSAGES.ended(sender.name)}
                </StateCard>
            );
        case 'gone':
            return (
                <StateCard icon={FileQuestion} title="This link doesn't lead anywhere">
                    This delivery isn&apos;t available anymore. Ask {sender.name} to send it again.
                </StateCard>
            );
        case 'error':
            return (
                <StateCard
                    icon={WifiOff}
                    sender={sender}
                    title="We couldn't load this delivery"
                    action={
                        <Button
                            variant="primary"
                            size="lg"
                            fullWidth
                            icon={<RotateCw strokeWidth={1.75} aria-hidden className="h-4 w-4" />}
                            onClick={() => {
                                setScreen({ name: 'loading' });
                                void load();
                            }}
                        >
                            Try again
                        </Button>
                    }
                >
                    {screen.message}
                </StateCard>
            );
    }
}

/** Matches the delivery page's layout so nothing jumps when it loads. */
function LoadingView() {
    return (
        <div className="flex min-h-dvh flex-col bg-canvas" aria-busy="true">
            <span className="sr-only" role="status">
                Opening your delivery…
            </span>
            <div className="border-b border-subtle bg-surface">
                <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2.5 px-4 sm:px-6">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-4 w-48" />
                </div>
            </div>
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
                <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-8 w-72 max-w-full" />
                </div>
                <Skeleton className="h-4 w-64" />
                <Card flush>
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 border-b border-subtle px-4 py-3 last:border-b-0">
                            <Skeleton className="h-10 w-10" />
                            <div className="flex flex-1 flex-col gap-1.5">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        </div>
                    ))}
                </Card>
            </div>
        </div>
    );
}
