# Book Analysis Dashboard

Interactive dashboard for exploring OCR'd Urdu/Persian poetry collections — topic models, entity maps, and full-text search across the corpus.

**Live:** https://sarmadchandio.com/book-analysis/

## Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

## Structure

```
dashboard/
  index.html
  src/               # state.js, data.js, rendering.js, main.js, style.css
  public/data/       # analysis JSON per book (topics, entities, search)
.github/workflows/   # Pages deploy on push to master
```

The upstream OCR + analysis pipeline that produces `public/data/*.json` is maintained in a separate working tree and not part of this repository.

## Notes

Page-scan image previews are disabled on the hosted build — only text-level features are available online.
