
// ONLY24 v4 - app.js
// Requer Supabase JS v2 e js/config.js carregado antes deste ficheiro.

let supabaseClient = null;
let currentUser = null;
let isAdminUser = false;
let allTitles = [];
let currentTitle = null;
let currentEpisode = null;
let authMode = 'login';
let deferredPrompt = null;

const $ = id => document.getElementById(id);

function toast(message) {
  const element = $('toast');
  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;
  element.classList.remove('hidden');

  clearTimeout(element._timer);
  element._timer = setTimeout(() => {
    element.classList.add('hidden');
  }, 3000);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function show(element) {
  if (element) element.classList.remove('hidden');
}

function hide(element) {
  if (element) element.classList.add('hidden');
}

function openModal(id) {
  show($(id));
}

function closeModal(id) {
  hide($(id));
}

function initSupabase() {
  const config = window.ONLY24_CONFIG;

  if (!config || !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    toast('Configuração Supabase incompleta.');
    console.error('Verifica js/config.js');
    return false;
  }

  if (!window.supabase || !window.supabase.createClient) {
    toast('Supabase não foi carregado.');
    console.error('Verifica o script CDN do Supabase no index.html');
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );
    return true;
  } catch (error) {
    console.error(error);
    toast('Erro ao iniciar Supabase.');
    return false;
  }
}

// -------------------------
// AUTENTICAÇÃO
// -------------------------

async function checkSession() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error(error);
    return;
  }

  currentUser = data.session?.user || null;
  await updateUserInterface();

  if (currentUser) {
    await checkAdmin();
  }

  await loadTitles();
}

async function updateUserInterface() {
  const avatarLetter = $('avatarLetter');
  const avatarImg = $('avatarImg');

  if (!currentUser) {
    if (avatarLetter) avatarLetter.textContent = 'U';
    if (avatarImg) {
      avatarImg.src = '';
      avatarImg.style.display = 'none';
    }
    hide($('adminBtn'));
    hide($('fabAdmin'));
    hide($('fabAdd'));
    return;
  }

  const name =
    currentUser.user_metadata?.name ||
    currentUser.email?.split('@')[0] ||
    'Utilizador';

  if (avatarLetter) {
    avatarLetter.textContent = name.charAt(0).toUpperCase();
  }

  const photo = currentUser.user_metadata?.avatar_url;

  if (avatarImg && photo) {
    avatarImg.src = photo;
    avatarImg.style.display = 'block';
    if (avatarLetter) avatarLetter.style.display = 'none';
  } else {
    if (avatarImg) avatarImg.style.display = 'none';
    if (avatarLetter) avatarLetter.style.display = 'block';
  }

  await updateUserInterfaceAdmin();
}

async function updateUserInterfaceAdmin() {
  if (isAdminUser) {
    show($('adminBtn'));
    show($('fabAdmin'));
    show($('fabAdd'));
  } else {
    hide($('adminBtn'));
    hide($('fabAdmin'));
    hide($('fabAdd'));
  }
}

async function checkAdmin() {
  isAdminUser = false;

  if (!currentUser) {
    await updateUserInterfaceAdmin();
    return;
  }

  // O administrador deve ser autorizado no servidor através de RLS.
  // Esta verificação só mostra ou esconde os controlos da interface.
  if (
    currentUser.app_metadata?.role === 'admin' ||
    currentUser.user_metadata?.role === 'admin'
  ) {
    isAdminUser = true;
  }

  // Opcional: tabela profiles com coluna role = 'admin'.
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (!error && data?.role === 'admin') {
      isAdminUser = true;
    }
  } catch (error) {
    console.warn('Não foi possível consultar profiles:', error);
  }

  await updateUserInterfaceAdmin();
}

async function submitAuth() {
  if (!supabaseClient) return;

  const email = $('authEmail')?.value.trim();
  const password = $('authPass')?.value;
  const name = $('authName')?.value.trim();

  if (!email || !password) {
    toast('Preenche o email e a palavra-passe.');
    return;
  }

  const button = $('authSubmit');
  if (button) button.disabled = true;

  try {
    if (authMode === 'register') {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { name: name || email.split('@')[0] }
        }
      });

      if (error) throw error;

      if (data.session) {
        currentUser = data.user;
        toast('Conta criada com sucesso!');
        closeModal('authModal');
        await checkAdmin();
        await updateUserInterface();
        await loadTitles();
      } else {
        toast('Conta criada. Confirma o teu email para entrar.');
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      currentUser = data.user;
      closeModal('authModal');
      toast('Sessão iniciada!');
      await checkAdmin();
      await updateUserInterface();
      await loadTitles();
    }
  } catch (error) {
    console.error(error);
    toast(error.message || 'Não foi possível autenticar.');
  } finally {
    if (button) button.disabled = false;
  }
}

