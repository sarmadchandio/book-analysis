# Coding Conventions

**Analysis Date:** 2026-04-14

## Naming Patterns

**Python Files:**
- Lowercase with underscores: `analyze.py`, `extract_images.py`, `topic_model.py`
- Pattern: `<action>_<subject>.py` (e.g., `extract_images`, `ocr_google_drive`)

**Python Functions:**
- Lowercase with underscores: `analyze_book()`, `load_book_text()`, `clean_text()`
- Helper/internal functions: `_private_func()` prefix (not observed, but docstrings and type hints used)
- Entry point: Always `main()` with `if __name__ == "__main__"` pattern

**Python Variables:**
- Lowercase with underscores: `all_words`, `word_freq`, `max_count`
- Constants: UPPERCASE: `URDU_STOP_WORDS`, `PROJECT_ROOT`, `BOOKS_DIR`, `IMAGE_EXTENSIONS`
- Data structures: Descriptive plural forms: `books_data`, `page_stats`, `graph_nodes`

**Python Types:**
- Use Python 3.10+ union syntax: `str | None`, `list[dict]`, `dict[str, Any]`
- Example from `analyze.py` line 54: `def find_image_for_stem(images_dir: Path, stem: str) -> str | None:`

**JavaScript Files:**
- Single file dashboard: `app.js` (14959 tokens)
- HTML markup: `index.html` (dashboard entry point)

**JavaScript Functions:**
- camelCase: `loadJSON()`, `loadAllData()`, `renderLibrary()`, `showView()`
- Async functions prefixed: `async function loadBookMeta()`, `async function openBook(slug)`
- Render functions: `render<Component>`: `renderLibrary()`, `renderWords()`, `renderTfidf()`, `renderEntityGraph()`
- Handler functions: `<action><Target>`: `goLibrary()`, `showView()`, `switchBookTab()`, `openBook()`
- Init functions: `init<Feature>()`: `initFilters()`, `initModal()`, `initSearch()`, `initTheme()`
- Helper functions: `<verb><Noun>`: `getThemeColor()`, `isDark()`, `isLight()`, `destroyChart()`

**JavaScript Variables:**
- camelCase for local variables: `booksIndex`, `booksData`, `currentGraph`, `currentBook`
- Constants (UPPERCASE): `COLORS`, `COVER_COLORS`, `URDU_FONT`, `BOOK_DISPLAY_NAMES`, `BOOKS_BASE`
- State containers: `let <stateVar> = null;` pattern (e.g., `let booksIndex = null;`)
- Caches: `let entityData = {}; let charts = {};`

**CSS Classes and IDs:**
- kebab-case: `book-tab`, `card-hover`, `tab-bar`, `search-input`, `filter-input`
- Semantic section IDs: `view-library`, `view-book`, `book-tab-words`, `graph-container`
- Data attributes: `data-slug`, `data-nav`, `data-tab`, `data-tip`, `data-nav-tab`, `data-theme`

## Code Style

**Formatting:**
- No explicit formatter detected (no `.prettierrc` or `eslintrc`)
- Python: 4-space indentation (standard PEP 8)
- JavaScript: 2-space indentation for nested structures
- Line length: Generally under 100 characters; Python docstrings wrapped

**Linting:**
- Not detected — no `.eslintrc` or `.flake8` found
- No pre-commit hooks observed

**Comments:**
- Python: Module-level docstrings in triple quotes (e.g., `"""Text analysis pipeline..."""`)
- Python: Function docstrings describing parameters, return values, and usage examples
- Python: Inline comments above code blocks explaining complex regex or logic
- JavaScript: Section markers with dashes: `// ─── State ───`, `// ─── Navigation ───`, `// ─── Filters ───`
- JavaScript: Minimal inline comments; code is self-documenting via clear function names

**Docstrings/JSDoc:**
- Python: Full docstrings with multiline formatting:
  ```python
  def load_book_text(book_dir: Path) -> list[dict]:
      """Load all OCR output files for a book.
      Returns list of {stem, page_num, text, image_path} sorted by page number."""
  ```
- JavaScript: No JSDoc comments observed (inline comments instead)

## Import Organization

**Python:**
- Standard library imports first: `sys`, `re`, `json`, `math`, `time`
- Third-party imports: `pathlib`, `collections`, `sklearn`, `sentence_transformers`, `google.oauth2`, etc.
- No relative imports; all scripts import from same parent directory
- Dynamic path insertion: `sys.path.insert(0, str(PROJECT_ROOT / "scripts"))`
- Example from `pipeline.py` lines 13-23:
  ```python
  import sys
  import shutil
  import argparse
  from pathlib import Path
  
  PROJECT_ROOT = Path(__file__).resolve().parent.parent
  BOOKS_DIR = PROJECT_ROOT / "books"
  
  sys.path.insert(0, str(PROJECT_ROOT / "scripts"))
  import extract_images
  ```

