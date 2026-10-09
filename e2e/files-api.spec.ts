import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type APIResponse, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { RUN_ID, newVisitor, signInAsAdmin } from './helpers';
import { localSupabaseEnv } from './supabase-env';

/**
 * The Files and Folders API follows the owner API's conventions (docs/ARCHITECTURE.md → API conventions):
 * errors are { error, code } in plain words, responses are camelCase with no database fields, ids that
 * aren't UUIDs are simply not found, and so is anything that belongs to someone else.
 * Two-factor sign-in on these routes: tests/files-api.test.ts and e2e/two-factor.spec.ts.
 */

const FILE_KEYS = ['createdAt', 'folderId', 'folderName', 'id', 'mimeType', 'name', 'size', 'updatedAt'];
const FOLDER_KEYS = ['createdAt', 'id', 'name', 'parentId', 'updatedAt'];
const FILE_GONE = { error: "That file doesn't exist anymore. Refresh and try again.", code: 'ERR_NOT_FOUND' };
const FOLDER_GONE = { error: "That folder doesn't exist anymore. Refresh and try again.", code: 'ERR_NOT_FOUND' };

function serviceClient() {
    const env = localSupabaseEnv();
    return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

/** Keys anywhere in a response that look like database columns */
function snakeKeys(value: unknown, found: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((item) => snakeKeys(item, found));
    else if (value && typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            if (key.includes('_')) found.push(key);
            snakeKeys(item, found);
        }
    }
    return found;
}

async function expectError(res: APIResponse, status: number, body: { error: string; code: string }) {
    expect(res.status(), res.url()).toBe(status);
    expect(await res.json(), res.url()).toEqual(body);
}

let context: BrowserContext;
let owner: APIRequestContext;

test.beforeAll(async ({ browser, baseURL }) => {
    context = await newVisitor(browser, baseURL!);
    await signInAsAdmin(await context.newPage());
    owner = context.request;
});

test.afterAll(async () => {
    await context?.close();
});

test('a file or folder that does not exist is not found, in plain words', async () => {
    const missing = randomUUID();
    for (const res of [
        await owner.get(`/api/files/${missing}`),
        await owner.get('/api/files/not-a-file-id'),
        await owner.get(`/api/files/${missing}/url?action=download`),
        await owner.patch(`/api/files/${missing}`, { data: { name: 'notes.txt' } }),
        await owner.delete(`/api/files/${missing}`),
    ]) {
        await expectError(res, 404, FILE_GONE);
    }
    for (const res of [
        await owner.get(`/api/folders/${missing}`),
        await owner.get(`/api/folders/${missing}/contents`),
        await owner.get('/api/folders/not-a-folder-id'),
        await owner.get(`/api/folders?parentId=${missing}`),
        await owner.get(`/api/files?folderId=${missing}`),
        await owner.patch(`/api/folders/${missing}`, { data: { name: 'Contracts' } }),
        await owner.delete(`/api/folders/${missing}`),
        await owner.post('/api/folders', { data: { name: 'Contracts', parentId: missing } }),
        await owner.post('/api/files/presign', { data: { name: 'notes.txt', size: 5, mimeType: 'text/plain', folderId: missing } }),
    ]) {
        await expectError(res, 404, FOLDER_GONE);
    }
});

