import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = path.resolve(__dirname, 'books');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.tiff': 'image/tiff', '.txt': 'text/plain; charset=utf-8' };

function serveBooks() {
  return {
    name: 'serve-books',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/books/')) return next();
        const rel = decodeURIComponent(req.url.split('?')[0].slice('/books/'.length));
        const filePath = path.join(BOOKS_DIR, rel);
        if (!filePath.startsWith(BOOKS_DIR)) return next();
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next();
        res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    },
  };
}

function copyBookImages() {
  return {
    name: 'copy-book-images',
    apply: 'build',
    closeBundle() {
      const dst = path.resolve(__dirname, 'dist/books');
      if (!fs.existsSync(BOOKS_DIR)) return;
      for (const slug of fs.readdirSync(BOOKS_DIR)) {
        const imgDir = path.join(BOOKS_DIR, slug, 'images');
        if (!fs.existsSync(imgDir)) continue;
        const outDir = path.join(dst, slug, 'images');
        fs.mkdirSync(outDir, { recursive: true });
        for (const file of fs.readdirSync(imgDir)) {
          fs.copyFileSync(path.join(imgDir, file), path.join(outDir, file));
        }
      }
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/book-analysis/' : '/',
  plugins: [tailwindcss(), serveBooks(), copyBookImages()],
  root: 'dashboard',
  publicDir: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    fs: { allow: ['..'] },
  },
});
