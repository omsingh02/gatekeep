/** Owner passwords: the minimum /api/account/password and the reset page enforce. */
export const OWNER_PASSWORD_MIN = 10;

export type PasswordStrength = {
    level: 'short' | 'weak' | 'fair' | 'strong';
    label: string;
    hint: string;
    tone: 'danger' | 'warning' | 'success';
};

const COMMON = ['password', 'gatekeep', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', '123456', 'abc123'];

/**
 * A quick, local estimate to guide people towards longer passwords. It is a hint, not a rule:
 * the only hard requirement is the minimum length.
 */
export function passwordStrength(password: string): PasswordStrength {
    if (password.length < OWNER_PASSWORD_MIN) {
        const more = OWNER_PASSWORD_MIN - password.length;
        return {
            level: 'short',
            label: 'Too short',
            hint: `Use at least ${OWNER_PASSWORD_MIN} characters (${more} more).`,
            tone: 'danger',
        };
    }
    const lower = password.toLowerCase();
    const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
    const unique = new Set(password).size;
    const common = COMMON.some((word) => lower.includes(word));
    const sequence = /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef)/.test(lower);

    if (unique <= 3 || ((common || sequence) && password.length < 16)) {
        return { level: 'weak', label: 'Weak', hint: 'Avoid common words and sequences. A few unrelated words work well.', tone: 'danger' };
    }
    if (password.length >= 16 || (password.length >= 12 && classes >= 3)) {
        return { level: 'strong', label: 'Strong', hint: 'Keep it in your password manager.', tone: 'success' };
    }
    return { level: 'fair', label: 'Fair', hint: 'Longer is stronger: add another word or a few characters.', tone: 'warning' };
}
