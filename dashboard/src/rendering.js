// src/rendering.js — All DOM rendering, charts, graphs, modal, and search-template functions.
// Chart.js (Chart) and vis-network (vis) are consumed as CDN globals — do NOT npm-install them here.
// Imports only from state.js and data.js (no import from main.js).

import { state } from './state.js';
import { getMeta, displayName, loadEntities, loadTopics, resolveImage } from './data.js';

// ─── Theme Helpers (file-private) ───

/** @returns {string} Computed value of a CSS variable on :root */
function getThemeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/** @returns {boolean} true when dark theme is active */
function isDark() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

/** @returns {boolean} true when light theme is active */
function isLight() { return !isDark(); }

// ─── Chart Helpers ───

/**
 * Destroy a Chart.js instance by canvas id (prevents reuse errors).
 * @param {string} id - canvas element id
 */
export function destroyChart(id) {
  if (state.charts[id]) { state.charts[id].destroy(); delete state.charts[id]; }
}

/**
 * Render a horizontal Urdu bar chart on a canvas element.
 * @param {string} canvasId
 * @param {string[]} labels
 * @param {number[]} values
 * @param {string} color - hex color
 * @param {string} label - dataset label
 */
export function urduBarChart(canvasId, labels, values, color, label) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext('2d');
  state.charts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label, data: values, backgroundColor: color + '66', borderColor: color, borderWidth: 1 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { font: { family: state.URDU_FONT, size: 13 }, color: getThemeColor('--text-body') } },
        x: { beginAtZero: true }
      }
    }
  });
}

// ─── Library View ───

/** Number of book cards to render per virtual-scroll batch. */
const BATCH = 12;

/**
 * Build the HTML string for a single book card.
 * @param {object} b - Book entry from state.booksIndex.books
 * @param {number} i - Index used for cover color cycling
 * @returns {string}
 */
function bookCardHTML(b, _i) {
  const meta = getMeta(b.name);
  const words = b.total_words >= 1000 ? (b.total_words / 1000).toFixed(b.total_words >= 10000 ? 0 : 1) + 'k' : b.total_words;
  return `
    <div class="book-card" data-slug="${b.name}" onclick="openBook('${b.name}')">
      <div class="bc-accent"></div>
      <div class="bc-urdu urdu">${displayName(b.name)}</div>
      <div class="bc-author">${meta.author} · ${meta.category}</div>
      <div class="bc-stats">
        <span><strong>${b.total_pages}</strong> pages</span>
        <span><strong>${words}</strong> words</span>
      </div>
    </div>`;
}

/**
 * Return the subset of books that match the current activeFilters.
 * Returns all books when no filter is active.
 * @returns {Array<object>}
 */
function getFilteredBooks() {
  const books = state.booksIndex.books;
  const af = state.activeFilters;
  if (!af.text && !af.author && !af.category && !af.tag) return books;
  return books.filter(b => {
    const meta = getMeta(b.name);
    const name = (displayName(b.name) + ' ' + b.name).toLowerCase();
    return (
      (!af.text || name.includes(af.text) || meta.author.toLowerCase().includes(af.text)) &&
      (!af.author || meta.author === af.author) &&
      (!af.category || meta.category === af.category) &&
      (!af.tag || (meta.tags || []).includes(af.tag))
    );
  });
}

/**
 * Render the full library view: stat cards, book grid (with IntersectionObserver virtual
 * scroll when book count > BATCH and no filters active), and comparison charts.
 *
 * Virtual scroll behaviour:
 *  - BATCH=12 cards rendered immediately; a sentinel <div> is appended to the grid.
 *  - IntersectionObserver (rootMargin: '200px') watches the sentinel and appends the
 *    next BATCH when it enters the viewport.
 *  - When all cards are rendered the observer is disconnected and the sentinel removed.
 * Filter bypass: when any activeFilter is non-empty, all matching cards are rendered
 * synchronously and no observer is created.
 * Short-list bypass: when books.length <= BATCH the grid is also rendered synchronously.
 */
