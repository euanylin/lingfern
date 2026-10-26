import { sharingRoute, cleanupShares, type SharingEnv } from './sharing';
import { webhookRoute } from './webhook';
import { authRoute } from './auth';
import { repositoryRoute } from './repository';
import { oauthRoute, type OAuthEnv } from './oauth';
import { pageSeo, prerenderPath, renderPageHtml } from '../src/shared/seo';

function unindexed(response: Response) {
  const result = new Response(response.body, response);
  result.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return result;
}

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(cleanupShares(env)); },
  async fetch(request, env, ctx) {
    const oauth = await oauthRoute(request, env, ctx);
    if (oauth) return unindexed(oauth);
    const webhook = await webhookRoute(request, env);
    if (webhook) return unindexed(webhook);
    const auth = await authRoute(request, env);
    if (auth) return unindexed(auth);
    const repository = await repositoryRoute(request, env);
    if (repository) return unindexed(repository);
    const sharing = await sharingRoute(request, env);
    if (sharing) return unindexed(sharing);
    const pathname = new URL(request.url).pathname;
    if (pathname === '/sitemap' && ['GET', 'HEAD'].includes(request.method)) {
      return env.ASSETS.fetch(new Request(new URL('/sitemap.xml', request.url), request));
    }
    if (/^\/(api|mcp|oauth)(\/|$)/.test(pathname) || pathname.startsWith('/.well-known/')) {
      // Return real errors for unknown protocol paths.
      return Response.json({ error: 'NOT_AVAILABLE' }, {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" },
      });
    }
    const accept = request.headers.get('Accept') ?? '*/*';
    if (/^\/(introduction|start|today|progress|library(?:\/(?:dictionary|saved|ipa|grammar|history))?|settings(?:\/about)?|learn\/[^/]+)$/.test(pathname) && ['GET', 'HEAD'].includes(request.method) && ['text/html', 'application/xhtml+xml', '*/*'].some(type => accept.includes(type))) {
      const headers = new Headers(request.headers);
      for (const key of ['if-none-match', 'if-modified-since', 'range']) headers.delete(key);
      headers.set('Accept-Encoding', 'identity');
      const search = new URL(request.url).search;
      const page = !search && prerenderPath(pathname);
      const asset = await env.ASSETS.fetch(new Request(new URL(page || '/', request.url), { method: 'GET', headers }));
      if (!asset.ok) return asset;
      // Only sealed public documents or the empty app shell are rendered.
      const template = await asset.text();
      if (template.length > (page ? 1024 * 1024 : 65536)) throw Error('HTML_SHELL_TOO_LARGE');
      const seo = pageSeo(pathname, search);
      const html = renderPageHtml(template, pathname, search);
      const responseHeaders = new Headers(asset.headers);
      for (const key of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified']) responseHeaders.delete(key);
      responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
      responseHeaders.set('X-Lingfern-Version', env.CF_VERSION_METADATA.id);
      responseHeaders.set('X-Robots-Tag', seo.robots);
      responseHeaders.set('Cache-Control', seo.robots.startsWith('noindex') ? 'private, no-store' : 'no-cache');
      return new Response(request.method === 'HEAD' ? null : html, { status: asset.status, headers: responseHeaders });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env & SharingEnv & OAuthEnv>;
