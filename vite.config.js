import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '::1'
  ) {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  const m172 = host.match(/^172\.(\d+)\./);
  if (m172) {
    const second = Number(m172[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (/^(?:fe80:|fc|fd)/i.test(host)) {
    return true;
  }
  return false;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function attachRecipeProxyMiddleware(middlewares) {
  middlewares.use('/api/fetch-recipe', async (req, res, next) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      next();
      return;
    }

    try {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      const rawUrl = (reqUrl.searchParams.get('url') || '').trim();
      if (!rawUrl) {
        sendJson(res, 400, { ok: false, error: 'Missing "url" query parameter.' });
        return;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        sendJson(res, 400, { ok: false, error: 'Invalid recipe URL.' });
        return;
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        sendJson(res, 400, { ok: false, error: 'Only http:// and https:// URLs are allowed.' });
        return;
      }

      if (isBlockedHost(parsedUrl.hostname)) {
        sendJson(res, 403, { ok: false, error: 'Requests to local or private network hosts are blocked.' });
        return;
      }

      const upstream = await fetch(parsedUrl.toString(), {
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RecipeBinder/1.0; +https://recipe-binder.local)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!upstream.ok) {
        sendJson(res, 502, { ok: false, error: `Upstream returned HTTP ${upstream.status}` });
        return;
      }

      const finalUrl = upstream.url || parsedUrl.toString();
      try {
        const resolved = new URL(finalUrl);
        if (isBlockedHost(resolved.hostname)) {
          sendJson(res, 403, { ok: false, error: 'Redirect to local or private host is blocked.' });
          return;
        }
      } catch {
        // Ignore malformed upstream.url
      }

      const maxBytes = 5 * 1024 * 1024;
      const buf = await upstream.arrayBuffer();
      if (buf.byteLength > maxBytes) {
        sendJson(res, 502, { ok: false, error: 'Recipe page exceeded 5 MB size limit.' });
        return;
      }

      const html = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      sendJson(res, 200, { ok: true, url: finalUrl, html });
    } catch (err) {
      sendJson(res, 502, { ok: false, error: err?.message || 'Failed to fetch recipe URL.' });
    }
  });
}

function recipeFetchProxyPlugin() {
  return {
    name: 'recipe-fetch-proxy',
    configureServer(server) {
      attachRecipeProxyMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachRecipeProxyMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    recipeFetchProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-icon.svg'],
      manifest: {
        name: 'Recipe Binder',
        short_name: 'Recipes',
        description: 'Offline-first cross-device digital kitchen recipe binder.',
        theme_color: '#254b69',
        background_color: '#d5cfc3',
        display: 'standalone',
        start_url: './',
        scope: './',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    port: 5176,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
});
