// src/main.js — Bootstrap, navigation, theme toggle, event wiring, and global entry point.
// Assigns window.openBook, window.goLibrary, window.openModal so inline onclick handlers work.

import './style.css';
import { state } from './state.js';
import {
  loadAllData, loadBookMeta, loadTranslations, applyFilters,
  translateToUrdu, isEnglish, getMeta, displayName, resolveImage,
  searchByVector,
} from './data.js';
import {
  renderLibrary,
  renderWords,
  renderTopics,
  renderGraph,
  renderDeepAnalysis,
  openModal,
  initModalListeners,
} from './rendering.js';

// ─── Chart.js Global Config (executed once at module load, before init) ───
// Chart is a CDN global loaded before this module script runs.
Chart.defaults.color = '#666';
Chart.defaults.borderColor = '#e5e5e5';
Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

// ─── Navigation ───

function showView(view) {
  document.getElementById('view-library').classList.toggle('hidden', view !== 'library');
  document.getElementById('view-book').classList.toggle('hidden', view !== 'book');
  document.querySelectorAll('.side-item[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === 'library' && view === 'library'));
}

function goLibrary() {
  showView('library');
  state.currentBook = null;
}

// ─── Book Detail ───

/**
 * Open the detail view for a book slug.
 * @param {string} slug
 * @returns {Promise<void>}
 */
async function openBook(slug) {
  state.currentBook = slug;
  showView('book');

  const meta = getMeta(slug);
  document.getElementById('bread-book').innerHTML = `<span class="urdu">${displayName(slug)}</span>`;
  document.getElementById('book-header').innerHTML = `
    <div class="section-title urdu" style="font-size:28px">${displayName(slug)}</div>
    <div class="section-sub">${meta.author} · ${meta.category}</div>
  `;

  const data = state.booksData[slug];
  const s = data.stats;
  const stats = [
    { v: s.total_pages, l: 'Pages' },
    { v: s.total_words.toLocaleString(), l: 'Words' },
    { v: s.unique_words.toLocaleString(), l: 'Unique' },
    { v: s.avg_words_per_page, l: 'Avg/Page' },
    { v: (s.lexical_richness * 100).toFixed(1) + '%', l: 'Richness' },
  ];
  document.getElementById('book-stats').innerHTML = stats.map(st => `
    <div><div class="stat-v">${st.v}</div><div class="stat-l">${st.l}</div></div>
  `).join('');

  await renderDeepAnalysis(slug, data);
  switchBookTab('words');
}

/**
 * Switch the active book analysis tab.
 * @param {string} tab - 'words' | 'topics' | 'graph' | 'search'
 */
function switchBookTab(tab) {
  document.querySelectorAll('.book-tab').forEach(b => {
    b.classList.toggle('active-tab', b.dataset.tab === tab);
  });
  ['words', 'topics', 'graph', 'search'].forEach(t => {
    document.getElementById(`book-tab-${t}`).classList.toggle('hidden', t !== tab);
  });
  const data = state.booksData[state.currentBook];
  if (tab === 'words') renderWords(data);
  if (tab === 'topics') renderTopics(state.currentBook);
  if (tab === 'graph') renderGraph(data);
}

// ─── Theme ───

/**
 * Apply a named theme ('light' or 'dark') to the document and persist it.
 * Also re-renders active charts so colors update.
 * @param {string} theme
 */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('icon-sun').classList.add('hidden');
    document.getElementById('icon-moon').classList.remove('hidden');
    Chart.defaults.color = '#888';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('icon-sun').classList.remove('hidden');
    document.getElementById('icon-moon').classList.add('hidden');
    Chart.defaults.color = '#666';
    Chart.defaults.borderColor = '#e5e5e5';
  }
  localStorage.setItem('theme', theme);

  // Re-render active charts if a book is open
  if (state.currentBook) {
    const activeTab = document.querySelector('.book-tab.active-tab');
    if (activeTab) switchBookTab(activeTab.dataset.tab);
  }
  // Re-render library charts
  if (!document.getElementById('view-library').classList.contains('hidden')) {
    renderLibrary();
  }
}

/**
 * Read saved theme from localStorage and wire up the theme toggle button.
 */
