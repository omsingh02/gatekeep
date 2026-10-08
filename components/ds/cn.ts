/** Join class names, skipping falsy values. Later classes are expected to win by design (no conflicting utilities). */
export function cn(...classes: Array<string | false | null | undefined>): string {
    return classes.filter(Boolean).join(' ');
}
