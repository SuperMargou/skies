// API en racine du site
const API_BASE = '/api';
const SESSION_KEY = 'skies_session';

const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
};

const setSession = (session) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

const authHeaders = () => {
  const session = getSession();
  return session?.token
    ? { Authorization: `Bearer ${session.token}` }
    : {};
};

const apiJson = async (path, options = {}) => {
  const session = getSession();
  let body = options.body;
  let url = `${API_BASE}/${path}`;

  // Ajoute le token dans le body JSON ET en query pour maximiser les chances qu'il passe
  if (session?.token) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}token=${encodeURIComponent(session.token)}`;

    if (body && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.token) {
          parsed.token = session.token;
          body = JSON.stringify(parsed);
        }
      } catch (_) {
        // ignore
      }
    }
  }

  const res = await fetch(url, {
    ...options,
    body,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...authHeaders(),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || res.statusText || 'Erreur';
    throw new Error(msg);
  }
  return data;
};

const apiForm = async (path, formData) => {
  const session = getSession();
  if (session?.token && !formData.has('token')) {
    formData.append('token', session.token);
  }
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    body: formData,
    headers: {
      ...authHeaders(),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error || res.statusText || 'Erreur';
    throw new Error(msg);
  }
  return data;
};

const formatTime = (ts) => {
  const millis = typeof ts === 'string' ? Date.parse(ts) : Number(ts) || Date.now();
  const diff = (Date.now() - millis) / 1000;
  if (diff < 60) return "a l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  const d = new Date(millis);
  return d.toLocaleString('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const readFile = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

const setAvatar = (el, handle, avatarUrl = '') => {
  if (!el) return;
  if (avatarUrl) {
    el.style.backgroundImage = `url(${avatarUrl})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.textContent = (handle || '--').slice(0, 2).toUpperCase();
  }
};

const requireSession = () => {
  const session = getSession();
  if (!session?.token || !session?.handle) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
};

const loginWithPassword = async (handle, password) => {
  const data = await apiJson('login.php', {
    method: 'POST',
    body: JSON.stringify({ handle, password }),
  });
  setSession({ token: data.token, handle: data.handle, userId: data.userId, avatarUrl: data.avatarUrl || null });
  return data;
};

const registerAccount = async (handle, password) => {
  const data = await apiJson('register.php', {
    method: 'POST',
    body: JSON.stringify({ handle, password }),
  });
  setSession({ token: data.token, handle: data.handle, userId: data.userId, avatarUrl: data.avatarUrl || null });
  return data;
};

const ensureSession = async () => {
  const session = getSession();
  if (!session?.token) return null;
  try {
    const me = await apiJson('me.php', {
      method: 'POST',
      body: JSON.stringify({ token: session.token }),
    });
    setSession({ ...session, handle: me.handle, userId: me.userId, avatarUrl: me.avatarUrl || session.avatarUrl || null });
    return getSession();
  } catch (err) {
    clearSession();
    return null;
  }
};

const createPost = async ({ text, imageFile }) => {
  const form = new FormData();
  form.append('text', text || '');
  if (imageFile) {
    form.append('image', imageFile);
  }
  return apiForm('create_post.php', form);
};

const fetchFeed = async () => {
  const data = await apiJson('feed.php');
  return data.posts || [];
};

const fetchPost = async (postId) => {
  const data = await apiJson(`post.php?id=${encodeURIComponent(postId)}`);
  return data;
};

const toggleLike = async (postId) => {
  return apiJson('toggle_like.php', {
    method: 'POST',
    body: JSON.stringify({ postId }),
  });
};

const addComment = async (postId, text) => {
  return apiJson('comment.php', {
    method: 'POST',
    body: JSON.stringify({ postId, text }),
  });
};

const addView = async (postId) => {
  return apiJson('add_view.php', {
    method: 'POST',
    body: JSON.stringify({ postId }),
  });
};

const toggleFollow = async (handle) => {
  return apiJson('toggle_follow.php', {
    method: 'POST',
    body: JSON.stringify({ handle }),
  });
};

const fetchThreads = async () => {
  const data = await apiJson('messages.php');
  return data.threads || [];
};

const fetchConversation = async (handle) => {
  const data = await apiJson(`messages.php?handle=${encodeURIComponent(handle)}`);
  return data;
};

const sendMessage = async (handle, text) => {
  return apiJson('send_message.php', {
    method: 'POST',
    body: JSON.stringify({ handle, text }),
  });
};

const searchUsers = async (query) => {
  if (!query) return [];
  const data = await apiJson(`search_users.php?q=${encodeURIComponent(query)}`);
  return data.users || [];
};

const fetchProfile = async (handle) => {
  const h = handle || '';
  const data = await apiJson(`profile.php?handle=${encodeURIComponent(h)}`);
  return data;
};

const updateProfile = async ({ bio, avatarFile }) => {
  const form = new FormData();
  form.append('bio', bio || '');
  if (avatarFile) form.append('avatar', avatarFile);
  return apiForm('update_profile.php', form);
};

const initTopbar = () => {
  const toggle = document.getElementById('menu-toggle');
  const actions = document.querySelector('.user-actions');
  if (!toggle || !actions) return;

  const close = () => actions.classList.remove('open');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    actions.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!actions.contains(e.target) && e.target !== toggle) {
      close();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 640) close();
  });
};

export const Skies = {
  getSession,
  setSession,
  clearSession,
  requireSession,
  ensureSession,
  claimHandle: registerAccount,
  loginWithPassword,
  registerAccount,
  createPost,
  fetchFeed,
  fetchPost,
  toggleLike,
  addComment,
  addView,
  toggleFollow,
  fetchThreads,
  fetchConversation,
  sendMessage,
  searchUsers,
  fetchProfile,
  updateProfile,
  formatTime,
  readFile,
  setAvatar,
  initTopbar,
};

window.Skies = Skies;
