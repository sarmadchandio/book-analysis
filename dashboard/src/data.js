// src/data.js — Data loading, translations, metadata, filtering, display-name helpers.
// Imports only from state.js (no circular deps with rendering.js or main.js).

import { state } from './state.js';

/** Vite-provided base URL. '/' in dev; configurable at build time for Phase 4 deploy. */
export const BASE = import.meta.env.BASE_URL;

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
 * Apply current activeFilters to the rendered book cards in the DOM.
 * Accepts an optional onUpdate callback so callers (main.js) can trigger
 * a re-render without creating a circular import into rendering.js.
 * @param {(() => void) | undefined} [onUpdate]
 */
export function applyFilters(onUpdate) {
  const cards = document.querySelectorAll('#library-grid .card');
  let anyHidden = false;
  cards.forEach(card => {
    const slug = card.dataset.slug;
    const meta = getMeta(slug);
    const name = (displayName(slug) + ' ' + slug).toLowerCase();
    const show =
      (!state.activeFilters.text || name.includes(state.activeFilters.text) || meta.author.toLowerCase().includes(state.activeFilters.text)) &&
      (!state.activeFilters.author || meta.author === state.activeFilters.author) &&
      (!state.activeFilters.category || meta.category === state.activeFilters.category) &&
      (!state.activeFilters.tag || (meta.tags || []).includes(state.activeFilters.tag));
    card.style.display = show ? '' : 'none';
    if (!show) anyHidden = true;
  });
  document.getElementById('filter-clear').classList.toggle('hidden', !anyHidden);
  if (onUpdate) onUpdate();
}
