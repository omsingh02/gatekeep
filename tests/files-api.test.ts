import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

/**
 * The Files and Folders API (app/api/files/**, app/api/folders/**): every handler signs the owner in
 * with validateAuth + getSignedIn before it touches the database, and the shapes and rules it answers
 * with come from lib/files.
 */

const session = vi.hoisted(() => ({ user: null as User | null, aal: 'aal1' as 'aal1' | 'aal2' }));
const database = vi.hoisted(() => ({ touched: 0 }));

/** An unsigned token: getSignedIn only reads the payload of a token the auth server accepted. */
function token(claims: Record<string, unknown>): string {
    const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    return `${part({ alg: 'HS256', typ: 'JWT' })}.${part(claims)}.signature`;
}

vi.mock('@/lib/supabase/server', () => ({
    createClient: async () => ({
        auth: {
            getSession: async () => ({
                data: { session: session.user ? { access_token: token({ sub: session.user.id, aal: session.aal }) } : null },
            }),
            getUser: async () => ({ data: { user: session.user } }),
        },
    }),
}));

vi.mock('@/lib/supabase/admin', () => ({
    createAdminClient: () => {
        database.touched += 1;
        throw new Error('The database must not be reached before the owner is signed in');
    },
}));

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const params = { params: Promise.resolve({ id: ID }) };
const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

type Call = () => Promise<Response>;

/** Every handler of every Files and Folders route. A new one must be added here (checked below). */
async function handlers(): Promise<Record<string, Call>> {
    const files = await import('@/app/api/files/route');
    const stats = await import('@/app/api/files/stats/route');
    const file = await import('@/app/api/files/[id]/route');
    const url = await import('@/app/api/files/[id]/url/route');
    const presign = await import('@/app/api/files/presign/route');
    const confirm = await import('@/app/api/files/confirm/route');
    const folders = await import('@/app/api/folders/route');
    const folder = await import('@/app/api/folders/[id]/route');
    const contents = await import('@/app/api/folders/[id]/contents/route');
    const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(`http://localhost${path}`, init);
    return {
        'GET /api/files': () => files.GET(req('/api/files')),
        'GET /api/files/stats': () => stats.GET(),
        'GET /api/files/[id]': () => file.GET(req(`/api/files/${ID}`), params),
        'PATCH /api/files/[id]': () => file.PATCH(req(`/api/files/${ID}`, { ...json({ name: 'x.txt' }), method: 'PATCH' }), params),
        'DELETE /api/files/[id]': () => file.DELETE(req(`/api/files/${ID}`, { method: 'DELETE' }), params),
        'GET /api/files/[id]/url': () => url.GET(req(`/api/files/${ID}/url?action=download`), params),
        'POST /api/files/presign': () => presign.POST(req('/api/files/presign', json({ name: 'x.txt', size: 1, mimeType: 'text/plain' }))),
        'POST /api/files/confirm': () => confirm.POST(req('/api/files/confirm', json({ path: 'x', name: 'x.txt', mimeType: 'text/plain' }))),
        'GET /api/folders': () => folders.GET(req('/api/folders')),
        'POST /api/folders': () => folders.POST(req('/api/folders', json({ name: 'Contracts' }))),
        'GET /api/folders/[id]': () => folder.GET(req(`/api/folders/${ID}`), params),
        'PATCH /api/folders/[id]': () => folder.PATCH(req(`/api/folders/${ID}`, { ...json({ name: 'Contracts' }), method: 'PATCH' }), params),
        'DELETE /api/folders/[id]': () => folder.DELETE(req(`/api/folders/${ID}`, { method: 'DELETE' }), params),
        'GET /api/folders/[id]/contents': () => contents.GET(req(`/api/folders/${ID}/contents`), params),
    };
}

const account = (overrides: Partial<User>): User =>
    ({ id: 'owner-1', email: 'owner@example.test', app_metadata: { role: 'owner' }, factors: [], ...overrides }) as unknown as User;
const verified = [{ id: 'f1', factor_type: 'totp', status: 'verified' }] as unknown as User['factors'];

