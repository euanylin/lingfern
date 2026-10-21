import { sharingRoute, cleanupShares, type SharingEnv } from './sharing';
import { webhookRoute } from './webhook';
import { authRoute } from './auth';
import { repositoryRoute } from './repository';
import { oauthRoute, type OAuthEnv } from './oauth';

export default {
  async scheduled(_event, env, ctx) { ctx.waitUntil(cleanupShares(env)); },
  async fetch(request, env, ctx) {
    const oauth = await oauthRoute(request, env, ctx);
    if (oauth) return oauth;
    const webhook = await webhookRoute(request, env);
    if (webhook) return webhook;
    const auth = await authRoute(request, env);
    if (auth) return auth;
    const repository = await repositoryRoute(request, env);
    if (repository) return repository;
    const sharing = await sharingRoute(request, env);
    if (sharing) return sharing;
    const pathname = new URL(request.url).pathname;
    if (/^\/(api|mcp|oauth)(\/|$)/.test(pathname) || pathname.startsWith('/.well-known/')) {
      // Return real errors for unknown protocol paths.
      return Response.json({ error: 'NOT_AVAILABLE' }, {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" },
      });
    }
    if (/^\/(introduction|start|today|progress|library(?:\/(?:dictionary|saved|ipa|grammar|history))?|settings(?:\/about)?|learn\/[^/]+)$/.test(pathname) && ['GET', 'HEAD'].includes(request.method) && request.headers.get('Accept')?.includes('text/html')) {
      return env.ASSETS.fetch(new Request(new URL('/', request.url), request));
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env & SharingEnv & OAuthEnv>;
