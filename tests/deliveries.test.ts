import { describe, expect, it, vi, afterEach } from 'vitest';
import {
    CODE_MAX_ATTEMPTS,
    RESEND_MAX,
    canSendAnotherCode,
    evaluateCode,
    generateCode,
    hashCode,
} from '@/lib/deliveries/verification';
import { evaluateSession } from '@/lib/deliveries/session';
import { generateReadablePassword } from '@/lib/deliveries/codes';
import { DENIAL_THRESHOLD, DENIAL_WINDOW_MS, OPEN_DEDUPE_MS, shouldNotifyDenials, shouldNotifyOpen } from '@/lib/deliveries/notifications';
import { csvCell, toCsv } from '@/lib/deliveries/csv';
import { accessProblem, inviteText, parseDownloadLimit, parseEndsAt, parsePersonRecipient } from '@/lib/deliveries/deliveries';
import { decodeCursor, encodeCursor, parseActivityFilters } from '@/lib/deliveries/activity-query';
import { defaultSettings, parseSettingsPatch } from '@/lib/deliveries/settings';
import { maskEmail, senderLabel } from '@/lib/deliveries/format';

const RID = '11111111-2222-4333-8444-555555555555';
const NOW = Date.parse('2026-10-09T12:00:00Z');
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('email codes', () => {
    it('are six digits', () => {
        for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
    });

    it('hash differently per recipient', () => {
        expect(hashCode('123456', RID)).not.toBe(hashCode('123456', '00000000-0000-4000-8000-000000000000'));
        expect(hashCode('123456', RID)).toBe(hashCode('123456', RID));
    });

    const row = (overrides = {}) => ({
        code_hash: hashCode('424242', RID),
        expires_at: iso(5 * 60 * 1000),
        attempts: 0,
        consumed_at: null,
        ...overrides,
    });

    it('accepts the right code, ignoring spaces', () => {
        expect(evaluateCode(row(), '424242', RID, NOW)).toBe('ok');
        expect(evaluateCode(row(), '424 242', RID, NOW)).toBe('ok');
    });

    it('rejects a wrong code, an expired or used code, and too many attempts', () => {
        expect(evaluateCode(row(), '000000', RID, NOW)).toBe('wrong');
        expect(evaluateCode(row({ expires_at: iso(-1) }), '424242', RID, NOW)).toBe('expired');
        expect(evaluateCode(row({ consumed_at: iso(-1000) }), '424242', RID, NOW)).toBe('expired');
        expect(evaluateCode(null, '424242', RID, NOW)).toBe('expired');
        expect(evaluateCode(row({ attempts: CODE_MAX_ATTEMPTS }), '424242', RID, NOW)).toBe('too_many');
    });

    it('allows at most RESEND_MAX codes per 10 minutes', () => {
        const recent = Array.from({ length: RESEND_MAX }, (_, i) => iso(-i * 60 * 1000));
        expect(canSendAnotherCode(recent.slice(0, RESEND_MAX - 1), NOW)).toBe(true);
        expect(canSendAnotherCode(recent, NOW)).toBe(false);
        expect(canSendAnotherCode([iso(-11 * 60 * 1000), iso(-12 * 60 * 1000), iso(-13 * 60 * 1000)], NOW)).toBe(true);
    });
});

describe('recipient sessions', () => {
    const base = { removed_at: null, ends_at: null, session_expires_at: iso(3600 * 1000) };
    it('are valid until they expire, access ends, or access is removed', () => {
        expect(evaluateSession(base, NOW)).toBe('ok');
        expect(evaluateSession({ ...base, session_expires_at: iso(-1) }, NOW)).toBe('expired');
        expect(evaluateSession({ ...base, session_expires_at: null }, NOW)).toBe('expired');
        expect(evaluateSession({ ...base, ends_at: iso(-1) }, NOW)).toBe('ended');
        expect(evaluateSession({ ...base, removed_at: iso(-1), ends_at: iso(-1) }, NOW)).toBe('removed');
    });
});