beforeEach(() => {
    database.touched = 0;
    // validateAuth logs every refusal
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('Files and Folders API: who can use it', () => {
    it('covers every handler of every route under app/api/files and app/api/folders', async () => {
        const root = join(__dirname, '..');
        const routes: string[] = [];
        const walk = (dir: string) => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) walk(join(dir, entry.name));
                else if (entry.name === 'route.ts') routes.push(join(dir, entry.name));
            }
        };
        walk(join(root, 'app/api/files'));
        walk(join(root, 'app/api/folders'));
        const exported = routes.flatMap((path) => {
            const source = readFileSync(path, 'utf8');
            const route = `/${relative(join(root, 'app'), path).replace(/\\/g, '/').replace(/\/route\.ts$/, '')}`;
            return [...source.matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)\b/g)].map((m) => `${m[1]} ${route}`);
        });
        expect(exported.sort()).toEqual(Object.keys(await handlers()).sort());
    });

    it('asks a password-only session of an account with two-factor sign-in for its code, everywhere', async () => {
        session.user = account({ factors: verified });
        session.aal = 'aal1';
        for (const [name, call] of Object.entries(await handlers())) {
            const res = await call();
            expect(res.status, name).toBe(403);
            expect(await res.json(), name).toEqual({
                error: 'Enter the code from your authenticator app to finish signing in.',
                code: 'ERR_TWO_FACTOR_REQUIRED',
            });
        }
        expect(database.touched).toBe(0);
    });

    it('refuses an account that is not the owner, and a request without a session', async () => {
        session.user = account({ app_metadata: {} });
        session.aal = 'aal2';
        for (const [name, call] of Object.entries(await handlers())) {
            const res = await call();
            expect(res.status, name).toBe(403);
            expect(await res.json(), name).toEqual({ error: "This account doesn't have access to this Gatekeep.", code: 'ERR_FORBIDDEN' });
        }
        session.user = null;
        for (const [name, call] of Object.entries(await handlers())) {
            const res = await call();
            expect(res.status, name).toBe(401);
            expect(await res.json(), name).toEqual({ error: 'Sign in to continue.', code: 'ERR_UNAUTHORIZED' });
        }
        expect(database.touched).toBe(0);
    });

    it('lets the owner through once the code is entered; unexpected errors are logged, not shown', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        session.user = account({ factors: verified });
        session.aal = 'aal2';
        const res = await (await handlers())['GET /api/files']();
        // Past sign-in, the route reaches for the database, which this test refuses
        expect(database.touched).toBeGreaterThan(0);
        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'Something went wrong on our side. Try again in a moment.', code: 'ERR_SERVER' });
        expect(logged).toHaveBeenCalledTimes(1);
        expect(JSON.parse(logged.mock.calls[0][0] as string)).toMatchObject({ level: 'ERROR', route: '/api/files', action: 'GET' });
    });
});

describe('Files and Folders API: shapes', () => {
    it('serializes a file in camelCase, without its storage path or owner', async () => {
        const { serializeFile } = await import('@/lib/files/library');
        const row = {
            id: ID,
            original_filename: 'Q3 deck.pdf',
            file_size: 2048,
            mime_type: 'application/pdf',
            folder_id: 'folder-1',
            created_at: '2026-10-01T10:00:00Z',
            updated_at: '2026-10-02T10:00:00Z',
            folders: { name: 'Board' },
            // Columns that must never come out, even if a query selected them
            filename: '1700000000000-x.pdf',
            file_path: '1700000000000-x.pdf',
            uploaded_by: 'owner-1',
        };
        expect(serializeFile(row)).toEqual({
            id: ID,
            name: 'Q3 deck.pdf',
            size: 2048,
            mimeType: 'application/pdf',
            folderId: 'folder-1',
            folderName: 'Board',
            createdAt: '2026-10-01T10:00:00Z',
            updatedAt: '2026-10-02T10:00:00Z',
        });
        expect(serializeFile({ ...row, folder_id: null, folders: null }).folderName).toBeNull();
    });

    it('serializes a folder in camelCase, without its owner', async () => {
        const { serializeFolder } = await import('@/lib/files/library');
        const row = { id: ID, name: 'Board', parent_id: null, created_at: 'c', updated_at: 'u', uploaded_by: 'owner-1', deleted_at: null };
        expect(serializeFolder(row)).toEqual({ id: ID, name: 'Board', parentId: null, createdAt: 'c', updatedAt: 'u' });
    });
});

describe('Files and Folders API: name rules', () => {
    it('cleans folder names and says what to fix when nothing is left', async () => {
        const { parseFolderName } = await import('@/lib/files/rules');
        expect(parseFolderName('  Q3   reports ')).toEqual({ value: 'Q3 reports' });
        expect(parseFolderName('Q3: reports?')).toEqual({ value: 'Q3 reports' });
        expect(parseFolderName('unnamed')).toEqual({ value: 'unnamed' });
        expect(parseFolderName('')).toEqual({ error: 'Enter a folder name.' });
        expect(parseFolderName('   ')).toEqual({ error: 'Enter a folder name.' });
        expect(parseFolderName(42)).toEqual({ error: 'Enter a folder name.' });
        expect(parseFolderName('/<>/')).toEqual({ error: 'Enter a folder name without / \\ < > : " | ? or *.' });
    });

    it('cleans file names the same way', async () => {
        const { parseFileName } = await import('@/lib/files/rules');
        expect(parseFileName(' contract (final).pdf ')).toEqual({ value: 'contract (final).pdf' });
        expect(parseFileName('')).toEqual({ error: 'Enter a file name.' });
        expect(parseFileName('***')).toEqual({ error: 'Enter a file name without / \\ < > : " | ? or *.' });
    });

    it('words folder problems the same in the API and the dashboard', async () => {
        const { folderNameTaken, folderTooDeep } = await import('@/lib/files/rules');
        const { ApiError, folderError } = await import('@/components/admin/files/api');
        expect(folderError(new ApiError('', 409, 'ERR_CONFLICT'), 'Board', 'create')).toBe(folderNameTaken('Board'));
        expect(folderError(new ApiError('', 400, 'ERR_MAX_DEPTH'), 'Board', 'move')).toBe(folderTooDeep('Board'));
        expect(folderError(new ApiError('Enter a folder name.', 400, 'ERR_INVALID_INPUT'), '', 'rename')).toBe('Enter a folder name.');
        expect(folderNameTaken('Board')).toBe("There's already a folder named Board here. Pick another name.");
    });
});
