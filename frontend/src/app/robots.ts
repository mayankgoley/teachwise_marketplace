import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/search', '/tutor/'],
        disallow: ['/dashboard/', '/api/', '/session/', '/admin/'],
      },
    ],
    sitemap: 'https://teachwiseedu.com/sitemap.xml',
  }
}
