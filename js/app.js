/* ONLY24²⁴ — js/app.js (versão completa) */
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

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    show(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hide(t), 3500);
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
    notifs: [], heroIdx: 0, hero: null
  };

  /* ============ ESTILOS EXTRA ============ */
  function injectStyles() {
    const css = `
.hidden{display:none!important}
:where(.grid){display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px}
:where(.row){display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
.o24-card{position:relative;cursor:pointer;border-radius:10px;overflow:hidden;background:#15151c;border:1px solid #2a2a33}
.row .o24-card{flex:0 0 120px}
.o24-card img{width:100%;aspect-ratio:2/3;object-fit:cover;display:block;background:#1b1b22}
.o24-card .cn{padding:6px 8px 2px;font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.o24-card .cm{padding:0 8px 8px;font-size:11px;color:#9a9aa6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.o24-card .bar{height:3px;background:#333}
.o24-card .bar i{display:block;height:100%;background:#e50914}
.o24-badge{position:absolute;top:6px;left:6px;background:#e50914;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;z-index:1}
.o24-empty{color:#9a9aa6;font-size:14px;padding:8px 2px}
.o24-eps{margin-top:14px}
.o24-eps-head{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;color:#fff}
.o24-eps h4{margin:12px 0 6px;color:#e50914}
.o24-eps .ep{display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #2a2a33;color:#fff}
.o24-eps .ep-info{flex:1;font-size:14px}
.o24-notif{padding:10px;border-bottom:1px solid #2a2a33;color:#fff;display:flex;flex-direction:column;gap:2px}
.o24-notif[data-open]{cursor:pointer}
.o24-notif span{color:#cfcfd6;font-size:14px}
.o24-notif small{color:#8a8a96}
.o24-eprow{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0;padding:8px;border:1px solid #2a2a33;border-radius:8px}
.o24-eprow input{width:100%;box-sizing:border-box}
.o24-eprow .ep-title,.o24-eprow .ep-url,.o24-eprow .ep-filelbl,.o24-eprow .ep-del{grid-column:1/-1}
.o24-arow{display:flex;align-items:center;gap:6px;padding:8px 0;border-bottom:1px solid #2a2a33;color:#fff}
.o24-ainfo{flex:1;display:flex;flex-direction:column;min-width:0}
.o24-ainfo b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.o24-ainfo small{color:#9a9aa6}
.o24-dl{display:inline-block;margin:4px 6px 0 0;text-decoration:none}
#fVideoUrl{width:100%;box-sizing:border-box}
`;
    const st = document.createElement('style');
    st.id = 'o24-extra-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function prepareUI() {
    // secção "Filmes" no início (o index.html não tem)
    const sg = $('seriesGrid');
    if (sg && !$('filmGrid')) {
      const anchor = sg.previousElementSibling;
      const h = document.createElement('h2');
      h.textContent = 'Filmes';
      const g = document.createElement('div');
      g.id = 'filmGrid';
      g.className = 'grid';
      sg.parentNode.insertBefore(h, anchor);
      sg.parentNode.insertBefore(g, anchor);
    }
    // campo "link do vídeo" no painel admin
    const q = $('fQualities');
    if (q && !$('fVideoUrl')) {
      const inp = document.createElement('input');
      inp.id = 'fVideoUrl';
      inp.placeholder = 'Link do vídeo MP4 (filmes)';
      q.parentNode.insertBefore(inp, q);
    }
    hide($('avatarImg'));

    // tipo "Vídeo musical" no painel admin
    const ft = $('fType');
    if (ft && !ft.querySelector('option[value="musica"]')) {
      const o = document.createElement('option');
      o.value = 'musica';
      o.textContent = 'Vídeo musical (Entretenimento)';
      ft.appendChild(o);
    }
    // botão "Entretenimento" no menu
    const nav = $('mainNav');
    if (nav && !nav.querySelector('[data-nav="musica"]')) {
      const b = document.createElement('button');
      b.className = 'nav-btn';
      b.dataset.nav = 'musica';
      b.textContent = 'Entretenimento';
      nav.insertBefore(b, nav.querySelector('[data-nav="mylist"]'));
    }
    // secção "Entretenimento" no início
    const ag = $('animeGrid');
    if (ag && !$('musicGrid')) {
      const anchor = ag.nextElementSibling;
      const h = document.createElement('h2');
      h.textContent = 'Entretenimento';
      const g = document.createElement('div');
      g.id = 'musicGrid';
      g.className = 'grid';
      ag.parentNode.insertBefore(h, anchor);
      ag.parentNode.insertBefore(g, anchor);
    }
    setGenreOptions('filme');
  }

  function setGenreOptions(type, current) {
    const music = type === 'musica';
    const list = music ? MUSIC_GENRES : MOVIE_GENRES;
    $('fGenre').innerHTML = list.map((g) => '<option value="' + g + '">' + esc(CAT_LABEL[g] || g) + '</option>').join('');
    if (current && list.indexOf(current) !== -1) $('fGenre').value = current;
    $('fCast').placeholder = music ? 'Artista(s)' : 'Elenco';
    $('fSynopsis').placeholder = music ? 'Descrição / letra' : 'Sinopse';
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
  function openAuth(m) { setAuthMode(m || 'login'); show($('authModal')); }

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
        else { hide($('authModal')); toast('Bem-vindo ao ONLY24²⁴!'); }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        hide($('authModal'));
        toast('Sessão iniciada.');
      }
      $('authPass').value = '';
    } catch (e) {
      toast(authError(e));
    } finally {
      btn.disabled = false;
    }
  }

    
