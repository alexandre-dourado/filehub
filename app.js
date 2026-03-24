/**
 * FileHub v2 — app.js
 * Central de conhecimento pessoal: busca, preview, favoritos,
 * navegação por teclado, highlight de busca, excerpts, stats.
 * JS puro. Sem frameworks. GitHub Pages ready.
 */

'use strict';

/* ══════════════════════════════════════════════
   ESTADO GLOBAL
══════════════════════════════════════════════ */
const State = {
  files:          [],
  filtered:       [],
  activeCategory: 'all',
  activeTypes:    new Set(),   // filtro por tipo (chips)
  query:          '',
  sort:           'date-desc',
  viewMode:       'grid',
  favorites:      new Set(JSON.parse(localStorage.getItem('fhub-favs') || '[]')),
  currentFile:    null,
  currentIndex:   -1,          // posição no array filtered (nav prev/next)
};

/* ══════════════════════════════════════════════
   SELETORES
══════════════════════════════════════════════ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const El = {
  sidebar:        $('#sidebar'),
  catNav:         $('#category-nav'),
  favList:        $('#favorites-list'),
  favBadge:       $('#fav-count-badge'),
  typeStats:      $('#type-stats'),
  totalCount:     $('#total-count'),
  indexDate:      $('#index-date'),
  searchInput:    $('#search-input'),
  btnClear:       $('#btn-clear-search'),
  sortSelect:     $('#sort-select'),
  btnGrid:        $('#btn-grid'),
  btnList:        $('#btn-list'),
  btnShortcuts:   $('#btn-shortcuts'),
  chips:          $('#filter-chips'),
  activeLabel:    $('#active-label'),
  resultCount:    $('#result-count'),
  container:      $('#files-container'),
  emptyState:     $('#empty-state'),
  emptyMsg:       $('#empty-msg'),
  btnReset:       $('#btn-reset-filters'),
  loadingState:   $('#loading-state'),
  overlay:        $('#viewer-overlay'),
  viewerBadge:    $('#viewer-badge'),
  viewerTitle:    $('#viewer-title'),
  viewerInfo:     $('#viewer-info'),
  viewerBreadcrumb:$('#viewer-breadcrumb'),
  viewerBody:     $('#viewer-body'),
  btnFavViewer:   $('#btn-fav-viewer'),
  btnCopyViewer:  $('#btn-copy-viewer'),
  btnOpenTab:     $('#btn-open-tab'),
  btnCloseViewer: $('#btn-close-viewer'),
  shortcutsPanel: $('#shortcuts-panel'),
  btnCloseShortcuts:$('#btn-close-shortcuts'),
  toast:          $('#toast'),
};

/* ══════════════════════════════════════════════
   UTILITÁRIOS
══════════════════════════════════════════════ */
const TYPE_ICONS = {
  md:'📝', html:'🌐', pdf:'📄', txt:'📃',
  png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🎞️', svg:'✏️', webp:'🖼️',
  json:'⚙️', csv:'📊', xml:'🗂️',
};
const typeIcon = t => TYPE_ICONS[t] || '📁';

const TYPE_COLORS = {
  md:'--c-md', html:'--c-html', pdf:'--c-pdf', txt:'--c-txt',
  json:'--c-json', csv:'--c-csv',
  png:'--c-img', jpg:'--c-img', jpeg:'--c-img', gif:'--c-img', svg:'--c-img',
};
const typeColor = t => `var(${TYPE_COLORS[t] || '--c-other'})`;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
}
function formatDateShort(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
}

/** Highlight de termos de busca no texto */
function highlight(text, query) {
  if (!query || !text) return escHtml(text || '');
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(new RegExp(`(${q})`, 'gi'), '<mark>$1</mark>');
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

let _toastTimer;
function toast(msg, dur = 2200) {
  El.toast.textContent = msg;
  El.toast.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => El.toast.classList.remove('show'), dur);
}

function saveFavorites() {
  localStorage.setItem('fhub-favs', JSON.stringify([...State.favorites]));
}

