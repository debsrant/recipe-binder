import { parseTagsInput } from './collection.js';

export const NOTE_TYPES = [
  { id: 'note', label: 'Note' },
  { id: 'website', label: 'Website' },
  { id: 'video', label: 'Video' },
  { id: 'file', label: 'File / PDF (Drive)' },
];

const NOTE_TYPE_SET = new Set(NOTE_TYPES.map((t) => t.id));

function cleanText(value, fallback = '') {
  const str = String(value ?? '').trim();
  return str || fallback;
}

/**
 * Validates and normalizes an http/https URL. Returns '' if empty or unsafe/invalid.
 */
export function normalizeSafeUrl(rawUrl) {
  let candidate = String(rawUrl || '').trim();
  if (!candidate) return '';

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate) && /^[^\s]+\.[^\s]+/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Returns a clean hostname for display (strips leading www.).
 */
export function getUrlHostname(rawUrl) {
  const safe = normalizeSafeUrl(rawUrl);
  if (!safe) return '';
  try {
    return new URL(safe).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/**
 * Extracts an 11-character YouTube video ID from standard watch, short, shorts, or embed URLs.
 */
export function extractYouTubeId(rawUrl) {
  const safe = normalizeSafeUrl(rawUrl);
  if (!safe) return '';
  try {
    const u = new URL(safe);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (host === 'youtu.be') {
      candidate = u.pathname.replace(/^\/+/, '').split('/')[0] || '';
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      if (u.pathname === '/watch' || u.pathname === '/watch/') {
        candidate = u.searchParams.get('v') || '';
      } else {
        const match = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
        if (match) candidate = match[1];
      }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : '';
  } catch {
    return '';
  }
}

export function getYouTubeThumbnailUrl(videoId) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) return '';
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function getYouTubeEmbedUrl(videoId, startSeconds = 0) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) return '';
  const start = Math.max(0, Math.floor(Number(startSeconds) || 0));
  return start > 0
    ? `https://www.youtube-nocookie.com/embed/${videoId}?start=${start}&autoplay=1&rel=0`
    : `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function getYouTubeWatchUrl(videoId, startSeconds = 0) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) return '';
  const start = Math.max(0, Math.floor(Number(startSeconds) || 0));
  return start > 0
    ? `https://www.youtube.com/watch?v=${videoId}&t=${start}s`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Extracts a Google Drive file ID from common Drive sharing URLs.
 */
export function extractGoogleDriveFileId(rawUrl) {
  const safe = normalizeSafeUrl(rawUrl);
  if (!safe) return '';
  try {
    const u = new URL(safe);
    const host = u.hostname.toLowerCase();
    if (!host.includes('drive.google.com') && !host.includes('docs.google.com')) {
      return '';
    }
    const pathMatch = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
    if (pathMatch) return pathMatch[1];
    if (u.pathname === '/open' || u.pathname === '/uc') {
      const id = u.searchParams.get('id') || '';
      if (/^[A-Za-z0-9_-]{10,}$/.test(id)) return id;
    }
    return '';
  } catch {
    return '';
  }
}

export function getGoogleDrivePreviewUrl(rawUrl) {
  const fileId = extractGoogleDriveFileId(rawUrl);
  return fileId ? `https://drive.google.com/file/d/${fileId}/preview` : '';
}

/**
 * Parses `MM:SS` or `H:MM:SS` into total seconds, or null if invalid.
 */
export function parseTimestampToSeconds(ts) {
  const parts = String(ts || '')
    .trim()
    .split(':')
    .map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    return null;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    if (s >= 60) return null;
    return m * 60 + s;
  }
  const [h, m, s] = parts;
  if (m >= 60 || s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/**
 * Extracts clickable timestamp entries from video note lines (e.g., `02:15 - brown butter`).
 */
export function extractVideoTimestamps(body) {
  const lines = String(body || '').split(/\r?\n/);
  const seen = new Set();
  const out = [];
  const TS_RE = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(TS_RE);
    if (!match) continue;
    const label = match[1];
    const seconds = parseTimestampToSeconds(label);
    if (seconds === null || seen.has(seconds)) continue;
    seen.add(seconds);
    const cleanedDesc = line
      .replace(label, '')
      .replace(/^[\s\-–—:|)\]]+/, '')
      .replace(/^\(/, '')
      .trim();
    out.push({
      label,
      seconds,
      text: cleanedDesc || label,
    });
  }
  return out;
}

/**
 * Decodes common XML/HTML entities found in captions & transcripts.
 */
export function decodeTranscriptEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => {
      const code = Number(num);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
}

/**
 * Strips VTT/SRT headers, cue numbers, arrow timestamp ranges, bracketed/inline timestamps,
 * and merges fragmented caption lines into clean, timestamp-free readable paragraphs.
 */
