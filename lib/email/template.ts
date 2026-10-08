/**
 * Gatekeep Mono email layout (docs/DESIGN.md → Email): a light, table-based, inline-styled
 * template that renders consistently in Gmail, Outlook and Apple Mail, plus a matching
 * plain-text version. This file only provides layout primitives; the wording of each email
 * lives with the code that sends it and follows docs/VOICE.md.
 *
 * Every string is HTML-escaped. Links must be http(s) or mailto.
 */

export interface EmailButton {
    label: string;
    url: string;
}

export interface EmailContent {
    /** Absolute base URL of this instance, used for the logo image */
    appUrl: string;
    /** Hidden preview line shown by inbox lists after the subject */
    preheader?: string;
    heading: string;
    /** Body paragraphs (plain text; line breaks inside a paragraph are kept) */
    paragraphs?: string[];
    /** Optional quoted message from the sender, shown in a bordered block */
    quote?: { text: string; attribution?: string };
    /** The single primary action */
    button?: EmailButton;
    /** Label/value pairs, e.g. [['Files', '3'], ['Access ends', 'Oct 14']] */
    rows?: Array<[string, string]>;
    /** A one-time code or similar value, shown large in a mono box */
    code?: string;
    /** Small print under the main content (e.g. why they got this email) */
    note?: string;
    /** Footer lines; defaults to "Sent by Gatekeep" */
    footer?: string[];
}

export interface RenderedEmail {
    html: string;
    text: string;
}

const C = {
    page: '#f5f5f5',
    card: '#ffffff',
    border: '#e5e5e5',
    text: '#1a1a1a',
    secondary: '#525252',
    tertiary: '#737373',
    inset: '#f5f5f5',
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function escapeHtml(value: string): string {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Returns the URL if it is safe to put in an href, otherwise throws. */
export function safeUrl(url: string): string {
    const trimmed = String(url).trim();
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
        throw new Error(`Refusing to render an email link that isn't http(s) or mailto: ${trimmed.slice(0, 40)}`);
    }
    return trimmed;
}

const nl2br = (value: string) => escapeHtml(value).replace(/\r?\n/g, '<br>');

export function renderEmail(content: EmailContent): RenderedEmail {
    const appUrl = content.appUrl.replace(/\/$/, '');
    const footer = content.footer ?? ['Sent by Gatekeep'];
    const buttonUrl = content.button ? safeUrl(content.button.url) : null;

    const parts: string[] = [];

    parts.push(
        `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:20px;line-height:28px;font-weight:600;color:${C.text};">${escapeHtml(content.heading)}</h1>`
    );

    for (const p of content.paragraphs ?? []) {
        parts.push(`<p style="margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.text};">${nl2br(p)}</p>`);
    }

    if (content.quote) {
        parts.push(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border-collapse:collapse;"><tr><td style="border-left:3px solid ${C.border};padding:4px 0 4px 14px;font-family:${FONT};font-size:15px;line-height:24px;color:${C.secondary};">${nl2br(content.quote.text)}${
                content.quote.attribution
                    ? `<div style="margin-top:6px;font-size:13px;line-height:20px;color:${C.tertiary};">${escapeHtml(content.quote.attribution)}</div>`
                    : ''
            }</td></tr></table>`
        );
    }

    if (content.code) {
        parts.push(
            `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px;border-collapse:separate;"><tr><td style="background:${C.inset};border:1px solid ${C.border};border-radius:6px;padding:12px 20px;font-family:${MONO};font-size:26px;line-height:32px;letter-spacing:6px;font-weight:600;color:${C.text};">${escapeHtml(content.code)}</td></tr></table>`
        );
    }

    if (content.button && buttonUrl) {
        parts.push(
            `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;border-collapse:separate;"><tr><td style="background:${C.text};border-radius:6px;"><a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:11px 20px;font-family:${FONT};font-size:15px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(content.button.label)}</a></td></tr></table>`
        );
    }

    if (content.rows?.length) {
        const rows = content.rows
            .map(
                ([label, value], i) =>
                    `<tr><td style="padding:10px 0;${i ? `border-top:1px solid ${C.border};` : ''}font-family:${FONT};font-size:14px;line-height:20px;color:${C.tertiary};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:10px 0 10px 16px;${i ? `border-top:1px solid ${C.border};` : ''}font-family:${FONT};font-size:14px;line-height:20px;color:${C.text};text-align:right;">${nl2br(value)}</td></tr>`
            )
            .join('');
        parts.push(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border-collapse:collapse;border-top:1px solid ${C.border};border-bottom:1px solid ${C.border};">${rows}</table>`
        );
    }

    if (buttonUrl) {
        parts.push(
            `<p style="margin:0 0 14px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.tertiary};">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(buttonUrl)}" style="color:${C.secondary};word-break:break-all;">${escapeHtml(buttonUrl)}</a></p>`
        );
    }

    if (content.note) {
        parts.push(`<p style="margin:8px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.tertiary};">${nl2br(content.note)}</p>`);
    }

    const preheader = content.preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.preheader)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>`
        : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};border-collapse:collapse;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:collapse;">
<tr><td style="padding:0 0 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
<td style="vertical-align:middle;"><img src="${escapeHtml(appUrl)}/brand/logo-mark-email.png" width="28" height="28" alt="" style="display:block;border:0;border-radius:6px;"></td>
<td style="padding-left:10px;vertical-align:middle;font-family:${FONT};font-size:16px;line-height:20px;font-weight:600;color:${C.text};">Gatekeep</td>
</tr></table>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:8px;padding:28px 28px 22px;">
${parts.join('\n')}
</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.tertiary};">
${footer.map((line) => escapeHtml(line)).join('<br>')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    const text = [
        content.heading,
        '',
        ...(content.paragraphs ?? []).flatMap((p) => [p, '']),
        ...(content.quote ? [content.quote.text.split('\n').map((l) => `> ${l}`).join('\n'), ...(content.quote.attribution ? [`  ${content.quote.attribution}`] : []), ''] : []),
        ...(content.code ? [content.code, ''] : []),
        ...(content.button && buttonUrl ? [`${content.button.label}: ${buttonUrl}`, ''] : []),
        ...(content.rows?.length ? [...content.rows.map(([label, value]) => `${label}: ${value}`), ''] : []),
        ...(content.note ? [content.note, ''] : []),
        '--',
        ...footer,
    ].join('\n');

    return { html, text };
}