/* ══════════════════════════════════════════════
   CARREGAR DADOS
══════════════════════════════════════════════ */
async function loadIndex() {
  try {
    const res  = await fetch('data/index.json?v=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    State.files = data.files || [];

    // Footer info
    El.totalCount.textContent = `${State.files.length} arquivo${State.files.length !== 1 ? 's' : ''}`;
    if (data.generated) {
      El.indexDate.textContent = 'Atualizado ' + formatDateShort(data.generated);
    }

    buildCategoryNav(data.byCategory || {});
    buildTypeStats(data.byType || {});
    renderFavoritesList();
    applyFilters();

  } catch (err) {
    El.loadingState.hidden = true;
    El.container.style.display = 'block';
    El.container.innerHTML = `
      <div style="padding:3rem;text-align:center;color:var(--text-3)">
        <div style="font-size:2rem;margin-bottom:.75rem">⚠️</div>
        <p style="margin-bottom:.5rem">Não foi possível carregar <code>data/index.json</code>.</p>
        <p style="font-size:11px">Execute <code>node scripts/generate-index.js</code> primeiro,<br>
        depois sirva com um servidor HTTP local (<code>npx serve .</code>).</p>
      </div>`;
  }
}

/* ══════════════════════════════════════════════
   SIDEBAR — CATEGORIAS
══════════════════════════════════════════════ */
function buildCategoryNav(byCat) {
  const total    = State.files.length;
  const cats     = Object.entries(byCat).sort((a,b) => a[0].localeCompare(b[0]));
  const allLabel = `<button class="cat-btn active" data-cat="all">
    <span class="cat-dot"></span>Todos
    <span class="cat-count">${total}</span>
  </button>`;

  const catBtns = cats.map(([cat, n]) => `
    <button class="cat-btn" data-cat="${escHtml(cat)}">
      <span class="cat-dot"></span>${escHtml(capitalize(cat))}
      <span class="cat-count">${n}</span>
    </button>`).join('');

  El.catNav.innerHTML = '<p class="nav-label">Categorias</p>' + allLabel + catBtns;

  El.catNav.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      State.activeCategory = btn.dataset.cat;
      El.catNav.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      El.activeLabel.textContent =
        btn.dataset.cat === 'all' ? 'Todos os arquivos' : capitalize(btn.dataset.cat);
      applyFilters();
      closeSidebar();
    });
  });
}

/* ══════════════════════════════════════════════
   SIDEBAR — STATS POR TIPO
══════════════════════════════════════════════ */
function buildTypeStats(byType) {
  const entries = Object.entries(byType).sort((a,b) => b[1]-a[1]);
  const max = entries[0]?.[1] || 1;
  El.typeStats.innerHTML = entries.map(([type, n]) => `
    <div class="type-stat-row" data-type="${type}" style="cursor:pointer" title="Filtrar por .${type}">
      <span class="badge badge-${type}">${type}</span>
      <div class="ts-bar-wrap">
        <div class="ts-bar" style="width:${Math.round(n/max*100)}%;background:${typeColor(type)}"></div>
      </div>
      <span class="ts-n">${n}</span>
    </div>`).join('');

  El.typeStats.querySelectorAll('.type-stat-row').forEach(row => {
    row.addEventListener('click', () => toggleTypeFilter(row.dataset.type));
  });
}

/* ══════════════════════════════════════════════
   FILTRO POR TIPO (chips)
══════════════════════════════════════════════ */
function toggleTypeFilter(type) {
  if (State.activeTypes.has(type)) {
    State.activeTypes.delete(type);
  } else {
    State.activeTypes.add(type);
  }
  renderChips();
  applyFilters();
}

function renderChips() {
  if (State.activeTypes.size === 0) {
    El.chips.innerHTML = '';
    return;
  }
  El.chips.innerHTML = [...State.activeTypes].map(t => `
    <span class="chip" data-type="${t}">
      ${typeIcon(t)} .${t} <span class="chip-x">✕</span>
    </span>`).join('');

  El.chips.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => toggleTypeFilter(chip.dataset.type));
  });
}

