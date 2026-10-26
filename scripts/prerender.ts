import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createServer, type Plugin, type ResolvedConfig } from 'vite';
import { publicPages, prerenderPath, renderPageHtml } from '../src/shared/seo.ts';
import type { PublicPageState } from '../src/shared/prerender.ts';

export function extractPublicStyles(body: string) {
  const rules = new Map<string, string>();
  const html = body.replace(/<[^>]+\sstyle="[^"]*"[^>]*>/g, tag => {
    const style = tag.match(/\sstyle="([^"]*)"/)![1];
    if (/[&<>]/.test(style)) throw Error('PUBLIC_STYLE_ENCODING');
    const name = `public-style-${createHash('sha256').update(style).digest('hex').slice(0, 12)}`;
    rules.set(name, style);
    tag = tag.replace(/\sstyle="[^"]*"/, ` data-public-style="${style}"`);
    return /\sclass="/.test(tag) ? tag.replace(/\sclass="/, ` class="${name} `) : tag.replace(/(\/?)>$/, ` class="${name}"$1>`);
  });
  return { html, css: [...rules].map(([name, style]) => `.${name}{${style}}`).join('\n') };
}

export function publicPrerender(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'public-prerender', apply: 'build',
    configResolved(value) { config = value; },
    async writeBundle(options, bundle) {
      if (!options.dir) throw Error('PUBLIC_BUILD_DIRECTORY');
      const index = bundle['index.html'];
      if (index?.type !== 'asset' || typeof index.source !== 'string') throw Error('PUBLIC_HTML_TEMPLATE');
      const template = index.source;
      const server = await createServer({ mode: config.mode, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, logLevel: 'error' });
      try {
        const { render } = await server.ssrLoadModule('/src/prerender.tsx') as typeof import('../src/prerender');
        for (const path of Object.keys(publicPages)) {
          const state: PublicPageState = { path, day: new Date().toISOString().slice(0, 10) };
          const data = async (name: string) => JSON.parse(await readFile(`${config.publicDir}/${name}`, 'utf8'));
          if (path === '/library/grammar') state.grammar = await data('grammar/entries.json');
          if (path === '/library/ipa') { state.ipa = await data('ipa/entries.json'); state.sounds = await data('ipa/full-sounds.json'); }
          const body = await render(state);
          if (/<script\b|<!--\$!-->|hidden id="S:/.test(body)) throw Error('PUBLIC_BODY_INCOMPLETE');
          const styled = extractPublicStyles(body);
          const json = JSON.stringify(state).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
          let html = renderPageHtml(template, path).replace('<div id="root"></div>', `<div id="root" data-public-page="${json}">${styled.html}</div>`).replace('lang="zh-Hans"', 'lang="en"');
          const style = path === '/introduction' ? 'Welcome.css' : path === '/library/ipa' ? 'IpaChart.css' : undefined;
          if (style) {
            const asset = Object.values(bundle).find(item => item.type === 'asset' && item.names.includes(style));
            if (!asset) throw Error(`PUBLIC_CSS_MISSING:${style}`);
            if (!html.includes(`href="/${asset.fileName}"`)) html = html.replace('</head>', `<link rel="stylesheet" href="/${asset.fileName}"></head>`);
          }
          if (html === template || !html.includes('data-public-page=') || Buffer.byteLength(html) > 1024 * 1024) throw Error('PUBLIC_HTML_INVALID');
          const file = join(options.dir, prerenderPath(path)!.slice(1));
          await mkdir(dirname(file), { recursive: true });
          if (styled.css) {
            const css = prerenderPath(path)!.replace(/\.html\.txt$/, `-${createHash('sha256').update(styled.css).digest('hex').slice(0, 12)}.css`);
            await writeFile(join(options.dir, css), styled.css);
            html = html.replace('</head>', `<link rel="stylesheet" href="${css}"></head>`);
          }
          await writeFile(file, html);
        }
      } finally { await server.close(); }
    },
  };
}
