import Link from 'next/link';
import FileList from '@/components/admin/FileList';

export default function AllFilesPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header with Back Link */}
            <div>
                <Link
                    href="/dashboard"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#9ca3af',
                        textDecoration: 'none',
                        marginBottom: '0.5rem',
                        transition: 'color 0.2s',
                    }}
                >
                    <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </Link>
                <h1 style={{
                    fontSize: '1.5rem',
                    fontWeight: 600,
                    color: '#e0e0e0',
                    margin: 0,
                }}>All Uploads</h1>
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
                backgroundColor: '#2a2a2a',
                borderRadius: '8px',
                padding: '1.5rem',
                border: '1px solid #3a3a3a',
            }}>
                <FileList enablePagination={true} itemsPerPage={20} />
            </div>
        </div>
    );
}
