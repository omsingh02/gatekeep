import { describe, expect, it } from 'vitest';
import { escapeHtml, renderEmail, safeUrl } from '@/lib/email/template';

const base = { appUrl: 'https://gatekeep.example.com/', heading: 'Maya Chen shared Q3 board pack with you' };

describe('renderEmail', () => {
    it('renders the heading, preheader, button and logo in HTML and text', () => {
        const { html, text } = renderEmail({
            ...base,
            preheader: 'Open it with a code sent to this address.',
            paragraphs: ['Hi,\nHere are the files.'],
            button: { label: 'Open delivery', url: 'https://gatekeep.example.com/aB3xY9' },
            rows: [['Access ends', 'Oct 14 at 6:00 PM']],
        });
        expect(html).toContain('Maya Chen shared Q3 board pack with you');
        expect(html).toContain('Open it with a code sent to this address.');
        expect(html).toContain('href="https://gatekeep.example.com/aB3xY9"');
        expect(html).toContain('src="https://gatekeep.example.com/brand/logo-mark-email.png"');
        expect(html).toContain('Hi,<br>Here are the files.');
        expect(text).toContain('Open delivery: https://gatekeep.example.com/aB3xY9');
        expect(text).toContain('Access ends: Oct 14 at 6:00 PM');
        expect(text.endsWith('Sent by Gatekeep')).toBe(true);
    });

    it('escapes every user-supplied value', () => {
        const { html } = renderEmail({
            ...base,
            heading: '<script>alert(1)</script>',
            paragraphs: ['Tom & "Jerry"'],
            quote: { text: '<b>hi</b>', attribution: '— <i>Maya</i>' },
            rows: [['<x>', '<y>']],
            code: '<123>',
            footer: ['<footer>'],
        });
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<b>hi</b>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(html).toContain('Tom &amp; &quot;Jerry&quot;');
        expect(html).toContain('&lt;123&gt;');
        expect(html).toContain('&lt;footer&gt;');
    });

    it('shows a one-time code without requiring a button', () => {
        const { html, text } = renderEmail({ ...base, heading: 'Your code', code: '482913' });
        expect(html).toContain('482913');
        expect(html).not.toContain("If the button doesn't work");
        expect(text).toContain('482913');
    });
});

describe('safeUrl', () => {
    it('allows http(s) and mailto links', () => {
        expect(safeUrl(' https://a.example/x ')).toBe('https://a.example/x');
        expect(safeUrl('mailto:owner@example.com')).toBe('mailto:owner@example.com');
    });

    it('rejects other schemes', () => {
        expect(() => safeUrl('javascript:alert(1)')).toThrow();
        expect(() => renderEmail({ ...base, button: { label: 'x', url: 'data:text/html,hi' } })).toThrow();
    });
});

describe('escapeHtml', () => {
    it('escapes quotes and angle brackets', () => {
        expect(escapeHtml(`<a href="x">'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
    });
});
