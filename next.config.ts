import type { NextConfig } from "next";

// Next.js needs 'unsafe-eval' only for development tooling (React Refresh); production doesn't
const isDev = process.env.NODE_ENV !== "production";

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
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`, // Next.js inline bootstrap scripts
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:", // Logos and previews from signed Storage URLs
              "font-src 'self' data:", // Inter is self-hosted by next/font
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co", // Supabase API/Realtime
              "media-src 'self' blob: https://*.supabase.co", // Video and audio previews (signed Storage URLs)
              "frame-src 'self' https://*.supabase.co https://view.officeapps.live.com", // PDF previews and the Office viewer
              "frame-ancestors 'none'", // Equivalent to X-Frame-Options: DENY
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
