import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

// Keep crawlers out of private areas. Share pages send their own noindex, and assets
// (CSS/JS, Open Graph images) must stay crawlable for rendering and link previews.
export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/login'] },
        sitemap: `${env.app.url}/sitemap.xml`,
    };
}