/* ══════════════════════════════════════════════
   FAVORITOS — SIDEBAR
══════════════════════════════════════════════ */
function renderFavoritesList() {
  const favFiles = State.files.filter(f => State.favorites.has(f.id));
  El.favBadge.textContent = favFiles.length > 0 ? favFiles.length : '';

  if (favFiles.length === 0) {
    El.favList.innerHTML = `
      <li style="padding:.35rem 1rem;font-size:11px;color:var(--text-3)">
        Nenhum favorito ainda.
      </li>`;
    return;
  }

  El.favList.innerHTML = favFiles.map(f => `
    <li class="fav-item" data-id="${f.id}">
      <span class="fav-icon">${typeIcon(f.type)}</span>
      ${escHtml(f.name)}
    </li>`).join('');

  El.favList.querySelectorAll('.fav-item').forEach(li => {
    li.addEventListener('click', () => {
      const file = State.files.find(x => x.id === li.dataset.id);
      if (file) openViewer(file);
    });
  });
}

/* ══════════════════════════════════════════════
   FILTROS + ORDENAÇÃO
══════════════════════════════════════════════ */
function applyFilters() {
  let list = [...State.files];

  // Categoria
  if (State.activeCategory !== 'all') {
    list = list.filter(f => f.category === State.activeCategory);
  }

  // Tipos ativos (chips)
  if (State.activeTypes.size > 0) {
    list = list.filter(f => State.activeTypes.has(f.type));
  }

  // Busca
  if (State.query) {
    const q = State.query.toLowerCase();
    list = list.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.filename.toLowerCase().includes(q) ||
      f.category.toLowerCase().includes(q) ||
      (f.excerpt || '').toLowerCase().includes(q)
    );
  }

  // Ordenação
  switch (State.sort) {
    case 'date-desc':  list.sort((a,b) => new Date(b.date) - new Date(a.date)); break;
    case 'date-asc':   list.sort((a,b) => new Date(a.date) - new Date(b.date)); break;
    case 'name-asc':   list.sort((a,b) => a.name.localeCompare(b.name));        break;
    case 'name-desc':  list.sort((a,b) => b.name.localeCompare(a.name));        break;
    case 'size-desc':  list.sort((a,b) => (b.sizeRaw||0) - (a.sizeRaw||0));    break;
  }

  State.filtered = list;
  renderCards();
}

/* ══════════════════════════════════════════════
   CARDS
══════════════════════════════════════════════ */
function renderCards() {
  El.loadingState.hidden = true;
  El.container.style.display = '';

  const isEmpty = State.filtered.length === 0;
  El.emptyState.hidden = !isEmpty;
  El.resultCount.textContent = State.filtered.length === State.files.length
    ? '' : `${State.filtered.length} resultado${State.filtered.length !== 1 ? 's' : ''}`;

  // Mensagem de empty inteligente
  if (isEmpty) {
    El.emptyMsg.textContent = State.query
      ? `Nenhum resultado para "${State.query}".`
      : 'Nenhum arquivo nesta categoria.';
  }

  if (isEmpty) { El.container.innerHTML = ''; return; }

  const isList = State.viewMode === 'list';
  El.container.innerHTML = State.filtered.map((f, i) => cardHTML(f, isList)).join('');

  El.container.querySelectorAll('.file-card').forEach((card, i) => {
    const file = State.filtered[i];
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'listitem');

    card.addEventListener('click', e => {
      if (e.target.closest('.btn-fav')) return;
      openViewer(file, i);
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openViewer(file, i); }
    });
    card.querySelector('.btn-fav').addEventListener('click', e => {
      e.stopPropagation();
      toggleFav(file, card.querySelector('.btn-fav'));
    });
  });
}