async function logout() {
  if (!supabaseClient) return;

  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    toast(error.message);
    return;
  }

  currentUser = null;
  isAdminUser = false;
  toast('Sessão terminada.');
  await updateUserInterface();
  await loadTitles();
}

function switchAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';

  if ($('authTitle')) {
    $('authTitle').textContent =
      authMode === 'login' ? 'Entrar' : 'Criar conta';
  }

  if ($('authName')) {
    $('authName').classList.toggle('hidden', authMode === 'login');
  }

  if ($('authSubmit')) {
    $('authSubmit').textContent =
      authMode === 'login' ? 'Entrar' : 'Criar conta';
  }

  if ($('authSwitch')) {
    $('authSwitch').textContent =
      authMode === 'login'
        ? 'Ainda não tens conta? Criar conta'
        : 'Já tens conta? Entrar';
  }
}

// -------------------------
// CONTEÚDOS
// -------------------------

async function loadTitles() {
  if (!supabaseClient) return;

  const { data, error } = await supabaseClient
    .from('titles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar títulos:', error);
    toast('Não foi possível carregar os conteúdos.');
    return;
  }

  allTitles = data || [];
  renderAll();
}

function cardHTML(title) {
  const image = title.poster || 'icon.svg';
  const id = esc(title.id);

  return `
    <div class="card" onclick="openTitle('${id}')">
      ${title.featured ? '<span class="badge">Destaque</span>' : ''}
      <img
        src="${esc(image)}"
        loading="lazy"
        alt="${esc(title.name)}"
        onerror="this.src='icon.svg'"
      >
      <div class="card-info">
        <h3>${esc(title.name)}</h3>
        <p>
          ${esc(title.type || '')}
          • ${esc(title.year || '')}
          • ⭐ ${esc(title.rating || '8.0')}
        </p>
      </div>
    </div>
  `;
}

function renderAll() {
  const filmes = allTitles.filter(t => t.type === 'filme');
  const series = allTitles.filter(t => t.type === 'serie');
  const animes = allTitles.filter(t => t.type === 'anime');
  const featured = allTitles.filter(t => t.featured);

  if ($('catGrid')) {
    $('catGrid').innerHTML =
      (featured.length ? featured : allTitles.slice(0, 12))
        .map(cardHTML).join('') ||
      '<p class="empty">Ainda não há conteúdos disponíveis.</p>';
  }

  if ($('seriesGrid')) {
    $('seriesGrid').innerHTML =
      series.map(cardHTML).join('') ||
      '<p class="empty">Ainda não há séries.</p>';
  }

  if ($('animeGrid')) {
    $('animeGrid').innerHTML =
      animes.map(cardHTML).join('') ||
      '<p class="empty">Ainda não há animes.</p>';
  }

  if ($('gridHome')) {
    $('gridHome').innerHTML =
      filmes.map(cardHTML).join('') ||
      '<p class="empty">Ainda não há filmes.</p>';
  }

  const hero = featured[0] || allTitles[0];

  if (hero) {
    if ($('heroBg')) {
      $('heroBg').src = hero.backdrop || hero.poster || '';
    }

    if ($('heroTitle')) $('heroTitle').textContent = hero.name || '';
    if ($('heroMeta')) {
      $('heroMeta').textContent =
        `${hero.type || ''} • ${hero.year || ''} • ⭐ ${hero.rating || '8.0'}`;
    }
    if ($('heroDesc')) {
      $('heroDesc').textContent = hero.synopsis || '';
    }

    if ($('heroPlay')) {
      $('heroPlay').onclick = () => openTitle(hero.id);
    }

    if ($('heroInfo')) {
      $('heroInfo').onclick = () => openTitle(hero.id);
    }
  }

  loadContinue();
  loadHistory();
  loadMyList();
}

function searchTitles() {
  const query = $('searchInput')?.value.trim().toLowerCase();

  if (!query) {
    if ($('searchResults')) $('searchResults').innerHTML = '';
    return;
  }

  const results = allTitles.filter(title => {
    const text = [
      title.name,
      title.type,
      title.cat,
      title.synopsis,
      title.cast_list
    ].join(' ').toLowerCase();

    return text.includes(query);
  });

  if ($('searchResults')) {
    $('searchResults').innerHTML = `
      <h2>Resultados da pesquisa</h2>
      <div class="content-grid">
        ${results.map(cardHTML).join('') ||
          '<p class="empty">Não foram encontrados resultados.</p>'}
      </div>
    `;
    $('searchResults').scrollIntoView({ behavior: 'smooth' });
  }
}

// -------------------------
// DETALHES DO TÍTULO
// -------------------------