test('bad input gets a 400 that says what to fix', async () => {
    await expectError(await owner.post('/api/folders', { data: { name: '   ' } }), 400, { error: 'Enter a folder name.', code: 'ERR_INVALID_INPUT' });
    await expectError(await owner.post('/api/folders', { data: 'not json' }), 400, { error: 'Enter a folder name.', code: 'ERR_INVALID_INPUT' });
    await expectError(await owner.post('/api/folders', { data: { name: '<?>' } }), 400, {
        error: 'Enter a folder name without / \\ < > : " | ? or *.',
        code: 'ERR_INVALID_INPUT',
    });
    await expectError(await owner.get(`/api/files?search=${'x'.repeat(101)}`), 400, {
        error: 'Keep the search to 100 characters or fewer.',
        code: 'ERR_INVALID_INPUT',
    });
    await expectError(await owner.post('/api/files/presign', { data: { name: 'notes.txt' } }), 400, {
        error: 'Choose a file to upload.',
        code: 'ERR_INVALID_INPUT',
    });
    await expectError(await owner.post('/api/files/confirm', { data: { path: `${Date.now()}-${randomUUID()}.txt`, name: 'notes.txt', mimeType: 'text/plain' } }), 400, {
        error: "That upload didn't finish. Try again.",
        code: 'ERR_NOT_UPLOADED',
    });

    const { files } = await (await owner.get('/api/files?all=true&limit=1')).json();
    await expectError(await owner.get(`/api/files/${files[0].id}/url?action=print`), 400, { error: 'Ask for a preview or a download.', code: 'ERR_INVALID_INPUT' });
    await expectError(await owner.patch(`/api/files/${files[0].id}`, { data: {} }), 400, { error: 'Nothing to change.', code: 'ERR_INVALID_INPUT' });
    await expectError(await owner.patch(`/api/files/${files[0].id}`, { data: { name: '' } }), 400, { error: 'Enter a file name.', code: 'ERR_INVALID_INPUT' });

    const blocked = await owner.post('/api/files/presign', { data: { name: 'setup.exe', size: 10, mimeType: 'application/octet-stream' } });
    expect(blocked.status()).toBe(400);
    expect(Object.keys(await blocked.json()).sort()).toEqual(['code', 'error']);
    expect((await blocked.json()).code).toBe('ERR_INVALID_FILE');
});

test('responses are camelCase, with no database fields, in the same envelopes as the rest of the owner API', async () => {
    const folderName = `API conventions ${RUN_ID}`;
    const created = await owner.post('/api/folders', { data: { name: folderName } });
    expect(created.status()).toBe(201);
    const { folder } = await created.json();
    expect(Object.keys(folder).sort()).toEqual(FOLDER_KEYS);
    expect(folder).toMatchObject({ name: folderName, parentId: null });

    try {
        // Folder names are unique in their parent, ignoring case
        await expectError(await owner.post('/api/folders', { data: { name: folderName.toUpperCase() } }), 409, {
            error: `There's already a folder named ${folderName.toUpperCase()} here. Pick another name.`,
            code: 'ERR_CONFLICT',
        });

        // Upload: presign → PUT to storage → confirm
        const name = `conventions-${RUN_ID}.txt`;
        const bytes = Buffer.from(`API conventions ${RUN_ID}\n`);
        const presign = await owner.post('/api/files/presign', { data: { name, size: bytes.length, mimeType: 'text/plain', folderId: folder.id } });
        expect(presign.status()).toBe(200);
        const upload = await presign.json();
        expect(Object.keys(upload).sort()).toEqual(['path', 'uploadUrl']);
        expect((await owner.put(upload.uploadUrl, { data: bytes, headers: { 'content-type': 'text/plain' } })).ok()).toBeTruthy();
        const confirmed = await owner.post('/api/files/confirm', { data: { path: upload.path, name, mimeType: 'text/plain', folderId: folder.id } });
        expect(confirmed.status()).toBe(201);
        const { file } = await confirmed.json();
        expect(Object.keys(file).sort()).toEqual(FILE_KEYS);
        expect(file).toMatchObject({ name, size: bytes.length, mimeType: 'text/plain', folderId: folder.id, folderName });

        const list = await (await owner.get(`/api/files?folderId=${folder.id}`)).json();
        expect(Object.keys(list).sort()).toEqual(['files', 'limit', 'page', 'total', 'totalPages']);
        expect(list).toMatchObject({ total: 1, page: 1, limit: 20, totalPages: 1 });
        expect(list.files).toEqual([file]);

        const one = await (await owner.get(`/api/files/${file.id}`)).json();
        expect(one).toEqual({ file });

        const renamed = await (await owner.patch(`/api/files/${file.id}`, { data: { name: `renamed-${RUN_ID}.txt` } })).json();
        expect(Object.keys(renamed)).toEqual(['file']);
        expect(Object.keys(renamed.file).sort()).toEqual(FILE_KEYS);
        expect(renamed.file.name).toBe(`renamed-${RUN_ID}.txt`);

        const all = await (await owner.get('/api/folders?all=true')).json();
        expect(Object.keys(all)).toEqual(['folders']);
        expect(all.folders).toContainEqual(folder);

        const detail = await (await owner.get(`/api/folders/${folder.id}`)).json();
        expect(Object.keys(detail.folder).sort()).toEqual([...FOLDER_KEYS, 'fileCount', 'path', 'subfolderCount'].sort());
        expect(detail.folder).toMatchObject({ fileCount: 1, subfolderCount: 0, path: [{ id: folder.id, name: folderName }] });

        const contents = await (await owner.get(`/api/folders/${folder.id}/contents`)).json();
        expect(Object.keys(contents).sort()).toEqual(['files', 'folder', 'folders']);
        expect(contents.folder).toEqual(detail.folder);
        expect(contents.files.map((f: { id: string }) => f.id)).toEqual([file.id]);

        const stats = await (await owner.get('/api/files/stats')).json();
        expect(Object.keys(stats).sort()).toEqual(['fileCount', 'totalSize']);

        const url = await (await owner.get(`/api/files/${file.id}/url?action=download`)).json();
        expect(Object.keys(url).sort()).toEqual(['expiresIn', 'url']);

        // No database fields anywhere, and never the storage path (signed URLs aside) or the owner's id
        const everything = { file, list, one, renamed, all, detail, contents, stats };
        expect(snakeKeys(everything)).toEqual([]);
        const text = JSON.stringify(everything);
        expect(text).not.toContain(upload.path);
        for (const field of ['uploadedBy', 'filePath', 'filename', 'shortCode', 'deletedAt']) expect(text).not.toContain(`"${field}"`);

        const deleted = await owner.delete(`/api/files/${file.id}`);
        expect(await deleted.json()).toEqual({ ok: true });
        await expectError(await owner.get(`/api/files/${file.id}`), 404, FILE_GONE);
    } finally {
        const removed = await owner.delete(`/api/folders/${folder.id}`);
        expect(await removed.json()).toEqual({ ok: true });
    }
});

