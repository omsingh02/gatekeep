import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        // Server modules validate these at import; unit tests never reach Supabase or Resend
        env: {
            NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'unit-test',
            SUPABASE_SERVICE_ROLE_KEY: 'unit-test',
            NEXT_PUBLIC_APP_URL: 'https://gatekeep.test',
        },
    },
});