function initTheme() {
  const saved = localStorage.getItem('theme');
  // Light is default; only apply dark if explicitly saved
  if (saved === 'dark') applyTheme('dark');

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    applyTheme(isDark ? 'light' : 'dark');
  });
}

// ─── Filters ───

/** Count books matching a predicate (used for sidebar filter counts). */
function countMatching(pred) {
  return Object.keys(state.bookMeta).filter(slug => state.booksData[slug] && pred(state.bookMeta[slug], slug)).length;
}

/** Populate sidebar categories/authors/tags with counts and wire click handlers. */
function initSidebarFilters() {
  const meta = state.bookMeta;
  const slugs = Object.keys(state.booksData);
  const total = slugs.length;
  document.getElementById('sidebar-book-count').textContent = total;

  const categories = [...new Set(slugs.map(s => meta[s]?.category).filter(Boolean))].sort();
  const authors = [...new Set(slugs.map(s => meta[s]?.author).filter(Boolean))].sort();
  const tags = [...new Set(slugs.flatMap(s => meta[s]?.tags || []))].sort();

  const catEl = document.getElementById('side-categories');
  catEl.innerHTML = `<div class="filter-row active" data-cat=""><span>All</span><span class="count">${total}</span></div>` +
    categories.map(c => `<div class="filter-row" data-cat="${c}"><span>${c}</span><span class="count">${countMatching(m => m.category === c)}</span></div>`).join('');

  const authorEl = document.getElementById('side-authors');
  authorEl.innerHTML = authors.map(a => `<div class="filter-row" data-author="${a}"><span>${a}</span><span class="count">${countMatching(m => m.author === a)}</span></div>`).join('');

  const tagEl = document.getElementById('side-tags');
  tagEl.innerHTML = tags.map(t => `<button class="t" data-tag="${t}">${t}</button>`).join('');

  // Wire category clicks
  catEl.querySelectorAll('.filter-row').forEach(el => el.addEventListener('click', () => {
    const val = el.dataset.cat;
    state.activeFilters.category = val;
    catEl.querySelectorAll('.filter-row').forEach(x => x.classList.toggle('active', x === el));
    goLibrary();
    applyFilters(renderLibrary);
  }));

  // Wire author clicks (toggleable)
  authorEl.querySelectorAll('.filter-row').forEach(el => el.addEventListener('click', () => {
    const val = el.dataset.author;
    if (state.activeFilters.author === val) {
      state.activeFilters.author = '';
      el.classList.remove('active');
    } else {
      state.activeFilters.author = val;
      authorEl.querySelectorAll('.filter-row').forEach(x => x.classList.toggle('active', x === el));
    }
    goLibrary();
    applyFilters(renderLibrary);
  }));

  // Wire tag clicks (toggleable)
  tagEl.querySelectorAll('.t').forEach(el => el.addEventListener('click', () => {
    const val = el.dataset.tag;
    if (state.activeFilters.tag === val) {
      state.activeFilters.tag = '';
      el.classList.remove('active');
    } else {
      state.activeFilters.tag = val;
      tagEl.querySelectorAll('.t').forEach(x => x.classList.toggle('active', x === el));
    }
    goLibrary();
    applyFilters(renderLibrary);
  }));

  // Search input
  document.getElementById('filter-text').addEventListener('input', e => {
    state.activeFilters.text = e.target.value.toLowerCase();
    document.getElementById('filter-clear').classList.toggle('hidden', !e.target.value);
    applyFilters(renderLibrary);
  });
  document.getElementById('filter-clear').addEventListener('click', () => {
    state.activeFilters = { text: '', author: '', category: '', tag: '' };
    document.getElementById('filter-text').value = '';
    document.getElementById('filter-clear').classList.add('hidden');
    catEl.querySelectorAll('.filter-row').forEach(x => x.classList.toggle('active', x.dataset.cat === ''));
    authorEl.querySelectorAll('.filter-row').forEach(x => x.classList.remove('active'));
    tagEl.querySelectorAll('.t').forEach(x => x.classList.remove('active'));
    applyFilters(renderLibrary);
  });

  // Logo / library nav
  document.querySelector('.side-item[data-nav="library"]').addEventListener('click', goLibrary);
}

// ─── Book Tab Navigation ───

