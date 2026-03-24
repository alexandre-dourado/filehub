#!/usr/bin/env node
/**
 * generate-index.js — FileHub Indexador v2
 *
 * Varre /content recursivamente e gera /data/index.json com:
 *   name, filename, path, type, size, date, category, excerpt, tags
 *
 * Uso: node scripts/generate-index.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Configuração ─────────────────────────────────────────
const ROOT        = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const OUTPUT_FILE = path.join(ROOT, 'data', 'index.json');

// Deixe vazio para indexar TUDO, ou liste extensões desejadas
const ALLOWED_EXTENSIONS = [
  '.html', '.md', '.txt', '.pdf',
  '.png',  '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  '.json', '.csv', '.xml',
];

// Pastas/arquivos a ignorar
const IGNORE = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db']);

// ── Helpers ───────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024)     return `${bytes} B`;
  if (bytes < 1048576)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getType(filename) {
  return path.extname(filename).replace('.', '').toLowerCase() || 'arquivo';
}

function relativePath(fullPath) {
  return fullPath.replace(ROOT + path.sep, '').replace(/\\/g, '/');
}

/** Extrai as primeiras ~160 chars de texto de um arquivo legível */
function extractExcerpt(fullPath, type) {
  try {
    if (!['md', 'txt', 'html'].includes(type)) return '';
    const raw = fs.readFileSync(fullPath, 'utf-8');
    // Remover tags HTML e marcação Markdown
    const clean = raw
      .replace(/<[^>]+>/g, ' ')     // HTML tags
      .replace(/[#*`_~\[\]()>!]/g, '') // Markdown syntax
      .replace(/\s+/g, ' ')
      .trim();
    return clean.slice(0, 160) + (clean.length > 160 ? '…' : '');
  } catch {
    return '';
  }
}

/** Deriva tags automáticas a partir da categoria e tipo */
function buildTags(category, type) {
  const tags = [];
  if (category && category !== 'raiz') tags.push(category.toLowerCase());
  tags.push(type);
  return tags;
}

/** Gera ID estável baseado no path relativo */
function makeId(relPath) {
  return Buffer.from(relPath).toString('base64').replace(/[=+/]/g, c =>
    c === '=' ? '' : c === '+' ? '-' : '_'
  );
}

/**
 * Varre diretório recursivamente
 * @param {string} dir      — diretório atual
 * @param {string} category — categoria raiz (primeira subpasta de /content)
 */
function scanDir(dir, category) {
  let files = [];

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    console.warn(`  ⚠️  Não foi possível ler: ${dir}`);
    return files;
  }

  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // A primeira subpasta de /content define a categoria
      const nextCat = category || entry.name;
      files = files.concat(scanDir(fullPath, nextCat));

    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (ALLOWED_EXTENSIONS.length && !ALLOWED_EXTENSIONS.includes(ext)) continue;

      let stat;
      try { stat = fs.statSync(fullPath); } catch { continue; }

      const relPath  = relativePath(fullPath);
      const type     = getType(entry.name);
      const cat      = category || 'raiz';

      files.push({
        id:       makeId(relPath),
        name:     path.basename(entry.name, path.extname(entry.name)),
        filename: entry.name,
        path:     relPath,
        type,
        size:     formatSize(stat.size),
        sizeRaw:  stat.size,
        date:     stat.mtime.toISOString(),
        category: cat,
        excerpt:  extractExcerpt(fullPath, type),
        tags:     buildTags(cat, type),
      });
    }
  }

  return files;
}

// ── Execução ──────────────────────────────────────────────

console.log('\n🗂️  FileHub — Indexador v2');
console.log('─'.repeat(40));
console.log('📂 Varrendo /content…\n');

if (!fs.existsSync(path.join(ROOT, 'data'))) {
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
}

if (!fs.existsSync(CONTENT_DIR)) {
  console.error('❌ Pasta /content não encontrada.');
  console.error('   Crie-a e adicione arquivos antes de indexar.\n');
  process.exit(1);
}

const files = scanDir(CONTENT_DIR, '');

// Ordenar: mais recente primeiro
files.sort((a, b) => new Date(b.date) - new Date(a.date));

// Estatísticas por tipo
const byType = {};
const byCat  = {};
for (const f of files) {
  byType[f.type] = (byType[f.type] || 0) + 1;
  byCat[f.category]  = (byCat[f.category]  || 0) + 1;
  console.log(`  ✓ [${f.type.padEnd(5)}] ${f.path}`);
}

const output = {
  generated:   new Date().toISOString(),
  total:       files.length,
  byType,
  byCategory:  byCat,
  files,
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

console.log('\n' + '─'.repeat(40));
console.log(`✅ ${files.length} arquivo(s) indexado(s)`);
console.log(`📄 Gerado: ${relativePath(OUTPUT_FILE)}\n`);

// Resumo por categoria
for (const [cat, n] of Object.entries(byCat)) {
  console.log(`   ${cat.padEnd(16)} ${n} arquivo(s)`);
}
console.log('');
