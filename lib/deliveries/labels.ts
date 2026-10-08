import type { ActivityReason, ActivityType } from '@/lib/types';

/** Human labels for denial reasons (docs/VOICE.md: never show raw enum values). */
export const REASON_LABELS: Record<ActivityReason, string> = {
    wrong_password: 'Wrong password',
    wrong_code: 'Wrong code',
    not_on_delivery: 'Not on this delivery',
    ended: 'Access had ended',
    download_limit: 'Download limit reached',
    removed: 'Access was removed',
    throttled: 'Too many tries',
    code_expired: 'Code expired',
    session_ended: 'Session ended',
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
    opened: 'Opened',
    previewed: 'Previewed',
    downloaded: 'Downloaded',
    downloaded_all: 'Downloaded all',
    denied: 'Denied',
    code_sent: 'Code sent',
    uploaded: 'Uploaded',
    access_given: 'Access given',
    access_removed: 'Access removed',
    invite_sent: 'Invite sent',
};

export const ANYONE_LABEL = 'Anyone with the password';

/** Messages shown to recipients. Some name the sender, so they're functions. */
export const RECIPIENT_MESSAGES = {
    credentials: "That email, username or password doesn't match. Check what you were sent and try again.",
    code: "That code doesn't match or has expired. Use the code in the latest email, or send a new one.",
    codeSent: "If that email has access, we've sent it a 6-digit code. It works for 10 minutes.",
    throttled: 'Too many tries. Wait a few minutes, then try again.',
    sessionEnded: "Your session ended. Confirm it's you again to continue.",
    notFound: "This link doesn't lead anywhere. Check you copied all of it, or ask the person who sent it.",
    invalidEmail: 'Enter the email address the invite was sent to.',
    ended: (sender: string) => `Your access to this delivery has ended. Ask ${sender} for a new invite.`,
    removed: (sender: string) => `${sender} removed your access to this delivery.`,
    downloadLimit: (sender: string) => `You've used all your downloads for this delivery. Ask ${sender} if you need more.`,
    notARequest: "This delivery doesn't accept uploads.",
    requestFull: (max: number) => `You've uploaded the most files this request allows (${max}).`,
    fileNotInDelivery: "That file isn't part of this delivery.",
    unavailable: "We couldn't prepare the file. Try again in a moment.",
} as const;
