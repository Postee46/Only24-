/* ONLY24²⁴ — js/app.js (versão completa com Player Universal) */
(function () {
  'use strict';

  const CFG = window.ONLY24_CONFIG || {};
  if (!window.supabase || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
    alert('Erro: falta a configuração do Supabase (js/config.js).');
    return;
  }
  const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  /* ============ HELPERS ============ */
  const $ = (id) => document.getElementById(id);
  const show = (el) => el && el.classList.remove('hidden');
  const hide = (el) => el && el.classList.add('hidden');
  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const toInt = (v) => { const n = parseInt(v, 10); return isNaN(n) ? null : n; };
  const toNum = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } };

  const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="100%" height="100%" fill="#15151c"/>' +
    '<text x="50%" y="50%" fill="#e50914" font-family="Arial" font-size="28" font-weight="700" text-anchor="middle">ONLY24</text></svg>'
  );

  const TYPE_LABEL = { filme: 'Filme', serie: 'Série', anime: 'Anime', musica: 'Vídeo musical' };
  const CAT_LABEL = {
    acao: 'Ação', drama: 'Drama', terror: 'Terror', comedia: 'Comédia',
    romance: 'Romance', ficcao: 'Ficção', animacao: 'Animação', documentario: 'Documentário',
    afrobeat: 'Afrobeat', kuduro: 'Kuduro', semba: 'Semba', kizomba: 'Kizomba',
    hiphop: 'Hip-Hop', gospel: 'Gospel', pop: 'Pop', rnb: 'R&B', outros: 'Outros'
  };
  const MOVIE_GENRES = ['acao', 'drama', 'terror', 'comedia', 'romance', 'ficcao', 'animacao', 'documentario'];
  const MUSIC_GENRES = ['afrobeat', 'kuduro', 'semba', 'kizomba', 'hiphop', 'gospel', 'pop', 'rnb', 'outros'];
  const NAV_TYPE = { filmes: 'filme', series: 'serie', anime: 'anime', musica: 'musica' };
  const NAV_LABEL = { filmes: 'Filmes', series: 'Séries', anime: 'Animes', musica: 'Entretenimento', mylist: 'Minha Lista' };
  const MODAL_IDS = ['playerModal', 'authModal', 'notifModal', 'adminPanel', 'titleModal'];

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    show(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hide(t), 3500);
  }

  function hasOpenModal() {
    return MODAL_IDS.some((id) => {
      const el = $(id);
      return el && !el.classList.contains('hidden');
    });
  }

  function syncBodyLock() {
    document.body.classList.toggle('modal-open', hasOpenModal());
  }

  function showModal(id) {
    show($(id));
    syncBodyLock();
  }

  function hideModal(id) {
    hide($(id));
    syncBodyLock();
  }

  function hideSplash() {
    const splash = $('splash');
    if (!splash || splash.classList.contains('hidden')) return;
    splash.classList.add('fade-out');
    setTimeout(() => hide(splash), 400);
  }

  function ts(s) {
    if (!s) return 0;
    let str = String(s).replace(' ', 'T');
    if (!/(Z|[+-]\d\d(:?\d\d)?)$/.test(str)) str += 'Z';
    const d = new Date(str).getTime();
    return isNaN(d) ? 0 : d;
  }
  const fmtDate = (s) => { const t = ts(s); return t ? new Date(t).toLocaleDateString('pt-PT') : ''; };

  function typeOf(t) {
    const x = norm(t && t.type);
    if (x.indexOf('serie') === 0) return 'serie';
    if (x.indexOf('anime') === 0) return 'anime';
    if (x.indexOf('music') === 0 || x.indexOf('entret') === 0 || x.indexOf('clipe') === 0) return 'musica';
    return 'filme';
  }
  function hasEpisodes(t) { const x = typeOf(t); return x === 'serie' || x === 'anime'; }
  function metaLine(t) {
    const parts = [];
    if (t.year) parts.push(t.year);
    parts.push(TYPE_LABEL[typeOf(t)]);
    if (t.cat) parts.push(CAT_LABEL[t.cat] || t.cat);
    if (t.rating) parts.push('⭐ ' + t.rating);
    return parts.join(' • ');
  }
  const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

  function parseQualities(q) {
    try { if (typeof q === 'string') q = JSON.parse(q); } catch (e) { return []; }
    return Array.isArray(q) ? q.filter((x) => x && x.url) : [];
  }

  function authError(e) {
    const m = (e && e.message) || String(e);
    if (/invalid login/i.test(m)) return 'Email ou senha incorretos.';
    if (/already registered|already been registered/i.test(m)) return 'Este email já tem conta.';
    if (/not confirmed/i.test(m)) return 'Confirma o teu email antes de entrar.';
    if (/password/i.test(m) && /6/.test(m)) return 'A senha deve ter pelo menos 6 caracteres.';
    if (/rate limit/i.test(m)) return 'Muitas tentativas. Espera um pouco.';
    return m;
  }

  /* ============ ESTADO ============ */
  const S = {
    user: null, profile: null, isAdmin: false,
    titles: [], map: new Map(),
    favs: new Set(), history: [],
    nav: 'home', query: '',
    current: null, episodes: [], epsPromise: null,
    playing: null, seekSec: null, resumeFrac: 0, lastSave: 0,
    authMode: 'login',
    editingId: null, removedEps: [],
    notifs: [], heroIdx: 0, hero: null,
    dlFirst: null
  };

  function setGenreOptions(type, current) {
    const music = type === 'musica';
    const list = music ? MUSIC_GENRES : MOVIE_GENRES;
    const fg = $('fGenre');
    if (!fg) return;
    fg.innerHTML = list.map((g) => '<option value="' + g + '">' + esc(CAT_LABEL[g] || g) + '</option>').join('');
    if (current && list.indexOf(current) !== -1) fg.value = current;
    if ($('fCast')) $('fCast').placeholder = music ? 'Artista(s)' : 'Elenco';
    if ($('fSynopsis')) $('fSynopsis').placeholder = music ? 'Descrição / letra' : 'Sinopse';
  }

  /* ============ DADOS ============ */
  async function loadTitles() {
    const { data, error } = await sb.from('titles').select('*').order('created_at', { ascending: false }).range(0, 999);
    if (error) { console.error(error); toast('Erro ao carregar o catálogo.'); return; }
    S.titles = data || [];
    S.map = new Map(S.titles.map((t) => [t.id, t]));
  }

  async function loadEpisodes(titleId) {
    const { data, error } = await sb.from('episodes').select('*').eq('title_id', titleId)
      .order('season', { ascending: true }).order('ep_number', { ascending: true });
    if (error) { console.error(error); return []; }
    return data || [];
  }

  async function loadFavs() {
    const { data } = await sb.from('favorites').select('title_id').eq('user_id', S.user.id);
    S.favs = new Set((data || []).map((r) => r.title_id));
  }

  async function loadHistory() {
    const { data } = await sb.from('history').select('*').eq('user_id', S.user.id)
      .order('updated_at', { ascending: false }).limit(40);
    S.history = (data || []).map((h) => Object.assign({}, h, { progress: Number(h.progress) || 0 }));
  }

  async function loadNotifs() {
    const { data } = await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(30);
    S.notifs = data || [];
    updateBell();
  }

  async function refreshUser() {
    const { data } = await sb.auth.getSession();
    S.user = data && data.session ? data.session.user : null;
    S.profile = null;
    S.isAdmin = false;
    S.favs = new Set();
    S.history = [];
    if (S.user) {
      const { data: p } = await sb.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
      S.profile = p || null;
      S.isAdmin = !!(p && p.role === 'admin');
      await Promise.all([loadFavs(), loadHistory()]);
    }
    updateUserUI();
  }
