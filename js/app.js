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