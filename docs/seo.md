# Search metadata

Public search entries are defined in `src/shared/seo.ts` and `public/sitemap.xml`. The current five entries are Introduction, Dictionary, IPA, English usage and About. `/sitemap.xml` is the only sitemap endpoint and is declared in `robots.txt`; `/sitemap` returns404. The sitemap does not enumerate learner state or practice identifiers.

## HTML and navigation

Vite fills the single `<!--seo:start-->` / `<!--seo:end-->` block in the app shell. The Worker replaces only that block for each known HTML route. `src/app/pageMetadata.ts` applies the same metadata after client navigation and offline loading. Preserve both markers and keep unrelated head elements outside them.

Public pages have distinct English titles/descriptions, production HTTPS canonical URLs, Open Graph and summary-card tags. The existing512px installation icon supplies the social thumbnail. Root and Introduction share the Introduction canonical; only these entry pages supply truthful `WebSite` JSON-LD. The interface still follows the saved language setting. There are no separate language URLs, so no `hreflang` aliases are invented.

Personal pages use `noindex, follow` with no canonical or private `og:url`. Lookup URLs with a `q` parameter also use `noindex`, retaining their public base canonical. Tracking parameters are removed from canonical URLs. No query text, profile names or practice IDs enter metadata. Protocol responses use `X-Robots-Tag: noindex, nofollow`; authentication and authorization remain unchanged. No new robots.txt crawl block prevents crawlers from reading these directives. Indexing directives are not access controls.

Known HTML routes accept ordinary HTML, XHTML and generic crawler requests. Explicit JSON-only requests and unknown routes keep real errors. Metadata rendering strips stale entity/length/encoding headers and conditional/range requests to the small underlying shell; private document responses are not publicly cached.

## Verification and release

- Focused checks: `npm exec -- vitest run tests/seo.test.ts`; browser cases in `tests/browser/seo.spec.ts` and `routes.spec.ts` use the compiled8787 preview.
- Build once with `npm run build`. Deployment checks require that the local HTML template matches its sealed manifest hash, derive each route's exact expected bytes from that template, and retain version pinning, all-file checks and recovery guards. A title change is not accepted merely because the response is HTML.
- For a new public page, align the route, public metadata map, sitemap and corresponding regression; do not automatically index stateful pages.

Canonical public paths also contain the existing initial page body. `scripts/prerender.ts` uses Vite's server module loader and the existing React components at build time; `src/prerender.tsx` loads their actual modules before rendering. The browser loads the same route modules and hydrates that markup. It then applies the saved language, theme and profile through the existing local-data loader. Profile-writing controls stay disabled until that loader is ready.

Grammar and IPA receive their validated public data in the document, avoiding a second initial JSON request. Existing disclosure behavior remains: closed grammar explanations are rendered when opened. No learner database is read while producing public documents. The root `/` retains its existing profile-dependent introduction/start/Today routing; query variants and personal routes retain the empty client shell. They do not receive a public bootstrap snapshot.

Static style properties are emitted as a small same-origin stylesheet, then restored through CSSOM before hydration. No inline-script/style permission is added to CSP. Generated CSS URLs contain a content hash. Internal `/prerender/*.html.txt` objects avoid Static Assets' automatic HTML redirects; only canonical page routes return them as HTML. These helper objects are marked noindex. They are excluded from SW precaching because offline navigation already uses the ordinary cached shell.

No crawler-specific body, telemetry, artificial rating, fake date or Search Console token is supplied. Search Console/Bing verification, submission and live crawl inspection require the deployed site and authorized account access. This local configuration does not claim indexing or rich-result acceptance.

References: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [site names](https://developers.google.com/search/docs/appearance/site-names), [Open Graph](https://ogp.me/).
