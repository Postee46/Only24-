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
async function fillFromTmdb(id, mediaType) {
    const key = getTmdbKey();
    if (!key) return;
    notify('A preencher dados...');
    try {
      const url = 'https://api.themoviedb.org/3/' + mediaType + '/' + id +
        '?api_key=' + encodeURIComponent(key) + '&language=pt-PT&append_to_response=credits,videos';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao carregar detalhes do TMDB.');
      const d = await res.json();

      const genres = d.genres || [];
      const isAnim = genres.some((g) => g.id === 16);
      let tipo = mediaType === 'tv' ? 'serie' : 'filme';
      if (mediaType === 'tv' && isAnim && d.original_language === 'ja') tipo = 'anime';

      $('fType').value = tipo;
      $('fType').dispatchEvent(new Event('change'));

      let cat = 'acao';
      for (const g of genres) {
        if (TMDB_GENRE_MAP[g.id]) { cat = TMDB_GENRE_MAP[g.id]; break; }
      }
      if ($('fGenre').querySelector('option[value="' + cat + '"]')) $('fGenre').value = cat;

      $('fTitle').value = d.title || d.name || '';
      $('fYear').value = (d.release_date || d.first_air_date || '').slice(0, 4);
      $('fRating').value = d.vote_average ? Number(d.vote_average).toFixed(1) : '';
      $('fSynopsis').value = d.overview || '';
      $('fCast').value = ((d.credits && d.credits.cast) || []).slice(0, 5).map((c) => c.name).join(', ');
      $('fPoster').value = d.poster_path ? 'https://image.tmdb.org/t/p/w500' + d.poster_path : '';
      $('fBackdrop').value = d.backdrop_path ? 'https://image.tmdb.org/t/p/w1280' + d.backdrop_path : '';

      const vids = (d.videos && d.videos.results) || [];
      const tr = vids.find((v) => v.site === 'YouTube' && v.type === 'Trailer') || vids.find((v) => v.site === 'YouTube');
      if (tr) $('fTrailer').value = 'https://www.youtube.com/watch?v=' + tr.key;

      $('tmdbResults').innerHTML = '';
      notify('Campos preenchidos! Agora cola o link do vídeo e salva.');
    } catch (e) {
      notify(e.message || 'Erro ao preencher.');
    }
        }
/* ============ PEDIDOS E REPORTES ============ */
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
    const anyOpen = ['playerModal', 'authModal', 'profileModal', 'notifModal', 'adminPanel', 'titleModal']
      .some((id) => $(id) && !$(id).classList.contains('hidden'));
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
      const { error } = await sb.from('requests').insert({
        user_id: uid,
        kind: $('reqKind').value,
        title_name: titleName,
        details: $('reqDetails').value.trim() || null
      });
      if (error) throw error;
      closeReqModal();
      notify('Enviado com sucesso! Obrigado pelo feedback ✅');
    } catch (e) {
      notify('Erro ao enviar: ' + (e.message || e));
    } finally {
      btn.disabled = false;
    }
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
      const icon = r.kind === 'reporte' ? '⚠️ Reporte' : '🎬 Pedido';
      return '<div class="o24-req-row">' +
        '<div class="o24-req-top"><b>' + icon + ': ' + esc(r.title_name) + '</b>' +
        '<span class="o24-req-tag' + (done ? ' done' : '') + '">' + esc(r.status) + '</span></div>' +
        (r.details ? '<p>' + esc(r.details) + '</p>' : '') +
        '<div class="o24-req-actions">' +
        (!done ? '<button type="button" class="btn-secondary" data-req-done="' + esc(r.id) + '">✓ Marcar resolvido</button>' : '') +
        '<button type="button" class="btn-secondary" data-req-del="' + esc(r.id) + '">Apagar</button>' +
        '</div></div>';
    }).join('');
  }
/* ============ INICIALIZAÇÃO ============ */
  function initExtras() {
    try {
      const savedKey = localStorage.getItem(TMDB_KEY_STORAGE);
      if (savedKey && $('tmdbKeyInput')) $('tmdbKeyInput').value = savedKey;
    } catch (e) { /* ignore */ }

    if ($('tmdbSearchBtn')) $('tmdbSearchBtn').addEventListener('click', searchTmdb);
    if ($('tmdbQuery')) $('tmdbQuery').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchTmdb(); });
    if ($('tmdbResults')) {
      $('tmdbResults').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tmdb-id]');
        if (btn) fillFromTmdb(btn.dataset.tmdbId, btn.dataset.tmdbType);
      });
    }

    if ($('openReqBtn')) $('openReqBtn').addEventListener('click', () => openReqModal('pedido', ''));
    if ($('tmReportBtn')) {
      $('tmReportBtn').addEventListener('click', () => {
        const t = $('tmTitle') ? $('tmTitle').textContent.trim() : '';
        openReqModal('reporte', t);
      });
    }
    if ($('reqClose')) $('reqClose').addEventListener('click', closeReqModal);
    if ($('reqModal')) $('reqModal').addEventListener('click', (e) => { if (e.target === $('reqModal')) closeReqModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('reqModal') && !$('reqModal').classList.contains('hidden')) closeReqModal();
    });
    if ($('reqSubmit')) $('reqSubmit').addEventListener('click', submitRequest);

    ['adminBtn', 'fabAdmin', 'fabAdd'].forEach((id) => {
      if ($(id)) $(id).addEventListener('click', () => setTimeout(loadAdminRequests, 150));
    });

    if ($('adminRequestsList')) {
      $('adminRequestsList').addEventListener('click', async (e) => {
        const doneBtn = e.target.closest('[data-req-done]');
        const delBtn = e.target.closest('[data-req-del]');
        if (doneBtn) {
          await sb.from('requests').update({ status: 'resolvido' }).eq('id', doneBtn.dataset.reqDone);
          loadAdminRequests();
          notify('Marcado como resolvido ✅');
        } else if (delBtn) {
          await sb.from('requests').delete().eq('id', delBtn.dataset.reqDel);
          loadAdminRequests();
          notify('Registo apagado.');
        }
      });
    }
  }

  initExtras();
})();
