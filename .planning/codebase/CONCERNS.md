# Codebase Concerns

**Analysis Date:** 2026-04-14

## Tech Debt

**Monolithic Frontend (app.js):**
- Issue: Single 1140-line JavaScript file contains all dashboard logic—UI rendering, data loading, charting, searching, filtering, entity graph visualization, topic modeling, and theme management
- Files: `dashboard/app.js`
- Impact: Difficult to maintain, test, or reuse components; tight coupling between features; slow IDE performance; hard to reason about data flow; refactoring one feature risks breaking others
- Fix approach: Break into modules (data-loading.js, rendering.js, charts.js, graphs.js, search.js) and use ES6 imports or a bundler (webpack/esbuild); consider migrating to a framework (Vue/React) for component isolation

**Hardcoded Book Slugs and Metadata:**
- Issue: Book display names, categories, authors, and tags are scattered across code—`BOOK_DISPLAY_NAMES` in `app.js` line 13-16, metadata loaded from `dashboard/data/metadata.json`, and sidebar/topnav dynamically generated from metadata
- Files: `dashboard/app.js` (BOOK_DISPLAY_NAMES const), `dashboard/data/metadata.json`, `dashboard/data/index.json`
- Impact: Adding or removing books requires code changes; inconsistent source of truth for book data; display names duplicated in both hardcoded map and metadata file
- Fix approach: Consolidate all book metadata into a single source (e.g., `books_config.json`); load display names, categories, and authors from JSON at startup; generate topnav tabs dynamically from this config