**JavaScript:**
- Single file: no imports (uses global scope)
- CDN libraries loaded in `index.html` via `<script>` tags
- Chart.js, vis-network, Tailwind CSS via CDN
- Noto Nastaliq Urdu font from Google Fonts

## Python Entry Points

All scripts follow the same pattern:

```python
def main():
    # Parse arguments and call run()
    slug = sys.argv[1] if len(sys.argv) > 1 else None
    run(slug)

if __name__ == "__main__":
    main()
```

Entry points in `scripts/`:
- `analyze.py`: Entry point via `main()` → `run(book_slug)` → `analyze_book()`
- `pipeline.py`: Entry point via `main()` using argparse → `run_pipeline()`, `new_book()`, `list_books()`
- `extract_images.py`: Entry point via `main()` → `run(book_dir)` → `extract_epub()`, `extract_pdf()`, or `copy_images()`
- `ocr_google_drive.py`: Entry point via `main()` → `run(book_dir)` → `ocr_file()`
- `topic_model.py`: Entry point via `main()` → `run(book_slug)` → embedding + UMAP + HDBSCAN

## Module Design

**Python Modules:**
- Each script is standalone but can be imported
- Shared constants at top: `PROJECT_ROOT`, `BOOKS_DIR`, `DASHBOARD_DATA`
- Helper functions defined before main logic
- Utility functions (type conversion, validation) defined early: `extract_page_number()`, `resolve_book_dir()`

**JavaScript Module:**
- Single monolithic file (`app.js`)
- Initialization functions at end: `loadBookMeta()`, `loadAllData()`, `init()`
- Global state variables declared at top (lines 1-7)
- Functions grouped by feature: State, Navigation, Filters, Views, Graphs, Search, Theme, Init
- No module pattern or closure pattern used; all functions in global scope

**Barrel Files:**
- Not applicable — no TypeScript/ESM modules

## Error Handling

**Python:**
- `sys.exit(1)` for fatal errors: Used in `resolve_book_dir()`, `ocr_file()`, `extract_pdf()` when dependencies missing
- Try-catch for API calls: `ocr_google_drive.py` lines 82-108 retry logic with exponential backoff
- Early returns: `load_book_text()` line 69 returns empty list if no output directory
- Validation before processing: Check if file exists, directory exists, extension is supported

**JavaScript:**
- Try-catch in data loading: `loadBookMeta()` line 22: `try { bookMeta = await loadJSON(...) } catch(e) { bookMeta = {}; }`
- Graceful fallback: Missing data renders placeholder UI: `"No entity data available"` (lines 366, 383)
- Null checks: Lines 282-286 check `hasAny` before rendering TF-IDF section
- Defensive defaults: `getMeta(slug)` line 25 returns default object if not found

## CSS Variables and Theming

**Theme System:**
- CSS custom properties (variables) defined in `:root` and `[data-theme="dark"]`
- Light theme (default): `--bg-body: #f8f8f8`, `--text-primary: #1a1a1a`, `--accent: #6B6BDE`
- Dark theme: `--bg-body: #111`, `--text-primary: #f0f0f0`, `--accent: #8888f0`
- Theme toggle via `data-theme` attribute on `<html>` element

**Color System:**
- Primary: `--accent` (purple #6B6BDE light, #8888f0 dark)
- Secondary: `--accent-yellow` (#F2B630 in both themes)
- Background layers: `--bg-body`, `--bg-surface`, `--bg-card`, `--bg-elevated`, `--bg-input`
- Text hierarchy: `--text-primary`, `--text-body`, `--text-muted`, `--text-faint`
- Borders: `--border`, `--border-light`, `--border-hover`
- Component-specific: `--graph-bg`, `--mark-bg`, `--tooltip-bg`, `--scrollbar`

**Theme Helper Functions:**
- `getThemeColor(varName)`: Returns computed CSS variable value via `getComputedStyle()`
- `isDark()`: Returns true if `data-theme="dark"` attribute set
- `isLight()`: Inverse of `isDark()`
- Usage: Graph rendering adjusts edge colors based on theme (lines 605-606, 643-644)

**CSS Organization:**
- Inline styles in HTML via `style="..."` attributes (not ideal for maintainability)
- Component classes with semantic names: `.card`, `.card-hover`, `.card-body`, `.pill`, `.bar-track`, `.theme-item`
- State classes: `.active`, `.active-tab`, `.hidden`
- Typography helpers: `.urdu` (RTL + Noto Nastaliq font), `.section-title`, `.section-sub`
- Layout: Tailwind CSS classes for grid, flexbox, spacing: `grid-cols-2`, `gap-4`, `mb-6`, `flex`, `flex-wrap`

**Tailwind CSS Integration:**
- Loaded from CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Mixed with custom CSS variables for theming
- Example: `class="grid md:grid-cols-2 lg:grid-cols-3 gap-4"` (responsive grid)

---

*Convention analysis: 2026-04-14*