export function renderLibrary() {
  const allBooks = state.booksIndex.books;

  // Stats strip (always shown, not filtered)
  const statsGrid = document.getElementById('library-stats');
  const totalPages = allBooks.reduce((s, b) => s + b.total_pages, 0);
  const totalWords = allBooks.reduce((s, b) => s + b.total_words, 0);
  const totalTokens = allBooks.reduce((s, b) => s + b.unique_tokens, 0);
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : n;
  const agg = [
    { v: allBooks.length, l: 'Books' },
    { v: fmt(totalPages), l: 'Pages' },
    { v: fmt(totalWords), l: 'Words' },
    { v: fmt(totalTokens), l: 'Unique Tokens' },
  ];
  statsGrid.innerHTML = agg.map(s => `<div><div class="stat-v">${s.v}</div><div class="stat-l">${s.l}</div></div>`).join('');

  // Update section sub with filter state
  const af = state.activeFilters;
  const filterLabel = af.category || af.author || af.tag;
  document.getElementById('library-sub').textContent = filterLabel
    ? `Filtered by ${filterLabel}`
    : `${allBooks.length} books in your library`;

  // ── Book grid ──
  // Tear down any prior IntersectionObserver before rebuilding the grid.
  if (state.currentLibraryObserver) {
    state.currentLibraryObserver.disconnect();
    state.currentLibraryObserver = null;
  }

  const cardsGrid = document.getElementById('library-grid');
  cardsGrid.innerHTML = '';

  const books = getFilteredBooks();

  // Determine if any filter is currently active.
  const filtersActive = !!(af.text || af.author || af.category || af.tag);

  // Bypass virtual scroll: render all matching cards synchronously.
  if (filtersActive || books.length <= BATCH) {
    cardsGrid.innerHTML = books.map((b, i) => bookCardHTML(b, i)).join('');
  } else {
    // Virtual scroll path — render first BATCH, then observe sentinel.
    let offset = 0;

    const appendBatch = () => {
      const slice = books.slice(offset, offset + BATCH);
      for (let j = 0; j < slice.length; j++) {
        const tpl = document.createElement('template');
        tpl.innerHTML = bookCardHTML(slice[j], offset + j).trim();
        cardsGrid.appendChild(tpl.content.firstElementChild);
      }
      offset += slice.length;
    };

    appendBatch();

    const sentinel = document.createElement('div');
    sentinel.style.gridColumn = '1 / -1';
    sentinel.style.height = '1px';
    cardsGrid.appendChild(sentinel);

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      if (offset >= books.length) {
        observer.disconnect();
        sentinel.remove();
        state.currentLibraryObserver = null;
        return;
      }
      appendBatch();
      // Keep sentinel at the very end of the grid.
      cardsGrid.appendChild(sentinel);
    }, { rootMargin: '200px' });

    observer.observe(sentinel);
    state.currentLibraryObserver = observer;
  }

  // ── Comparison charts (always use the full book list, not filtered) ──
  destroyChart('chart-lib-comparison');
  const ctx1 = document.getElementById('chart-lib-comparison').getContext('2d');
  state.charts['chart-lib-comparison'] = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: allBooks.map(b => displayName(b.name)),
      datasets: [
        { label: 'Total Words', data: allBooks.map(b => b.total_words), backgroundColor: state.COLORS[0] + '88' },
        { label: 'Unique Words', data: allBooks.map(b => b.unique_words), backgroundColor: state.COLORS[1] + '88' },
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { font: { family: state.URDU_FONT, size: 13 } } },
        y: { beginAtZero: true }
      }
    }
  });

  destroyChart('chart-lib-richness');
  const ctx2 = document.getElementById('chart-lib-richness').getContext('2d');
  state.charts['chart-lib-richness'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: allBooks.map(b => displayName(b.name)),
      datasets: [{
        label: 'Lexical Richness',
        data: allBooks.map(b => (b.lexical_richness * 100).toFixed(1)),
        backgroundColor: allBooks.map((_, i) => state.COLORS[i % state.COLORS.length] + '88'),
        borderColor: allBooks.map((_, i) => state.COLORS[i % state.COLORS.length]),
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { font: { family: state.URDU_FONT, size: 13 } } },
        y: { beginAtZero: true, title: { display: true, text: '% Unique Tokens' } }
      }
    }
  });

  renderTfidf();
}

