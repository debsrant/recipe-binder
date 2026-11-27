import { normalizeRecipe, parseTagsInput } from './collection.js';

export const AI_PROVIDERS = [
  { id: 'off', label: 'Off (Offline Only)' },
  { id: 'ollama', label: 'Local Ollama (PC / LAN)' },
  { id: 'gemini', label: 'Gemini API (BYOK)' },
];

export const GEMINI_MODELS = [
  { id: 'gemini-4-hydrogen', label: 'Gemini 4 Hydrogen (Balanced, Default)' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (Fastest / Lowest Cost)' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon (Stronger Reasoning)' },
];

export const DEFAULT_AI_CONFIG = {
  provider: 'off',
  ollamaUrl: '',
  ollamaModel: 'llama3.2',
  geminiModel: 'gemini-4-hydrogen',
  geminiApiKey: '',
};

const PROVIDER_SET = new Set(AI_PROVIDERS.map((p) => p.id));
const DEPRECATED_GEMINI_RE = /^gemini-(?:1\.5|2\.0|2\.5)-/i;

const RECIPE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    dividerHint: { type: 'string' },
    summary: { type: 'string' },
    prepMinutes: { type: 'number' },
    servings: { type: 'number' },
    servingSize: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    ingredients: { type: 'array', items: { type: 'string' } },
    methods: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cookMinutes: { type: 'number' },
          note: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['steps'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['title', 'ingredients', 'methods'],
};

