import { describe, expect, it } from 'vitest';
import { OWNER_PASSWORD_MIN, passwordStrength } from '@/lib/utils/passwordStrength';

describe('passwordStrength', () => {
    it('asks for the minimum length first', () => {
        const result = passwordStrength('short');
        expect(result.level).toBe('short');
        expect(result.hint).toContain(`${OWNER_PASSWORD_MIN} characters`);
        expect(result.hint).toContain('5 more');
    });

    it('calls repeated characters, common words and sequences weak', () => {
        expect(passwordStrength('aaaaaaaaaaaa').level).toBe('weak');
        expect(passwordStrength('password1234').level).toBe('weak');
        expect(passwordStrength('gatekeep-demo').level).toBe('weak');
    });

    it('rates length and variety', () => {
        expect(passwordStrength('mountain-lake').level).toBe('fair');
        expect(passwordStrength('Mountain-lake7').level).toBe('strong');
        expect(passwordStrength('correct horse battery staple').level).toBe('strong');
    });
});