/**
 * Render the cross-library TF-IDF comparison bar charts.
 */
export function renderTfidf() {
  const grid = document.getElementById('tfidf-grid');
  const slugs = Object.keys(state.booksData);
  const hasAny = slugs.some(s => state.booksData[s].tfidf?.length);

  if (!hasAny) {
    document.getElementById('tfidf-section').classList.add('hidden');
    return;
  }

  grid.innerHTML = slugs.map((slug, i) => `
    <div class="card p-5">
      <h4 class="urdu" style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:12px">${displayName(slug)}</h4>
      <canvas id="chart-tfidf-${i}"></canvas>
    </div>
  `).join('');

  requestAnimationFrame(() => {
    slugs.forEach((slug, i) => {
      const d = (state.booksData[slug].tfidf || []).slice(0, 20);
      if (d.length) {
        urduBarChart(`chart-tfidf-${i}`, d.map(w => w.word), d.map(w => w.score), state.COLORS[i % state.COLORS.length], 'Importance');
      }
    });
  });
}

// ─── Book Words Tab ───

/**
 * Render the Words tab: bigram chart, word frequency table, TF-IDF table, word cloud, page chart.
 * @param {any} data - per-book data object from state.booksData
 */
export function renderWords(data) {
  const bi = data.bigrams.slice(0, 20);
  urduBarChart('chart-bigrams', bi.map(b => `${b.word1} ${b.word2}`), bi.map(b => b.count), state.COLORS[1], 'Count');

  const tbody = document.getElementById('word-table');
  const maxCount = data.word_freq[0]?.count || 1;
  tbody.innerHTML = data.word_freq.map((w, i) => `
    <tr class="tbl-row">
      <td style="color:var(--text-faint)">${i + 1}</td>
      <td class="urdu" style="text-align:right;font-size:15px;color:var(--text-primary)">${w.word}</td>
      <td style="font-variant-numeric:tabular-nums;color:var(--text-muted)">${w.count}</td>
      <td>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(w.count / maxCount * 100)}%;background:var(--chart-bar)"></div>
        </div>
      </td>
    </tr>
  `).join('');

  // TF-IDF table (within-book, each page as a document)
  const tfidfTbody = document.getElementById('tfidf-table');
  const bookTfidf = data.tfidf;
  if (bookTfidf && bookTfidf.length) {
    const maxScore = bookTfidf[0].score;
    tfidfTbody.innerHTML = bookTfidf.map((w, i) => `
      <tr class="tbl-row">
        <td style="color:var(--text-faint)">${i + 1}</td>
        <td class="urdu" style="text-align:right;font-size:15px;color:var(--text-primary)">${w.word}</td>
        <td style="font-variant-numeric:tabular-nums;color:var(--text-muted)">${w.score.toFixed(4)}</td>
        <td>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(w.score / maxScore * 100)}%;background:var(--text-muted)"></div>
          </div>
        </td>
      </tr>
    `).join('');
  } else {
    tfidfTbody.innerHTML = '<tr><td colspan="4" style="padding:16px;text-align:center;color:var(--text-faint)">Not enough pages for TF-IDF analysis</td></tr>';
  }

  // Word cloud
  renderWordCloud(data.word_freq);

  // Words per page chart (moved from Pages tab)
  renderPages(data);
}

// ─── Word Cloud ───

/**
 * Render a canvas-based Urdu word cloud.
 * @param {Array<{ word: string, count: number }>} wordFreq
 */
