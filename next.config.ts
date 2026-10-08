import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone for the Docker image (ignored by Vercel)
  output: "standalone",
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Prevent clickjacking attacks
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // Enable browser XSS protection
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer policy for privacy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // Permissions policy - restrict unnecessary features
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS - Force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://static.cloudflareinsights.com", // Next.js requires unsafe-inline/eval in dev, allow Cloudflare analytics
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow Google Fonts
              "img-src 'self' data: blob: https:", // Allow images from data URLs, blob, and HTTPS
              "font-src 'self' data: https://fonts.gstatic.com", // Allow Google Fonts
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co", // Supabase API/Realtime
              "media-src 'self' blob: https://*.supabase.co", // Video and audio previews (signed Storage URLs)
              "frame-src 'self' https://*.supabase.co https://view.officeapps.live.com", // Allow Supabase frames and Office viewer
              "media-src 'self' blob: https://*.supabase.co", // Video and audio previews stream from signed Supabase URLs
              "frame-ancestors 'none'", // Equivalent to X-Frame-Options: DENY
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
