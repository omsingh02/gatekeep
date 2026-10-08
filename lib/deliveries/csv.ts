/**
 * CSV for spreadsheet apps (RFC 4180). Values that start with = + - @ (or a tab/CR) are prefixed
 * with ' so a crafted file name or username can't run as a formula when the export is opened.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
    if (value === null || value === undefined) return '';
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: (string | number | boolean | null | undefined)[][]): string {
    return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
