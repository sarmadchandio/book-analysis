# Book Analysis Dashboard

Interactive dashboard for exploring OCR'd Urdu/Persian poetry collections — topic models, entity maps, and full-text search across the corpus.

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

When the upstream analysis pipeline drops fresh JSON into `dashboard/public/data/` (and fresh page images into `books/<slug>/images/`), the publish flow is:

```bash
# 1. Upload page images for any new or updated books.
#    Idempotent — skips images already uploaded, creates a release per new book.
bash upload_images.sh

# 2. Commit the new JSON data and push. Pages auto-rebuilds on push to master.
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