export function stripTranscriptTimestamps(rawText) {
  const decoded = decodeTranscriptEntities(String(rawText || '').replace(/\r\n?/g, '\n'));
  const lines = decoded.split('\n');
  const cleanedTokens = [];

  const VTT_ARROW_RE =
    /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?.*$/;
  const STANDALONE_TS_RE =
    /^\s*[\[(]?(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?[\])]?\s*(?:[-–—:|]\s*)?$/;
  const BRACKETED_TS_RE =
    /[\[(]\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s*[\])]/g;
  const LEADING_TS_RE =
    /^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s*(?:[-–—:|]\s*|\s+)/;

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) {
      if (cleanedTokens.length > 0 && cleanedTokens[cleanedTokens.length - 1] !== '\n') {
        cleanedTokens.push('\n');
      }
      continue;
    }
    if (/^(?:WEBVTT|Kind:|Language:|NOTE\b|STYLE\b)/i.test(line)) continue;
    if (/^\d{1,5}$/.test(line)) continue;
    if (VTT_ARROW_RE.test(line)) continue;
    if (STANDALONE_TS_RE.test(line)) continue;

    line = line
      .replace(/<[^>]+>/g, ' ')
      .replace(BRACKETED_TS_RE, ' ')
      .replace(LEADING_TS_RE, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!line) continue;
    cleanedTokens.push(line);
  }

  // Group lines into readable paragraphs, collapsing excessive single-line breaks
  const paragraphs = [];
  let currentChunks = [];
  for (const tok of cleanedTokens) {
    if (tok === '\n') {
      if (currentChunks.length > 0) {
        paragraphs.push(currentChunks.join(' ').replace(/\s+/g, ' ').trim());
        currentChunks = [];
      }
    } else {
      currentChunks.push(tok);
      // Break overly long caption walls into readable ~4-sentence blocks
      const joinedLen = currentChunks.reduce((acc, s) => acc + s.length + 1, 0);
      if (joinedLen >= 420 && /[.!?]["']?$/.test(tok)) {
        paragraphs.push(currentChunks.join(' ').replace(/\s+/g, ' ').trim());
        currentChunks = [];
      }
    }
  }
  if (currentChunks.length > 0) {
    paragraphs.push(currentChunks.join(' ').replace(/\s+/g, ' ').trim());
  }

  return paragraphs.filter(Boolean).join('\n\n').trim();
}

/**
 * Parses YouTube timedtext JSON3 or XML caption payloads and returns clean text without timestamps.
 */
export function parseYouTubeTranscriptPayload(rawPayload) {
  const raw = String(rawPayload || '').trim();
  if (!raw) return '';

  // JSON3 format
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try {
      const data = JSON.parse(raw);
      const events = Array.isArray(data?.events) ? data.events : [];
      const pieces = [];
      for (const ev of events) {
        if (!Array.isArray(ev?.segs)) continue;
        const text = ev.segs
          .map((seg) => String(seg?.utf8 || ''))
          .join('')
          .replace(/\n+/g, ' ')
          .trim();
        if (text) pieces.push(text);
      }
      if (pieces.length > 0) {
        return stripTranscriptTimestamps(pieces.join('\n'));
      }
    } catch {
      // Fall through to XML/text extraction
    }
  }

  // TimedText XML (<text ...> or <p ...> / <s>)
  const xmlChunks = [];
  const TEXT_TAG_RE = /<(?:text|p)\b[^>]*>([\s\S]*?)<\/(?:text|p)>/gi;
  let match;
  while ((match = TEXT_TAG_RE.exec(raw)) !== null) {
    const inner = decodeTranscriptEntities(match[1].replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim();
    if (inner) xmlChunks.push(inner);
  }
  if (xmlChunks.length > 0) {
    return stripTranscriptTimestamps(xmlChunks.join('\n'));
  }

  return stripTranscriptTimestamps(raw);
}

/**
 * Normalizes a single Notes & Clippings item.
 */