export function renderWordCloud(wordFreq) {
  const canvas = document.getElementById('wordcloud-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.offsetWidth;
  const displayH = 420;
  canvas.width = displayW * dpr;
  canvas.height = displayH * dpr;
  canvas.style.height = displayH + 'px';
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayW, displayH);

  const words = wordFreq.slice(0, 50);
  if (!words.length) return;

  const maxCount = words[0].count;
  const minCount = words[words.length - 1].count;
  const minSize = 14;
  const maxSize = 56;
  const palette = ['#6B6BDE', '#B8B5F5', '#1a1a1a', '#F2B630', '#D4D2FA', '#444', '#8B8BEE', '#c9940a', '#6B6BDE', '#888', '#B8B5F5', '#1a1a1a'];

  // Use log scale for better size variation
  const logMax = Math.log(maxCount + 1);
  const logMin = Math.log(minCount + 1);
  const range = logMax - logMin || 1;

  const placed = [];
  const centerX = displayW / 2;
  const centerY = displayH / 2;
  const padding = 40; // keep words away from edges

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const t = (Math.log(w.count + 1) - logMin) / range;
    const size = minSize + t * (maxSize - minSize);
    const color = palette[i % palette.length];

    ctx.font = `bold ${size}px 'Noto Nastaliq Urdu', serif`;
    ctx.direction = 'rtl';
    const metrics = ctx.measureText(w.word);
    const wordW = metrics.width + 8;
    const wordH = size * 1.6;

    let angle = i * 0.7;
    let radius = 0;
    let x, y, collision;
    let attempts = 0;

    do {
      x = centerX + radius * Math.cos(angle) - wordW / 2;
      y = centerY + radius * Math.sin(angle) - wordH / 2;
      // Check bounds
      const inBounds = x >= padding && x + wordW <= displayW - padding &&
                       y >= padding && y + wordH <= displayH - padding;
      collision = !inBounds || placed.some(p =>
        x < p.x + p.w + 4 && x + wordW + 4 > p.x &&
        y < p.y + p.h + 2 && y + wordH + 2 > p.y
      );
      angle += 0.25;
      radius += 0.5;
      attempts++;
    } while (collision && attempts < 1200);

    if (attempts < 1200) {
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(w.word, x + wordW / 2, y + wordH / 2);
      placed.push({ x, y, w: wordW, h: wordH });
    }
  }
}

// ─── Pages Chart ───

/**
 * Render the words-per-page line chart.
 * @param {any} data - per-book data object
 */
export function renderPages(data) {
  const pages = data.page_stats;
  destroyChart('chart-pages');
  const ctx = document.getElementById('chart-pages').getContext('2d');
  state.charts['chart-pages'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: pages.map(p => p.page),
      datasets: [
        {
          label: 'Total Words',
          data: pages.map(p => p.words),
          borderColor: state.COLORS[0],
          backgroundColor: state.COLORS[0] + '22',
          fill: true, tension: 0.3, pointRadius: 2,
        },
        {
          label: 'Unique Words',
          data: pages.map(p => p.tokens),
          borderColor: state.COLORS[2],
          backgroundColor: state.COLORS[2] + '22',
          fill: true, tension: 0.3, pointRadius: 2,
        },
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { title: { display: true, text: 'Page' }, ticks: { maxTicksLimit: 30, font: { size: 10 } } },
        y: { beginAtZero: true, title: { display: true, text: 'Count' } }
      }
    }
  });
}

// ─── Topics Tab ───

const TOPIC_COLORS = [
  '#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
];

/**
 * Render the Topics tab: scatter plot and distribution bar chart.
 * @param {string} slug
 * @returns {Promise<void>}
 */
