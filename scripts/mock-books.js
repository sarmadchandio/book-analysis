// Usage: node scripts/mock-books.js   (writes stress test files; manual cleanup required)
// Generates 47 synthetic book entries + a 50-entry stress index for virtual-scroll testing.
// Does NOT mutate the real index.json or metadata.json.

import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '../dashboard/public/data');

async function main() {
  // ── Read real data ──
  const index = JSON.parse(await readFile(`${DATA_DIR}/index.json`, 'utf8'));
  const metadata = JSON.parse(await readFile(`${DATA_DIR}/metadata.json`, 'utf8'));

  // Use the first real book as the template for cloning.
  const templateBook = index.books[0]; // 'ankhain'
  const templateSlug = templateBook.name;
  const templateData = JSON.parse(await readFile(`${DATA_DIR}/${templateSlug}.json`, 'utf8'));
  const templateMeta = metadata[templateSlug];

  // ── Generate 47 mock entries ──
  const MOCK_COUNT = 47;
  const mockBooks = [];
  const mockMeta = {};

  for (let n = 1; n <= MOCK_COUNT; n++) {
    const slug = `mock-${String(n).padStart(3, '0')}`;

    // Index entry — clone stats from template, unique slug.
    mockBooks.push({
      name: slug,
      total_pages: templateBook.total_pages,
      total_chars: templateBook.total_chars,
      total_words: templateBook.total_words,
      unique_words: templateBook.unique_words,
      total_tokens: templateBook.total_tokens,
      unique_tokens: templateBook.unique_tokens,
      avg_words_per_page: templateBook.avg_words_per_page,
      lexical_richness: templateBook.lexical_richness,
    });

    // Metadata entry — reuse template author/category/tags.
    mockMeta[slug] = {
      author: templateMeta ? templateMeta.author : 'Mock Author',
      category: templateMeta ? templateMeta.category : 'Mock',
      tags: templateMeta ? [...templateMeta.tags] : [],
    };

    // Per-book JSON — minimal clone; enough for the library grid to render.
    const mockBookData = {
      stats: {
        total_pages: templateBook.total_pages,
        total_words: templateBook.total_words,
        unique_words: templateBook.unique_words,
        total_tokens: templateBook.total_tokens,
        unique_tokens: templateBook.unique_tokens,
        avg_words_per_page: templateBook.avg_words_per_page,
        lexical_richness: templateBook.lexical_richness,
      },
      word_freq: templateData.word_freq || {},
      tfidf: templateData.tfidf || [],
      search_pages: templateData.search_pages || [],
    };

    await writeFile(
      `${DATA_DIR}/${slug}.json`,
      JSON.stringify(mockBookData),
      'utf8'
    );
  }

  // ── Write stress index (3 real + 47 mock = 50 total) ──
  const stressIndex = { books: [...index.books, ...mockBooks] };
  await writeFile(
    `${DATA_DIR}/index.stress.json`,
    JSON.stringify(stressIndex, null, 2),
    'utf8'
  );

  // ── Write stress metadata (real entries + mock entries) ──
  const stressMeta = { ...metadata, ...mockMeta };
  await writeFile(
    `${DATA_DIR}/metadata.stress.json`,
    JSON.stringify(stressMeta, null, 2),
    'utf8'
  );

  console.log(`wrote 50 mock entries.`);
  console.log(`
To stress test:
  1. Back up current data/index.json and data/metadata.json.
  2. Copy data/index.stress.json over data/index.json.
  3. Copy data/metadata.stress.json over data/metadata.json.
  4. Run \`npm run dev\` and scroll the library grid. Expect smooth batches of 12.
  5. Restore backups and delete data/mock-*.json when done.
`);
}

main().catch(err => { console.error(err); process.exit(1); });