window.openTitle = async function(id) {
  const title = allTitles.find(item => String(item.id) === String(id));
  if (!title) return;

  currentTitle = title;

  if ($('tmBackdrop')) {
    $('tmBackdrop').src = title.backdrop || title.poster || '';
  }

  if ($('tmPoster')) {
    $('tmPoster').src = title.poster || 'icon.svg';
  }

  if ($('tmTitle')) $('tmTitle').textContent = title.name || '';

  if ($('tmMeta')) {
    $('tmMeta').textContent =
      `${title.type || ''} • ${title.year || ''} • ⭐ ${title.rating || '8.0'} • ${title.cat || ''}`;
  }

  if ($('tmDesc')) {
    $('tmDesc').textContent = title.synopsis || 'Sem sinopse.';
  }

  if ($('tmCast')) {
    $('tmCast').textContent =
      title.cast_list ? `Elenco: ${title.cast_list}` : '';
  }

  if ($('tmTrailer')) {
    $('tmTrailer').style.display = title.trailer ? 'inline-block' : 'none';
    $('tmTrailer').onclick = () => {
      if (title.trailer) window.open(title.trailer, '_blank', 'noopener');
    };
  }

  if ($('tmPlay')) {
    $('tmPlay').onclick = () => playTitle(title);
  }

  if ($('tmFav')) {
    $('tmFav').onclick = () => toggleFav(title.id);
    $('tmFav').textContent = '＋ Minha Lista';
  }

  const episodeBox = $('tmEpisodes');

  if (episodeBox) {
    episodeBox.innerHTML = '';

    if (title.type !== 'filme') {
      const { data: episodes, error } = await supabaseClient
        .from('episodes')
        .select('*')
        .eq('title_id', title.id)
        .order('season', { ascending: true })
        .order('ep_number', { ascending: true });

      if (error) {
        console.error(error);
        episodeBox.innerHTML =
          '<p class="empty">Não foi possível carregar os episódios.</p>';
      } else if (episodes?.length) {
        episodeBox.innerHTML =
          '<h3>Episódios</h3>' +
          episodes.map(ep => `
            <div class="ep-item">
              <span>
                T${esc(ep.season)} E${esc(ep.ep_number)}
                - ${esc(ep.title || `Episódio ${ep.ep_number}`)}
              </span>
              <button class="btn-primary"
                onclick="playEpisode('${esc(ep.id)}')">
                ▶ Ver
              </button>
            </div>
          `).join('');
      } else {
        episodeBox.innerHTML =
          '<p class="empty">Ainda não existem episódios.</p>';
      }
    }
  }

  await updateFavoriteButton(title.id);
  openModal('titleModal');
};

async function updateFavoriteButton(titleId) {
  if (!currentUser || !$('tmFav')) return;

  const { data, error } = await supabaseClient
    .from('favorites')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('title_id', titleId)
    .maybeSingle();

  if (!error) {
    $('tmFav').textContent = data ? '✓ Na Minha Lista' : '＋ Minha Lista';
  }
}

// -------------------------
// FAVORITOS
// -------------------------

async function toggleFav(titleId) {
  if (!currentUser) {
    toast('Inicia sessão para guardar favoritos.');
    openModal('authModal');
    return;
  }

  const { data, error } = await supabaseClient
    .from('favorites')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('title_id', titleId)
    .maybeSingle();

  if (error) {
    toast(error.message);
    return;
  }

  if (data) {
    const result = await supabaseClient
      .from('favorites')
      .delete()
      .eq('id', data.id);

    if (result.error) {
      toast(result.error.message);
      return;
    }

    toast('Removido da tua lista.');
  } else {
    const result = await supabaseClient
      .from('favorites')
      .insert({
        user_id: currentUser.id,
        title_id: titleId
      });

    if (result.error) {
      toast(result.error.message);
      return;
    }

    toast('Adicionado à tua lista!');
  }

  await updateFavoriteButton(titleId);
  await loadMyList();
}