function cardHTML(f, list) {
  const isFav    = State.favorites.has(f.id);
  const name     = highlight(f.name, State.query);
  const excerpt  = f.excerpt ? highlight(f.excerpt, State.query) : '';
  const dateStr  = formatDateShort(f.date);
  const favBtn   = `<button class="btn-fav ${isFav?'active':''}" aria-label="${isFav?'Desfavoritar':'Favoritar'}">${isFav?'★':'☆'}</button>`;

  if (list) {
    return `
      <div class="file-card" data-id="${f.id}" aria-label="${f.filename}">
        <div class="card-top">
          <span class="card-icon" aria-hidden="true">${typeIcon(f.type)}</span>
        </div>
        <div class="card-name">${name}</div>
        <div class="card-meta">
          <span class="badge badge-${f.type}">${f.type}</span>
          <span style="font-size:10px;color:var(--text-3)">${capitalize(f.category)}</span>
          <span class="card-date">${dateStr}</span>
        </div>
        ${favBtn}
      </div>`;
  }

  return `
    <div class="file-card" data-id="${f.id}" aria-label="${f.filename}">
      <div class="card-top">
        <span class="card-icon" aria-hidden="true">${typeIcon(f.type)}</span>
        ${favBtn}
      </div>
      <div class="card-name">${name}</div>
      ${excerpt ? `<div class="excerpt">${excerpt}</div>` : ''}
      <div class="card-meta">
        <span class="badge badge-${f.type}">${f.type}</span>
        <span style="font-size:10px;color:var(--text-3)">${capitalize(f.category)}</span>
        <span class="card-date">${dateStr}</span>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════════
   FAVORITAR
══════════════════════════════════════════════ */
function toggleFav(file, btnEl) {
  const adding = !State.favorites.has(file.id);
  if (adding) {
    State.favorites.add(file.id);
    toast('⭐ Adicionado aos favoritos!');
  } else {
    State.favorites.delete(file.id);
    toast('Removido dos favoritos');
  }
  if (btnEl) {
    btnEl.textContent = adding ? '★' : '☆';
    btnEl.classList.toggle('active', adding);
    btnEl.setAttribute('aria-label', adding ? 'Desfavoritar' : 'Favoritar');
  }
  saveFavorites();
  renderFavoritesList();
  if (State.currentFile?.id === file.id) syncViewerFavBtn();
}

function syncViewerFavBtn() {
  const isFav = State.favorites.has(State.currentFile?.id);
  El.btnFavViewer.textContent = isFav ? '★' : '☆';
  El.btnFavViewer.title       = `${isFav ? 'Desfavoritar' : 'Favoritar'} (F)`;
  El.btnFavViewer.classList.toggle('active', isFav);
}

/* ══════════════════════════════════════════════
   VIEWER
══════════════════════════════════════════════ */
function openViewer(file, index) {
  State.currentFile  = file;
  State.currentIndex = index ?? State.filtered.findIndex(f => f.id === file.id);

  // Header
  El.viewerBadge.className   = `badge badge-${file.type}`;
  El.viewerBadge.textContent = file.type;
  El.viewerTitle.textContent = file.filename;
  El.viewerInfo.textContent  = `${formatDate(file.date)} · ${file.size}`;

  // Breadcrumb
  El.viewerBreadcrumb.innerHTML =
    `<span>${typeIcon(file.type)}</span>
     <span class="bc-cat">${capitalize(file.category)}</span>
     <span>›</span>
     <span>${escHtml(file.filename)}</span>`;

  syncViewerFavBtn();

  // Copiar só para txt/md
  const canCopy = ['txt', 'md'].includes(file.type);
  El.btnCopyViewer.hidden = !canCopy;

  El.btnOpenTab.onclick = () => window.open(file.path, '_blank');

  renderViewerContent(file);

  El.overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  El.btnCloseViewer.focus();
}

function closeViewer() {
  El.overlay.hidden = true;
  El.viewerBody.innerHTML = '';
  State.currentFile  = null;
  State.currentIndex = -1;
  document.body.style.overflow = '';
}

/** Navegar para o arquivo anterior/próximo no filtered */
function navigateViewer(dir) {
  const next = State.currentIndex + dir;
  if (next < 0 || next >= State.filtered.length) return;
  openViewer(State.filtered[next], next);
}

/* ── Render por tipo ── */
function renderViewerContent(file) {
  const body = El.viewerBody;
  body.innerHTML = '';

  switch (file.type) {

    case 'html': {
      const f = document.createElement('iframe');
      f.src     = file.path;
      f.sandbox = 'allow-scripts allow-same-origin';
      body.appendChild(f);
      break;
    }

    case 'pdf': {
      const f = document.createElement('iframe');
      f.src = file.path;
      f.style.minHeight = '560px';
      body.appendChild(f);
      break;
    }

    case 'md': {
      const div = document.createElement('div');
      div.className = 'md-body';
      div.innerHTML = '<p style="color:var(--text-3);padding:1.5rem">Carregando…</p>';
      body.appendChild(div);
      fetch(file.path)
        .then(r => r.text())
        .then(text => {
          div.innerHTML = window.marked
            ? marked.parse(text)
            : `<pre class="txt-body">${escHtml(text)}</pre>`;
        })
        .catch(() => { div.innerHTML = '<p style="color:var(--c-pdf);padding:1.5rem">Erro ao carregar o arquivo.</p>'; });
      break;
    }

    case 'txt': {
      const pre = document.createElement('pre');
      pre.className = 'txt-body';
      pre.textContent = 'Carregando…';
      body.appendChild(pre);
      fetch(file.path)
        .then(r => r.text())
        .then(text => { pre.textContent = text; })
        .catch(() => { pre.textContent = 'Erro ao carregar o arquivo.'; });
      break;
    }

    case 'png': case 'jpg': case 'jpeg':
    case 'gif': case 'svg':  case 'webp': {
      const img = document.createElement('img');
      img.src = file.path;
      img.alt = file.name;
      img.style.cssText = 'max-width:100%;max-height:72vh;display:block;margin:auto;padding:1.25rem;border-radius:8px;';
      body.appendChild(img);
      break;
    }

    default: {
      body.innerHTML = `
        <div class="ext-body">
          <span class="ext-icon">${typeIcon(file.type)}</span>
          <p style="font-size:13px">Prévia não disponível para <strong>.${escHtml(file.type)}</strong></p>
          <a href="${escHtml(file.path)}" target="_blank" rel="noopener noreferrer">
            Abrir arquivo
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px" aria-hidden="true">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>`;
    }
  }
}

