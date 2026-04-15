# Testing Patterns

**Analysis Date:** 2026-04-14

## Current Testing State

**Status:** No automated test suite exists.

- No test files found in codebase (zero `.test.js`, `.spec.js`, `*_test.py` files)
- No test framework configuration detected (no `jest.config.js`, `pytest.ini`, `vitest.config.js`)
- No test command in package scripts (no `package.json`)
- Testing approach: Manual verification only

## Manual Verification Approach

### Python Scripts

Scripts are designed to be run directly from command line with visible output. Verification is done by:

1. **Pipeline Output Inspection (`scripts/pipeline.py`, `scripts/extract_images.py`, `scripts/ocr_google_drive.py`):**
   - Printed progress messages guide user through execution
   - Example from `extract_images.py` lines 40-41:
     ```python
     print(f"  Extracted: {filename}")
     print(f"\n{len(image_files)} images extracted")
     ```
   - Example from `ocr_google_drive.py` lines 134-137:
     ```python
     print(f"[{i}/{len(files)}] {f.name}...")
     text = ocr_file(service, f)
     out.write_text(text, encoding="utf-8")
     print(f"  -> {out.name} ({len(text)} chars)")
     ```

2. **File System Inspection:**
   - Verification happens after script execution by checking output files
   - `extract_images.py` creates files in `books/<slug>/images/`
   - `ocr_google_drive.py` creates text files in `books/<slug>/output/`
   - `analyze.py` creates JSON data files in `dashboard/data/`
   - User manually inspects:
     - Number of files created
     - File sizes and content
     - JSON structure validity (can load in text editor)

3. **Data Integrity Checks:**
   - `analyze.py` embeds validation via type hints and early returns
   - Line 70: `if not output_dir.is_dir(): return []` — graceful handling of missing data
   - Line 101: `if w and w not in URDU_STOP_WORDS and len(w) > 1:` — filters invalid tokens during tokenization
   - Statistics output (lines 119-129) automatically validate counts match file processing

4. **Skip Logic for Idempotency:**
   - `extract_images.py` line 93-96: Checks if images already exist before extraction
   - `ocr_google_drive.py` lines 131-132: Skips already-processed OCR output files
   - This prevents re-processing and allows user to run scripts multiple times safely

### JavaScript Dashboard

Manual verification approach:

1. **Browser Developer Tools:**
   - Open `dashboard/index.html` in browser
   - Check JavaScript console for errors
   - Inspect network tab to verify JSON files load correctly
   - No automated console error reporting

2. **Visual Inspection:**
   - Navigate through Library view → verify book cards render
   - Click on book → verify stats display correctly
   - Switch tabs (Words, Topics, Relationships, Search) → verify charts render
   - Check theme toggle → verify dark/light mode applies
   - Search functionality → manually type and verify results highlight

3. **Data Loading Validation:**
   - `app.js` line 55-60: `loadAllData()` loads all JSON files
   - Line 50-52: `loadJSON()` has implicit error handling via Promise (unhandled rejects logged to console)
   - No explicit validation that JSON structure matches expected schema

4. **Chart Rendering:**
   - Chart.js integration line 45-47 configures defaults globally
   - Chart creation in functions like `urduBarChart()` (lines 68-87) — if canvas not found, will throw error in console
   - No try-catch around chart creation; errors stop execution silently

5. **Theme System Validation:**
   - `initTheme()` lines 1085-1121: Manually test dark/light toggle
   - `applyTheme()` lines 1095-1121: Verifies CSS variables apply correctly
   - No programmatic theme validation

## Testing Gaps & Manual Workarounds

| Component | What's Not Tested | Manual Verification | Risk |
|-----------|------------------|---------------------|------|
| Python text cleaning | Urdu regex patterns in `CLEAN_RE` | Inspect JSON output for garbled text | High: Unicode handling errors go unnoticed |
| Tokenization | Stop word filtering, punctuation stripping | Count tokens in output vs expected | Medium: Incorrect token counts affect analysis |
| TF-IDF calculation | scikit-learn vectorizer output | Check TF-IDF table values seem reasonable | Medium: Bad weights silently produce charts |
| OCR pipeline retry logic | Exponential backoff in `ocr_file()` lines 82-108 | Manual test with network failure | Medium: Retry logic untested |
| JSON data schema | Structure of `dashboard/data/*.json` | Load in browser, observe rendering | High: Mismatched schema breaks visualizations |
| Chart rendering | Chart.js initialization, D3-like layouts | Visual inspection in browser | High: Charts can fail silently or render incorrectly |
| Search filtering | Text matching in English + Urdu | Manual search tests with various queries | Medium: Edge cases (RTL, diacritics) may break |
| Graph physics | vis-network physics simulation | Visual inspection of node layout | Low: Layout is aesthetic, not functional |
| Theme switching | CSS variable application | Click toggle, inspect styles | Low: Obvious if broken |