/* ============ UTILIZADOR / AUTH ============ */
  function updateUserUI() {
    const meta = (S.user && S.user.user_metadata) || {};
    const name = (S.profile && S.profile.name) || meta.name || (S.user && S.user.email) || '';
    const letter = $('avatarLetter');
    if (letter) letter.textContent = S.user && name ? name.trim().charAt(0).toUpperCase() : '👤';
    if (S.isAdmin) { show($('adminBtn')); show($('fabAdmin')); show($('fabAdd')); }
    else { hide($('adminBtn')); hide($('fabAdmin')); hide($('fabAdd')); }
    if (!S.user) hide($('userMenu'));
  }

  function setAuthMode(m) {
    S.authMode = m;
    const su = m === 'signup';
    $('authTitle').textContent = su ? 'Criar conta' : 'Entrar';
    $('authSubmit').textContent = su ? 'Criar conta' : 'Entrar';
    $('authSwitch').textContent = su ? 'Já tenho conta' : 'Criar conta nova';
    su ? show($('authName')) : hide($('authName'));
    $('authPass').setAttribute('autocomplete', su ? 'new-password' : 'current-password');
  }
  function openAuth(m) { setAuthMode(m || 'login'); showModal('authModal'); }

  async function submitAuth() {
    const email = $('authEmail').value.trim();
    const pass = $('authPass').value;
    const name = $('authName').value.trim();
    const su = S.authMode === 'signup';
    if (!email || !pass) return toast('Preenche o email e a senha.');
    if (su && pass.length < 6) return toast('A senha deve ter pelo menos 6 caracteres.');
    const btn = $('authSubmit');
    btn.disabled = true;
    try {
      if (su) {
        const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { name } } });
        if (error) throw error;
        if (!data.session) { toast('Conta criada! Confirma o teu email e depois entra.'); setAuthMode('login'); }
        else { hideModal('authModal'); toast('Bem-vindo ao ONLY24²⁴!'); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        hideModal('authModal');
        toast('Sessão iniciada.');
      }
      $('authPass').value = '';
    } catch (e) {
      toast(authError(e));
    } finally {
      btn.disabled = false;
    }
  }

  /* ============ RENDER ============ */
  function cardHTML(t, progress) {
    const bar = progress != null ? '<div class="bar"><i style="width:' + Math.round(progress * 100) + '%"></i></div>' : '';
    return '<div class="o24-card" data-open="' + esc(t.id) + '" tabindex="0" role="button" aria-label="' + esc(t.name) + '">' +
      (t.featured && progress == null ? '<span class="o24-badge">DESTAQUE</span>' : '') +
      '<img loading="lazy" src="' + esc(t.poster || PLACEHOLDER) + '" alt="' + esc(t.name) + '">' + bar +
      '<div class="cn">' + esc(t.name) + '</div>' +
      '<div class="cm">' + esc(TYPE_LABEL[typeOf(t)] + (t.year ? ' • ' + t.year : '')) + '</div></div>';
  }
  const wrap = (list) => list.map((t) => ({ t, p: null }));

  function fill(id, items, emptyMsg) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = items.length
      ? items.map((x) => cardHTML(x.t, x.p)).join('')
      : '<p class="o24-empty">' + esc(emptyMsg) + '</p>';
  }

  function favTitles() { return S.titles.filter((t) => S.favs.has(t.id)); }
  function histItems() { return S.history.map((h) => ({ t: S.map.get(h.title_id), p: h.progress })).filter((x) => x.t); }

  function renderHero() {
    const pool = S.titles.filter((t) => t.featured);
    const list = pool.length ? pool : S.titles;
    const bg = $('heroBg');
    if (!list.length) {
      S.hero = null;
      if (bg) hide(bg);
      $('heroTitle').textContent = 'Bem-vindo ao ONLY24²⁴';
      $('heroMeta').textContent = '';
      $('heroDesc').textContent = 'Filmes, séries e animes num só lugar.';
      return;
    }
    const t = list[S.heroIdx % list.length];
    S.hero = t;
    if (bg) {
      bg.src = t.backdrop || t.poster || PLACEHOLDER;
      show(bg);
    }
    $('heroTitle').textContent = t.name;
    $('heroMeta').textContent = metaLine(t);
    $('heroDesc').textContent = cut(t.synopsis, 180);
  }

  function renderHome() {
    const all = S.titles;
    const feat = all.filter((t) => t.featured);
    const needLogin = 'Entra na tua conta para ver isto.';
    fill('catGrid', wrap((feat.length ? feat : all).slice(0, 18)), 'Ainda não há títulos. O administrador pode adicionar conteúdo.');
    fill('filmGrid', wrap(all.filter((t) => typeOf(t) === 'filme').slice(0, 24)), 'Sem filmes por agora.');
    fill('seriesGrid', wrap(all.filter((t) => typeOf(t) === 'serie').slice(0, 24)), 'Sem séries por agora.');
    fill('animeGrid', wrap(all.filter((t) => typeOf(t) === 'anime').slice(0, 24)), 'Sem animes por agora.');
    fill('musicGrid', wrap(all.filter((t) => typeOf(t) === 'musica').slice(0, 24)), 'Sem vídeos musicais por agora.');
    const hist = histItems();
    fill('continueRow', hist.filter((x) => x.p > 0.02 && x.p < 0.95), S.user ? 'Nada para continuar.' : needLogin);
    fill('historyRow', hist, S.user ? 'O teu histórico está vazio.' : needLogin);
    fill('myList', wrap(favTitles()), S.user ? 'A tua lista está vazia.' : needLogin);
  }

  function searchTitles(q) {
    const n = norm(q);
    return S.titles.filter((t) => norm([t.name, t.cast_list, t.cat, CAT_LABEL[t.cat], t.type, t.synopsis, t.year].join(' ')).indexOf(n) !== -1);
  }

  function renderView() {
    const sr = $('searchResults');
    const hs = $('homeSections');
    const h2 = sr.querySelector('h2');
    const q = S.query.trim();
    const hero = $('hero');

    if (q) {
      hide(hero); show(sr); hide(hs);
      h2.textContent = 'Resultados para "' + q + '"';
      fill('gridHome', wrap(searchTitles(q)), 'Nada encontrado.');
      return;
    }
    if (S.nav === 'home') {
      show(hero); hide(sr); show(hs);
      renderHome();
      return;
    }
    hide(hero); show(sr); hide(hs);
    h2.textContent = NAV_LABEL[S.nav] || '';
    if (S.nav === 'mylist') {
      fill('gridHome', wrap(favTitles()), S.user ? 'A tua lista está vazia.' : 'Entra na tua conta para ver a tua lista.');
    } else {
      const type = NAV_TYPE[S.nav];
      fill('gridHome', wrap(S.titles.filter((t) => typeOf(t) === type)), 'Sem conteúdo nesta categoria.');
    }
  }

  function renderAll() { renderHero(); renderView(); }

  function setNav(n) {
    S.nav = n;
    S.query = '';
    const si = $('searchInput');
    if (si) si.value = '';
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === n));
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============ FAVORITOS ============ */
  function updateFavBtn() {
    const b = $('tmFav');
    if (!b || !S.current) return;
    b.textContent = S.favs.has(S.current.id) ? '✓ Na Minha Lista' : '＋ Minha Lista';
  }

  async function toggleFav(id) {
    if (!S.user) { openAuth('login'); return toast('Entra para guardar na tua lista.'); }
    if (S.favs.has(id)) {
      const { error } = await sb.from('favorites').delete().eq('user_id', S.user.id).eq('title_id', id);
      if (error) return toast('Erro ao remover.');
      S.favs.delete(id);
      toast('Removido da lista.');
    } else {
      const { error } = await sb.from('favorites').insert({ user_id: S.user.id, title_id: id });
      if (error) return toast('Erro ao guardar.');
      S.favs.add(id);
      toast('Adicionado à lista.');
    }
    updateFavBtn();
    renderView();
  }

  /* ============ FICHA DO TÍTULO ============ */
  function prepareEpisodes(t) {
    S.episodes = [];
    if (!hasEpisodes(t)) { S.epsPromise = Promise.resolve([]); renderEpisodes(); return S.epsPromise; }
    S.epsPromise = loadEpisodes(t.id).then((list) => {
      if (S.current && S.current.id === t.id) { S.episodes = list; renderEpisodes(); }
      return list;
    });
    return S.epsPromise;
  }

  function renderEpisodes() {
    const box = $('tmEpisodes');
    const eps = S.episodes;
    if (!eps.length) { box.innerHTML = ''; return; }
    const seasons = {};
    eps.forEach((e) => { const s = e.season || 1; (seasons[s] = seasons[s] || []).push(e); });
    let h = '<div class="o24-eps"><div class="o24-eps-head"><label><input type="checkbox" id="epAll"> Selecionar tudo</label>' +
      '<button type="button" class="btn-secondary" id="epDl">⬇ Baixar selecionados</button></div>';
    Object.keys(seasons).sort((a, b) => a - b).forEach((s) => {
      h += '<h4>Temporada ' + esc(s) + '</h4>';
      seasons[s].forEach((e) => {
        h += '<div class="ep"><input type="checkbox" class="epChk" value="' + esc(e.id) + '">' +
          '<div class="ep-info"><b>EP ' + esc(e.ep_number) + '</b> ' + esc(e.title || '') + '</div>' +
          '<button type="button" class="btn-secondary" data-play-ep="' + esc(e.id) + '">▶</button></div>';
      });
    });
    box.innerHTML = h + '</div>';
  }

  function openTitle(id) {
    const t = S.map.get(id);
    if (!t) return;
    S.current = t;
    $('tmBackdrop').src = t.backdrop || t.poster || PLACEHOLDER;
    $('tmPoster').src = t.poster || PLACEHOLDER;
    $('tmTitle').textContent = t.name;
    $('tmMeta').textContent = metaLine(t);
    $('tmDesc').textContent = t.synopsis || '';
    $('tmCast').textContent = t.cast_list ? (typeOf(t) === 'musica' ? 'Artista: ' : 'Elenco: ') + t.cast_list : '';
    t.trailer ? show($('tmTrailer')) : hide($('tmTrailer'));
    updateFavBtn();
    $('tmEpisodes').innerHTML = '';
    showModal('titleModal');
    prepareEpisodes(t);
  }

  async function playFromModal() {
    const t = S.current;
    if (!t) return;
    await S.epsPromise;
    if (hasEpisodes(t) && S.episodes.length) {
      const h = S.history.find((x) => x.title_id === t.id);
      const ep = h && h.episode_id ? S.episodes.find((e) => e.id === h.episode_id) : null;
      playItem(t, ep || S.episodes[0]);
    } else {
      playItem(t, null);
    }
  }

  async function quickPlay(t) {
    if (!t) return toast('Ainda não há conteúdo.');
    S.current = t;
    await prepareEpisodes(t);
    playFromModal();
  }
