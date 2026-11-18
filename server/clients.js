import { createClient } from '@supabase/supabase-js';

let storageClient;

export function getStorageClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Storage is temporarily unavailable.');
  storageClient ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, options = {}) => fetch(input, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    }) },
  });
  return storageClient;
}

export async function generateAIContent({ model = getAIModel(), contents, config = {}, allowFallback = true }) {
  if (!process.env.GEMINI_API_KEY) throw new Error('AI is temporarily unavailable.');
  const started = Date.now();
  const { httpOptions, systemInstruction, ...generationConfig } = config;
  const timeout = httpOptions?.timeout || 25000;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: typeof contents === 'string' ? [{ role: 'user', parts: [{ text: contents }] }] : contents,
      generationConfig,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    }),
    signal: AbortSignal.timeout(timeout),
  });
  const result = await response.json();
  if (!response.ok) {
    const fallback = process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-3.5-flash-lite';
    const remaining = timeout - (Date.now() - started);
    if (allowFallback && fallback && fallback !== model && [429, 503].includes(response.status) && remaining >= 3000) {
      return generateAIContent({ model: fallback, contents, allowFallback: false,
        config: { ...config, thinkingConfig: getThinkingConfig(fallback), httpOptions: { timeout: remaining } } });
    }
    const error = new Error('AI provider request failed.');
    error.status = response.status;
    throw error;
  }
  const text = result.candidates?.[0]?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('');
  if (!text) throw new Error('AI returned no answer.');
  return { text };
}

export function getAIModel() {
  return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
}

export function getThinkingConfig(model = getAIModel()) {
  if (model.startsWith('gemini-2.5-flash')) return { thinkingBudget: 0 };
  if (model.startsWith('gemini-3')) return { thinkingLevel: 'minimal' };
  return undefined;
}

export function sendAIError(res, error) {
  const timedOut = error?.status === 504 || error?.name === 'TimeoutError' || /timed out|deadline/i.test(error?.message || '');
  const limited = error?.status === 429;
  const status = timedOut ? 504 : limited ? 429 : 503;
  return res.status(status).json({ success: false, error: timedOut
    ? 'AI processing timed out. Please try again.'
    : limited ? 'AI is busy or its quota has been reached. Please try again later.'
      : 'AI is temporarily unavailable. Please try again later.' });
}

export async function withTimeout(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('AI request timed out. Please try again.')), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function parseAIResponse(response) {
  const result = JSON.parse(response.text);
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('AI returned malformed data.');
  }
  return result;
}

export function validateAnalysis(result, maxContentLength = 80000) {
  const nullable = (value, max = 10000) => typeof value === 'string' ? value.trim().slice(0, max) || null : null;
  const strings = (value, max) => Array.isArray(value)
    ? value.filter(item => typeof item === 'string' && item.trim()).slice(0, max).map(item => item.trim().slice(0, 2000)) : [];
  const actions = (value, deadlines = false) => Array.isArray(value) ? value
    .filter(item => item && typeof item.title === 'string' && item.title.trim()).slice(0, 50)
    .map(item => ({ title: item.title.trim().slice(0, 500), description: nullable(item.description),
      deadline: nullable(item.deadline, 200), ...(deadlines ? { sourceText: nullable(item.sourceText) } : {}) })) : [];
  return {
    summary: nullable(result.summary), category: nullable(result.category, 200),
    tags: strings(result.tags, 20), importantInformation: strings(result.importantInformation, 30),
    deadlines: actions(result.deadlines, true), actionItems: actions(result.actionItems),
    contentText: nullable(result.contentText, maxContentLength),
    contentTruncated: typeof result.contentText === 'string' && result.contentText.length > maxContentLength,
  };
}
