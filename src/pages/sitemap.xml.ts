// Sitemap a partir de src/paginas.ts; as fichas do Aniilog levam a data da última mudança na wiki.
import type { APIRoute } from 'astro';
import { porSlug } from '../data.ts';
import { rotas } from '../paginas.ts';

export const GET: APIRoute = ({ site }) => {
  const urls = rotas.map((r) => {
    const a = porSlug.get(r.match(/^\/aniilog\/([^/]+)\/$/)?.[1] ?? '');
    const lastmod = a ? `<lastmod>${a.coletadoEm.slice(0, 10)}</lastmod>` : '';
    return `<url><loc>${new URL(r, site).href}</loc>${lastmod}</url>`;
  });
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml' },
  });
};