describe('access problems', () => {
    const base = { removed_at: null, ends_at: null, download_limit: 2, download_count: 2 };
    it('only checks the download limit for downloads', () => {
        expect(accessProblem(base, {}, NOW)).toBeNull();
        expect(accessProblem(base, { forDownload: true }, NOW)).toBe('download_limit');
        expect(accessProblem({ ...base, download_count: 1 }, { forDownload: true }, NOW)).toBeNull();
        expect(accessProblem({ ...base, download_limit: null }, { forDownload: true }, NOW)).toBeNull();
    });
    it('reports removal before an end date', () => {
        expect(accessProblem({ ...base, ends_at: iso(-1) }, {}, NOW)).toBe('ended');
        expect(accessProblem({ ...base, ends_at: iso(-1), removed_at: iso(-1) }, {}, NOW)).toBe('removed');
    });
});

describe('generated passwords', () => {
    it('are three readable groups with no look-alike characters', () => {
        for (let i = 0; i < 200; i++) {
            const password = generateReadablePassword();
            expect(password).toMatch(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/);
            expect(password).not.toMatch(/[0O1lI]/);
        }
    });
});

describe('owner notifications', () => {
    it('send an open notice once per day per recipient', () => {
        expect(shouldNotifyOpen(null, NOW)).toBe(true);
        expect(shouldNotifyOpen(iso(-60 * 1000), NOW)).toBe(false);
        expect(shouldNotifyOpen(iso(-OPEN_DEDUPE_MS), NOW)).toBe(true);
    });
    it('alert on denials only after the threshold, then stay quiet for the window', () => {
        expect(shouldNotifyDenials(DENIAL_THRESHOLD - 1, null, NOW)).toBe(false);
        expect(shouldNotifyDenials(DENIAL_THRESHOLD, null, NOW)).toBe(true);
        expect(shouldNotifyDenials(DENIAL_THRESHOLD + 5, iso(-60 * 1000), NOW)).toBe(false);
        expect(shouldNotifyDenials(DENIAL_THRESHOLD, iso(-DENIAL_WINDOW_MS), NOW)).toBe(true);
    });
});

