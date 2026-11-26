import { RECIPE_PROXY_URL } from '../config.js';
import { parseHtmlRecipe } from './recipeImport.js';

/**
 * Validates and normalizes a cooking website URL (only http/https allowed).
 */
export function validateRecipeUrl(rawUrl) {
  let candidate = String(rawUrl || '').trim();
  if (!candidate) {
    throw new Error('Please enter a recipe webpage URL.');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) && candidate.includes('.')) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// recipe URLs are supported.');
  }

  return parsed.toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryLocalViteProxy(targetUrl) {
  const res = await fetchWithTimeout(`./api/fetch-recipe?url=${encodeURIComponent(targetUrl)}`);
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Local proxy unavailable');
  }
  const data = await res.json();
  if (!res.ok || !data?.ok || !data?.html) {
    throw new Error(data?.error || `Proxy error (${res.status})`);
  }
  return { html: data.html, finalUrl: data.url || targetUrl };
}

async function tryCustomProxy(targetUrl) {
  if (!RECIPE_PROXY_URL) {
    throw new Error('No custom proxy configured');
  }
  const separator = RECIPE_PROXY_URL.includes('?') ? '&' : '?';
  const res = await fetchWithTimeout(`${RECIPE_PROXY_URL}${separator}url=${encodeURIComponent(targetUrl)}`);
  if (!res.ok) {
    throw new Error(`Custom proxy returned HTTP ${res.status}`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!data?.html) throw new Error(data?.error || 'Custom proxy returned empty HTML');
    return { html: data.html, finalUrl: data.url || targetUrl };
  }
  const html = await res.text();
  if (!html.trim()) throw new Error('Custom proxy returned empty HTML');
  return { html, finalUrl: targetUrl };
}

async function tryPublicCorsProxy(proxyUrlBuilder, targetUrl) {
  const res = await fetchWithTimeout(proxyUrlBuilder(targetUrl));
  if (!res.ok) {
    throw new Error(`CORS fallback returned HTTP ${res.status}`);
  }
  const html = await res.text();
  if (!html || !html.trim()) {
    throw new Error('CORS fallback returned empty content');
  }
  return { html, finalUrl: targetUrl };
}

/**
 * Fetches recipe HTML via local Vite middleware (dev/preview), optional custom proxy, or CORS fallback.
 */
export async function fetchHtmlForUrl(targetUrl) {
  const errors = [];

  try {
    return await tryLocalViteProxy(targetUrl);
  } catch (err) {
    errors.push(err?.message || 'Local proxy failed');
  }

  if (RECIPE_PROXY_URL) {
    try {
      return await tryCustomProxy(targetUrl);
    } catch (err) {
      errors.push(err?.message || 'Custom proxy failed');
    }
  }

  const fallbacks = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ];

  for (const builder of fallbacks) {
    try {
      return await tryPublicCorsProxy(builder, targetUrl);
    } catch (err) {
      errors.push(err?.message || 'CORS fallback failed');
    }
  }

  throw new Error(
    `Could not fetch webpage (${errors[0] || 'network blocked'}). If the site blocks automated requests or you are offline, copy the recipe text on that page and use "Copy & Paste Text" below.`
  );
}

/**
 * Validates, fetches, and parses a recipe webpage into an editable Recipe Binder draft.
 */
export async function fetchAndScrapeRecipeUrl(
  rawUrl,
  { dividers = [], fallbackDividerId = 'weeknight' } = {}
) {
  const validUrl = validateRecipeUrl(rawUrl);
  const { html, finalUrl } = await fetchHtmlForUrl(validUrl);
  return parseHtmlRecipe(html, {
    sourceUrl: finalUrl || validUrl,
    dividers,
    fallbackDividerId,
  });
}
