/**
 * The one email layout Gatekeep uses: light, flat and inline-styled, because dark emails render
 * poorly in many clients (see docs/DESIGN.md → Email). Every email has an HTML and a matching
 * plain-text version.
 *
 * Text fields are plain strings; `**bold**` is the only markup and is rendered as <strong>.
 * Everything is HTML-escaped, so values from users (file names, messages) are safe to pass.
 */

export interface EmailContent {
    /** Hidden preview line shown after the subject in most inboxes */
    preheader: string;
    heading: string;
    paragraphs?: string[];
    /** Label/value pairs, e.g. Files, Access ends */
    rows?: { label: string; value: string }[];
    /** A one-time code, shown large in a monospace box */
    code?: string;
    /** A quoted message from the sender */
    quote?: { from: string; text: string };
    button?: { label: string; url: string };
    /** Smaller paragraphs after the button */
    after?: string[];
    /** Footer lines: why they got this and who to contact */
    footer?: string[];
    /** Sender branding shown at the top. Without a logo, the name is shown as text. */
    brand?: { name: string; logoUrl?: string | null };
}

export interface RenderedEmail {
    html: string;
    text: string;
}

const COLORS = {
    canvas: '#f5f5f5',
    card: '#ffffff',
    border: '#e5e5e5',
    text: '#1a1a1a',
    muted: '#5c5c5c',
    faint: '#8a8a8a',
    codeBg: '#f5f5f5',
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Escape, then turn **bold** into <strong>. */
function inline(value: string): string {
    return escapeHtml(value).replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:600;color:' + COLORS.text + '">$1</strong>');
}

/** Plain-text version of the inline markup. */
function plain(value: string): string {
    return value.replace(/\*\*(.+?)\*\*/g, '$1');
}

function safeUrl(url: string): string {
    return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#';
}

function paragraph(text: string, size = 15, color = COLORS.text): string {
    return `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.55;color:${color}">${inline(text)}</p>`;
}

export function renderEmail(content: EmailContent): RenderedEmail {
    const parts: string[] = [];

    if (content.brand) {
        const brand = content.brand.logoUrl
            ? `<img src="${safeUrl(content.brand.logoUrl)}" alt="${escapeHtml(content.brand.name)}" height="32" style="display:block;height:32px;max-width:180px;border:0">`
            : `<span style="font-size:15px;font-weight:600;color:${COLORS.text}">${escapeHtml(content.brand.name)}</span>`;
        parts.push(`<div style="margin:0 0 24px">${brand}</div>`);
    }

    parts.push(
        `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.35;font-weight:600;color:${COLORS.text}">${inline(content.heading)}</h1>`,
    );

    for (const p of content.paragraphs ?? []) parts.push(paragraph(p));

    if (content.quote) {
        parts.push(
            `<div style="margin:0 0 20px;padding:12px 16px;border-left:3px solid ${COLORS.border};background:${COLORS.codeBg}">` +
                `<p style="margin:0 0 4px;font-size:13px;color:${COLORS.muted}">${escapeHtml(content.quote.from)} wrote:</p>` +
                `<p style="margin:0;font-size:15px;line-height:1.55;color:${COLORS.text};white-space:pre-line">${escapeHtml(content.quote.text)}</p>` +
                `</div>`,
        );
    }

    if (content.rows?.length) {
        const rows = content.rows
            .map(
                (row) =>
                    `<tr><td style="padding:8px 0;border-top:1px solid ${COLORS.border};font-size:14px;color:${COLORS.muted};width:38%;vertical-align:top">${escapeHtml(row.label)}</td>` +
                    `<td style="padding:8px 0;border-top:1px solid ${COLORS.border};font-size:14px;color:${COLORS.text};vertical-align:top">${inline(row.value)}</td></tr>`,
            )
            .join('');
        parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;border-bottom:1px solid ${COLORS.border}">${rows}</table>`);
    }

    if (content.code) {
        parts.push(
            `<div style="margin:0 0 20px;padding:16px;border:1px solid ${COLORS.border};border-radius:6px;background:${COLORS.codeBg};text-align:center">` +
                `<span style="font-family:${MONO};font-size:30px;letter-spacing:8px;font-weight:600;color:${COLORS.text}">${escapeHtml(content.code)}</span></div>`,
        );
    }

    if (content.button) {
        parts.push(
            `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 24px"><tr><td style="border-radius:6px;background:${COLORS.text}">` +
                `<a href="${safeUrl(content.button.url)}" style="display:inline-block;padding:12px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px">${escapeHtml(content.button.label)}</a>` +
                `</td></tr></table>`,
        );
    }

    for (const p of content.after ?? []) parts.push(paragraph(p, 14, COLORS.muted));

    const footer = (content.footer ?? [])
        .map((line) => `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${COLORS.faint}">${inline(line)}</p>`)
        .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeHtml(content.heading.replace(/\*\*/g, ''))}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.canvas};font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.canvas}">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:32px;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px">
${parts.join('\n')}
</td></tr>
<tr><td style="padding:20px 8px 0">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    const lines: string[] = [];
    if (content.brand) lines.push(content.brand.name, '');
    lines.push(plain(content.heading), '');
    for (const p of content.paragraphs ?? []) lines.push(plain(p), '');
    if (content.quote) lines.push(`${content.quote.from} wrote:`, ...content.quote.text.split('\n').map((l) => `> ${l}`), '');
    if (content.rows?.length) {
        for (const row of content.rows) lines.push(`${row.label}: ${plain(row.value)}`);
        lines.push('');
    }
    if (content.code) lines.push(content.code, '');
    if (content.button) lines.push(`${content.button.label}: ${content.button.url}`, '');
    for (const p of content.after ?? []) lines.push(plain(p), '');
    if (content.footer?.length) lines.push('--', ...content.footer.map(plain));

    return { html, text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n' };
}
