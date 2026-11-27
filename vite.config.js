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

  middlewares.use('/api/fetch-transcript', async (req, res, next) => {
    if ((req.method || 'GET').toUpperCase() !== 'GET') {
      next();
      return;
    }

    const extractYtId = (rawUrl) => {
      try {
        const parsed = new URL(rawUrl);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        let id = '';
        if (host === 'youtu.be') {
          id = parsed.pathname.replace(/^\/+/, '').split('/')[0] || '';
        } else if (
          host === 'youtube.com' ||
          host === 'm.youtube.com' ||
          host === 'music.youtube.com' ||
          host === 'youtube-nocookie.com'
        ) {
          if (parsed.pathname === '/watch' || parsed.pathname === '/watch/') {
            id = parsed.searchParams.get('v') || '';
          } else {
            const m = parsed.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
            if (m) id = m[1];
          }
        }
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
      } catch {
        return '';
      }
    };

    const decodeEntities = (text) =>
      String(text || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)));

    const cleanTranscriptLines = (chunks) => {
      const paragraphs = [];
      let current = [];
      for (const rawChunk of chunks) {
        const line = decodeEntities(String(rawChunk || '').replace(/<[^>]+>/g, ' '))
          .replace(/\[[^\]]*\d{1,2}:\d{2}[^\]]*\]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!line) continue;
        current.push(line);
        const len = current.reduce((acc, s) => acc + s.length + 1, 0);
        if (len >= 420 && /[.!?]["']?$/.test(line)) {
          paragraphs.push(current.join(' ').trim());
          current = [];
        }
      }
      if (current.length > 0) {
        paragraphs.push(current.join(' ').trim());
      }
      return paragraphs.join('\n\n').trim();
    };

    try {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      const rawUrl = (reqUrl.searchParams.get('url') || '').trim();
      const videoId = extractYtId(rawUrl);
      if (!videoId) {
        sendJson(res, 400, { ok: false, error: 'Please provide a valid YouTube video URL.' });
        return;
      }

      let playerData = null;

      // Primary: YouTube Innertube Android player request (reliable captionTracks access)
      try {
        const playerRes = await fetch(
          'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
          {
            method: 'POST',
            signal: AbortSignal.timeout(12000),
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip',
            },
            body: JSON.stringify({
              context: {
                client: {
                  clientName: 'ANDROID',
                  clientVersion: '20.10.38',
                  hl: 'en',
                  gl: 'US',
                },
              },
              videoId,
            }),
          }
        );
        if (playerRes.ok) {
          playerData = await playerRes.json();
        }
      } catch {
        // Fall through to HTML watch page extraction
      }

      // Fallback: Watch page HTML ytInitialPlayerResponse
      if (!playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length) {
        const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
          signal: AbortSignal.timeout(12000),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (watchRes.ok) {
          const watchHtml = await watchRes.text();
          const marker = 'ytInitialPlayerResponse = ';
          const startIdx = watchHtml.indexOf(marker);
          if (startIdx >= 0) {
            const jsonStart = watchHtml.indexOf('{', startIdx + marker.length);
            if (jsonStart >= 0) {
              let depth = 0;
              let inStr = false;
              let escaped = false;
              let endIdx = -1;
              for (let i = jsonStart; i < watchHtml.length; i += 1) {
                const ch = watchHtml[i];
                if (escaped) {
                  escaped = false;
                  continue;
                }
                if (ch === '\\') {
                  escaped = true;
                  continue;
                }
                if (ch === '"') {
                  inStr = !inStr;
                  continue;
                }
                if (!inStr) {
                  if (ch === '{') depth += 1;
                  else if (ch === '}') {
                    depth -= 1;
                    if (depth === 0) {
                      endIdx = i + 1;
                      break;
                    }
                  }
                }
              }
              if (endIdx > jsonStart) {
                try {
                  playerData = JSON.parse(watchHtml.slice(jsonStart, endIdx));
                } catch {
                  // Ignore malformed player JSON
                }
              }
            }
          }
        }
      }

      const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      if (!Array.isArray(tracks) || tracks.length === 0) {
        sendJson(res, 404, {
          ok: false,
          error:
            'No captions/transcript found for this video. You can paste a transcript manually and click "Clean Timestamps".',
        });
        return;
      }

      const selectedTrack =
        tracks.find((t) => /^en/i.test(t.languageCode || '') && t.kind !== 'asr') ||
        tracks.find((t) => /^en/i.test(t.languageCode || '')) ||
        tracks[0];

      const rawBase = String(selectedTrack.baseUrl || '');
      if (!rawBase) {
        sendJson(res, 404, { ok: false, error: 'Caption track URL unavailable.' });
        return;
      }

      const captionUrl = rawBase.includes('fmt=') ? rawBase : `${rawBase}&fmt=json3`;
      const capRes = await fetch(captionUrl, { signal: AbortSignal.timeout(12000) });
      if (!capRes.ok) {
        sendJson(res, 502, {
          ok: false,
          error: `Caption download failed (HTTP ${capRes.status}).`,
        });
        return;
      }

      const capText = await capRes.text();
      const chunks = [];
      if (capText.trim().startsWith('{')) {
        const capJson = JSON.parse(capText);
        for (const ev of capJson?.events || []) {
          if (!Array.isArray(ev?.segs)) continue;
          const line = ev.segs.map((s) => String(s?.utf8 || '')).join('').replace(/\n+/g, ' ').trim();
          if (line) chunks.push(line);
        }
      } else {
        const tagRe = /<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/gi;
        let m;
        while ((m = tagRe.exec(capText)) !== null) {
          if (m[1]) chunks.push(m[1]);
        }
      }

      const transcript = cleanTranscriptLines(chunks);
      if (!transcript) {
        sendJson(res, 404, { ok: false, error: 'Transcript text was empty for this video.' });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        videoId,
        title: String(playerData?.videoDetails?.title || '').trim(),
        language: selectedTrack.languageCode || 'en',
        isAutoGenerated: selectedTrack.kind === 'asr',
        transcript,
      });
    } catch (err) {
      sendJson(res, 502, {
        ok: false,
        error: err?.message || 'Failed to fetch YouTube transcript.',
      });
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