export async function renderTopics(slug) {
  const topics = await loadTopics(slug);
  if (!topics || !topics.points.length) return;

  const labels = topics.cluster_labels || {};
  const points = topics.points;

  // Build legend
  const legendEl = document.getElementById('topic-legend');
  const clusters = [...new Set(points.map(p => p.cluster))].sort((a, b) => a - b);
  legendEl.innerHTML = clusters.map(c => {
    const color = c === -1 ? '#52525b' : TOPIC_COLORS[c % TOPIC_COLORS.length];
    const name = c === -1 ? 'Unclustered' : (labels[String(c)] || `Topic ${c}`);
    return `<span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${color}"></span> ${name}</span>`;
  }).join('');

  // Scatter plot
  destroyChart('chart-topics');
  const ctx = document.getElementById('chart-topics').getContext('2d');

  const datasets = clusters.map(c => {
    const color = c === -1 ? '#52525b' : TOPIC_COLORS[c % TOPIC_COLORS.length];
    const name = c === -1 ? 'Unclustered' : (labels[String(c)] || `Topic ${c}`);
    const pts = points.filter(p => p.cluster === c);
    return {
      label: name,
      data: pts.map(p => ({ x: p.x, y: p.y, page: p.page_num, snippet: p.snippet })),
      backgroundColor: color + 'aa',
      borderColor: color,
      borderWidth: 1,
      pointRadius: c === -1 ? 3 : 5,
      pointHoverRadius: 8,
    };
  });

  state.charts['chart-topics'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = ctx.raw;
              return [`Page ${d.page}`, d.snippet.slice(0, 80) + '...'];
            }
          },
          bodyFont: { family: state.URDU_FONT, size: 12 },
          titleFont: { family: "'Outfit', sans-serif" },
          maxWidth: 300,
        }
      },
      scales: {
        x: { display: false },
        y: { display: false },
      },
    }
  });

  // Topic distribution bar chart
  destroyChart('chart-topic-dist');
  const distCtx = document.getElementById('chart-topic-dist').getContext('2d');
  const validClusters = clusters.filter(c => c !== -1);
  const counts = validClusters.map(c => points.filter(p => p.cluster === c).length);
  const names = validClusters.map(c => labels[String(c)] || `Topic ${c}`);
  const colors = validClusters.map(c => TOPIC_COLORS[c % TOPIC_COLORS.length]);

  state.charts['chart-topic-dist'] = new Chart(distCtx, {
    type: 'bar',
    data: {
      labels: names,
      datasets: [{
        label: 'Pages',
        data: counts,
        backgroundColor: colors.map(c => c + '88'),
        borderColor: colors,
        borderWidth: 1,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'Pages' } },
        y: { ticks: { font: { size: 11 } } },
      }
    }
  });
}

// ─── Relationship Graphs ───

/**
 * Render both entity graph and co-occurrence graph for the current book.
 * @param {any} data - per-book data object
 * @returns {Promise<void>}
 */
export async function renderGraph(data) {
  // Entity graph
  const entityContainer = document.getElementById('graph-container');
  const entities = await loadEntities(state.currentBook);

  if (entities && entities.relationships.length) {
    renderEntityGraph(entityContainer, entities);
  }

  // Co-occurrence graph (always render)
  const coContainer = document.getElementById('graph-container-cooccurrence');
  if (data.graph && data.graph.nodes.length) {
    renderCooccurrenceGraph(coContainer, data);
  }
}

/**
 * Render the vis-network entity relationship graph.
 * @param {HTMLElement} container
 * @param {any} entities
 */
