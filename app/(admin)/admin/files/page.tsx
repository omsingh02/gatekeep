import type { Metadata } from 'next';
import FileList from '@/components/admin/FileList';

export const metadata: Metadata = { title: 'Files' };

/** ?folder=<id> opens a folder (breadcrumbs are links); ?upload=1 opens the upload dialog. */
export default async function FilesPage({ searchParams }: { searchParams: Promise<{ folder?: string; upload?: string }> }) {
    const { folder, upload } = await searchParams;
    return <FileList folderId={folder || null} startUpload={upload === '1'} />;
}