## How to Manually Test

### Python Scripts

1. **Test Extract Images:**
   ```bash
   python scripts/pipeline.py --new test-book path/to/sample.pdf
   python scripts/pipeline.py test-book --extract
   # Inspect: books/test-book/images/ should contain .jpg files
   ```

2. **Test OCR:**
   ```bash
   python scripts/pipeline.py test-book --ocr
   # Inspect: books/test-book/output/ should contain .txt files with extracted text
   ```

3. **Test Analysis:**
   ```bash
   python scripts/analyze.py test-book
   # Inspect: dashboard/data/test-book.json should contain stats, word_freq, bigrams, etc.
   ```

4. **Test Topic Modeling:**
   ```bash
   python scripts/topic_model.py test-book
   # Inspect: dashboard/data/topics-test-book.json should contain points with x, y, cluster
   ```

### JavaScript Dashboard

1. **Start Local Server:**
   ```bash
   cd dashboard
   python -m http.server 8000
   # Visit http://localhost:8000
   ```

2. **Test Library View:**
   - Verify all books from `data/index.json` render as cards
   - Test filters: author, category, tags, text search
   - Check aggregate stats at top: total books, pages, words, tokens

3. **Test Book Detail:**
   - Click book card → navigate to book view
   - Verify stats cards show: Pages, Words, Unique, Avg/Page, Richness
   - Verify breadcrumb appears at top

4. **Test Words Tab:**
   - Word cloud renders without errors
   - Top bigrams chart displays
   - Word frequency table shows top 100 words with counts
   - TF-IDF table shows important words per page

5. **Test Topics Tab:**
   - Topic map scatter plot renders (if `topics-<slug>.json` exists)
   - Each dot is clickable
   - Topic distribution bar chart shows cluster counts

6. **Test Relationships Tab:**
   - Entity relationship graph renders if `entities-<slug>.json` exists
   - Word co-occurrence graph renders with nodes/edges
   - Graphs respond to hover/click interactions

7. **Test Search:**
   - Type English word → highlights matching results
   - Type Urdu word → highlights matching results
   - Results show page number and context snippet

8. **Test Theme:**
   - Click sun/moon icon in top right
   - Verify background and text colors change
   - Verify all CSS variables apply (borders, accents, etc.)

## Coverage Gaps

**High Priority (Core Logic):**
- ❌ Urdu text normalization (`clean_text()`, `tokenize()` in `analyze.py`)
- ❌ Stop word filtering accuracy
- ❌ JSON schema validation (Python output, JavaScript input)
- ❌ Chart rendering correctness (Bar, Line, Scatter charts)

**Medium Priority (Integration):**
- ❌ Google Drive API auth flow (OAuth token refresh)
- ❌ Exponential retry logic for failed uploads
- ❌ Search across multiple books (English + Urdu matching)

**Low Priority (UI/UX):**
- ❌ Responsive layout (CSS grid breakpoints)
- ❌ Theme toggle persistence (localStorage)
- ❌ Modal image viewer interactions

## Why No Automated Tests

1. **Manual verification sufficient for small codebase:** 5 Python scripts + 1 JS file + data processing
2. **Data-dependent testing:** Requires external resources:
   - Google Drive API credentials (can't mock in CI without secrets)
   - Sample book files (EPUBs, PDFs) are large
3. **Visual components:** Charts and graphs require manual visual inspection
4. **Rapid iteration:** Project prioritizes exploratory data analysis over test coverage
5. **No CI/CD pipeline:** No GitHub Actions, etc. that would enforce test runs

## Adding Tests (Recommendation)

If tests are needed in future:

**Python:**
- Use pytest for unit tests
- Mock `pathlib.Path` for file operations
- Mock Google Drive API calls using `unittest.mock`
- Test functions: `clean_text()`, `tokenize()`, `analyze_book()` in isolation

**JavaScript:**
- Use Jest or Vitest for unit tests
- Mock Chart.js and vis-network libraries
- Test functions: `loadJSON()`, `applyFilters()`, `renderWords()` with sample data
- E2E tests with Playwright or Cypress for browser interactions

---

*Testing analysis: 2026-04-14*
