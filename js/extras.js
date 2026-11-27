/* ONLY24²⁴ — js/extras.js (v3.0 completo) */
(function () {
  'use strict';
  const CFG = window.ONLY24_CONFIG || {};
  if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY_ST = 'o24_tmdb_api_key';
  const GMAP = { 28:'acao', 12:'acao', 10759:'acao', 18:'drama', 80:'drama', 9648:'drama', 10768:'drama', 27:'terror', 53:'terror', 35:'comedia', 10749:'romance', 878:'ficcao', 14:'ficcao', 10765:'ficcao', 16:'animacao', 10751:'animacao', 99:'documentario' };
  const T_LBL = { filme: 'Filme', serie: 'Série', anime: 'Anime', musica: 'Vídeo musical' };
  let titlesCache = null;
  let lastOpenedId = null;
  let gridLimit = 24;

  function notify(msg) {
    const t = $('toast');
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(window.__o24ExtraToast);
    window.__o24ExtraToast = setTimeout(() => t.classList.add('hidden'), 3500);
  }

  function getTmdbKey() {
    const typed = $('tmdbKeyInput') ? $('tmdbKeyInput').value.trim() : '';
    if (typed) { try { localStorage.setItem(KEY_ST, typed); } catch (e) {} return typed; }
    try { return CFG.TMDB_API_KEY || localStorage.getItem(KEY_ST) || ''; } catch (e) { return CFG.TMDB_API_KEY || ''; }
  }

  async function searchTmdb() {
    const key = getTmdbKey();
    if (!key) return notify('Cola a tua Chave API v3 do TMDB primeiro.');
    const q = $('tmdbQuery') ? $('tmdbQuery').value.trim() : '';
    if (!q) return notify('Escreve o nome do filme, série ou anime.');
    const box = $('tmdbResults');
    box.innerHTML = '<small style="color:#aaa">A procurar no TMDB...</small>';
    try {
      const res = await fetch('https://api.themoviedb.org/3/search/multi?api_key=' + encodeURIComponent(key) + '&language=pt-PT&query=' + encodeURIComponent(q));
      if (!res.ok) throw new Error(res.status === 401 ? 'Chave TMDB inválida.' : 'Erro na busca TMDB.');
      const data = await res.json();
      const list = (data.results || []).filter((x) => x.media_type === 'movie' || x.media_type === 'tv').slice(0, 5);
      if (!list.length) { box.innerHTML = '<small style="color:#aaa">Nada encontrado no TMDB.</small>'; return; }
      box.innerHTML = list.map((x) => {
        const poster = x.poster_path ? 'https://image.tmdb.org/t/p/w92' + x.poster_path : '';
        const yr = (x.release_date || x.first_air_date || '').slice(0, 4);
        return '<button type="button" class="tmdb-item" data-tmdb-id="' + x.id + '" data-tmdb-type="' + x.media_type + '">' +
          (poster ? '<img src="' + esc(poster) + '" alt="">' : '') +
          '<div><b>' + esc(x.title || x.name || '') + '</b><small>' + (x.media_type === 'tv' ? 'Série' : 'Filme') + (yr ? ' • ' + yr : '') + '</small></div></button>';
      }).join('');
    } catch (e) { box.innerHTML = ''; notify(e.message || 'Erro ao buscar no TMDB.'); }
  }

async function fillFromTmdb(id, mediaType) {
    const key = getTmdbKey();
    if (!key) return;
    notify('A preencher dados...');
    try {
      const res = await fetch('https://api.themoviedb.org/3/' + mediaType + '/' + id + '?api_key=' + encodeURIComponent(key) + '&language=pt-PT&include_video_language=pt,en,null&append_to_response=credits,videos');
      if (!res.ok) throw new Error('Erro ao carregar detalhes do TMDB.');
      const d = await res.json();
      let synopsis = d.overview || '';
      if (!synopsis) {
        const r2 = await fetch('https://api.themoviedb.org/3/' + mediaType + '/' + id + '?api_key=' + encodeURIComponent(key) + '&language=pt-BR');
        if (r2.ok) { const d2 = await r2.json(); synopsis = d2.overview || ''; }
      }
      const genres = d.genres || [];
      let tipo = mediaType === 'tv' ? 'serie' : 'filme';
      if (mediaType === 'tv' && genres.some((g) => g.id === 16) && d.original_language === 'ja') tipo = 'anime';
      $('fType').value = tipo;
      $('fType').dispatchEvent(new Event('change'));
      let cat = 'acao';
      for (const g of genres) { if (GMAP[g.id]) { cat = GMAP[g.id]; break; } }
      if ($('fGenre').querySelector('option[value="' + cat + '"]')) $('fGenre').value = cat;
      $('fTitle').value = d.title || d.name || '';
      $('fYear').value = (d.release_date || d.first_air_date || '').slice(0, 4);
      $('fRating').value = d.vote_average ? Number(d.vote_average).toFixed(1) : '';
      $('fSynopsis').value = synopsis;
      $('fCast').value = ((d.credits && d.credits.cast) || []).slice(0, 5).map((c) => c.name).join(', ');
      $('fPoster').value = d.poster_path ? 'https://image.tmdb.org/t/p/w500' + d.poster_path : '';
      $('fBackdrop').value = d.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path : '';
      const vids = ((d.videos && d.videos.results) || []).filter((v) => v.site === 'YouTube');
      const tr = vids.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'pt') || vids.find((v) => v.type === 'Trailer') || vids.find((v) => v.type === 'Teaser') || vids[0];
      $('fTrailer').value = tr ? 'https://www.youtube.com/watch?v=' + tr.key : '';
      if ($('iaQuery')) $('iaQuery').value = d.original_title || d.original_name || d.title || d.name || '';
      $('tmdbResults').innerHTML = '';
      notify('Campos preenchidos! Escolhe o vídeo ou usa o Trailer.');
    } catch (e) { notify(e.message || 'Erro ao preencher.'); }
  }

async function searchArchive() {
    const q = $('iaQuery') ? $('iaQuery').value.trim() : '';
    if (!q) return notify('Escreve o nome do filme para buscar no Archive.org.');
    const box = $('iaResults');
    box.innerHTML = '<small style="color:#aaa">A procurar no Archive.org...</small>';
    try {
      const clean = q.replace(/[()":]/g, ' ');
      const url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('(' + clean + ') AND mediatype:movies') +
        '&fl[]=identifier&fl[]=title&fl[]=year&sort[]=downloads+desc&rows=5&output=json';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro na busca Archive.org.');
      const data = await res.json();
      const docs = (data.response && data.response.docs) || [];
      if (!docs.length) { box.innerHTML = '<small style="color:#aaa">Nada encontrado no Archive.org.</small>'; return; }
      box.innerHTML = docs.map((x) => {
        const img = 'https://archive.org/services/img/' + encodeURIComponent(x.identifier);
        const yr = Array.isArray(x.year) ? x.year[0] : (x.year || '');
        return '<button type="button" class="tmdb-item" data-ia-id="' + esc(x.identifier) + '" data-ia-title="' + esc(x.title || x.identifier) + '" data-ia-year="' + esc(yr) + '">' +
          '<img src="' + esc(img) + '" alt=""><div><b>' + esc(x.title || x.identifier) + '</b><small>Archive.org' + (yr ? ' • ' + esc(yr) : '') + '</small></div></button>';
      }).join('');
    } catch (e) { box.innerHTML = ''; notify(e.message || 'Erro ao buscar no Archive.org.'); }
  }

  async function fillFromArchive(id, title, year) {
    notify('A procurar vídeo MP4 no Archive.org...');
    try {
      const res = await fetch('https://archive.org/metadata/' + encodeURIComponent(id));
      if (!res.ok) throw new Error('Erro ao ler ficheiros.');
      const meta = await res.json();
      const files = Array.isArray(meta.files) ? meta.files : [];
      const ok = files.filter((f) => f && f.name && /\.(mp4|webm)$/i.test(f.name) && Number(f.size || 0) > 500000);
      ok.sort((a, b) => {
        const score = (f) => (/h\.264|mpeg4/i.test(f.format || '') ? 2 : 0) + (/\.mp4$/i.test(f.name) ? 1 : 0);
        return score(b) - score(a) || Number(a.size || 0) - Number(b.size || 0);
      });
      const pick = ok.find((f) => /mpeg4|h\.264/i.test(f.format || '') && !/512kb/i.test(f.format || '')) || ok[0];
      const videoUrl = pick
        ? 'https://archive.org/download/' + encodeURIComponent(id) + '/' + pick.name.split('/').map(encodeURIComponent).join('/')
        : 'https://archive.org/embed/' + encodeURIComponent(id);
      $('fVideoUrl').value = videoUrl;
      if ($('fTitle') && !$('fTitle').value.trim()) $('fTitle').value = title || '';
      if ($('fYear') && !$('fYear').value.trim() && year) $('fYear').value = String(year).slice(0, 4);
      if ($('fPoster') && !$('fPoster').value.trim()) $('fPoster').value = 'https://archive.org/services/img/' + encodeURIComponent(id);
      $('iaResults').innerHTML = '';
      notify(pick ? 'Vídeo MP4 preenchido ✅' : 'Link Embed preenchido ✅');
    } catch (e) { notify(e.message || 'Erro ao carregar vídeo.'); }
  }

  function useTrailerAsVideo() {
    const tr = $('fTrailer') ? $('fTrailer').value.trim() : '';
    if (!tr) return notify('Preenche ou busca um trailer primeiro.');
    if ($('fVideoUrl')) $('fVideoUrl').value = tr;
    notify('Trailer copiado para o Link do vídeo ✅');
  }

function openReqModal(kind, prefillTitle) {
    const m = $('reqModal');
    if (!m) return;
    $('reqKind').value = kind || 'pedido';
    $('reqTitle').value = prefillTitle || '';
    $('reqDetails').value = '';
    m.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeReqModal() {
    const m = $('reqModal');
    if (!m) return;
    m.classList.add('hidden');
    const anyOpen = ['playerModal', 'authModal', 'profileModal', 'notifModal', 'adminPanel', 'titleModal'].some((id) => $(id) && !$(id).classList.contains('hidden'));
    document.body.classList.toggle('modal-open', anyOpen);
  }

  async function submitRequest() {
    const titleName = $('reqTitle').value.trim();
    if (!titleName) return notify('Escreve o nome do conteúdo.');
    const btn = $('reqSubmit');
    btn.disabled = true;
    try {
      const { data: sess } = await sb.auth.getSession();
      const uid = sess && sess.session ? sess.session.user.id : null;
      const { error } = await sb.from('requests').insert({ user_id: uid, kind: $('reqKind').value, title_name: titleName, details: $('reqDetails').value.trim() || null });
      if (error) throw error;
      closeReqModal();
      notify('Enviado com sucesso! Obrigado pelo feedback ✅');
    } catch (e) { notify('Erro ao enviar: ' + (e.message || e)); }
    finally { btn.disabled = false; }
  }

  async function loadAdminRequests() {
    const box = $('adminRequestsList');
    if (!box) return;
    const { data, error } = await sb.from('requests').select('*').order('created_at', { ascending: false }).limit(40);
    if (error) { box.innerHTML = '<p class="o24-empty">Sem pedidos por agora.</p>'; return; }
    const list = data || [];
    if (!list.length) { box.innerHTML = '<p class="o24-empty">Nenhum pedido ou reporte recebido.</p>'; return; }
    box.innerHTML = list.map((r) => {
      const done = r.status === 'resolvido';
      return '<div class="o24-req-row"><div class="o24-req-top"><b>' + (r.kind === 'reporte' ? '⚠️ Reporte' : '🎬 Pedido') + ': ' + esc(r.title_name) + '</b><span class="o24-req-tag' + (done ? ' done' : '') + '">' + esc(r.status) + '</span></div>' +
        (r.details ? '<p>' + esc(r.details) + '</p>' : '') +
        '<div class="o24-req-actions">' + (!done ? '<button type="button" class="btn-secondary" data-req-done="' + esc(r.id) + '">✓ Marcar resolvido</button>' : '') +
        '<button type="button" class="btn-secondary" data-req-del="' + esc(r.id) + '">Apagar</button></div></div>';
    }).join('');
  }

  async function syncGuestToAccount(uid) {
    let gf = [], gh = [];
    try { gf = JSON.parse(localStorage.getItem('o24_guest_favs') || '[]'); } catch (e) {}
    try { gh = JSON.parse(localStorage.getItem('o24_guest_history') || '[]'); } catch (e) {}
    if ((!Array.isArray(gf) || !gf.length) && (!Array.isArray(gh) || !gh.length)) return;
    let moved = false;
    if (Array.isArray(gf) && gf.length) {
      const rows = gf.map((tid) => ({ user_id: uid, title_id: tid }));
      const { error } = await sb.from('favorites').upsert(rows, { onConflict: 'user_id,title_id', ignoreDuplicates: true });
      if (!error) moved = true;
      try { localStorage.removeItem('o24_guest_favs'); } catch (e) {}
    }
    if (Array.isArray(gh) && gh.length) {
      const rows = gh.filter((h) => h && h.title_id).map((h) => ({ user_id: uid, title_id: h.title_id, episode_id: h.episode_id || null, progress: Number(h.progress) || 0, updated_at: h.updated_at || new Date().toISOString() }));
      if (rows.length) {
        const { error } = await sb.from('history').upsert(rows, { onConflict: 'user_id,title_id', ignoreDuplicates: true });
        if (!error) moved = true;
      }
      try { localStorage.removeItem('o24_guest_history'); } catch (e) {}
    }
    if (moved) { notify('Lista e histórico sincronizados ✅'); setTimeout(() => location.reload(), 900); }
  }

async function loadAdminStats() {
    const box = $('adminStats');
    if (!box) return;
    const [{ data: tData }, { data: rData }] = await Promise.all([
      sb.from('titles').select('id,featured,views'),
      sb.from('requests').select('id,status')
    ]);
    const t = tData || [], r = rData || [];
    const views = t.reduce((sum, x) => sum + (Number(x.views) || 0), 0);
    const feat = t.filter((x) => x.featured).length;
    const pend = r.filter((x) => x.status !== 'resolvido').length;
    box.innerHTML =
      '<div class="o24-stat"><b>' + t.length + '</b><small>Títulos</small></div>' +
      '<div class="o24-stat"><b>' + views + '</b><small>Views</small></div>' +
      '<div class="o24-stat"><b>' + feat + '</b><small>Destaques</small></div>' +
      '<div class="o24-stat"><b>' + pend + '</b><small>Pedidos</small></div>';
  }

  async function loadRelated() {
    const wrap = $('tmRelatedWrap'), row = $('tmRelatedRow');
    if (!wrap || !row) return;
    if (!titlesCache) {
      const { data } = await sb.from('titles').select('id,name,type,cat,year,poster,featured').order('views', { ascending: false }).limit(200);
      titlesCache = data || [];
    }
    const name = $('tmTitle') ? $('tmTitle').textContent.trim() : '';
    const cur = titlesCache.find((x) => (lastOpenedId && String(x.id) === String(lastOpenedId)) || x.name === name);
    if (!cur) { wrap.classList.add('hidden'); return; }
    const sameCat = titlesCache.filter((x) => String(x.id) !== String(cur.id) && x.cat && x.cat === cur.cat);
    const sameType = titlesCache.filter((x) => String(x.id) !== String(cur.id) && x.type === cur.type && x.cat !== cur.cat);
    const list = sameCat.concat(sameType).slice(0, 8);
    if (!list.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    row.innerHTML = list.map((x) => {
      const img = (x.poster || '').replace('image.tmdb.org/t/p/w500/', 'image.tmdb.org/t/p/w300/');
      return '<div class="o24-card" data-open="' + esc(x.id) + '" tabindex="0" role="button">' +
        (img ? '<img loading="lazy" src="' + esc(img) + '" alt="' + esc(x.name) + '">' : '') +
        '<div class="cn">' + esc(x.name) + '</div><div class="cm">' + esc((T_LBL[x.type] || 'Título') + (x.year ? ' • ' + x.year : '')) + '</div></div>';
    }).join('');
  }

  function updateCommunityAvg() {
    const avgEl = $('tmCommAvg'), box = $('tmCommentsList');
    if (!avgEl || !box) return;
    const nums = [];
    box.querySelectorAll('.o24-comment-head b').forEach((b) => {
      const m = /⭐\s*(\d)\/5/.exec(b.textContent || '');
      if (m) nums.push(Number(m[1]));
    });
    if (!nums.length) { avgEl.textContent = ''; return; }
    const avg = (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1);
    avgEl.textContent = '⭐ ' + avg + '/5 (' + nums.length + ')';
  }

  async function removeHistoryItem(tid) {
    try {
      const gh = JSON.parse(localStorage.getItem('o24_guest_history') || '[]');
      localStorage.setItem('o24_guest_history', JSON.stringify(gh.filter((h) => String(h.title_id) !== String(tid))));
    } catch (e) {}
    const { data: sess } = await sb.auth.getSession();
    if (sess && sess.session) await sb.from('history').delete().eq('user_id', sess.session.user.id).eq('title_id', tid);
    ['continueRow', 'historyRow'].forEach((rid) => {
      const el = $(rid);
      if (!el) return;
      el.querySelectorAll('.o24-card[data-open="' + tid + '"]').forEach((c) => c.remove());
      if (!el.querySelector('.o24-card')) el.innerHTML = '<p class="o24-empty">' + (rid === 'continueRow' ? 'Nada para continuar.' : 'O teu histórico está vazio.') + '</p>';
    });
    notify('Removido do histórico.');
  }

  async function clearAllHistory() {
    if (!confirm('Limpar todo o teu histórico e "Continuar a assistir"?')) return;
    try { localStorage.removeItem('o24_guest_history'); } catch (e) {}
    const { data: sess } = await sb.auth.getSession();
    if (sess && sess.session) await sb.from('history').delete().eq('user_id', sess.session.user.id);
    if ($('continueRow')) $('continueRow').innerHTML = '<p class="o24-empty">Nada para continuar.</p>';
    if ($('historyRow')) $('historyRow').innerHTML = '<p class="o24-empty">O teu histórico está vazio.</p>';
    notify('Histórico limpo ✅');
  }

  function optimizeGrid(grid) {
    if (!grid) return;
    grid.querySelectorAll('img').forEach((img) => {
      const s = img.getAttribute('src') || '';
      if (s.indexOf('image.tmdb.org/t/p/w500/') !== -1) img.src = s.replace('image.tmdb.org/t/p/w500/', 'image.tmdb.org/t/p/w300/');
    });
    if (grid.id === 'continueRow' || grid.id === 'historyRow') {
      grid.querySelectorAll('.o24-card[data-open]').forEach((c) => {
        if (!c.querySelector('.o24-card-rm')) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'o24-card-rm'; b.textContent = '✕'; b.dataset.rmHist = c.dataset.open;
          c.appendChild(b);
        }
      });
    }
    if (grid.id === 'gridHome') {
      const cards = Array.from(grid.querySelectorAll('.o24-card'));
      cards.forEach((c, i) => c.classList.toggle('o24-paged-hidden', i >= gridLimit));
      let btn = $('loadMoreBtn');
      const rest = cards.length - gridLimit;
      if (rest > 0) {
        if (!btn) { btn = document.createElement('button'); btn.id = 'loadMoreBtn'; btn.type = 'button'; btn.className = 'btn-secondary o24-load-more'; grid.parentNode.appendChild(btn); }
        btn.textContent = 'Ver mais (+' + rest + ')';
        btn.classList.remove('hidden');
      } else if (btn) btn.classList.add('hidden');
    }
  }

function syncPlayerExtraUI() {
    const v = $('player'), isVid = v && !v.classList.contains('hidden');
    ['rw10Btn', 'ff10Btn', 'speedSel'].forEach((id) => { if ($(id)) $(id).classList.toggle('hidden', !isVid); });
    if (isVid && $('speedSel')) { $('speedSel').value = '1'; v.playbackRate = 1; }
  }

  function setupInjectedUI() {
    const tb = $('tmdbBox');
    if (tb && !$('iaSearchBtn')) {
      tb.insertAdjacentHTML('beforeend',
        '<div style="margin:8px 0"><button type="button" id="useTrailerBtn" class="btn-secondary" style="width:100%;padding:9px 12px;font-size:13px">▶ Usar Trailer como Vídeo</button></div>' +
        '<h4 style="margin-top:10px">Buscar vídeo público (Archive.org)</h4>' +
        '<div class="tmdb-row"><input id="iaQuery" type="search" placeholder="Nome em inglês (ex: Night of the Living Dead)"><button type="button" id="iaSearchBtn" class="btn-secondary">Buscar</button></div>' +
        '<div id="iaResults" class="tmdb-results"></div>');
    }
    if (tb && !$('adminStats')) tb.insertAdjacentHTML('beforebegin', '<div id="adminStats" class="o24-stats"></div>');
    if ($('addEp') && !$('addSeasonBtn')) $('addEp').insertAdjacentHTML('afterend', ' <button type="button" id="addSeasonBtn" class="btn-secondary">＋ Nova Temporada</button>');
    const pt = document.querySelector('.player-tools');
    if (pt && !$('rw10Btn')) {
      pt.insertAdjacentHTML('afterbegin',
        '<button type="button" id="rw10Btn" class="btn-secondary hidden">⏪ 10s</button>' +
        '<button type="button" id="ff10Btn" class="btn-secondary hidden">10s ⏩</button>' +
        '<select id="speedSel" class="hidden" aria-label="Velocidade"><option value="1">1x</option><option value="1.25">1.25x</option><option value="1.5">1.5x</option><option value="2">2x</option></select>');
    }
    if ($('tmCommentsWrap') && !$('tmRelatedWrap')) {
      $('tmCommentsWrap').insertAdjacentHTML('beforebegin', '<div id="tmRelatedWrap" class="tm-related hidden"><h3>Também podes gostar</h3><div id="tmRelatedRow" class="row"></div></div>');
      const ch = $('tmCommentsWrap').querySelector('h3');
      if (ch && !$('tmCommAvg')) ch.insertAdjacentHTML('beforeend', '<span id="tmCommAvg" class="o24-comm-avg"></span>');
    }
    const hr = $('historyRow');
    if (hr && hr.previousElementSibling && !$('clearHistBtn')) {
      hr.previousElementSibling.classList.add('o24-h2-row');
      hr.previousElementSibling.insertAdjacentHTML('beforeend', '<button type="button" id="clearHistBtn" class="o24-clear-hist">Limpar histórico</button>');
    }
    if (!$('scrollTopBtn')) document.body.insertAdjacentHTML('beforeend', '<button type="button" id="scrollTopBtn" class="o24-scroll-top hidden" aria-label="Voltar ao topo">⬆</button>');
  }

  function initExtras() {
    setupInjectedUI();
    try { const k = localStorage.getItem(KEY_ST); if (k && $('tmdbKeyInput')) $('tmdbKeyInput').value = k; } catch (e) {}
    if ($('tmdbSearchBtn')) $('tmdbSearchBtn').addEventListener('click', searchTmdb);
    if ($('tmdbQuery')) $('tmdbQuery').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchTmdb(); });
    if ($('tmdbResults')) $('tmdbResults').addEventListener('click', (e) => { const b = e.target.closest('[data-tmdb-id]'); if (b) fillFromTmdb(b.dataset.tmdbId, b.dataset.tmdbType); });
    if ($('useTrailerBtn')) $('useTrailerBtn').addEventListener('click', useTrailerAsVideo);
    if ($('iaSearchBtn')) $('iaSearchBtn').addEventListener('click', searchArchive);
    if ($('iaQuery')) $('iaQuery').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchArchive(); });
    if ($('iaResults')) $('iaResults').addEventListener('click', (e) => { const b = e.target.closest('[data-ia-id]'); if (b) fillFromArchive(b.dataset.iaId, b.dataset.iaTitle, b.dataset.iaYear); });
    if ($('openReqBtn')) $('openReqBtn').addEventListener('click', () => openReqModal('pedido', ''));
    if ($('tmReportBtn')) $('tmReportBtn').addEventListener('click', () => openReqModal('reporte', $('tmTitle') ? $('tmTitle').textContent.trim() : ''));
    if ($('reqClose')) $('reqClose').addEventListener('click', closeReqModal);
    if ($('reqModal')) $('reqModal').addEventListener('click', (e) => { if (e.target === $('reqModal')) closeReqModal(); });
    if ($('reqSubmit')) $('reqSubmit').addEventListener('click', submitRequest);
    if ($('clearHistBtn')) $('clearHistBtn').addEventListener('click', clearAllHistory);
    if ($('scrollTopBtn')) $('scrollTopBtn').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    if ($('rw10Btn')) $('rw10Btn').addEventListener('click', () => { const v = $('player'); if (v) v.currentTime = Math.max(0, (v.currentTime || 0) - 10); });
    if ($('ff10Btn')) $('ff10Btn').addEventListener('click', () => { const v = $('player'); if (v) v.currentTime = Math.min(isFinite(v.duration) ? v.duration : 999999, (v.currentTime || 0) + 10); });
    if ($('speedSel')) $('speedSel').addEventListener('change', () => { const v = $('player'); if (v) v.playbackRate = Number($('speedSel').value) || 1; });
    if ($('player')) { $('player').addEventListener('loadedmetadata', syncPlayerExtraUI); new MutationObserver(syncPlayerExtraUI).observe($('player'), { attributes: true, attributeFilter: ['class'] }); }
    ['adminBtn', 'fabAdmin', 'fabAdd'].forEach((id) => { if ($(id)) $(id).addEventListener('click', () => setTimeout(() => { loadAdminRequests(); loadAdminStats(); }, 150)); });
    if ($('saveAdmin')) $('saveAdmin').addEventListener('click', () => setTimeout(() => { titlesCache = null; loadAdminStats(); }, 1200));
    if ($('addEp')) $('addEp').addEventListener('click', () => setTimeout(() => {
      const rows = $('episodesWrap').querySelectorAll('.o24-eprow');
      if (rows.length >= 2) {
        const prev = rows[rows.length - 2], cur = rows[rows.length - 1];
        cur.querySelector('.ep-season').value = prev.querySelector('.ep-season').value || 1;
        cur.querySelector('.ep-num').value = (Number(prev.querySelector('.ep-num').value) || 0) + 1;
      }
    }, 0));
    if ($('addSeasonBtn')) $('addSeasonBtn').addEventListener('click', () => {
      let maxS = 1;
      $('episodesWrap').querySelectorAll('.ep-season').forEach((i) => { maxS = Math.max(maxS, Number(i.value) || 1); });
      $('addEp').click();
      setTimeout(() => {
        const rows = $('episodesWrap').querySelectorAll('.o24-eprow'), cur = rows[rows.length - 1];
        if (cur) { cur.querySelector('.ep-season').value = rows.length > 1 ? maxS + 1 : 1; cur.querySelector('.ep-num').value = 1; }
      }, 10);
    });
    if ($('adminRequestsList')) $('adminRequestsList').addEventListener('click', async (e) => {
      const d = e.target.closest('[data-req-done]'), del = e.target.closest('[data-req-del]');
      if (d) { await sb.from('requests').update({ status: 'resolvido' }).eq('id', d.dataset.reqDone); loadAdminRequests(); loadAdminStats(); notify('Marcado como resolvido ✅'); }
      else if (del) { await sb.from('requests').delete().eq('id', del.dataset.reqDel); loadAdminRequests(); loadAdminStats(); notify('Registo apagado.'); }
    });
    document.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-rm-hist]');
      if (rm) { e.stopPropagation(); removeHistoryItem(rm.dataset.rmHist); return; }
      if (e.target.id === 'loadMoreBtn') { gridLimit += 24; optimizeGrid($('gridHome')); return; }
      const op = e.target.closest('[data-open]');
      if (op) { lastOpenedId = op.dataset.open; if ($('titleModal')) $('titleModal').scrollTop = 0; }
    }, true);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('reqModal') && !$('reqModal').classList.contains('hidden')) closeReqModal(); });
    window.addEventListener('scroll', () => { if ($('scrollTopBtn')) $('scrollTopBtn').classList.toggle('hidden', window.scrollY < 400); }, { passive: true });
    window.addEventListener('offline', () => notify('Sem ligação à internet.'));
    window.addEventListener('online', () => notify('Ligação restabelecida ✅'));
    if ($('titleModal')) new MutationObserver(() => { if (!$('titleModal').classList.contains('hidden')) loadRelated(); }).observe($('titleModal'), { attributes: true, attributeFilter: ['class'] });
    if ($('tmCommentsList')) new MutationObserver(updateCommunityAvg).observe($('tmCommentsList'), { childList: true });
    ['topRow', 'catGrid', 'filmGrid', 'seriesGrid', 'animeGrid', 'musicGrid', 'continueRow', 'historyRow', 'gridHome'].forEach((id) => {
      const el = $(id);
      if (!el) return;
      optimizeGrid(el);
      new MutationObserver(() => { if (id === 'gridHome') gridLimit = 24; optimizeGrid(el); }).observe(el, { childList: true });
    });
    sb.auth.onAuthStateChange((evt, sess) => { if (evt === 'SIGNED_IN' && sess && sess.user) syncGuestToAccount(sess.user.id); });
  }

  initExtras();
})();

