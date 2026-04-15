// src/data.js — BASE_URL-aware fetch helper.
// This file is a minimal stub in Plan 1; Plan 2 expands it with loadAllData,
// loadBookMeta, loadTranslations, loadEntities, loadTopics, filter helpers, etc.

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