/* ============ DOWNLOADS ============ */
  function fileName(t, ep) {
    const base = (t.name + (ep ? ' T' + (ep.season || 1) + 'E' + ep.ep_number : ''))
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_');
    const url = ep ? ep.video_url : t.video_url;
    const m = /\.(mp4|mkv|webm|mov|m4v|avi)(\?|$)/i.exec(url || '');
    return base + '.' + (m ? m[1].toLowerCase() : 'mp4');
  }
  function dlHref(url, name) {
    if (url.indexOf('/storage/v1/object/public/') !== -1 && url.indexOf('?') === -1) {
      return url + '?download=' + encodeURIComponent(name);
    }
    return url;
  }
  function triggerDownload(url, name) {
    const a = document.createElement('a');
    a.href = dlHref(url, name);
    a.download = name;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function downloadSelected() {
    const ids = Array.prototype.map.call(document.querySelectorAll('#tmEpisodes .epChk:checked'), (x) => x.value);
    if (!ids.length) return toast('Seleciona pelo menos um episódio.');
    const list = S.episodes.filter((e) => ids.indexOf(e.id) !== -1 && e.video_url);
    if (!list.length) return toast('Os episódios selecionados não têm vídeo.');
    toast('A iniciar ' + list.length + ' download(s)...');
    for (const e of list) {
      triggerDownload(e.video_url, fileName(S.current, e));
      await sleep(900);
    }
  }

  /* ============ PLAYER UNIVERSAL ============ */
  let hlsInstance = null;

  function destroyHls() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
  }

  function parseVideoSource(raw) {
    let url = String(raw || '').trim();
    if (!url) return null;

    // Se colarem um código <iframe src="...">, extrai o link automaticamente
    const ifr = /<iframe[^>]+src=["']([^"']+)["']/i.exec(url);
    if (ifr) url = ifr[1].trim();

    // YouTube (watch, youtu.be, shorts, live, embed)
    const yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i.exec(url);
    if (yt) {
      return { kind: 'iframe', url: 'https://www.youtube.com/embed/' + yt[1] + '?autoplay=1&rel=0', isEmbed: true };
    }

    // Google Drive
    const gd = /drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?&#]+)/i.exec(url);
    if (gd) {
      return { kind: 'iframe', url: 'https://drive.google.com/file/d/' + gd[1] + '/preview', isEmbed: true };
    }

    // Vimeo
    const vm = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
    if (vm && url.indexOf('player.vimeo.com') === -1) {
      return { kind: 'iframe', url: 'https://player.vimeo.com/video/' + vm[1] + '?autoplay=1', isEmbed: true };
    }

    // Dailymotion
    const dm = /(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/i.exec(url);
    if (dm) {
      return { kind: 'iframe', url: 'https://www.dailymotion.com/embed/video/' + dm[1] + '?autoplay=1', isEmbed: true };
    }

    // Outros links de embed/iframe
    if (/(\/embed\/|\/preview\b|player\.vimeo\.com|ok\.ru\/videoembed|streamtape\.com\/e\/|dood\.)/i.test(url)) {
      return { kind: 'iframe', url: url, isEmbed: true };
    }

    // Stream HLS (.m3u8)
    if (/\.m3u8(\?|$)/i.test(url)) {
      return { kind: 'hls', url: url, isEmbed: false };
    }

    // Vídeo direto (MP4, WebM, MOV, MKV, OGG, etc.)
    return { kind: 'video', url: url, isEmbed: false };
  }

  function setMediaSource(rawUrl, autoplay) {
    const v = $('player');
    const emb = $('embedPlayer');
    const parsed = parseVideoSource(rawUrl);
    destroyHls();
    v.pause();
    v.removeAttribute('src');
    v.load();

    if (!parsed) return null;

    if (parsed.kind === 'iframe') {
      hide(v);
      if (emb) {
        emb.src = parsed.url;
        show(emb);
      }
      return parsed;
    }

    if (emb) {
      emb.src = 'about:blank';
      hide(emb);
    }
    show(v);

    if (parsed.kind === 'hls' && window.Hls && window.Hls.isSupported()) {
      hlsInstance = new window.Hls();
      hlsInstance.loadSource(parsed.url);
      hlsInstance.attachMedia(v);
      hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (S.seekSec != null) { v.currentTime = S.seekSec; S.seekSec = null; }
        else if (S.resumeFrac && isFinite(v.duration)) { v.currentTime = S.resumeFrac * v.duration; S.resumeFrac = 0; }
        if (autoplay) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      });
      hlsInstance.on(window.Hls.Events.ERROR, (ev, data) => {
        if (data && data.fatal) toast('Erro ao carregar o stream (.m3u8).');
      });
    } else {
      v.src = parsed.url;
      if (autoplay) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    }
    return parsed;
  }

  function setupQualities(t, ep, src) {
    const sel = $('qualityList');
    if (!sel) return;
    const q = ep ? [] : parseQualities(t.qualities);
    if (!q.length) { hide(sel); return; }
    show(sel);
    sel.innerHTML = '<option value="">Qualidade / Servidor</option><option value="' + esc(src) + '">Original</option>' +
      q.map((x) => '<option value="' + esc(x.url) + '">' + esc(x.label || 'Opção') + '</option>').join('');
    sel.value = '';
  }

  function setupSubtitles(t, v, isEmbed) {
    const sel = $('subtitleList');
    if (!sel) return;
    if (isEmbed || !t.subtitle) { hide(sel); return; }
    show(sel);
    sel.innerHTML = '<option value="">Sem legendas</option><option value="pt">Português</option>';
    sel.value = '';
    const tr = document.createElement('track');
    tr.kind = 'subtitles';
    tr.label = 'Português';
    tr.srclang = 'pt';
    tr.src = t.subtitle;
    v.appendChild(tr);
    tr.track.mode = 'disabled';
  }

  function setupDownloads(t, ep, src, isEmbed) {
    const box = $('dlList');
    const btn = $('downloadBtn');
    if (!box) return;
    const name = fileName(t, ep);
    const links = [];
    if (t.download && !ep) links.push({ label: 'Download', url: t.download });
    if (!ep && !isEmbed) parseQualities(t.qualities).forEach((q) => links.push({ label: 'Download ' + (q.label || ''), url: q.url }));
    if (!links.length && src && !isEmbed) links.push({ label: 'Download vídeo', url: src });
    S.dlFirst = links[0] ? { url: links[0].url, name } : null;
    if (btn) S.dlFirst ? show(btn) : hide(btn);
    box.innerHTML = links.map((l) =>
      '<a class="btn-secondary o24-dl" href="' + esc(dlHref(l.url, name)) + '" target="_blank" rel="noopener" download="' + esc(name) + '">⬇ ' + esc(l.label) + '</a>'
    ).join('');
  }

  function playItem(t, ep) {
    const src = ep ? ep.video_url : t.video_url;
    if (!src) { toast('Este conteúdo ainda não tem vídeo.'); return; }
    const v = $('player');
    S.playing = { title: t, ep: ep || null };
    $('playerTitle').textContent = t.name +
      (ep ? ' — T' + (ep.season || 1) + ' EP' + ep.ep_number + (ep.title ? ': ' + ep.title : '') : '');
    v.querySelectorAll('track').forEach((x) => x.remove());
    const h = S.history.find((x) => x.title_id === t.id && (!ep || x.episode_id === ep.id));
    S.seekSec = null;
    S.resumeFrac = h && h.progress > 0.02 && h.progress < 0.95 ? h.progress : 0;

    const parsed = setMediaSource(src, true);
    if (!parsed) { toast('Link de vídeo inválido.'); return; }
    setupQualities(t, ep, src);
    setupSubtitles(t, v, parsed.isEmbed);
    setupDownloads(t, ep, src, parsed.isEmbed);
    showModal('playerModal');
    t.views = (t.views || 0) + 1;
    sb.rpc('increment_views', { tid: t.id }).then(() => {}, () => {});
  }

  function playTrailer(t) {
    if (!t || !t.trailer) return;
    const v = $('player');
    S.playing = null;
    S.seekSec = null;
    S.resumeFrac = 0;
    $('playerTitle').textContent = t.name + ' — Trailer';
    v.querySelectorAll('track').forEach((x) => x.remove());
    hide($('qualityList'));
    hide($('subtitleList'));
    hide($('downloadBtn'));
    $('dlList').innerHTML = '';
    const parsed = setMediaSource(t.trailer, true);
    if (!parsed) return toast('Link do trailer inválido.');
    showModal('playerModal');
  }

  async function saveProgress(force) {
    if (!S.user || !S.playing) return;
    const v = $('player');
    if (v.classList.contains('hidden') || !v.duration || !isFinite(v.duration)) return;
    const now = Date.now();
    if (!force && now - S.lastSave < 10000) return;
    S.lastSave = now;
    const row = {
      user_id: S.user.id,
      title_id: S.playing.title.id,
      episode_id: S.playing.ep ? S.playing.ep.id : null,
      progress: Number(Math.min(1, v.currentTime / v.duration).toFixed(4)),
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from('history').upsert(row, { onConflict: 'user_id,title_id' });
    if (error) { console.error(error); return; }
    const i = S.history.findIndex((h) => h.title_id === row.title_id);
    if (i >= 0) S.history.splice(i, 1);
    S.history.unshift(row);
  }

  async function closePlayer() {
    const v = $('player');
    const emb = $('embedPlayer');
    v.pause();
    destroyHls();
    hideModal('playerModal');
    await saveProgress(true);
    S.playing = null;
    v.removeAttribute('src');
    v.querySelectorAll('track').forEach((x) => x.remove());
    v.load();
    if (emb) {
      emb.src = 'about:blank';
      hide(emb);
    }
    renderView();
  }

  function playNext() {
    if (!S.playing || !S.playing.ep || !S.current || S.current.id !== S.playing.title.id) return;
    const i = S.episodes.findIndex((e) => e.id === S.playing.ep.id);
    const next = i >= 0 ? S.episodes[i + 1] : null;
    if (next) { toast('A seguir: EP ' + next.ep_number); playItem(S.playing.title, next); }
  }

  /* ============ NOTIFICAÇÕES ============ */
  function visibleNotifs() {
    const c = Number(lsGet('o24_notif_clear') || 0);
    return S.notifs.filter((n) => ts(n.created_at) > c);
  }
  function updateBell() {
    const seen = Number(lsGet('o24_notif_seen') || 0);
    const has = visibleNotifs().some((n) => ts(n.created_at) > seen);
    has ? show($('bellDot')) : hide($('bellDot'));
  }
  async function openNotifs() {
    await loadNotifs();
    const list = visibleNotifs();
    $('notifList').innerHTML = list.length
      ? list.map((n) =>
        '<div class="o24-notif"' + (n.title_id ? ' data-open="' + esc(n.title_id) + '"' : '') + '>' +
        '<b>' + esc(n.title) + '</b><span>' + esc(n.description || '') + '</span><small>' + esc(fmtDate(n.created_at)) + '</small></div>'
      ).join('')
      : '<p class="o24-empty">Sem notificações.</p>';
    lsSet('o24_notif_seen', String(Date.now()));
    updateBell();
    showModal('notifModal');
  }

  /* ============ ADMIN ============ */
  const TEXT_FIELDS = ['fTitle', 'fYear', 'fRating', 'fSynopsis', 'fCast', 'fTrailer', 'fSubtitle', 'fDownload', 'fVideoUrl', 'fQualities', 'fPoster', 'fBackdrop'];
  const FILE_FIELDS = ['fPosterFile', 'fVideoFile', 'fSubtitleFile'];

  function resetAdminForm() {
    TEXT_FIELDS.forEach((id) => { const el = $(id); if (el) el.value = ''; });
    FILE_FIELDS.forEach((id) => { const el = $(id); if (el) el.value = ''; });
    $('fFeatured').checked = false;
    $('fType').selectedIndex = 0;
    setGenreOptions('filme');
    $('episodesWrap').innerHTML = '';
    S.editingId = null;
    S.removedEps = [];
    $('saveAdmin').textContent = 'Salvar Título';
  }

  function fillNotifSelect() {
    const sel = $('notifTitleId');
    if (!sel) return;
    sel.innerHTML = '<option value="">Sem título ligado</option>' +
      S.titles.map((t) => '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>').join('');
  }

  function renderAdminList() {
    const box = $('adminList');
    const list = S.titles.slice().sort((a, b) => (b.views || 0) - (a.views || 0));
    box.innerHTML = list.length
      ? list.map((t) =>
        '<div class="o24-arow"><div class="o24-ainfo"><b>' + esc(t.name) + '</b><small>' + esc(TYPE_LABEL[typeOf(t)]) + ' • 👁 ' + (t.views || 0) + '</small></div>' +
        '<button type="button" class="btn-secondary" data-edit="' + esc(t.id) + '">Editar</button>' +
        '<button type="button" class="btn-secondary" data-del="' + esc(t.id) + '">Apagar</button></div>'
      ).join('')
      : '<p class="o24-empty">Ainda não há títulos.</p>';
  }

  function openAdmin(fresh) {
    if (!S.isAdmin) return toast('Só o administrador pode abrir o painel.');
    if (fresh) resetAdminForm();
    renderAdminList();
    fillNotifSelect();
    showModal('adminPanel');
  }

  function addEpRow(ep) {
    ep = ep || {};
    const wrapEl = $('episodesWrap');
    const next = wrapEl.querySelectorAll('.o24-eprow').length + 1;
    const div = document.createElement('div');
    div.className = 'o24-eprow';
    if (ep.id) div.dataset.id = ep.id;
    div.innerHTML =
      '<input class="ep-season" type="number" min="1" placeholder="Temporada" value="' + esc(ep.season || 1) + '">' +
      '<input class="ep-num" type="number" min="1" placeholder="Episódio" value="' + esc(ep.ep_number || next) + '">' +
      '<input class="ep-title" placeholder="Título do episódio" value="' + esc(ep.title || '') + '">' +
      '<input class="ep-url" placeholder="Link do vídeo" value="' + esc(ep.video_url || '') + '">' +
      '<label class="ep-filelbl">Vídeo ficheiro <input class="ep-file" type="file" accept="video/*"></label>' +
      '<button type="button" class="btn-secondary ep-del">Remover episódio</button>';
    wrapEl.appendChild(div);
  }

  async function uploadFile(file, folder) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    const path = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
    const opts = { cacheControl: '31536000', upsert: false };
    if (ext === 'vtt') opts.contentType = 'text/vtt';
    else if (file.type) opts.contentType = file.type;
    const { error } = await sb.storage.from('media').upload(path, file, opts);
    if (error) {
      if (/size|large|exceed/i.test(error.message)) {
        throw new Error('Ficheiro demasiado grande (limite grátis: 50 MB). Usa um link externo.');
      }
      throw new Error('Falha no upload: ' + error.message);
    }
    return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
  }
