// src/state.js — Single source of shared mutable state.
// No logic, no imports. All other modules import { state } from here.

/**
 * Shared mutable state for the book-analysis dashboard.
 * All modules read and write via this object to avoid circular imports.
 *
 * @type {{
 *   booksIndex: null | { books: Array<{ name: string, total_pages: number, total_words: number, unique_tokens: number, unique_words: number, lexical_richness: number }> },
 *   booksData: Record<string, any>,
 *   bookMeta: Record<string, { author: string, tags: string[], category: string }>,
 *   translations: null | Record<string, any>,
 *   charts: Record<string, any>,
 *   currentGraph: null | any,
 *   currentCoGraph: null | any,
 *   currentBook: null | string,
 *   entityData: Record<string, any>,
 *   topicsCache: Record<string, any>,
 *   activeFilters: { text: string, author: string, category: string, tag: string },
 *   currentLibraryObserver: IntersectionObserver | null,
 *   COLORS: string[],
 *   COVER_COLORS: string[],
 *   URDU_FONT: string,
 *   BOOK_DISPLAY_NAMES: Record<string, string>
 * }}
 */
export const state = {
  // ─── Runtime mutable refs ───
  /** @type {null | { books: Array<any> }} */
  booksIndex: null,
  /** @type {Record<string, any>} */
  booksData: {},
  /** @type {Record<string, { author: string, tags: string[], category: string }>} */
  bookMeta: {},
  /** @type {null | Record<string, any>} */
  translations: null,
  /** @type {Record<string, any>} */
  charts: {},
  /** @type {null | any} */
  currentGraph: null,
  /** @type {null | any} */
  currentCoGraph: null,
  /** @type {null | string} */
  currentBook: null,
  /** @type {Record<string, any>} */
  entityData: {},
  /** @type {Record<string, any>} */
  topicsCache: {},
  /** @type {{ text: string, author: string, category: string, tag: string }} */
  activeFilters: { text: '', author: '', category: '', tag: '' },
  /** @type {IntersectionObserver | null} */
  currentLibraryObserver: null,

  // ─── Constants (kept on state to minimize imports downstream) ───
  COLORS: ['#6B6BDE', '#B8B5F5', '#F2B630', '#1a1a1a', '#D4D2FA', '#ec4899', '#06b6d4', '#84cc16'],
  COVER_COLORS: ['#6B6BDE', '#D4D2FA', '#1a1a1a', '#F2B630', '#B8B5F5'],
  URDU_FONT: "'Noto Nastaliq Urdu', serif",
  BOOK_DISPLAY_NAMES: {
    'deewan-e-ghalib': 'دیوانِ غالب',
    'murda-ankhain': 'مردہ آنکھیں',
    'ankhain': 'آنکھیں',
    'deewan-e-meer': 'دیوانِ میر (سندھی)',
    'deewan-e-meer-by-meer-taqi-meer-urduinpage-com': 'دیوانِ میر',
    'kulliyat-e-meer-farhang-meer-taqi-meer': 'کلیاتِ میر (فرہنگ)',
    'masnavi-dariya-e-ishq-meer-taqi-meer-ebooks-3': 'مثنوی دریائے عشق',
    '4628-meer-taqi-meer-hauyatt-aur-shaury': 'میر تقی میر: حیات اور شاعری',
  },
};