export function normalizeNoteItem(raw) {
  const type = NOTE_TYPE_SET.has(raw?.type) ? raw.type : 'note';
  const tags = Array.isArray(raw?.tags)
    ? parseTagsInput(raw.tags.join(','))
    : parseTagsInput(raw?.tags || '');
  const recipeIds = Array.from(
    new Set(
      (Array.isArray(raw?.recipeIds)
        ? raw.recipeIds
        : String(raw?.recipeIds || '').split(',')
      )
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );

  return {
    id: cleanText(raw?.id, `note-${Date.now()}`),
    type,
    title: cleanText(raw?.title, 'Untitled Note'),
    url: normalizeSafeUrl(raw?.url || ''),
    body: String(raw?.body ?? '').trim(),
    transcript: String(raw?.transcript ?? '').trim(),
    tags,
    recipeIds,
    updatedMs: Number(raw?.updatedMs || Date.now()),
    deleted: Boolean(raw?.deleted),
  };
}

export function getDefaultNotesData() {
  return {
    googleDriveFolderUrl: '',
    googleDriveUpdatedMs: 0,
    items: [],
    updatedMs: 0,
  };
}

export function normalizeNotesData(input) {
  const defaults = getDefaultNotesData();
  const src = input && typeof input === 'object' ? input : {};
  const items = Array.isArray(src.items) ? src.items.map((item) => normalizeNoteItem(item)) : [];
  return {
    googleDriveFolderUrl: normalizeSafeUrl(src.googleDriveFolderUrl || defaults.googleDriveFolderUrl),
    googleDriveUpdatedMs: Number(src.googleDriveUpdatedMs || 0),
    items,
    updatedMs: Number(src.updatedMs || 0),
  };
}

export function upsertNoteItem(items, itemInput) {
  const normalized = normalizeNoteItem({
    ...itemInput,
    updatedMs: Date.now(),
    deleted: false,
  });
  const list = Array.isArray(items) ? [...items] : [];
  const idx = list.findIndex((x) => x.id === normalized.id);
  if (idx >= 0) {
    list[idx] = normalized;
  } else {
    list.push(normalized);
  }
  return list;
}

export function deleteNoteItem(items, id) {
  const now = Date.now();
  return (Array.isArray(items) ? items : []).map((x) =>
    x.id === id ? { ...x, deleted: true, updatedMs: now } : x
  );
}

/**
 * Timestamp-aware merge between local and remote notesData blobs.
 */
export function mergeNotesData(localData, remoteData) {
  const local = normalizeNotesData(localData);
  const remote = normalizeNotesData(remoteData);

  const byId = new Map();
  for (const item of [...local.items, ...remote.items]) {
    if (!item?.id) continue;
    const prev = byId.get(item.id);
    if (!prev || Number(item.updatedMs || 0) >= Number(prev.updatedMs || 0)) {
      byId.set(item.id, item);
    }
  }

  const useRemoteDrive = remote.googleDriveUpdatedMs > local.googleDriveUpdatedMs;
  const googleDriveFolderUrl = useRemoteDrive
    ? remote.googleDriveFolderUrl
    : local.googleDriveFolderUrl || remote.googleDriveFolderUrl;
  const googleDriveUpdatedMs = Math.max(local.googleDriveUpdatedMs, remote.googleDriveUpdatedMs);

  return {
    googleDriveFolderUrl,
    googleDriveUpdatedMs,
    items: Array.from(byId.values()),
    updatedMs: Math.max(local.updatedMs, remote.updatedMs),
  };
}

/**
 * Aggregates unique tags and usage counts across active (non-deleted) notes.
 */
export function collectNoteTags(items) {
  const counts = new Map();
  for (const item of items || []) {
    if (!item || item.deleted) continue;
    for (const tag of item.tags || []) {
      const clean = String(tag || '').trim().toLowerCase();
      if (!clean) continue;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.tag.localeCompare(b.tag)));
}

/**
 * Filters active notes by pinnedOnly/type/tag/query, puts pinned items first in pinned order,
 * and sorts all remaining items alphabetically A–Z by title.
 */
export function filterAndSortNotes({
  items = [],
  typeFilter = 'all',
  tagFilter = '',
  query = '',
  pinnedSet = new Set(),
  pinnedOnly = false,
  recipeTitleById = new Map(),
} = {}) {
  const cleanQuery = String(query || '').trim().toLowerCase();
  const cleanTag = String(tagFilter || '').trim().toLowerCase();
  const pinSet = pinnedSet instanceof Set ? pinnedSet : new Set(Array.isArray(pinnedSet) ? pinnedSet : []);

  const pinOrder = new Map();
  let idx = 0;
  for (const id of pinSet) {
    pinOrder.set(id, idx++);
  }

  const filtered = (items || []).filter((item) => {
    if (!item || item.deleted) return false;
    const cardId = `note-${item.id}`;
    if (pinnedOnly && !pinSet.has(cardId)) return false;
    if (typeFilter && typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (cleanTag && !(item.tags || []).includes(cleanTag)) return false;
    if (!cleanQuery) return true;

    const linkedTitles = (item.recipeIds || [])
      .map((rid) => recipeTitleById.get(rid) || '')
      .filter(Boolean);
    const haystack = [
      item.title,
      item.type,
      item.url,
      item.body,
      item.transcript,
      ...(item.tags || []),
      ...linkedTitles,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(cleanQuery);
  });

  return filtered.sort((a, b) => {
    const aId = `note-${a.id}`;
    const bId = `note-${b.id}`;
    const aPinned = pinSet.has(aId);
    const bPinned = pinSet.has(bId);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    if (aPinned && bPinned) {
      return (pinOrder.get(aId) ?? 0) - (pinOrder.get(bId) ?? 0);
    }
    return String(a.title || '')
      .trim()
      .localeCompare(String(b.title || '').trim(), undefined, { sensitivity: 'base' });
  });
}