async function saveAdmin() {
    if (!S.isAdmin) return;
    const name = $('fTitle').value.trim();
    if (!name) return toast('Escreve o título.');
    let qualities = null;
    const qraw = $('fQualities').value.trim();
    if (qraw) {
      try { qualities = JSON.parse(qraw); if (!Array.isArray(qualities)) throw new Error('x'); }
      catch (e) { return toast('Qualidades: JSON inválido.'); }
    }
    const btn = $('saveAdmin');
    btn.disabled = true;
    btn.textContent = 'A guardar...';
    try {
      let poster = $('fPoster').value.trim();
      const pf = $('fPosterFile').files[0];
      if (pf) { toast('A enviar poster...'); poster = await uploadFile(pf, 'posters'); }

      let video = $('fVideoUrl').value.trim();
      const vf = $('fVideoFile').files[0];
      if (vf) { toast('A enviar vídeo (pode demorar)...'); video = await uploadFile(vf, 'videos'); }
      if (!video && qualities && qualities[0] && qualities[0].url) video = qualities[0].url;

      let subtitle = $('fSubtitle').value.trim();
      const sf = $('fSubtitleFile').files[0];
      if (sf) { toast('A enviar legenda...'); subtitle = await uploadFile(sf, 'subs'); }

      const type = $('fType').value;
      const row = {
        name: name,
        type: type,
        cat: $('fGenre').value,
        year: toInt($('fYear').value),
        rating: toNum($('fRating').value),
        synopsis: $('fSynopsis').value.trim() || null,
        cast_list: $('fCast').value.trim() || null,
        featured: $('fFeatured').checked,
        trailer: $('fTrailer').value.trim() || null,
        poster: poster || null,
        backdrop: $('fBackdrop').value.trim() || null,
        video_url: video || null,
        subtitle: subtitle || null,
        download: $('fDownload').value.trim() || null,
        qualities: qualities
      };

      let id = S.editingId;
      if (id) {
        const { error } = await sb.from('titles').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('titles').insert(row).select('id').single();
        if (error) throw error;
        id = data.id;
      }

      if (type === 'serie' || type === 'anime') {
        if (S.removedEps.length) {
          const { error } = await sb.from('episodes').delete().in('id', S.removedEps);
          if (error) throw error;
        }
        const rows = Array.prototype.slice.call($('episodesWrap').querySelectorAll('.o24-eprow'));
        for (const r of rows) {
          let vurl = r.querySelector('.ep-url').value.trim();
          const f = r.querySelector('.ep-file').files[0];
          if (f) { toast('A enviar episódio...'); vurl = await uploadFile(f, 'videos'); }
          const ep = {
            title_id: id,
            season: toInt(r.querySelector('.ep-season').value) || 1,
            ep_number: toInt(r.querySelector('.ep-num').value) || 1,
            title: r.querySelector('.ep-title').value.trim() || null,
            video_url: vurl || null
          };
          const res = r.dataset.id
            ? await sb.from('episodes').update(ep).eq('id', r.dataset.id)
            : await sb.from('episodes').insert(ep);
          if (res.error) throw res.error;
        }
      }

      toast('Título guardado ✅');
      resetAdminForm();
      await loadTitles();
      renderAll();
      renderAdminList();
      fillNotifSelect();
    } catch (e) {
      console.error(e);
      toast('Erro: ' + (e.message || e));
      btn.textContent = S.editingId ? 'Atualizar Título' : 'Salvar Título';
    } finally {
      btn.disabled = false;
      if (!S.editingId) btn.textContent = 'Salvar Título';
    }
  }

  async function editTitle(id) {
    const t = S.map.get(id);
    if (!t) return;
    resetAdminForm();
    S.editingId = id;
    $('fTitle').value = t.name || '';
    $('fType').value = typeOf(t);
    setGenreOptions(typeOf(t), t.cat);
    $('fYear').value = t.year || '';
    $('fRating').value = t.rating || '';
    $('fSynopsis').value = t.synopsis || '';
    $('fCast').value = t.cast_list || '';
    $('fFeatured').checked = !!t.featured;
    $('fTrailer').value = t.trailer || '';
    $('fSubtitle').value = t.subtitle || '';
    $('fDownload').value = t.download || '';
    $('fVideoUrl').value = t.video_url || '';
    const q = parseQualities(t.qualities);
    $('fQualities').value = q.length ? JSON.stringify(q) : '';
    $('fPoster').value = t.poster || '';
    $('fBackdrop').value = t.backdrop || '';
    $('saveAdmin').textContent = 'Atualizar Título';
    if (hasEpisodes(t)) {
      const eps = await loadEpisodes(id);
      eps.forEach(addEpRow);
    }
    const box = $('adminPanel').querySelector('.modal-box');
    $('adminPanel').scrollTop = 0;
    if (box) box.scrollTop = 0;
    toast('A editar: ' + t.name);
  }

  async function deleteTitle(id) {
    const t = S.map.get(id);
    if (!t) return;
    if (!confirm('Apagar "' + t.name + '"? Não pode ser desfeito.')) return;
    try {
      await sb.from('episodes').delete().eq('title_id', id);
      await sb.from('favorites').delete().eq('title_id', id);
      await sb.from('history').delete().eq('title_id', id);
      const { error } = await sb.from('titles').delete().eq('id', id);
      if (error) throw error;
      toast('Título apagado.');
      await loadTitles();
      renderAll();
      renderAdminList();
      fillNotifSelect();
    } catch (e) {
      toast('Erro ao apagar: ' + (e.message || e));
    }
  }

  async function sendNotif() {
    if (!S.isAdmin) return;
    const title = $('notifTitle').value.trim();
    if (!title) return toast('Escreve o título da notificação.');
    const btn = $('sendNotif');
    btn.disabled = true;
    try {
      const row = {
        title: title,
        description: $('notifBody').value.trim() || null,
        title_id: $('notifTitleId').value || null
      };
      const { error } = await sb.from('notifications').insert(row);
      if (error) throw error;
      $('notifTitle').value = '';
      $('notifBody').value = '';
      $('notifTitleId').value = '';
      toast('Notificação enviada ✅');
      loadNotifs();
    } catch (e) {
      toast('Erro: ' + (e.message || e));
    } finally {
      btn.disabled = false;
    }
  }

  /* ============ INSTALAR APP (PWA) ============ */
  let deferredPrompt = null;
  async function doInstall() {
    if (!deferredPrompt) return toast('A instalação não está disponível neste momento.');
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (e) { /* ignore */ }
    deferredPrompt = null;
    hide($('installBtn'));
    hide($('installBanner'));
  }

  /* ============ EVENTOS ============ */
  function bindEvents() {
    // imagens quebradas
    document.addEventListener('error', (e) => {
      const el = e.target;
      if (el && el.tagName === 'IMG' && el.getAttribute('src') !== PLACEHOLDER && el.id !== 'avatarImg') el.src = PLACEHOLDER;
    }, true);

    // cartões / notificações -> abrir ficha
    document.addEventListener('click', (e) => {
      const c = e.target.closest('[data-open]');
      if (c) { hideModal('notifModal'); openTitle(c.dataset.open); return; }
      if (!e.target.closest('#userMenu') && !e.target.closest('#avatarBtn')) hide($('userMenu'));
    });

    // acessibilidade teclado nos cards + ESC para fechar modais
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('.o24-card[data-open]')) {
        openTitle(e.target.dataset.open);
        return;
      }
      if (e.key === 'Escape') {
        if (!$('playerModal').classList.contains('hidden')) { closePlayer(); return; }
        for (const id of ['authModal', 'notifModal', 'adminPanel', 'titleModal']) {
          if ($(id) && !$(id).classList.contains('hidden')) { hideModal(id); return; }
        }
      }
    });

    // fechar ao tocar fora
    ['titleModal', 'notifModal', 'authModal'].forEach((id) => {
      const m = $(id);
      if (m) m.addEventListener('click', (e) => { if (e.target === m) hideModal(id); });
    });

    // topo
    on('logo', 'click', () => setNav('home'));
    document.querySelectorAll('.nav-btn').forEach((b) => b.addEventListener('click', () => setNav(b.dataset.nav)));

    let st;
    on('searchInput', 'input', () => { clearTimeout(st); st = setTimeout(() => { S.query = $('searchInput').value; renderView(); }, 250); });
    on('searchInput', 'keydown', (e) => { if (e.key === 'Enter') { S.query = $('searchInput').value; renderView(); e.target.blur(); } });
    on('searchBtn', 'click', () => { S.query = $('searchInput').value; renderView(); });

    on('bellBtn', 'click', openNotifs);
    on('notifClose', 'click', () => hideModal('notifModal'));
    on('notifClear', 'click', () => {
      lsSet('o24_notif_clear', String(Date.now()));
      $('notifList').innerHTML = '<p class="o24-empty">Sem notificações.</p>';
      updateBell();
    });

    on('avatarBtn', 'click', () => {
      if (!S.user) return openAuth('login');
      const m = $('userMenu');
      m.classList.toggle('hidden');
    });
    on('logoutBtn', 'click', async () => { hide($('userMenu')); await sb.auth.signOut(); toast('Sessão terminada.'); });
    on('adminBtn', 'click', () => { hide($('userMenu')); openAdmin(false); });
    on('fabAdmin', 'click', () => openAdmin(false));
    on('fabAdd', 'click', () => openAdmin(true));

    // auth
    on('closeAuth', 'click', () => hideModal('authModal'));
    on('authSwitch', 'click', () => setAuthMode(S.authMode === 'login' ? 'signup' : 'login'));
    on('authSubmit', 'click', submitAuth);
    on('authPass', 'keydown', (e) => { if (e.key === 'Enter') submitAuth(); });

    // hero
    on('heroPlay', 'click', () => quickPlay(S.hero));
    on('heroInfo', 'click', () => { if (S.hero) openTitle(S.hero.id); });

    // ficha
    on('tmClose', 'click', () => hideModal('titleModal'));
    on('tmPlay', 'click', playFromModal);
    on('tmFav', 'click', () => { if (S.current) toggleFav(S.current.id); });
    on('tmTrailer', 'click', () => { if (S.current && S.current.trailer) playTrailer(S.current); });
    const eb = $('tmEpisodes');
    eb.addEventListener('click', (e) => {
      const p = e.target.closest('[data-play-ep]');
      if (p) {
        const ep = S.episodes.find((x) => x.id === p.dataset.playEp);
        if (ep && S.current) playItem(S.current, ep);
        return;
      }
      if (e.target.id === 'epDl') downloadSelected();
    });
    eb.addEventListener('change', (e) => {
      if (e.target.id === 'epAll') eb.querySelectorAll('.epChk').forEach((c) => { c.checked = e.target.checked; });
    });

    // player
    const v = $('player');
    on('closePlayer', 'click', closePlayer);
    v.addEventListener('loadedmetadata', () => {
      if (S.seekSec != null) { v.currentTime = S.seekSec; S.seekSec = null; }
      else if (S.resumeFrac && isFinite(v.duration)) { v.currentTime = S.resumeFrac * v.duration; S.resumeFrac = 0; }
    });
    v.addEventListener('error', () => {
      const src = v.getAttribute('src');
      if (!src) return;
      if (location.protocol === 'https:' && /^http:\/\//i.test(src)) {
        toast('Links http:// são bloqueados pelo navegador em sites HTTPS. Usa https://.');
      } else if (S.playing) {
        toast('Erro ao carregar o vídeo. Verifica o link ou formato.');
      }
    });
    v.addEventListener('timeupdate', () => saveProgress(false));
    v.addEventListener('pause', () => saveProgress(true));
    v.addEventListener('ended', () => { saveProgress(true).then(playNext); });
    on('qualityList', 'change', () => {
      const url = $('qualityList').value;
      if (!url) return;
      const was = !v.paused || !$('embedPlayer').classList.contains('hidden');
      S.seekSec = !v.classList.contains('hidden') && v.currentTime ? v.currentTime : null;
      const parsed = setMediaSource(url, was);
      if (parsed && S.playing) setupSubtitles(S.playing.title, v, parsed.isEmbed);
    });
    on('subtitleList', 'change', () => {
      const on_ = !!$('subtitleList').value;
      for (let i = 0; i < v.textTracks.length; i++) v.textTracks[i].mode = on_ ? 'showing' : 'disabled';
    });
    on('downloadBtn', 'click', () => {
      if (S.dlFirst) triggerDownload(S.dlFirst.url, S.dlFirst.name);
      else toast('Sem link de download.');
    });

    // admin
    on('adminClose', 'click', () => hideModal('adminPanel'));
    on('fType', 'change', () => setGenreOptions($('fType').value));
    on('addEp', 'click', () => addEpRow());
    on('saveAdmin', 'click', saveAdmin);
    on('sendNotif', 'click', sendNotif);
    $('episodesWrap').addEventListener('click', (e) => {
      if (!e.target.classList.contains('ep-del')) return;
      const row = e.target.closest('.o24-eprow');
      if (row && row.dataset.id) S.removedEps.push(row.dataset.id);
      if (row) row.remove();
    });
    $('adminList').addEventListener('click', (e) => {
      const ed = e.target.closest('[data-edit]');
      const dl = e.target.closest('[data-del]');
      if (ed) editTitle(ed.dataset.edit);
      else if (dl) deleteTitle(dl.dataset.del);
    });

    // instalar
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      show($('installBtn'));
      show($('installBanner'));
    });
    window.addEventListener('appinstalled', () => { hide($('installBtn')); hide($('installBanner')); deferredPrompt = null; });
    on('installBtn', 'click', doInstall);
    on('installNow', 'click', doInstall);
    on('installLater', 'click', () => hide($('installBanner')));
  }

  /* ============ INÍCIO ============ */
  async function init() {
    setGenreOptions('filme');
    bindEvents();
    try {
      await refreshUser();
      await Promise.all([loadTitles(), loadNotifs()]);
    } catch (e) {
      console.error(e);
      toast('Erro ao ligar ao servidor.');
    }
    renderAll();
    hideSplash();

    setInterval(() => {
      if (S.nav === 'home' && !S.query && S.titles.length > 1 && !hasOpenModal()) {
        S.heroIdx++;
        renderHero();
      }
    }, 8000);

    sb.auth.onAuthStateChange((evt) => {
      if (evt === 'INITIAL_SESSION') return;
      setTimeout(async () => {
        await refreshUser();
        renderAll();
      }, 0);
    });
  }

  init();
})();