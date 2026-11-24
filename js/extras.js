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