function sanitizeOllamaUrl(raw) {
  const trimmed = String(raw || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function sanitizeGeminiModel(rawModel) {
  const clean = String(rawModel || '').trim();
  if (!clean || DEPRECATED_GEMINI_RE.test(clean)) {
    return DEFAULT_AI_CONFIG.geminiModel;
  }
  return clean;
}

/**
 * Normalizes AI configuration loaded from localStorage or form inputs.
 */
export function normalizeAiConfig(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const provider = PROVIDER_SET.has(src.provider) ? src.provider : DEFAULT_AI_CONFIG.provider;
  return {
    provider,
    ollamaUrl: sanitizeOllamaUrl(src.ollamaUrl),
    ollamaModel: String(src.ollamaModel || '').trim() || DEFAULT_AI_CONFIG.ollamaModel,
    geminiModel: sanitizeGeminiModel(src.geminiModel),
    geminiApiKey: String(src.geminiApiKey || '').trim(),
  };
}

/**
 * Returns true if the active AI provider has the minimum config needed to run requests.
 */
export function isAiReady(config) {
  const norm = normalizeAiConfig(config);
  if (norm.provider === 'ollama') {
    return Boolean(norm.ollamaModel);
  }
  if (norm.provider === 'gemini') {
    return Boolean(norm.geminiApiKey && norm.geminiModel);
  }
  return false;
}

/**
 * Short human-readable label for toolbars and status pills.
 */
export function getAiStatusLabel(config) {
  const norm = normalizeAiConfig(config);
  if (norm.provider === 'ollama') {
    return `AI: Ollama (${norm.ollamaModel})`;
  }
  if (norm.provider === 'gemini') {
    if (!norm.geminiApiKey) return 'AI: Gemini (Key Needed)';
    return `AI: Gemini (${norm.geminiModel})`;
  }
  return 'AI: Off';
}

/**
 * Extracts text from a Gemini v1 Interactions API response payload.
 */
export function extractGeminiInteractionText(data) {
  if (!data || typeof data !== 'object') return '';
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const chunks = [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (!step) continue;
    const isModelOutput =
      step.type === 'model_output' ||
      (step.type && typeof step.type === 'object' && step.type.type === 'model_output') ||
      Array.isArray(step.content);
    if (!isModelOutput) continue;
    const contentArr = Array.isArray(step.content) ? step.content : [];
    const textParts = contentArr
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean);
    if (textParts.length > 0) {
      chunks.unshift(textParts.join('\n'));
      break;
    }
  }
  if (chunks.length > 0) return chunks.join('\n').trim();

  // Fallback for unexpected nested outputs array if present
  const outputs = Array.isArray(data.outputs) ? data.outputs : [];
  return outputs
    .map((o) => o?.text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * Strips markdown fences and extracts the outermost JSON object from LLM text.
 */
export function extractJsonObjectFromText(rawText) {
  const cleaned = String(rawText || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  if (!cleaned) {
    throw new Error('AI returned an empty response.');
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('AI did not return valid JSON.');
  }
}

function resolveDividerId(dividerHint, dividers = [], fallbackDividerId = 'weeknight') {
  const list = Array.isArray(dividers) ? dividers : [];
  const fallback = list[0]?.id || fallbackDividerId || 'weeknight';
  const hint = String(dividerHint || '').trim().toLowerCase();
  if (!hint || list.length === 0) return fallback;

  const exact = list.find(
    (d) => d.id.toLowerCase() === hint || d.name.toLowerCase() === hint
  );
  if (exact) return exact.id;

  const partial = list.find(
    (d) => d.name.toLowerCase().includes(hint) || hint.includes(d.id.toLowerCase())
  );
  return partial ? partial.id : fallback;
}

/**
 * Converts structured JSON from Ollama/Gemini into a normalized Recipe Binder draft.
 */
export function aiJsonToRecipeDraft(
  aiObj,
  { sourceUrl = '', sourceTitle = '', dividers = [], fallbackDividerId = 'weeknight' } = {}
) {
  const src = aiObj && typeof aiObj === 'object' ? aiObj : {};
  const dividerId = resolveDividerId(src.dividerHint, dividers, fallbackDividerId);

  const rawMethods = Array.isArray(src.methods) ? src.methods : [];
  const methods = rawMethods
    .map((m, idx) => {
      const steps = Array.isArray(m?.steps)
        ? m.steps.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
      return {
        id: `method-${idx + 1}`,
        name: String(m?.name || '').trim(),
        cookMinutes: Math.max(0, Math.round(Number(m?.cookMinutes) || 0)),
        note: String(m?.note || '').trim(),
        steps,
      };
    })
    .filter((m) => m.steps.length > 0 || m.name || m.note);

  const safeMethods =
    methods.length > 0
      ? methods
      : [{ id: 'method-1', name: '', cookMinutes: 0, note: '', steps: [] }];

  const ingredients = Array.isArray(src.ingredients)
    ? src.ingredients.map((line) => String(line || '').trim()).filter(Boolean)
    : [];

  const tags = Array.isArray(src.tags)
    ? parseTagsInput(src.tags.join(','))
    : parseTagsInput(src.tags || '');

  return normalizeRecipe(
    {
      title: String(src.title || sourceTitle || 'AI Extracted Recipe').trim(),
      dividerId,
      source: String(sourceUrl || src.source || '').trim(),
      summary: String(src.summary || '').trim(),
      prepMinutes: Math.max(0, Math.round(Number(src.prepMinutes) || 0)),
      cookMinutes: safeMethods[0].cookMinutes,
      servings: Math.max(1, Number(src.servings) || 4),
      servingSize: String(src.servingSize || '').trim(),
      tags,
      ingredients,
      steps: safeMethods[0].steps,
      methods: safeMethods,
      notes: String(src.notes || '').trim(),
    },
    dividerId
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function callOllamaChat({ systemInstruction, userPrompt, expectJson, config }) {
  const bodyPayload = {
    model: config.ollamaModel,
    messages: [
      ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
      { role: 'user', content: userPrompt },
    ],
    ...(expectJson ? { format: 'json' } : {}),
    stream: false,
  };

  if (!config.ollamaUrl) {
    const res = await fetchWithTimeout(
      './api/ai/ollama/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      },
      60000
    );
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error(
        'Local Ollama proxy requires running Vite (`npm.cmd run dev` or `npm.cmd run preview`). On static hosting, switch AI Provider to Gemini API (BYOK) in Sync & Backup.'
      );
    }
    const data = await res.json();
    if (!res.ok || !data?.ok || !data?.content) {
      throw new Error(data?.error || `Ollama error (HTTP ${res.status})`);
    }
    return String(data.content).trim();
  }

  const res = await fetchWithTimeout(
    `${config.ollamaUrl}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    },
    60000
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Direct Ollama error (${res.status}): ${txt.slice(0, 140)}`);
  }
  const data = await res.json();
  const content = String(data?.message?.content || data?.response || '').trim();
  if (!content) {
    throw new Error('Ollama returned an empty response.');
  }
  return content;
}

async function callGeminiInteraction({ systemInstruction, userPrompt, responseSchema, config }) {
  if (!config.geminiApiKey) {
    throw new Error('Add your Gemini API key in Sync & Backup -> AI Assistant Settings.');
  }

  const payload = {
    model: config.geminiModel,
    input: userPrompt,
    store: false,
    ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
    ...(responseSchema
      ? {
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: responseSchema,
          },
        }
      : {}),
  };

  const res = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1/interactions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey,
      },
      body: JSON.stringify(payload),
    },
    45000
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${res.status}`;
    throw new Error(`Gemini API error: ${msg}`);
  }
  const text = extractGeminiInteractionText(data);
  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }
  return text;
}

/**
 * Tests connectivity for the configured AI provider.
 */
export async function testAiConnection(rawConfig) {
  const config = normalizeAiConfig(rawConfig);
  if (config.provider === 'off') {
    return { ok: false, models: [], message: 'AI Assistant is currently turned Off.' };
  }

  if (config.provider === 'ollama') {
    if (!config.ollamaUrl) {
      const res = await fetchWithTimeout('./api/ai/ollama/tags', {}, 8000);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        return {
          ok: false,
          models: [],
          message:
            'Built-in Ollama proxy only runs when served via Vite (`npm.cmd run dev` / `preview`).',
        };
      }
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        return {
          ok: false,
          models: [],
          message:
            data?.error ||
            'Could not reach Ollama on this PC. Start Ollama (`ollama serve`) and try again.',
        };
      }
      const models = Array.isArray(data.models) ? data.models : [];
      return {
        ok: true,
        models,
        message:
          models.length > 0
            ? `Connected to Local Ollama! Found ${models.length} installed model(s): ${models.join(', ')}`
            : 'Connected to Local Ollama, but no models are pulled yet (e.g., run `ollama pull llama3.2`).',
      };
    }

    const res = await fetchWithTimeout(`${config.ollamaUrl}/api/tags`, {}, 8000);
    if (!res.ok) {
      return {
        ok: false,
        models: [],
        message: `Direct Ollama endpoint returned HTTP ${res.status}.`,
      };
    }
    const data = await res.json();
    const models = (Array.isArray(data?.models) ? data.models : [])
      .map((m) => String(m?.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return {
      ok: true,
      models,
      message: `Connected to ${config.ollamaUrl} (${models.length} model(s) found).`,
    };
  }

  if (!config.geminiApiKey) {
    return { ok: false, models: [], message: 'Please enter a Gemini API key first.' };
  }
  const res = await fetchWithTimeout(
    'https://generativelanguage.googleapis.com/v1/interactions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey,
      },
      body: JSON.stringify({
        model: config.geminiModel,
        input: 'Reply with OK.',
        store: false,
        generation_config: { max_output_tokens: 16 },
      }),
    },
    15000
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      models: [],
      message: `Gemini connection failed: ${data?.error?.message || `HTTP ${res.status}`}`,
    };
  }
  return {
    ok: true,
    models: [],
    message: `Connected to Gemini API (${config.geminiModel}).`,
  };
}

/**
 * Runs a prompt against the configured provider (Local Ollama or Gemini API).
 */
export async function callAiCompletion({
  systemInstruction = '',
  userPrompt,
  responseSchema = null,
  config: rawConfig,
}) {
  const config = normalizeAiConfig(rawConfig);
  if (config.provider === 'off') {
    throw new Error('AI Assistant is turned Off. Enable Ollama or Gemini in Sync & Backup.');
  }
  if (config.provider === 'ollama') {
    return callOllamaChat({
      systemInstruction,
      userPrompt,
      expectJson: Boolean(responseSchema),
      config,
    });
  }
  return callGeminiInteraction({
    systemInstruction,
    userPrompt,
    responseSchema,
    config,
  });
}

/**
 * Extracts a structured Recipe Binder draft from raw pasted recipe text or a video transcript.
 */
export async function extractRecipeWithAi({
  text,
  sourceLabel = 'recipe text',
  sourceUrl = '',
  sourceTitle = '',
  dividers = [],
  fallbackDividerId = 'weeknight',
  config,
}) {
  const cleanInput = String(text || '').trim();
  if (!cleanInput) {
    throw new Error('Provide some text or transcript first.');
  }

  const dividerChoices = (dividers || [])
    .map((d) => `${d.id} (${d.name})`)
    .join(', ');

  const systemInstruction =
    'You are a meticulous culinary assistant. Extract an accurate, structured recipe from the provided text. Return ONLY a single valid JSON object matching the requested fields. Do not invent ingredients that are not mentioned or strongly implied by the recipe.';

  const userPrompt = [
    `Convert this ${sourceLabel} into a Recipe Binder JSON object.`,
    sourceTitle ? `Known title hint: ${sourceTitle}` : '',
    dividerChoices ? `Choose dividerHint from these binder dividers if relevant: ${dividerChoices}` : '',
    'JSON fields:',
    '{',
    '  "title": "Recipe Name",',
    '  "dividerHint": "divider id or name",',
    '  "summary": "1-2 sentence overview",',
    '  "prepMinutes": 15,',
    '  "servings": 4,',
    '  "servingSize": "1 bowl or 2 tacos",',
    '  "tags": ["weeknight", "quick"],',
    '  "ingredients": ["1 lb chicken thighs", "2 tbsp olive oil"],',
    '  "methods": [{ "name": "Skillet or Oven (leave empty if single standard method)", "cookMinutes": 25, "note": "", "steps": ["Step 1...", "Step 2..."] }],',
    '  "notes": "Helpful chef tips, make-ahead notes, or variations"',
    '}',
    '',
    'SOURCE TEXT:',
    cleanInput.slice(0, 18000),
  ]
    .filter(Boolean)
    .join('\n');

  const rawText = await callAiCompletion({
    systemInstruction,
    userPrompt,
    responseSchema: RECIPE_RESPONSE_SCHEMA,
    config,
  });

  const parsed = extractJsonObjectFromText(rawText);
  return aiJsonToRecipeDraft(parsed, {
    sourceUrl,
    sourceTitle,
    dividers,
    fallbackDividerId,
  });
}

/**
 * Summarizes a video transcript or long note into concise bulleted kitchen takeaways.
 */
export async function summarizeNoteWithAi({ title = '', text = '', config }) {
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    throw new Error('Add or fetch a transcript before summarizing.');
  }

  const systemInstruction =
    'You are a practical kitchen assistant. Summarize cooking transcripts or notes into crisp, scannable bullet points focusing on temperatures, timings, ingredient ratios, technique cues, and mistakes to avoid. Keep output concise plain text bullets starting with "- ".';

  const userPrompt = [
    title ? `Title: ${title}` : '',
    'Summarize the key cooking takeaways from this transcript:',
    cleanText.slice(0, 18000),
  ]
    .filter(Boolean)
    .join('\n\n');

  return callAiCompletion({
    systemInstruction,
    userPrompt,
    responseSchema: null,
    config,
  });
}
