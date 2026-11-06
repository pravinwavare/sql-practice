import type { APIRoute } from 'astro';
import { databases } from '../data/databases';
import { questions, topics } from '../data/questions';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? new URL('https://example.invalid');
  const paths = [ '/', '/playground/', '/practice/', '/databases/', ...topics.map((topic) => `/practice/${topic.slug}/`), ...questions.map((question) => `/practice/questions/${question.slug}/`), ...databases.map((database) => `/databases/${database.id}/`) ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((path) => `  <url><loc>${new URL(path, base).toString()}</loc></url>`).join('\n')}\n</urlset>`;
  return new Response(xml, { headers:{'Content-Type':'application/xml; charset=utf-8'} });
};
