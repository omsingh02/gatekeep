'use client';

export default function SignOutButton() {
    return (
        <form action="/api/auth/signout" method="POST">
            <button
                type="submit"
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: '#9ca3af',
                    backgroundColor: '#12141c',
                    border: '1px solid #23263a',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#e0e0e0';
                    e.currentTarget.style.backgroundColor = '#23263a';
                    e.currentTarget.style.borderColor = '#2f3349';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.backgroundColor = '#12141c';
                    e.currentTarget.style.borderColor = '#23263a';
                }}
            >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
            </button>
        </form>
    );
}