export function renderEntityGraph(container, entities) {
  const TYPE_COLORS = {
    poet: '#3b82f6', subject: '#f59e0b', author: '#10b981', character: '#ef4444',
    literary_figure: '#8b5cf6', friend: '#ec4899', journalist: '#06b6d4', artist: '#84cc16',
    reference: '#94a3b8', city: '#f97316', country: '#14b8a6', location: '#a78bfa',
    region: '#fb923c', address: '#64748b', institution: '#22d3ee',
    high: '#ef4444', medium: '#f59e0b', low: '#10b981',
  };

  // Build nodes from all entity categories
  const nodeMap = {};
  const addNode = (id, label, type, group) => {
    if (!nodeMap[id]) {
      const color = TYPE_COLORS[type] || '#94a3b8';
      nodeMap[id] = { id, label, group, type, color };
    }
  };

  (entities.people || []).forEach(p => addNode(p.urdu, p.urdu + '\n' + p.english, p.type, 'people'));
  (entities.places || []).forEach(p => addNode(p.urdu, p.urdu + '\n' + p.english, p.type, 'places'));
  (entities.themes || []).forEach(t => addNode(t.urdu, t.urdu + '\n' + t.english, t.count_hint, 'themes'));

  const SHAPE_MAP = { people: 'dot', places: 'diamond', themes: 'triangle' };
  const SIZE_MAP = { people: 20, places: 15, themes: 18 };

  const entTextCol = getThemeColor('--text-body');
  const entEdgeCol = isLight() ? '#c4c4c4' : '#475569';
  const entEdgeLabelCol = isLight() ? '#495057' : '#94a3b8';

  const nodes = new vis.DataSet(Object.values(nodeMap).map(n => ({
    id: n.id,
    label: n.label,
    shape: SHAPE_MAP[n.group] || 'dot',
    size: SIZE_MAP[n.group] || 15,
    font: { face: 'Noto Nastaliq Urdu', size: 12, color: entTextCol, multi: 'md' },
    color: { background: n.color + '44', border: n.color, highlight: { background: n.color + '88', border: n.color } },
  })));

  const edges = new vis.DataSet(entities.relationships.map((r, i) => ({
    id: i,
    from: r.from,
    to: r.to,
    label: r.label || r.type.replace(/_/g, ' '),
    font: { size: 10, color: entEdgeLabelCol, strokeWidth: 0, face: 'Outfit, sans-serif' },
    arrows: { to: { enabled: true, scaleFactor: 0.5 } },
    color: { color: entEdgeCol, highlight: '#6366f1' },
    smooth: { type: 'curvedCW', roundness: 0.15 },
  })));

  if (state.currentGraph) state.currentGraph.destroy();
  state.currentGraph = new vis.Network(container, { nodes, edges }, {
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -50, springLength: 180 },
      stabilization: { iterations: 200 },
    },
    interaction: { hover: true, tooltipDelay: 100 },
  });
}

/**
 * Render the vis-network word co-occurrence graph.
 * @param {HTMLElement} container
 * @param {any} data - per-book data object containing data.graph
 */
export function renderCooccurrenceGraph(container, data) {
  const maxFreq = Math.max(...data.graph.nodes.map(n => n.frequency));

  const textCol = getThemeColor('--text-body');
  const edgeCol = isLight() ? '#c4c4c4' : '#475569';
  const edgeLabelCol = isLight() ? '#6c757d' : '#64748b';

  const nodes = new vis.DataSet(data.graph.nodes.map(n => ({
    id: n.id,
    label: n.label,
    value: n.frequency,
    font: { face: 'Noto Nastaliq Urdu', size: 14 + (n.frequency / maxFreq) * 18, color: textCol },
    color: { background: '#6366f144', border: '#6366f1', highlight: { background: '#6366f188', border: '#818cf8' } },
  })));

  const edges = new vis.DataSet(data.graph.edges.map((e, i) => ({
    id: i,
    from: e.from,
    to: e.to,
    value: e.weight,
    label: String(e.weight),
    font: { size: 9, color: edgeLabelCol, strokeWidth: 0 },
    color: { color: edgeCol, highlight: '#6366f1' },
  })));

  if (state.currentCoGraph) state.currentCoGraph.destroy();
  state.currentCoGraph = new vis.Network(container, { nodes, edges }, {
    physics: {
      solver: 'forceAtlas2Based',
      forceAtlas2Based: { gravitationalConstant: -40, springLength: 120 },
      stabilization: { iterations: 150 },
    },
    nodes: { shape: 'dot', scaling: { min: 10, max: 40 } },
    edges: { scaling: { min: 1, max: 6 }, smooth: { type: 'continuous' } },
    interaction: { hover: true, tooltipDelay: 100 },
  });
}

// ─── Deep Analysis Cards ───

/**
 * Render the deep analysis cards (themes, people, key passages) for a book.
 * @param {string} slug
 * @param {any} data - per-book data object
 * @returns {Promise<void>}
 */