/* ── Copiar conteúdo ── */
async function copyViewerContent() {
  if (!State.currentFile) return;
  try {
    const text = await fetch(State.currentFile.path).then(r => r.text());
    await navigator.clipboard.writeText(text);
    toast('✅ Conteúdo copiado!');
  } catch {
    toast('❌ Não foi possível copiar.');
  }
}

/* ══════════════════════════════════════════════
   VIEW MODE
══════════════════════════════════════════════ */
function setViewMode(mode) {
  State.viewMode = mode;
  El.container.className = mode === 'grid' ? 'grid-view' : 'list-view';
  El.btnGrid.classList.toggle('active', mode === 'grid');
  El.btnList.classList.toggle('active', mode === 'list');
  renderCards();
}

/* ══════════════════════════════════════════════
   SIDEBAR MOBILE
══════════════════════════════════════════════ */
function openSidebar() {
  El.sidebar.classList.add('open');
  let ov = document.getElementById('sidebar-overlay');
  if (!ov) {
    ov = Object.assign(document.createElement('div'), { id: 'sidebar-overlay' });
    document.body.appendChild(ov);
    ov.addEventListener('click', closeSidebar);
  }
  ov.classList.add('show');
}

function closeSidebar() {
  El.sidebar.classList.remove('open');
  const ov = document.getElementById('sidebar-overlay');
  if (ov) ov.classList.remove('show');
}