async function loadMyList() {
  if (!$('myList')) return;

  if (!currentUser) {
    $('myList').innerHTML =
      '<p class="empty">Inicia sessão para ver a tua lista.</p>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('favorites')
    .select('*, titles(*)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    $('myList').innerHTML =
      '<p class="empty">Não foi possível carregar a lista.</p>';
    return;
  }

  $('myList').innerHTML =
    data?.map(item => item.titles ? cardHTML(item.titles) : '').join('') ||
    '<p class="empty">A tua lista está vazia.</p>';
}

// -------------------------
// HISTÓRICO E CONTINUAR
// -------------------------

async function saveHistory(titleId, episodeId = null, position = 0) {
  if (!currentUser) return;

  const { data: existing, error: findError } = await supabaseClient
    .from('history')
    .select('id')
    .eq('user_id', currentUser.id)
    .eq('title_id', titleId)
    .maybeSingle();

  if (findError) {
    console.warn(findError);
    return;
  }

  const record = {
    user_id: currentUser.id,
    title_id: titleId,
    episode_id: episodeId,
    progress: position,
    updated_at: new Date().toISOString()
  };

  let result;

  if (existing) {
    result = await supabaseClient
      .from('history')
      .update(record)
      .eq('id', existing.id);
  } else {
    result = await supabaseClient
      .from('history')
      .insert(record);
  }

  if (result.error) console.warn('Histórico:', result.error);
}

async function loadHistory() {
  if (!$('historyRow')) return;

  if (!currentUser) {
    $('historyRow').innerHTML =
      '<p class="empty">Inicia sessão para ver o histórico.</p>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('history')
    .select('*, titles(*)')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  $('historyRow').innerHTML =
    data?.map(item => item.titles ? cardHTML(item.titles) : '').join('') ||
    '<p class="empty">Sem histórico.</p>';
}

async function loadContinue() {
  if (!$('continueRow')) return;

  if (!currentUser) {
    $('continueRow').innerHTML =
      '<p class="empty">Inicia sessão para continuar a assistir.</p>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('history')
    .select('*, titles(*)')
    .eq('user_id', currentUser.id)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  $('continueRow').innerHTML =
    data?.map(item => item.titles ? cardHTML(item.titles) : '').join('') ||
    '<p class="empty">Ainda não assististe nada.</p>';
}

// -------------------------
// REPRODUÇÃO DE VÍDEO
// -------------------------

function playTitle(title) {
  if (!title) return;

  currentTitle = title;
  currentEpisode = null;

  const video = $('player');
  if (!video) {
    toast('Leitor de vídeo não encontrado.');
    return;
  }

  // O campo esperado na tabela titles é video_url.
  const videoUrl = title.video_url || title.video;

  if (!videoUrl) {
    toast('Este título ainda não tem vídeo associado.');
    return;
  }

  if ($('playerTitle')) $('playerTitle').textContent = title.name || '';

  video.pause();
  video.src = videoUrl;
  video.load();

  openModal('playerModal');
  video.play().catch(() => {
    toast('Carrega no botão de reprodução do vídeo.');
  });

  saveHistory(title.id, null, 0);
}

window.playEpisode = async function(episodeId) {
  const { data: episode, error } = await supabaseClient
    .from('episodes')
    .select('*')
    .eq('id', episodeId)
    .single();

  if (error || !episode) {
    toast('Não foi possível abrir o episódio.');
    console.error(error);
    return;
  }

  const videoUrl = episode.video_url || episode.video;

  if (!videoUrl) {
    toast('Este episódio ainda não tem vídeo associado.');
    return;
  }

  currentEpisode = episode;

  const video = $('player');

  if ($('playerTitle')) {
    $('playerTitle').textContent =
      `${currentTitle?.name || ''} - ${episode.title || 'Episódio'}`;
  }

  video.pause();
  video.src = videoUrl;
  video.load();

  closeModal('titleModal');
  openModal('playerModal');

  video.play().catch(() => {
    toast('Carrega no botão de reprodução do vídeo.');
  });

  if (currentTitle) {
    saveHistory(currentTitle.id, episode.id, 0);
  }
};

function setupPlayer() {
  const video = $('player');
  if (!video) return;

  video.addEventListener('timeupdate', () => {
    if (!currentUser || !currentTitle) return;

    if (video.currentTime > 0 && Math.floor(video.currentTime) % 20 === 0) {
      saveHistory(
        currentTitle.id,
        currentEpisode?.id || null,
        video.currentTime
      );
    }
  });

  video.addEventListener('ended', () => {
    if (currentTitle) {
      saveHistory(
        currentTitle.id,
        currentEpisode?.id || null,
        video.duration || 0
      );
    }
  });

  if ($('closePlayer')) {
    $('closePlayer').onclick = () => {
      video.pause();

      if (currentTitle) {
        saveHistory(
          currentTitle.id,
          currentEpisode?.id || null,
          video.currentTime || 0
        );
      }

      video.removeAttribute('src');
      video.load();
      closeModal('playerModal');
    };
  }
}

// -------------------------
// PAINEL ADMINISTRADOR
// -------------------------

function openAdmin() {
  if (!isAdminUser) {
    toast('Apenas administradores podem aceder.');
    return;
  }

  openModal('adminPanel');
  loadAdminList();
}

async function loadAdminList() {
  if (!isAdminUser || !$('adminList')) return;

  const { data, error } = await supabaseClient
    .from('titles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    toast('Erro ao carregar painel.');
    return;
  }

  $('adminList').innerHTML = (data || []).map(title => `
    <div cl