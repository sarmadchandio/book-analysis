# External Integrations

**Analysis Date:** 2026-04-14

## APIs & External Services

**Google Drive API:**
- Service: Google Drive API v3 for OCR via Google Docs conversion
- What it's used for: Image-to-text OCR by uploading images as Google Docs (auto-OCR), then exporting as plain text
- SDK/Client: `google-api-python-client` [2.194.0]
- Auth: OAuth 2.0 Desktop app credentials (`config/credentials.json`)
- Implementation: `scripts/ocr_google_drive.py`
  - Authenticates via `google-auth-oauthlib` InstalledAppFlow
  - Uploads images with MIME type mapping (JPG, PNG, TIFF, GIF, BMP)
  - Converts to Google Docs MIME type on server-side
  - Exports as plain text and deletes temp file
  - Supports retry logic with exponential backoff (3 attempts)

**Google Fonts:**
- Service: Google Fonts CDN for Noto Nastaliq Urdu typeface
- What it's used for: Urdu text rendering in dashboard
- URL: `https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&display=swap`
- Implementation: Loaded in `dashboard/index.html` <head>

## Data Storage

**Databases:**
- None - Uses local filesystem only

**File Storage:**
- Local filesystem (`books/<slug>/source|images|output/`)
  - `source/` - Original EPUB, PDF, or image files
  - `images/` - Extracted page images (JPG, PNG, TIFF)
  - `output/` - OCR text files (plain text, one per page)
- Dashboard data: JSON files in `dashboard/data/`
  - `index.json` - Book index with metadata
  - `{slug}.json` - Per-book analysis results
  - `topics-{slug}.json` - Topic modeling results

**Caching:**
- None - No server-side caching layer

## Authentication & Identity

**Auth Provider:**
- Google OAuth 2.0 (Desktop app type)
- Credentials: `config/credentials.json` (obtained from Google Cloud Console)
- Token storage: `config/token.json` (auto-generated on first run)
- Scope: `https://www.googleapis.com/auth/drive`
- Flow: InstalledAppFlow (browser popup for user consent, token cached locally)

## Monitoring & Observability

**Error Tracking:**
- None detected - Errors printed to stdout

**Logs:**
- Console output only (print statements)
- No persistent logging framework
- Pipeline status printed for each step:
  - Image extraction progress
  - OCR progress with file counts
  - Analysis completion notifications

## CI/CD & Deployment

**Hosting:**
- Local execution only (no cloud hosting)
- Dashboard served statically via local HTTP server or file:// protocol

**CI Pipeline:**
- None detected - Manual execution via command-line

## Environment Configuration

**Required env vars:**
- None - Uses file-based credentials

**Secrets location:**
- `config/credentials.json` - Google OAuth credentials (JSON)
- `config/token.json` - Cached access token (JSON, auto-managed)

**Note:** Both credential files are NOT checked into git (listed in .gitignore pattern)

## Webhooks & Callbacks

**Incoming:**
- None - Single-direction API calls only

**Outgoing:**
- None

## Document Format Support

**Input Formats:**
- EPUB - Extracted as ZIP archives, images extracted by filename pattern
- PDF - Converted to JPEG at 300 DPI via PyMuPDF
- Image folders - Direct copy of JPG, PNG, TIFF, GIF, BMP files

**Output Formats:**
- Plain text (UTF-8) - OCR output from Google Docs export
- JSON - Analysis and topic modeling results
- HTML/JS - Dashboard visualization (static)

## Data Flow

**OCR Pipeline:**
1. User provides EPUB, PDF, or image folder → `books/<slug>/source/`
2. `extract_images.py` converts to images → `books/<slug>/images/`
3. `ocr_google_drive.py` uploads to Google Drive, triggers OCR, downloads text → `books/<slug>/output/`

**Analysis Pipeline:**
1. `analyze.py` reads OCR output, computes statistics, word frequency, bigrams, TF-IDF, co-occurrence graph
2. Outputs per-book JSON to `dashboard/data/{slug}.json`
3. `topic_model.py` generates embeddings, UMAP visualization, HDBSCAN clustering
4. Outputs topics JSON to `dashboard/data/topics-{slug}.json`

**Dashboard:**
1. Loads `index.json` and per-book JSON files from `dashboard/data/`
2. Renders interactive visualizations: charts, word graphs, topic scatter plots
3. Supports text search with per-page snippets and image references

## Libraries & Tools Used

**Text Processing:**
- `collections.Counter` - Word frequency analysis
- `re` - Regex for text cleaning (Urdu diacritics, punctuation removal)
- Built-in string manipulation for tokenization and stop-word filtering

**ML/Analytics:**
- scikit-learn `TfidfVectorizer` - Within-page TF-IDF scores
- sentence-transformers - Multilingual embeddings for semantic similarity
- UMAP - 2D projection of high-dimensional embeddings
- HDBSCAN - Density-based clustering for topic discovery

**PDF Handling:**
- PyMuPDF (fitz) - Page-to-pixmap conversion at configurable DPI
- Built-in zipfile module - EPUB extraction

**Frontend Libraries:**
- Chart.js - Bar charts, line graphs, radar charts
- vis-network - Interactive node-link graph visualization
- Tailwind CSS - Responsive grid and utility styling

---

*Integration audit: 2026-04-14*
