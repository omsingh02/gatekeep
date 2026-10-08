import { describe, expect, it } from 'vitest';
import { codeEmail, deniedEmail, inviteEmail, passwordResetEmail } from '@/lib/email/messages';

const sender = { name: 'Avery Stone', label: 'Avery Stone from Northwind Studio', logoUrl: null };

describe('emails', () => {
    it('invites name the sender, never include a password, and say how to get in', () => {
        const email = inviteEmail({
            sender,
            kind: 'send',
            title: 'Q3 board pack',
            message: 'Here are the files we discussed.',
            fileNames: ['deck.pdf', 'model.xlsx'],
            url: 'https://gatekeep.test/aB3xY9',
            method: 'email_code',
            recipientEmail: 'maya@acme.co',
            endsAt: null,
            downloadLimit: 3,
        });
        expect(email.subject).toBe('Avery Stone sent you "Q3 board pack"');
        expect(email.text).toContain('https://gatekeep.test/aB3xY9');
        expect(email.text).toContain('6-digit code to maya@acme.co');
        expect(email.text).toContain('Here are the files we discussed.');
        expect(email.text.toLowerCase()).not.toMatch(/password:/);

        const passwordInvite = inviteEmail({
            sender,
            kind: 'send',
            title: 'Q3 board pack',
            message: null,
            fileNames: ['deck.pdf'],
            url: 'https://gatekeep.test/aB3xY9',
            method: 'password',
            recipientEmail: 'maya@acme.co',
            endsAt: null,
            downloadLimit: null,
        });
        expect(passwordInvite.text).toContain("It isn't in this email");
    });

    it('request invites ask for uploads', () => {
        const email = inviteEmail({
            sender,
            kind: 'request',
            title: 'Signed contracts',
            message: null,
            fileNames: [],
            url: 'https://gatekeep.test/Up1oad',
            method: 'email_code',
            recipientEmail: 'maya@acme.co',
            endsAt: null,
            downloadLimit: null,
        });
        expect(email.subject).toBe('Avery Stone asked you to upload files');
        expect(email.text).toContain('Upload files: https://gatekeep.test/Up1oad');
    });

    it('code emails put the code in the subject and body', () => {
        const email = codeEmail({ sender, title: 'Q3 board pack', code: '424242' });
        expect(email.subject).toBe('424242 is your code for "Q3 board pack"');
        expect(email.text).toContain('424242');
        expect(email.text).toContain('10 minutes');
    });

    it('owner alerts use plain reasons and plurals', () => {
        const email = deniedEmail({
            title: 'Q3',
            count: 1,
            minutes: 15,
            reasons: ['Wrong password'],
            ips: ['203.0.113.7'],
            activityUrl: 'https://gatekeep.test/admin/deliveries/x',
            settingsUrl: 'https://gatekeep.test/admin/settings',
        });
        expect(email.subject).toBe('1 denied attempt on "Q3"');
        expect(email.text).toContain('Wrong password');
    });

    it('password reset links to the reset page', () => {
        const email = passwordResetEmail({ email: 'o@n.co', instanceUrl: 'https://gatekeep.test', resetUrl: 'https://x.supabase.co/auth/v1/verify?token=t' });
        expect(email.subject).toBe('Reset your Gatekeep password');
        expect(email.text).toContain('https://x.supabase.co/auth/v1/verify?token=t');
    });
});
