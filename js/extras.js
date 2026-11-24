/* ONLY24²⁴ — js/extras.js (TMDB Auto-Fill + Pedidos/Reportes) */
(function () {
  'use strict';

  const CFG = window.ONLY24_CONFIG || {};
  if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) return;
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TMDB_KEY_STORAGE = 'o24_tmdb_api_key';

  function notify(msg) {
    const t = $('toast');
    if (!t) return alert(msg);
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(window.__o24ExtraToast);
    window.__o24ExtraToast = setTimeout(() => t.classList.add('hidden'), 3500);
  }

  /* ============ TMDB AUTO-FILL ============ */
  const TMDB_GENRE_MAP = {
    28: 'acao', 12: 'acao', 10759: 'acao',
    18: 'drama', 80: 'drama', 9648: 'drama', 10768: 'drama',
    27: 'terror', 53: 'terror',
    35: 'comedia',
    10749: 'romance',
    878: 'ficcao', 14: 'ficcao', 10765: 'ficcao',
    16: 'animacao', 10751: 'animacao',
    99: 'documentario'
  };

  function getTmdbKey() {
    const inp = $('tmdbKeyInput');
    const typed = inp ? inp.value.trim() : '';
    if (typed) {
      try { localStorage.setItem(TMDB_KEY_STORAGE, typed); } catch (e) { /* ignore */ }
      return typed;
    }
    try { return CFG.TMDB_API_KEY || localStorage.getItem(TMDB_KEY_STORAGE) || ''; }
    catch (e) { return CFG.TMDB_API_KEY || ''; }
        }
async function searchTmdb() {
    const key = getTmdbKey();
    if (!key) return notify('Cola a tua Chave API v3 do TMDB primeiro.');
    const q = $('tmdbQuery') ? $('tmdbQuery').value.trim() : '';
    if (!q) return notify('Escreve o nome do filme, série ou anime.');

    const box = $('tmdbResults');
    box.innerHTML = '<small style="color:#aaa">A procurar no TMDB...</small>';
    try {
      const url = 'https://api.themoviedb.org/3/search/multi?api_key=' + encodeURIComponent(key) +
        '&language=pt-PT&query=' + encodeURIComponent(q);
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status === 401 ? 'Chave TMDB inválida.' : 'Erro na busca TMDB.');
      const data = await res.json();
      const list = (data.results || []).filter((x) => x.media_type === 'movie' || x.media_type === 'tv').slice(0, 5);
      if (!list.length) {
        box.innerHTML = '<small style="color:#aaa">Nada encontrado no TMDB.</small>';
        return;
      }
      box.innerHTML = list.map((x) => {
        const title = x.title || x.name || '';
        const year = (x.release_date || x.first_air_date || '').slice(0, 4);
        const kind = x.media_type === 'tv' ? 'Série' : 'Filme';
        const poster = x.poster_path ? 'https://image.tmdb.org/t/p/w92' + x.poster_path : '';
        return '<button type="button" class="tmdb-item" data-tmdb-id="' + x.id + '" data-tmdb-type="' + x.media_type + '">' +
          (poster ? '<img src="' + esc(poster) + '" alt="">' : '') +
          '<div><b>' + esc(title) + '</b><small>' + kind + (year ? ' • ' + year : '') + '</small></div></button>';
      }).join('');
    } catch (e) {
      box.innerHTML = '';
      notify(e.message || 'Erro ao buscar no TMDB.');
    }
      }
