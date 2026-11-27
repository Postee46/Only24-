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