export async function renderDeepAnalysis(slug, data) {
  const entities = await loadEntities(slug);
  const themeColors = ['#6B6BDE', '#B8B5F5', '#F2B630', '#1a1a1a', '#D4D2FA', '#ec4899'];

  // Themes
  const themes = entities?.themes || [];
  document.getElementById('theme-count-pill').textContent = `${themes.length} themes`;
  const themesEl = document.getElementById('deep-themes');
  if (themes.length) {
    const countMap = { high: 90, medium: 55, low: 25 };
    themesEl.innerHTML = themes.slice(0, 8).map((t, i) => {
      const pct = countMap[t.count_hint] || 40;
      return `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:12px;font-weight:500;width:100px;flex-shrink:0;color:var(--text-primary)" class="urdu">${t.urdu}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${themeColors[i % themeColors.length]}"></div></div>
          <span style="font-size:11px;color:var(--text-faint);width:28px;text-align:right;flex-shrink:0">${pct}%</span>
        </div>`;
    }).join('');
  } else {
    themesEl.innerHTML = '<div style="color:var(--text-faint);font-size:12px">No entity data available</div>';
  }

  // People / Characters
  const people = entities?.people || [];
  document.getElementById('people-count-pill').textContent = `${people.length} entities`;
  const peopleEl = document.getElementById('deep-people');
  if (people.length) {
    peopleEl.innerHTML = '<ul style="list-style:none;padding:0;margin:0">' + people.slice(0, 8).map((p, i) => `
      <li class="theme-item">
        <span class="theme-dot" style="background:${themeColors[i % themeColors.length]}"></span>
        <span style="color:var(--text-primary)">${p.english}</span>
        <span class="urdu" style="font-size:13px;color:var(--text-muted)">${p.urdu}</span>
        <span class="theme-count">${p.type}</span>
      </li>
    `).join('') + '</ul>';
  } else {
    peopleEl.innerHTML = '<div style="color:var(--text-faint);font-size:12px">No entity data available</div>';
  }

}

// ─── Image Viewer Modal ───

// Module-private modal state
let modalPages = [];
let modalIndex = 0;

/**
 * Open the page image modal for a given page number.
 * @param {number} pageNum
 * @param {string} imagePath
 */
export function openModal(pageNum, imagePath) {
  if (!imagePath) return;
  const data = state.booksData[state.currentBook];
  modalPages = data.search_pages.filter(p => p.image_path);
  modalIndex = modalPages.findIndex(p => p.page_num === pageNum);
  if (modalIndex === -1) modalIndex = 0;

  showModalPage();
  const modal = document.getElementById('page-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/** Close the page image modal. */
function closeModal() {
  const modal = document.getElementById('page-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/** @param {number} dir - +1 or -1 */
function navigateModal(dir) {
  modalIndex = Math.max(0, Math.min(modalPages.length - 1, modalIndex + dir));
  showModalPage();
}

/** Update the modal image and title to the current modalIndex. */
function showModalPage() {
  const page = modalPages[modalIndex];
  if (!page) return;
  document.getElementById('modal-image').src = resolveImage(page.image_path);
  document.getElementById('modal-title').textContent = `Page ${page.page_num} (${modalIndex + 1} of ${modalPages.length})`;
  document.getElementById('modal-prev').disabled = modalIndex === 0;
  document.getElementById('modal-next').disabled = modalIndex === modalPages.length - 1;
}

/**
 * Wire up modal navigation and close event listeners.
 * Called once during init from main.js.
 */
export function initModalListeners() {
  const modal = document.getElementById('page-modal');

  document.getElementById('modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.addEventListener('keydown', (e) => {
    if (modal.classList.contains('hidden')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigateModal(-1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigateModal(1);
  });

  document.getElementById('modal-prev').addEventListener('click', () => navigateModal(-1));
  document.getElementById('modal-next').addEventListener('click', () => navigateModal(1));
}
