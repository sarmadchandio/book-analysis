// src/data.js — Data loading, translations, metadata, filtering, display-name helpers.
// Imports only from state.js (no circular deps with rendering.js or main.js).

import { state } from './state.js';

/** Vite-provided base URL. '/' in dev; configurable at build time for Phase 4 deploy. */
export const BASE = import.meta.env.BASE_URL;

/** Resolve an `image_path` like `books/<slug>/images/<file>` to a real URL.
 *  In prod, images live on per-book GitHub Releases tagged `images-<slug>`.
 *  In dev, the Vite serveBooks middleware serves `/books/...` from the local books/ folder. */
const RELEASE_BASE = 'https://github.com/sarmadchandio/book-analysis/releases/download';
export function resolveImage(imagePath) {
  if (!imagePath) return '';
  if (import.meta.env.DEV) return '/' + imagePath;
  const m = imagePath.match(/^books\/([^/]+)\/images\/(.+)$/);
  return m ? `${RELEASE_BASE}/images-${m[1]}/${m[2]}` : '/' + imagePath;
}

/**
 * Fetch a JSON file relative to BASE_URL.
 * @param {string} path — path beneath BASE, e.g. 'data/index.json'
 * @returns {Promise<any>}
 */
export async function loadJSON(path) {
  const resp = await fetch(`${BASE}${path}`);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

/** Strip Urdu/Latin punctuation that clings to tokens. Mirrors analyze.py's PUNCT_STRIP. */
const URDU_PUNCT_RE = /[۔،؛؟!.,:;?»«()\[\]{}"'/\\–—\-_٪؍﷽]/g;

/** Tokenize a user's Urdu query the same way analyze.py tokenizes page text, so query
 *  tokens align with the per-page TF-IDF vectors. */
export function tokenizeUrduQuery(text) {
  return text.split(/\s+/)
    .map(w => w.replace(URDU_PUNCT_RE, '').trim())
    .filter(w => w.length > 1);
}

/** Tokenize an English query. Stop words are dropped naturally because they aren't
 *  in the English IDF vocab (analyze.py strips them at index time). */
export function tokenizeEnglishQuery(text) {
  return text.toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z]/g, ''))
    .filter(w => w.length > 1);
}

/** Cosine-similarity search using pre-computed per-page TF-IDF vectors.
 *  Picks the Urdu or English index based on query language. Returns top-K pages with score.
 *  @returns {Array<{page_num: number, score: number, tokens: string[]}>}
 */
export function searchByVector(bookData, rawQuery, topK = 10) {
  const query = rawQuery.trim();
  if (!query) return [];
  const lang = isEnglish(query) ? 'en' : 'ur';
  const index = bookData.search_index?.[lang];
  if (!index || !index.pages || !index.pages.length) return [];
  const idf = index.idf || {};

  const tokens = lang === 'en' ? tokenizeEnglishQuery(query) : tokenizeUrduQuery(query);
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;

  const queryVec = {};
  for (const [t, c] of Object.entries(tf)) {
    if (idf[t]) queryVec[t] = c * idf[t];
  }
  const qNorm = Math.sqrt(Object.values(queryVec).reduce((s, v) => s + v * v, 0));
  if (!qNorm) return [];
  for (const t in queryVec) queryVec[t] /= qNorm;
  const queryTokens = Object.keys(queryVec);

  const scored = [];
  for (const p of index.pages) {
    let score = 0;
    for (const t of queryTokens) {
      const w = p.vec[t];
      if (w) score += queryVec[t] * w;
    }
    if (score > 0) scored.push({ page_num: p.page_num, score, tokens: queryTokens });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Load the book index and all per-book JSON data files into state.
 * @returns {Promise<void>}
 */
export async function loadAllData() {
  state.booksIndex = await loadJSON('data/index.json');
  for (const book of state.booksIndex.books) {
    state.booksData[book.name] = await loadJSON(`data/${book.name}.json`);
  }
  // TF-IDF is now per-book inside each book's data
}

/**
 * Load book metadata (author, tags, category) from metadata.json into state.
 * @returns {Promise<void>}
 */
export async function loadBookMeta() {
  try { state.bookMeta = await loadJSON('data/metadata.json'); } catch (e) { state.bookMeta = {}; }
}

/**
 * Load translation dictionary from translations.json into state.
 * @returns {Promise<void>}
 */
export async function loadTranslations() {
  try {
    state.translations = await loadJSON('data/translations.json');
  } catch (e) {
    state.translations = {};
  }
}

/**
 * Load entity data for a given book slug into state.entityData.
 * @param {string} slug
 * @returns {Promise<any>}
 */
export async function loadEntities(slug) {
  if (state.entityData[slug]) return state.entityData[slug];
  try {
    state.entityData[slug] = await loadJSON(`data/entities-${slug}.json`);
  } catch (e) {
    state.entityData[slug] = null;
  }
  return state.entityData[slug];
}

/**
 * Load topic clustering data for a given book slug into state.topicsCache.
 * @param {string} slug
 * @returns {Promise<any>}
 */
export async function loadTopics(slug) {
  if (state.topicsCache[slug]) return state.topicsCache[slug];
  try {
    state.topicsCache[slug] = await loadJSON(`data/topics-${slug}.json`);
  } catch (e) {
    state.topicsCache[slug] = null;
  }
  return state.topicsCache[slug];
}

/**
 * Get metadata for a book slug from state.bookMeta.
 * @param {string} slug
 * @returns {{ author: string, tags: string[], category: string }}
 */
export function getMeta(slug) {
  return state.bookMeta[slug] || { author: 'Unknown', tags: [], category: 'Uncategorized' };
}

/**
 * Get Urdu display name for a book slug, with a slug-humanisation fallback.
 * @param {string} slug
 * @returns {string}
 */
export function displayName(slug) {
  return state.BOOK_DISPLAY_NAMES[slug] || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Determine if a string is purely ASCII-Latin (used for translation lookup).
 * @param {string} text
 * @returns {boolean}
 */
export function isEnglish(text) {
  return /^[a-zA-Z\s]+$/.test(text);
}

/**
 * Translate an English query to Urdu equivalents using the loaded translations dictionary.
 * Returns an array of Urdu strings, or [query] if no translation found.
 * @param {string} query
 * @returns {string[]}
 */
export function translateToUrdu(query) {
  if (!state.translations || !isEnglish(query)) return [query];
  const eng2urdu = state.translations._english_to_urdu || {};
  const lower = query.toLowerCase();
  const matches = eng2urdu[lower] || eng2urdu[query];
  if (matches) return matches;
  const partial = [];
  for (const [eng, urduList] of Object.entries(eng2urdu)) {
    if (eng.toLowerCase().includes(lower) || lower.includes(eng.toLowerCase())) {
      partial.push(...urduList);
    }
  }
  return partial.length ? [...new Set(partial)] : [query];
}

/**
 * Trigger a library re-render after filter state has changed.
 * The filter logic now lives inside renderLibrary() via getFilteredBooks(), so
 * this function's job is to update the filter-clear button visibility and invoke
 * the onUpdate callback (which callers wire to renderLibrary).
 * Accepts an optional onUpdate callback so callers (main.js) can trigger
 * a re-render without creating a circular import into rendering.js.
 * @param {(() => void) | undefined} [onUpdate]
 */
export function applyFilters(onUpdate) {
  const af = state.activeFilters;
  const anyActive = !!(af.text || af.author || af.category || af.tag);
  document.getElementById('filter-clear').classList.toggle('hidden', !anyActive);
  if (onUpdate) onUpdate();
}