/* ══════════════════════════════════════════════
   ATALHOS DE TECLADO
══════════════════════════════════════════════ */
function handleKeyboard(e) {
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  const viewerOpen    = !El.overlay.hidden;
  const shortcutsOpen = !El.shortcutsPanel.hidden;

  // Fechar com Esc
  if (e.key === 'Escape') {
    if (shortcutsOpen) { El.shortcutsPanel.hidden = true; return; }
    if (viewerOpen)    { closeViewer(); return; }
  }

  // Viewer aberto
  if (viewerOpen) {
    switch (e.key) {
      case 'f': case 'F':
        if (!inInput) { e.preventDefault(); toggleFav(State.currentFile); syncViewerFavBtn(); }
        break;
      case 'c': case 'C':
        if (!inInput && !El.btnCopyViewer.hidden) { e.preventDefault(); copyViewerContent(); }
        break;
      case 'o': case 'O':
        if (!inInput) { e.preventDefault(); window.open(State.currentFile?.path, '_blank'); }
        break;
      case 'ArrowLeft':
        e.preventDefault(); navigateViewer(-1);
        break;
      case 'ArrowRight':
        e.preventDefault(); navigateViewer(1);
        break;
    }
    return;
  }

  if (inInput) return;

  switch (e.key) {
    case '/':
      e.preventDefault(); El.searchInput.focus();
      break;
    case 'g': case 'G':
      e.preventDefault(); setViewMode('grid');
      break;
    case 'l': case 'L':
      e.preventDefault(); setViewMode('list');
      break;
    case 'm': case 'M':
      e.preventDefault();
      El.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
      break;
    case '?':
      e.preventDefault();
      El.shortcutsPanel.hidden = !El.shortcutsPanel.hidden;
      break;
  }
}

/* ══════════════════════════════════════════════
   BIND DE EVENTOS
══════════════════════════════════════════════ */
function bindEvents() {
  // Busca
  El.searchInput.addEventListener('input', () => {
    State.query = El.searchInput.value.trim();
    El.btnClear.hidden = !State.query;
    applyFilters();
  });
  El.btnClear.addEventListener('click', () => {
    El.searchInput.value = '';
    State.query = '';
    El.btnClear.hidden = true;
    applyFilters();
    El.searchInput.focus();
  });

  // Sort
  El.sortSelect.addEventListener('change', () => {
    State.sort = El.sortSelect.value;
    applyFilters();
  });

  // View mode
  El.btnGrid.addEventListener('click', () => setViewMode('grid'));
  El.btnList.addEventListener('click', () => setViewMode('list'));

  // Atalhos panel
  El.btnShortcuts.addEventListener('click', () => {
    El.shortcutsPanel.hidden = !El.shortcutsPanel.hidden;
  });
  El.btnCloseShortcuts.addEventListener('click', () => {
    El.shortcutsPanel.hidden = true;
  });
  El.shortcutsPanel.addEventListener('click', e => {
    if (e.target === El.shortcutsPanel) El.shortcutsPanel.hidden = true;
  });

  // Viewer — fechar
  El.btnCloseViewer.addEventListener('click', closeViewer);
  El.overlay.addEventListener('click', e => {
    if (e.target === El.overlay) closeViewer();
  });

  // Viewer — favoritar
  El.btnFavViewer.addEventListener('click', () => {
    if (!State.currentFile) return;
    const cardBtn = El.container.querySelector(
      `.file-card[data-id="${State.currentFile.id}"] .btn-fav`
    );
    toggleFav(State.currentFile, cardBtn);
  });

  // Viewer — copiar
  El.btnCopyViewer.addEventListener('click', copyViewerContent);

  // Menu mobile
  $('#btn-menu').addEventListener('click', () => {
    El.sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  // Reset filtros
  El.btnReset.addEventListener('click', () => {
    State.query = '';
    State.activeTypes.clear();
    State.activeCategory = 'all';
    El.searchInput.value = '';
    El.btnClear.hidden = true;
    El.catNav.querySelectorAll('.cat-btn').forEach((b,i) => b.classList.toggle('active', i===0));
    El.activeLabel.textContent = 'Todos os arquivos';
    renderChips();
    applyFilters();
  });

  // Teclado global
  document.addEventListener('keydown', handleKeyboard);
}

/* ══════════════════════════════════════════════
   PWA — Service Worker
══════════════════════════════════════════════ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadIndex();
  registerSW();
});