test("another owner's files and folders are not found, and stay as they were", async () => {
    const service = serviceClient();
    const { data: created, error } = await service.auth.admin.createUser({
        email: `other-owner-${RUN_ID}@example.test`,
        password: `Other-owner-${RUN_ID}`,
        email_confirm: true,
        app_metadata: { role: 'owner' },
    });
    expect(error).toBeNull();
    const otherId = created.user!.id;
    try {
        const { data: folder } = await service.from('folders').insert({ name: `Theirs ${RUN_ID}`, uploaded_by: otherId }).select('id').single();
        const path = `${Date.now()}-${randomUUID()}.txt`;
        const { data: file } = await service
            .from('files')
            .insert({ filename: path, original_filename: 'theirs.txt', file_path: path, file_size: 5, mime_type: 'text/plain', uploaded_by: otherId, folder_id: folder!.id })
            .select('id')
            .single();
        const { files } = await (await owner.get('/api/files?all=true&limit=1')).json();
        const mine = files[0];

        for (const res of [
            await owner.get(`/api/files/${file!.id}`),
            await owner.get(`/api/files/${file!.id}/url?action=download`),
            await owner.patch(`/api/files/${file!.id}`, { data: { name: 'mine-now.txt', folderId: null } }),
            await owner.delete(`/api/files/${file!.id}`),
        ]) {
            await expectError(res, 404, FILE_GONE);
        }
        for (const res of [
            await owner.get(`/api/folders/${folder!.id}`),
            await owner.get(`/api/folders/${folder!.id}/contents`),
            await owner.get(`/api/files?folderId=${folder!.id}`),
            await owner.patch(`/api/folders/${folder!.id}`, { data: { name: 'Mine now' } }),
            await owner.delete(`/api/folders/${folder!.id}`),
            await owner.post('/api/folders', { data: { name: `Inside theirs ${RUN_ID}`, parentId: folder!.id } }),
            await owner.patch(`/api/files/${mine.id}`, { data: { folderId: folder!.id } }),
        ]) {
            await expectError(res, 404, FOLDER_GONE);
        }

        const { data: theirFile } = await service.from('files').select('original_filename, folder_id, deleted_at').eq('id', file!.id).single();
        expect(theirFile).toEqual({ original_filename: 'theirs.txt', folder_id: folder!.id, deleted_at: null });
        const { data: theirFolder } = await service.from('folders').select('name, deleted_at').eq('id', folder!.id).single();
        expect(theirFolder).toEqual({ name: `Theirs ${RUN_ID}`, deleted_at: null });
        expect((await (await owner.get(`/api/files/${mine.id}`)).json()).file.folderId).toBe(mine.folderId);
    } finally {
        await service.from('files').delete().eq('uploaded_by', otherId);
        await service.from('folders').delete().eq('uploaded_by', otherId);
        await service.auth.admin.deleteUser(otherId);
    }
});
