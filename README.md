# Book Analysis Dashboard

Interactive dashboard for exploring OCR'd Urdu/Persian poetry collections alongside digital-English volumes — topic models, entity maps, and TF-IDF cosine search across the corpus.

**Live:** https://sarmadchandio.com/book-analysis/

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

In dev, page-scan images are served from the local `books/` folder (not committed).
In prod, they're fetched from per-book GitHub Releases (`images-<slug>` tag).

## Publishing new books

The pipeline routes each book to the right extractor automatically:

- **Scanned EPUB/PDF** → `extract_images.py` → `ocr_google_drive.py` (Urdu OCR)
- **Digital EPUB** (has real text) → `extract_epub_text.py` (no OCR)
- `extract_epub_text.py` splits pages on `<h1>–<h6>` headings and on class names matching `title|heading|chaptertitle|poemtitle|blurbstitle` — so chapbooks and multi-poem files are split poem-by-poem rather than char-chunked.

Then the analysis flow runs the same four steps regardless of source:

1. `analyze.py` — stats, word-freq, bigrams, graph, per-page TF-IDF index (auto language-detect: `ur` vs `en`)
2. `topic_model.py` — multilingual embeddings + UMAP + HDBSCAN
3. Claude entity extraction → `entities-<slug>.json`
4. Claude topic labeling → `cluster_labels` on `topics-<slug>.json`

Once data lands in `dashboard/public/data/`:

```bash
# Upload page images to GitHub Releases (skipped silently if the book has none).
# Idempotent — skips images already uploaded, creates a release per new book.
bash upload_images.sh

# Commit the new JSON data and push. Pages auto-rebuilds on push to master.
git add dashboard/public/data
git commit -m "data: add <slug>"
git push
```

`upload_images.sh` auto-discovers books from `dashboard/public/data/index.json` — no list to maintain. It needs `gh` authenticated with `repo` scope.

## Structure

```
dashboard/
  index.html
  src/               # state.js, data.js, rendering.js, main.js, style.css
  public/data/       # analysis JSON per book (topics, entities, search)
.github/workflows/   # Pages deploy on push to master
upload_images.sh     # publishes page images to per-book GitHub Releases
```

The upstream OCR + analysis pipeline that produces `public/data/*.json` is maintained in a separate working tree and not part of this repository.