**Inline Styles Mixed with Tailwind Classes:**
- Issue: After theme refactor from sidebar to top-nav, the codebase mixes inline `style="..."` attributes with Tailwind classes (`class="w-2.5 h-2.5 rounded-full"`)—CSS variables for theming (--accent, --text-primary, etc.) mixed with hardcoded hex colors (#6B6BDE, #F2B630) in both CSS and JS template literals
- Files: `dashboard/index.html` (inline styles in HTML), `dashboard/app.js` (template literals with hardcoded colors in lines 198, 214-217, 331, 359-362, 376, 398)
- Impact: Theme changes require updating colors in multiple places; dark mode inconsistency if a hardcoded color is missed; difficult to maintain color consistency; Tailwind classes won't respect CSS variable changes
- Fix approach: Extract all hardcoded colors to CSS variables; move inline styles to CSS classes; use CSS variables in JavaScript templates instead of hex values; establish a color token system (accent, primary, warning, etc.)

**Tailwind CDN (Not Production-Ready):**
- Issue: `dashboard/index.html` line 7 loads Tailwind from CDN (`https://cdn.tailwindcss.com`), which is JIT-compiled at runtime
- Files: `dashboard/index.html`
- Impact: Slower page load; larger CSS payload (entire Tailwind included); cannot be tree-shaken; no offline capability; relies on external CDN availability; no build-time optimizations
- Fix approach: Install Tailwind CSS locally (`npm install -D tailwindcss`), configure with `tailwind.config.js`, set up PostCSS build pipeline, use purge/content for tree-shaking, bundle CSS at build time

**Entity Extraction Not Reproducible:**
- Issue: Entity data (themes, people, places, relationships) in `dashboard/data/entities-*.json` files were extracted via LLM in-conversation—no script or pipeline captures this process; data is hardcoded JSON with no way to regenerate or verify accuracy
- Files: `dashboard/data/entities-ankhain.json`, `dashboard/data/entities-deewan-e-ghalib.json`, `dashboard/data/entities-murda-ankhain.json`
- Impact: Cannot add new books without manual LLM extraction; no versioning or audit trail for entity definitions; quality degradation if source text changes; relationships and theme mappings unmaintainable
- Fix approach: Create `scripts/extract_entities.py` that uses a consistent LLM (OpenAI API, Ollama, HuggingFace model) to extract entities; accept translation JSON as input for English-Urdu pairs; save results with metadata (model version, temperature, prompt); make entity extraction part of the pipeline

## Security Considerations

**Google OAuth Token Storage:**
- Risk: `config/token.json` stores encrypted Google OAuth refresh token; stored locally in plain text after generation (can be accessed by any process on the machine)
- Files: `scripts/ocr_google_drive.py` (lines 54-67), `config/token.json` (generated at runtime)
- Current mitigation: Token is user-specific and file permissions may restrict access
- Recommendations: 
  - Document that `config/token.json` must be `.gitignored` and never committed (critical security risk)
  - Add to `.gitignore` explicitly with comment explaining why
  - Use environment variable for credentials path instead of hardcoded `config/credentials.json`
  - Document OAuth scopes limitation (currently requests full Drive access)
  - Consider using service account keys with restricted permissions instead of user OAuth for production
  - Encrypt token.json at rest or use OS credential store (Keychain, credential-manager)

**Credentials File in Config Directory:**
- Risk: `config/credentials.json` (Google Cloud service account JSON) is mentioned in README and expected to be present; if accidentally committed, exposes API keys
- Files: `scripts/ocr_google_drive.py` (line 25, 60, 64), `README.md` (line 13)
- Current mitigation: Presumably gitignored, but not verified in codebase
- Recommendations:
  - Verify `.gitignore` explicitly blocks `config/credentials.json` and `config/token.json`
  - Document setup requirement clearly: "Never commit `config/credentials.json` to git"
  - Add `config/.gitkeep` with a template `credentials.json.example` showing expected structure
  - Consider supporting GOOGLE_APPLICATION_CREDENTIALS env var as alternative

**No HTTPS/CSP for Dashboard:**
- Risk: Dashboard served over HTTP (development assumption); no Content-Security-Policy headers; externally loaded scripts (Chart.js, vis-network) via CDN
- Files: `dashboard/index.html` (lines 7-9)
- Current mitigation: None (development only)
- Recommendations:
  - Document that production deployment must use HTTPS
  - Add CSP headers to restrict inline styles and script sources
  - Self-host external libraries (Chart.js, vis-network) or use npm instead of CDN

## Performance Bottlenecks

**Large Data Load at Initialization:**
- Problem: `init()` function loads all books' data + entities + topics + translations into memory on page load
- Files: `dashboard/app.js` (lines 1123+)
- Cause: `loadAllData()` fetches every `data/*.json` file at startup; no lazy loading or pagination
- Current impact: Page becomes interactive only after all data is loaded; memory footprint increases with each new book
- Improvement path: 
  - Lazy-load book data only when book is opened
  - Load entities and topics on-demand when tabs are clicked
  - Implement pagination for word frequency tables (currently showing all 100 words)
  - Consider IndexedDB for client-side caching

**Duplicate Data Structures:**
- Problem: Same book statistics (total_words, lexical_richness, etc.) stored in multiple places:
  - `dashboard/data/index.json` (aggregated)
  - `dashboard/data/ankhain.json`, etc. (individual book files)
  - `bookMeta` loaded from `metadata.json` (author, category, tags)
- Files: `dashboard/data/index.json`, `dashboard/data/{slug}.json`, `dashboard/data/metadata.json`
- Impact: Risk of data inconsistency; harder to update book info; increased JSON payload
- Improvement path: Consolidate into single `books_config.json` with all metadata + stats; load once at startup

**Chart.js Global State:**
- Problem: Charts stored in global `charts` object; `destroyChart()` called before recreating but no cleanup of old canvas contexts
- Files: `dashboard/app.js` (lines 7, 64-66, 68-85)
- Impact: Memory leaks if switching tabs rapidly; multiple chart instances may accumulate
- Improvement path: Implement proper cleanup; consider using a charting library with built-in lifecycle management (e.g., Chart.js 4 with automatic cleanup)

## Fragile Areas

**Theme Refactoring Incomplete:**
- Files: `dashboard/index.html`, `dashboard/app.js`
- Why fragile: Recent refactor from sidebar to top-nav layout introduced both Tailwind and inline styles; CSS variable system defined but hardcoded hex colors used in JavaScript templates (lines 198, 214-217, 331, 359-362, 376, 398-399 in app.js); theme toggle switch works (dark mode CSS variables applied) but JS-rendered HTML ignores theme variables
- Safe modification: Before changing theme colors, audit all instances of hardcoded #hex values in `app.js` and replace with CSS variable references; test dark mode after any color changes
- Test coverage: No tests; verify manually by switching theme and checking all UI elements (card headers, badges, covers, charts)

**OCR Accuracy Quality (44% in EPUB):**
- Files: `scripts/ocr_google_drive.py`, `books/*/output/`
- Why fragile: OCR via Google Drive API has documented 44% accuracy for scanned EPUB books (noted in context); no validation or confidence scoring; errors propagate through word frequency, TF-IDF, and entity detection
- Safe modification: Before analyzing a new book, spot-check OCR output files (`books/{slug}/output/*.txt`) for quality; if accuracy is poor, consider preprocessing images (binarization, rotation correction, upsampling) before upload
- Test coverage: No automated quality checks; recommend adding a `verify_ocr_quality.py` script that compares OCR output character-by-character against ground truth samples or flags suspicious patterns (very short pages, missing Urdu characters)

**Entity Graph Rendering (vis-network):**
- Files: `dashboard/app.js` (lines 579-640, renderEntityGraph function)
- Why fragile: Directly mutates DOM and vis-network graph state; no error handling if entity data is malformed; graph can become unresponsive with many nodes (50+ entities will slow rendering)
- Safe modification: Add input validation for entity data structure; test with entities-*.json files from all books; check for circular relationships or missing node definitions before rendering
- Test coverage: None; test manually with each book to ensure graph renders without freezing

**Search Across Books (Global Search):**
- Files: `dashboard/app.js` (lines 1000-1080, global search handler)
- Why fragile: Linear search through all book pages for every search query; regex-based matching without proper Urdu normalization (diacritics); no result pagination or debouncing on input
- Safe modification: Before optimizing, verify current performance with large books (141 pages); add debounce to search input; consider pre-indexing pages at load time
- Test coverage: None; test with searches that have many results (>100) to ensure UI doesn't freeze

## Reproducibility Gaps

**Entity Extraction Pipeline:**
- What's not reproducible: Theme intensity (entity count hints), people/place relationships, character/reference categorization stored in `entities-*.json`
- Files: `dashboard/data/entities-*.json`
- Risk: Cannot regenerate entity data if source text changes or new books are added; no way to verify entity quality; translations are hardcoded
- How to fix: Implement `scripts/extract_entities.py` with:
  - Consistent LLM provider (OpenAI API, HuggingFace) and model version
  - Configurable prompt and temperature (save in config file)
  - Urdu-English translation handling (use translation map or dual-language prompt)
  - Output format with metadata (extraction_date, model, prompt_version, confidence_scores)
  - Idempotent: only re-extract if source text has changed

**OCR Parameter Tuning:**
- What's not reproducible: Google Drive API OCR uses undocumented parameters; no way to adjust quality (contrast, language hints, preprocessing)
- Files: `scripts/ocr_google_drive.py` (line 71-108, ocr_file function)
- Risk: Inconsistent OCR quality across books; 44% accuracy may be preventable with preprocessing
- How to fix: 
  - Document Google Drive OCR capabilities and limitations
  - Add preprocessing step (`scripts/preprocess_images.py`) with options: binarization, rotation detection, denoising, contrast adjustment
  - Add optional validation: compare OCR output sample against human transcription to measure accuracy before processing entire book
  - Log OCR parameters and book metadata for future reference

**Dashboard Build Process:**
- What's not reproducible: No build script; Tailwind compiled at runtime from CDN; no minification or bundling
- Files: `dashboard/` (no package.json or build config)
- Risk: Cannot reproduce production-ready dashboard; performance degrades with larger data files
- How to fix:
  - Add `package.json` with build tools (webpack/esbuild for bundling, Tailwind CSS for compilation)
  - Create `build.sh` that compiles CSS, bundles JS, minifies HTML
  - Document build vs. dev workflow: "npm run dev" for local work, "npm run build" for production
  - Add source maps for debugging

## Missing Critical Features

**Test Suite:**
- Problem: No tests exist (no test files found; no Jest/Vitest config)
- Blocks: Cannot safely refactor app.js; no regression detection when fixing bugs; entity extraction quality unknown; OCR pipeline untested
- Recommendation: Start with integration tests for core flows (load book data, render library, search, filter); add unit tests for utility functions (tokenization in analyze.py, theme helpers in app.js); aim for 50%+ coverage of analyze.py (data processing logic is critical)

**Book Addition Workflow:**
- Problem: No UI for adding books; requires manual steps:
  1. Place file in `books/{slug}/source/`
  2. Run `python scripts/pipeline.py --new {slug} path/to/file.epub`
  3. Run `python scripts/ocr_google_drive.py {slug}` (requires Google auth)
  4. Run `python scripts/analyze.py {slug}` (generates dashboard data)
  5. Manually extract entities via LLM and add to `dashboard/data/entities-{slug}.json`
  6. Reload dashboard
- Blocks: Cannot easily add books for end users; error-prone process; no feedback during pipeline execution
- Recommendation: Create `scripts/add_book.py` that orchestrates all steps with error handling; add progress output; or build web UI for book upload

**Internationalization (i18n):**
- Problem: App is hardcoded for Urdu-English; translations are in JSON (`translations.json`) but no framework for managing them
- Blocks: Cannot support other languages; UI labels are hardcoded (e.g., "Library", "Words", "Topics")
- Recommendation: Implement i18n library (e.g., i18next); move all UI strings to translation files; make language selectable in header

## Test Coverage Gaps

**analyze.py (OCR-to-Dashboard Pipeline):**
- What's not tested: Text tokenization (URDU_STOP_WORDS, punctuation stripping), word frequency calculation, TF-IDF scoring, graph construction (word co-occurrence edges)
- Files: `scripts/analyze.py` (core logic spans lines 84-227)
- Risk: Bugs in tokenization go undetected; stop word list may be incomplete; TF-IDF scores may be incorrect; co-occurrence graph may miss important relationships
- Priority: High—data quality depends on this; implement unit tests for:
  - `clean_text()`: test punctuation/diacritic removal
  - `tokenize()`: test stop word filtering and edge cases (short words, empty strings)
  - `calculate_tfidf()`: verify scores are normalized and sorted correctly

**app.js Search & Filter Functions:**
- What's not tested: Global search regex matching, book filtering by author/category/tags, search result rendering
- Files: `dashboard/app.js` (search handler ~lines 1000-1080, filter logic ~lines 167-185)
- Risk: Search may fail on special characters or Urdu text; filter combinations may not work as expected; results may render incorrectly or cause crashes
- Priority: High—user-facing; implement integration tests with sample book data:
  - Search for multi-word Urdu phrases
  - Filter by multiple criteria (author + category + tag)
  - Verify result counts are accurate

**Entity Graph Rendering:**
- What's not tested: vis-network graph construction, node/edge layout, interactivity (dragging, zooming)
- Files: `dashboard/app.js` (renderEntityGraph ~lines 579-640)
- Risk: Graph may not display correctly with many nodes; click handlers may fail; performance may degrade with complex relationships
- Priority: Medium—optional feature; implement smoke tests to verify:
  - Graph renders without errors
  - Node count matches entity data
  - Relationships are bidirectional

**Theme Toggle:**
- What's not tested: Dark mode CSS variable application, chart color updates, inline style theme awareness
- Files: `dashboard/index.html`, `dashboard/app.js` (theme toggle handler)
- Risk: Dark mode may be incomplete (hardcoded colors not updated); charts may have low contrast
- Priority: Medium—user experience; implement visual regression tests or manual checklist for each theme change

---

*Concerns audit: 2026-04-14*
