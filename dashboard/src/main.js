// src/main.js — Bootstrap, navigation, theme toggle, event wiring, and global entry point.
// Assigns window.openBook, window.goLibrary, window.openModal so inline onclick handlers work.

import './style.css';
import { state } from './state.js';
import {
  loadAllData, loadBookMeta, loadTranslations, applyFilters,
  translateToUrdu, isEnglish, getMeta, displayName,
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

/**
 * Show a top-level view by id ('library' or 'book'), hiding the other.
 * @param {string} view
 */
function showView(view) {
  document.getElementById('view-library').classList.toggle('hidden', view !== 'library');
  document.getElementById('view-book').classList.toggle('hidden', view !== 'book');
  document.getElementById('breadbar').classList.toggle('hidden', view !== 'book');
  // Update top nav active states
  document.querySelectorAll('#topnav-links a').forEach(a => a.classList.remove('active'));
  if (view === 'library') {
    document.querySelector('[data-nav="library"]').classList.add('active');
    updateTopNavTabs(false);
  }
}

/**
 * Navigate back to the library view and clear the current book.
 */
function goLibrary() {
  showView('library');
  state.currentBook = null;
}

/**
 * Add or remove the per-book analysis tab links in the top nav.
 * @param {boolean} bookOpen
 */
function updateTopNavTabs(bookOpen) {
  const links = document.getElementById('topnav-links');
  // Remove old book tabs
  links.querySelectorAll('[data-nav-tab]').forEach(el => el.remove());
  if (!bookOpen) return;
  // Add book analysis tabs to top nav
  const tabs = ['words', 'topics', 'graph', 'search'];
  const labels = { words: 'Words', topics: 'Topics', graph: 'Relationships', search: 'Search' };
  tabs.forEach(tab => {
    const a = document.createElement('a');
    a.dataset.navTab = tab;
    a.textContent = labels[tab];
    if (tab === 'words') a.classList.add('active');
    a.addEventListener('click', () => {
      links.querySelectorAll('[data-nav-tab]').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      switchBookTab(tab);
    });
    links.appendChild(a);
  });
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
  updateTopNavTabs(true);

  // Update breadcrumb
  const meta = getMeta(slug);
  document.getElementById('bread-book').innerHTML = `<span class="urdu" style="font-size:14px">${displayName(slug)}</span> <span style="color:var(--text-faint);font-weight:400">— ${meta.author}</span>`;

  // Remove library active, highlight first tab
  document.querySelector('[data-nav="library"]').classList.remove('active');

  const data = state.booksData[slug];

  // Stats
  const s = data.stats;
  const stats = [
    { v: s.total_pages, l: 'Pages', tip: 'Number of scanned pages processed by OCR' },
    { v: s.total_words.toLocaleString(), l: 'Words', tip: 'Total word count across all pages' },
    { v: s.unique_words.toLocaleString(), l: 'Unique', tip: 'Number of distinct words in the text' },
    { v: s.avg_words_per_page, l: 'Avg/Page', tip: 'Average number of words per page' },
    { v: (s.lexical_richness * 100).toFixed(1) + '%', l: 'Richness', tip: 'Vocabulary diversity: unique tokens / total tokens' },
  ];
  const detailAccents = ['#6B6BDE', '#B8B5F5', '#F2B630', '#D4D2FA', '#1a1a1a'];
  document.getElementById('book-stats').innerHTML = stats.map((st, i) => `
    <div class="card cursor-help" data-tip="${st.tip}" style="border-top:3px solid ${detailAccents[i % detailAccents.length]}">
      <div class="card-body text-center">
        <div style="font-size:1.3rem;font-weight:700;color:var(--text-primary);letter-spacing:-0.02em">${st.v}</div>
        <div class="stat-label">${st.l}</div>
      </div>
    </div>
  `).join('');

  // Deep analysis cards
  await renderDeepAnalysis(slug, data);

  switchBookTab('words');
}

/**
 * Switch the active book analysis tab.
 * @param {string} tab - 'words' | 'topics' | 'graph' | 'search'
 */
function switchBookTab(tab) {
  // Sync inline tab bar
  document.querySelectorAll('.book-tab').forEach(b => {
    b.classList.toggle('active-tab', b.dataset.tab === tab);
  });
  // Sync top nav tabs
  document.querySelectorAll('#topnav-links [data-nav-tab]').forEach(a => {
    a.classList.toggle('active', a.dataset.navTab === tab);
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

/**
 * Populate author/category/tag filter controls and wire their change events.
 */
function initFilters() {
  const authors = [...new Set(Object.values(state.bookMeta).map(m => m.author))].sort();
  const categories = [...new Set(Object.values(state.bookMeta).map(m => m.category))].sort();
  const allTags = [...new Set(Object.values(state.bookMeta).flatMap(m => m.tags || []))].sort();

  const authorSel = document.getElementById('filter-author');
  authors.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; authorSel.appendChild(o); });

  const catSel = document.getElementById('filter-category');
  categories.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });

  const tagsDiv = document.getElementById('filter-tags');
  allTags.forEach(tag => {
    const el = document.createElement('span');
    el.className = 'pill pill-plain pill-click';
    el.textContent = tag;
    el.addEventListener('click', () => {
      state.activeFilters.tag = state.activeFilters.tag === tag ? '' : tag;
      applyFilters(renderLibrary);
    });
    tagsDiv.appendChild(el);
  });

  document.getElementById('filter-text').addEventListener('input', e => {
    state.activeFilters.text = e.target.value.toLowerCase();
    applyFilters(renderLibrary);
  });
  authorSel.addEventListener('change', e => { state.activeFilters.author = e.target.value; applyFilters(renderLibrary); });
  catSel.addEventListener('change', e => { state.activeFilters.category = e.target.value; applyFilters(renderLibrary); });
  document.getElementById('filter-clear').addEventListener('click', () => {
    state.activeFilters = { text: '', author: '', category: '', tag: '' };
    document.getElementById('filter-text').value = '';
    document.getElementById('filter-author').value = '';
    document.getElementById('filter-category').value = '';
    applyFilters(renderLibrary);
  });
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
    const queries = translateToUrdu(rawQuery);
    const data = state.booksData[state.currentBook];
    const results = [];
    const translated = isEnglish(rawQuery) && queries[0] !== rawQuery;

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
        results.push({
          page_num: page.page_num,
          image_path: page.image_path,
          hits,
          count: hits.length,
        });
      }
    }

    const statsEl = document.getElementById('search-stats');
    const resultsEl = document.getElementById('search-results');
    const totalHits = results.reduce((s, r) => s + r.count, 0);

    statsEl.classList.remove('hidden');
    const transNote = translated ? ` <span style="color:var(--accent)">(translated: ${queries.join('، ')})</span>` : '';
    statsEl.innerHTML = `Found <strong>${totalHits}</strong> match${totalHits !== 1 ? 'es' : ''} across <strong>${results.length}</strong> page${results.length !== 1 ? 's' : ''}${transNote}`;

    if (results.length === 0) {
      resultsEl.innerHTML = '<div style="color:var(--text-faint);text-align:center;padding:32px 0">No results found.</div>';
      return;
    }

    resultsEl.innerHTML = results.map(r => `
      <div class="search-hit" style="border-radius:8px;padding:14px;">
        <div class="flex items-center justify-between mb-2">
          <span style="font-size:13px;font-weight:600;color:var(--accent)">Page ${r.page_num}</span>
          <span style="font-size:11px;color:var(--text-faint)">${r.count} match${r.count > 1 ? 'es' : ''}</span>
        </div>
        ${r.hits.map(h => `<div class="urdu" style="font-size:15px;color:var(--text-body);margin-bottom:4px;line-height:1.8">${h}</div>`).join('')}
        ${r.image_path ? `<a href="/${r.image_path}" target="_blank" rel="noopener" style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent);display:inline-flex;align-items:center;gap:4px;text-decoration:none;">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          View original page
        </a>` : ''}
      </div>
    `).join('');
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
  initFilters();
  initBookTabs();
  initSearch();
  initGlobalSearch();
  initModalListeners();
  renderLibrary();
}

init();
