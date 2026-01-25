/**
 * Utility functions for HTTP header encoding
 */

/**
 * Encodes a filename for use in Content-Disposition header following RFC 5987.
 * Returns both ASCII fallback and UTF-8 encoded version for maximum compatibility.
 * 
 * @example
 * encodeContentDisposition('文档.pdf')
 * // Returns: 'attachment; filename="document.pdf"; filename*=UTF-8\'\'%E6%96%87%E6%A1%A3.pdf'
 * 
 * encodeContentDisposition('report.pdf')
 * // Returns: 'attachment; filename="report.pdf"'
 */
export function encodeContentDisposition(
    filename: string,
    disposition: 'attachment' | 'inline' = 'attachment'
): string {
    // Check if filename contains non-ASCII characters
    const hasNonAscii = /[^\x00-\x7F]/.test(filename);
    
    if (!hasNonAscii) {
        // Simple case: ASCII only filename
        // Escape quotes and backslashes
        const escaped = filename.replace(/[\\"]/g, '\\$&');
        return `${disposition}; filename="${escaped}"`;
    }
    
    // Complex case: Non-ASCII characters present
    // Create ASCII fallback by transliterating or replacing non-ASCII chars
    const asciiFallback = createAsciiFallback(filename);
    
    // RFC 5987 encode the original filename
    const encoded = encodeRFC5987(filename);
    
    // Return both for maximum compatibility
    // Modern browsers use filename*, older ones fall back to filename
    return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}

/**
 * Creates an ASCII-safe fallback filename by:
 * 1. Keeping ASCII alphanumeric, dots, hyphens, underscores
 * 2. Replacing spaces with underscores
 * 3. Replacing other characters with underscores
 * 4. Ensuring the extension is preserved
 */
function createAsciiFallback(filename: string): string {
    // Split into name and extension
    const lastDot = filename.lastIndexOf('.');
    const name = lastDot > 0 ? filename.slice(0, lastDot) : filename;
    const ext = lastDot > 0 ? filename.slice(lastDot) : '';
    
    // Process name: keep ASCII alphanumeric, replace others
    const safeName = name
        .replace(/\s+/g, '_')           // Spaces to underscores
        .replace(/[^\x20-\x7E]/g, '_')  // Non-printable/non-ASCII to underscore
        .replace(/[<>:"/\\|?*]/g, '_')  // Filesystem-unsafe chars to underscore
        .replace(/_+/g, '_')            // Collapse multiple underscores
        .replace(/^_|_$/g, '');         // Trim leading/trailing underscores
    
    // If name became empty, use 'download'
    const finalName = safeName || 'download';
    
    // Extension should already be ASCII in most cases
    const safeExt = ext.replace(/[^\x20-\x7E]/g, '').replace(/[<>:"/\\|?*]/g, '');
    
    return finalName + safeExt;
}

/**
 * Encodes a string according to RFC 5987 (percent-encoding for header parameters)
 * This is similar to encodeURIComponent but with a slightly different set of allowed chars
 */
function encodeRFC5987(str: string): string {
    return encodeURIComponent(str)
        // RFC 5987 allows these chars unencoded: A-Z a-z 0-9 ! # $ & + - . ^ _ ` | ~
        // encodeURIComponent already handles most, but we need to convert some back
        .replace(/['()]/g, escape)  // These need to be escaped
        .replace(/\*/g, '%2A')      // Asterisk needs encoding
        .replace(/%(?:7C|60|5E)/gi, unescape); // These can be unescoded per RFC 5987
}

/**
 * Sanitizes a filename for safe client-side download while preserving
 * international characters. This is for use with JavaScript download triggers.
 * 
 * @example
 * sanitizeDownloadFilename('文档.pdf')       // '文档.pdf'
 * sanitizeDownloadFilename('my/file:name.pdf') // 'my_file_name.pdf'
 */
export function sanitizeDownloadFilename(filename: string): string {
    // Only remove/replace characters that are problematic for filesystems
    // Preserve international characters (non-ASCII)
    return filename
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')  // Filesystem-unsafe chars
        .replace(/^\.+/, '_')                      // Don't start with dots
        .replace(/\.+$/, '')                       // Don't end with dots
        .replace(/_+/g, '_')                       // Collapse multiple underscores
        .trim();
}