/** Wire click events on the inline book tab buttons. */
function initBookTabs() {
  document.querySelectorAll('.book-tab').forEach(btn => {
    btn.addEventListener('click', () => switchBookTab(btn.dataset.tab));
  });
}

// ─── Per-book Search ───

/** Wire the per-book search input and button. */
function initSearch() {
  const input = document.getElementById('search-input');
  const btn = document.getElementById('search-btn');

  function doSearch() {
    const rawQuery = input.value.trim();
    if (!rawQuery || !state.currentBook) return;
    const data = state.booksData[state.currentBook];
    const isEn = isEnglish(rawQuery);
    const ranked = searchByVector(data, rawQuery, 10);
    const pagesByNum = Object.fromEntries(data.search_pages.map(p => [p.page_num, p]));

    const statsEl = document.getElementById('search-stats');
    const resultsEl = document.getElementById('search-results');

    statsEl.classList.remove('hidden');
    const langLabel = isEn ? 'English' : 'Urdu';
    statsEl.innerHTML = `Top <strong>${ranked.length}</strong> page${ranked.length !== 1 ? 's' : ''} by TF-IDF cosine similarity <span style="color:var(--text-faint)">(${langLabel} index)</span>`;

    if (ranked.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--text-faint);text-align:center;padding:32px 0">No results found.</div>';
      return;
    }

    resultsEl.innerHTML = ranked.map(r => {
      const page = pagesByNum[r.page_num];
      if (!page) return '';
      const snippet = buildSnippet(page.text, r.tokens, isEn);
      const scorePct = (r.score * 100).toFixed(1);
      return `
      <div class="search-hit" style="border-radius:8px;padding:14px;">
        <div class="flex items-center justify-between mb-2">
          <span style="font-size:13px;font-weight:600;color:var(--accent)">Page ${r.page_num}</span>
          <span style="font-size:11px;color:var(--text-faint)">score ${scorePct}</span>
        </div>
        <div class="urdu" style="font-size:15px;color:var(--text-body);margin-bottom:4px;line-height:1.8">${snippet}</div>
        ${page.image_path ? `<a href="${resolveImage(page.image_path)}" target="_blank" rel="noopener" style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent);display:inline-flex;align-items:center;gap:4px;text-decoration:none;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          View original page
        </a>` : ''}
      </div>`;
    }).join('');
  }

  /** Build a short HTML snippet from a page's Urdu text, centered on the first
   *  matched token and highlighting all tokens present on the page.
   *  For English queries, tokens are English words — the page text is Urdu, so we
   *  fall back to showing the page's opening text. */
  function buildSnippet(fullText, tokens, isEnglishQuery) {
    const MAX_LEN = 260;
    if (!tokens || !tokens.length) return fullText.slice(0, MAX_LEN);
    if (isEnglishQuery) {
      // English query → Urdu page body — no direct substring; show the opening.
      return escapeHtml(fullText.slice(0, MAX_LEN)) + (fullText.length > MAX_LEN ? '…' : '');
    }
    let anchor = -1;
    for (const t of tokens) {
      const i = fullText.indexOf(t);
      if (i !== -1 && (anchor === -1 || i < anchor)) anchor = i;
    }
    const start = anchor < 0 ? 0 : Math.max(0, anchor - 80);
    const end = Math.min(fullText.length, start + MAX_LEN);
    let snippet = escapeHtml(fullText.slice(start, end));
    for (const t of tokens) {
      snippet = snippet.replaceAll(escapeHtml(t), `<mark>${escapeHtml(t)}</mark>`);
    }
    return (start > 0 ? '…' : '') + snippet + (end < fullText.length ? '…' : '');
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

// ─── Global Search ───

/** Wire the global (cross-library) search input and button. */
function initGlobalSearch() {
  const input = document.getElementById('global-search-input');
  const btn = document.getElementById('global-search-btn');

  function doGlobalSearch() {
    const rawQuery = input.value.trim();
    if (!rawQuery) return;
    const queries = translateToUrdu(rawQuery);
    const translated = isEnglish(rawQuery) && queries[0] !== rawQuery;

    const allResults = [];

    for (const [slug, data] of Object.entries(state.booksData)) {
      const bookResults = [];

      for (const page of data.search_pages) {
        const hits = [];
        for (const query of queries) {
          let pos = 0;
          while (true) {
            const found = page.text.indexOf(query, pos);
            if (found === -1) break;
            const start = Math.max(0, found - 60);
            const end = Math.min(page.text.length, found + query.length + 60);
            let snippet = page.text.slice(start, end);
            snippet = snippet.replaceAll(query, `<mark>${query}</mark>`);
            if (start > 0) snippet = '...' + snippet;
            if (end < page.text.length) snippet += '...';
            hits.push(snippet);
            pos = found + query.length;
          }
        }
        if (hits.length) {
          bookResults.push({ page_num: page.page_num, image_path: page.image_path, hits, count: hits.length });
        }
      }

      if (bookResults.length) {
        allResults.push({
          slug,
          name: displayName(slug),
          pages: bookResults,
          totalHits: bookResults.reduce((s, r) => s + r.count, 0),
        });
      }
    }

    const statsEl = document.getElementById('global-search-stats');
    const resultsEl = document.getElementById('global-search-results');
    const totalHits = allResults.reduce((s, r) => s + r.totalHits, 0);
    const totalPages = allResults.reduce((s, r) => s + r.pages.length, 0);

    statsEl.classList.remove('hidden');
    const gTransNote = translated ? ` <span style="color:var(--accent)">(translated: ${queries.join('، ')})</span>` : '';
    statsEl.innerHTML = `Found <strong>${totalHits}</strong> match${totalHits !== 1 ? 'es' : ''} across <strong>${totalPages}</strong> page${totalPages !== 1 ? 's' : ''} in <strong>${allResults.length}</strong> book${allResults.length !== 1 ? 's' : ''}${gTransNote}`;

    if (!allResults.length) {
      resultsEl.innerHTML = '<div style="color:var(--text-faint);text-align:center;padding:32px 0">No results found.</div>';
      return;
    }

    resultsEl.innerHTML = allResults.map(book => `
      <div class="card">
        <div class="card-head">
          <div class="flex items-center gap-2">
            <span class="urdu" style="font-size:15px;font-weight:700;color:var(--text-primary)">${book.name}</span>
            <span style="font-size:11px;color:var(--text-faint)">${book.slug}</span>
          </div>
          <span class="pill pill-purple">${book.totalHits} match${book.totalHits !== 1 ? 'es' : ''}</span>
        </div>
        <div class="card-body flex flex-col gap-2">
          ${book.pages.slice(0, 10).map(r => `
            <div class="search-hit" style="border-radius:6px;padding:10px;">
              <div class="flex items-center justify-between mb-1">
                <span style="font-size:12px;font-weight:600;color:var(--accent)">Page ${r.page_num}</span>
                <span style="font-size:10px;color:var(--text-faint)">${r.count} match${r.count > 1 ? 'es' : ''}</span>
              </div>
              ${r.hits.slice(0, 3).map(h => `<div class="urdu" style="font-size:14px;color:var(--text-body);margin-bottom:2px;line-height:1.8">${h}</div>`).join('')}
              ${r.hits.length > 3 ? `<div style="font-size:10px;color:var(--text-faint)">+${r.hits.length - 3} more...</div>` : ''}
            </div>
          `).join('')}
          ${book.pages.length > 10 ? `<div style="font-size:11px;color:var(--text-faint);text-align:center;padding:4px 0">+${book.pages.length - 10} more pages...</div>` : ''}
        </div>
      </div>
    `).join('');
  }

  btn.addEventListener('click', doGlobalSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doGlobalSearch(); });
}

// ─── Window Globals (must be assigned before init runs) ───
// Inline onclick handlers in index.html and rendering.js template literals
// call these as plain functions — they must be on window.
window.openBook = openBook;
window.goLibrary = goLibrary;
window.openModal = openModal;

// ─── Init ───

/**
 * Top-level async initialiser. Loads all data then wires the UI.
 * @returns {Promise<void>}
 */
export async function init() {
  await loadAllData();
  await loadTranslations();
  await loadBookMeta();
  initTheme();
  initSidebarFilters();
  initBookTabs();
  initSearch();
  initGlobalSearch();
  initModalListeners();
  renderLibrary();
}

init();
