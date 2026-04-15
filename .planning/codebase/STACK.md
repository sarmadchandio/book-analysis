# Technology Stack

**Analysis Date:** 2026-04-14

## Languages

**Primary:**
- Python 3.12 - OCR pipeline, data analysis, and text processing scripts
- JavaScript (Vanilla) - Dashboard frontend
- HTML/CSS - Web interface

**Secondary:**
- Bash - Setup and execution scripts

## Runtime

**Environment:**
- Python 3.12 (Windows-based venv at `venv/`)

**Package Manager:**
- pip - Python package management
- Lockfile: `requirements.txt` (minimal, lists 4 core dependencies)

## Frameworks

**Core:**
- None - Lightweight, script-based architecture without traditional frameworks

**NLP/ML:**
- scikit-learn 1.5+ - TF-IDF vectorization for term importance analysis (`scripts/analyze.py`)
- sentence-transformers - Multilingual embeddings for page clustering (`scripts/topic_model.py`)
- UMAP - Dimensionality reduction to 2D coordinates for visualization (`scripts/topic_model.py`)
- HDBSCAN - Unsupervised clustering for topic discovery (`scripts/topic_model.py`)

**Document Processing:**
- PyMuPDF (fitz) - PDF extraction to images at 300 DPI (`scripts/extract_images.py`)
- zipfile (stdlib) - EPUB extraction (treated as ZIP archives)

**Google API:**
- google-api-python-client - Google Drive API v3 service client (`scripts/ocr_google_drive.py`)
- google-auth-oauthlib - OAuth 2.0 Desktop App flow for user authentication
- google-auth - Credential management and token refresh

**Frontend:**
- Chart.js 4 - Time-series and statistical visualizations (CDN: `cdn.jsdelivr.net`)
- vis-network 9 - Interactive word co-occurrence graph visualization (CDN)
- Tailwind CSS (CDN) - Utility-based styling
- Noto Nastaliq Urdu (Google Fonts) - Urdu script rendering

**Build/Dev:**
- None - No build tool; dashboard is vanilla HTML/JS

## Key Dependencies

**Critical (listed in `requirements.txt`):**
- google-auth [2.49.2] - OAuth2 credential handling and refresh
- google-auth-oauthlib [1.3.1] - Desktop app authentication flow
- google-api-python-client [2.194.0] - Google Drive API client
- PyMuPDF [fitz] - PDF to image conversion at high DPI

**Inferred (installed but not explicitly listed):**
- scikit-learn [1.5+] - Required by analyze.py for TF-IDF
- sentence-transformers - Required by topic_model.py for embeddings
- umap-learn - Required for UMAP dimensionality reduction
- hdbscan - Required for clustering algorithms
- numpy - Linear algebra for embeddings and TF-IDF matrices
- torch/pytorch - Dependency of sentence-transformers

## Configuration

**Environment:**
- OAuth credentials stored in `config/credentials.json` (Google Cloud Console Desktop app)
- Access token cached in `config/token.json` (generated on first run)
- No .env file - credentials are file-based

**Build:**
- No build configuration needed
- Dashboard is served as static HTML/JS
- Python scripts run directly via `python scripts/<script>.py`

## Platform Requirements

**Development:**
- Windows 10+ (bash via git-bash or WSL)
- Python 3.12+ installed
- pip package manager
- ~1-2 GB disk for venv + dependencies

**Production:**
- Execution: Command-line only (no server framework)
- Google Drive API access required (active internet)
- Local filesystem for book storage

## Directory Structure

**Key locations:**
- `scripts/` - Python OCR and analysis pipeline
- `dashboard/` - Static HTML/JS visualization (served as-is)
- `books/` - Book data directory (source files, extracted images, OCR output)
- `config/` - Google OAuth credentials
- `venv/` - Python virtual environment (Windows-based)

---

*Stack analysis: 2026-04-14*
