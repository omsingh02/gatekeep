import FileList from '@/components/admin/FileList';

export default function AllFilesPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    margin: 0,
                }}>Files</h1>
                <p style={{
                    fontSize: '0.875rem',
                    color: '#9ca3af',
                    marginTop: '0.5rem',
                }}>
                    View and manage all your uploaded files
                </p>
            </div>

            {/* Files List */}
            <div style={{
                backgroundColor: '#12141c',
                borderRadius: '8px',
                padding: '1.5rem',
                border: '1px solid #23263a',
            }}>
                <FileList enablePagination={true} itemsPerPage={20} />
            </div>
        </div>
    );
}