describe('CSV export', () => {
    it('quotes commas, quotes and line breaks', () => {
        expect(csvCell('plain')).toBe('plain');
        expect(csvCell('a,b')).toBe('"a,b"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell('two\nlines')).toBe('"two\nlines"');
        expect(csvCell(null)).toBe('');
        expect(csvCell(3)).toBe('3');
    });
    it('neutralises spreadsheet formulas', () => {
        expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
        expect(csvCell('+1')).toBe("'+1");
        expect(csvCell('-cmd')).toBe("'-cmd");
        expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    });
    it('uses CRLF row endings', () => {
        expect(toCsv([['a', 'b'], [1, null]])).toBe('a,b\r\n1,\r\n');
    });
});

describe('recipient input', () => {
    const settings = defaultSettings(RID);

    it('lowercases emails and requires email for codes', async () => {
        vi.stubEnv('EMAIL_TRANSPORT', 'memory');
        const result = await parsePersonRecipient({ identifier: 'Maya@Acme.CO', method: 'email_code' }, settings);
        expect('value' in result && result.value.row).toMatchObject({ identifier: 'maya@acme.co', identifier_type: 'email', method: 'email_code' });
        expect('value' in result && result.value.password).toBeNull();

        const username = await parsePersonRecipient({ identifier: 'studio-wren', method: 'email_code' }, settings);
        expect(username).toMatchObject({ ok: false });
    });

    it('generates a password per person when none is given', async () => {
        const a = await parsePersonRecipient({ identifier: 'a@x.co', method: 'password' }, settings);
        const b = await parsePersonRecipient({ identifier: 'b@x.co', method: 'password' }, settings);
        const pa = 'value' in a ? a.value.password : null;
        const pb = 'value' in b ? b.value.password : null;
        expect(pa).toMatch(/^\w{4}-\w{4}-\w{4}$/);
        expect(pa).not.toBe(pb);
        expect('value' in a && a.value.row.password_hash).toMatch(/^\$2[aby]\$/);
    });

    it('falls back to passwords when email is not set up', async () => {
        vi.stubEnv('EMAIL_TRANSPORT', '');
        vi.stubEnv('RESEND_API_KEY', '');
        const result = await parsePersonRecipient({ identifier: 'a@x.co' }, settings);
        expect('value' in result && result.value.row.method).toBe('password');
        const forced = await parsePersonRecipient({ identifier: 'a@x.co', method: 'email_code' }, settings);
        expect(forced).toMatchObject({ ok: false });
    });

    it('validates end dates and download limits, using defaults when omitted', () => {
        expect(parseEndsAt('2001-01-01', null)).toMatchObject({ ok: false });
        expect(parseEndsAt(undefined, 7)).toMatchObject({ ok: true });
        expect(parseEndsAt(null, 7)).toEqual({ ok: true, value: null });
        expect(parseDownloadLimit(0, 5)).toEqual({ ok: true, value: null });
        expect(parseDownloadLimit(undefined, 5)).toEqual({ ok: true, value: 5 });
        expect(parseDownloadLimit(-1, null)).toMatchObject({ ok: false });
        expect(parseDownloadLimit(1.5, null)).toMatchObject({ ok: false });
    });

    it('builds an invite text without the password', () => {
        const text = inviteText({
            senderName: 'Avery Stone',
            title: 'Q3 pack',
            kind: 'send',
            link: 'https://gatekeep.test/aB3xY9',
            recipient: { kind: 'person', identifier: 'studio-wren', identifier_type: 'username', method: 'password', ends_at: null },
        });
        expect(text).toContain('https://gatekeep.test/aB3xY9');
        expect(text).toContain('studio-wren');
        expect(text).toContain('separately');
    });
});

describe('activity filters and cursors', () => {
    it('round-trips a cursor and rejects junk', () => {
        const cursor = encodeCursor({ created_at: '2026-10-09T12:00:00.000Z', id: RID });
        expect(decodeCursor(cursor)).toEqual({ createdAt: '2026-10-09T12:00:00.000Z', id: RID });
        expect(decodeCursor('not-a-cursor')).toBeNull();
        expect(decodeCursor(null)).toBeNull();
    });
    it('validates filters', () => {
        expect(parseActivityFilters(new URLSearchParams('type=opened,denied'))).toEqual({ filters: { types: ['opened', 'denied'] } });
        expect(parseActivityFilters(new URLSearchParams('type=hacked'))).toMatchObject({ error: expect.any(String) });
        expect(parseActivityFilters(new URLSearchParams('delivery=nope'))).toMatchObject({ error: expect.any(String) });
    });
});

describe('settings', () => {
    it('accepts valid changes and rejects invalid ones', () => {
        expect(parseSettingsPatch({ displayName: '  Avery   Stone ', notifyOpened: false })).toEqual({
            update: { display_name: 'Avery Stone', notify_opened: false },
        });
        expect(parseSettingsPatch({ displayName: '' })).toEqual({ update: { display_name: null } });
        expect(parseSettingsPatch({ defaultMethod: 'carrier-pigeon' })).toMatchObject({ error: expect.any(String) });
        expect(parseSettingsPatch({ defaultDownloadLimit: 0 })).toMatchObject({ error: expect.any(String) });
        expect(parseSettingsPatch({ notifyDenied: 'yes' })).toMatchObject({ error: expect.any(String) });
    });
    it('describes the sender for recipients', () => {
        expect(senderLabel({ display_name: 'Avery Stone', organization: 'Northwind' }, 'a@n.co')).toBe('Avery Stone from Northwind');
        expect(senderLabel({ display_name: null, organization: null }, 'a@n.co')).toBe('a@n.co');
        expect(maskEmail('maya@acme.co')).toBe('m•••@acme.co');
    });
});
