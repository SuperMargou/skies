import { Skies } from './skies.js';

const shortRel = (ts) => {
  const diff = Math.max(0, Date.now() - ts);
  const s = diff / 1000;
  if (s < 60) return 'now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d`;
  const w = d / 7;
  return `${Math.floor(w)}w`;
};

let session = null;
let conversations = [];
let current = null;
const normalizeHandle = (h = '') => h.trim().replace(/^@+/, '').toLowerCase();
const params = new URLSearchParams(window.location.search);
const preselectHandle = normalizeHandle(params.get('to') || params.get('handle') || '');
const hasMessages = (c) => {
  if (!c) return false;
  if (c.last && String(c.last).trim().length) return true;
  if (Array.isArray(c.messages) && c.messages.length) return true;
  if (c.updatedAt) return true;
  return false;
};
const inferLastFromMessages = (c) => {
  if (!Array.isArray(c?.messages) || !c.messages.length) return { last: c?.last || '', updatedAt: c?.updatedAt || '' };
  const lastMsg = c.messages[c.messages.length - 1];
  return {
    last: c.last || lastMsg?.text || '',
    updatedAt: c.updatedAt || lastMsg?.createdAt || '',
  };
};

document.addEventListener('DOMContentLoaded', async () => {
  session = Skies.requireSession();
  if (!session) return;
  session = await Skies.ensureSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const avatar = document.getElementById('avatar');
  const handleEl = document.getElementById('user-handle');
  const profileLink = document.getElementById('profile-link');
  const mobileProfileLink = document.getElementById('mobile-profile-link');
  Skies.setAvatar(avatar, session.handle, session.avatarUrl);
  if (handleEl) handleEl.textContent = `@${session.handle}`;
  if (profileLink) profileLink.href = `profile.html?handle=${encodeURIComponent(session.handle)}`;
  if (mobileProfileLink) mobileProfileLink.href = `profile.html?handle=${encodeURIComponent(session.handle)}`;
  Skies.initTopbar();

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    Skies.clearSession();
    window.location.href = 'login.html';
  });

  const searchInput = document.getElementById('search-user');
  const threadList = document.getElementById('thread-list');
  const chatBody = document.getElementById('chat-body');
  const chatHeader = document.getElementById('chat-header');
  const chatHandle = document.getElementById('chat-handle');
  const chatStatus = document.getElementById('chat-status');
  const chatAvatar = document.getElementById('chat-avatar');
  const chatProfileLink = document.getElementById('chat-profile-link');
  const chatPeer = document.getElementById('chat-peer-link');
  const chatBack = document.getElementById('chat-back');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const suggestBox = document.createElement('div');
  suggestBox.className = 'suggest-box';
  searchInput?.parentElement?.appendChild(suggestBox);
  let suggestTimer = null;

  // Swipe navigation: messages -> home
  let touchStartX = null;
  let touchStartY = null;
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX === null || touchStartY === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx > 0) {
        document.body.classList.add('swipe-right-transition');
        setTimeout(() => (window.location.href = 'index.html'), 140);
      }
    }
    touchStartX = null;
    touchStartY = null;
  };
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });

  const scrollToBottom = () => {
    if (!chatBody) return;
    // defer pour laisser le DOM peindre avant de scroller
    requestAnimationFrame(() => {
      chatBody.scrollTop = chatBody.scrollHeight;
    });
  };

  const resizeChatBody = () => {
    const panel = document.querySelector('.chat-panel');
    if (!panel || !chatBody) return;
    const headerH = chatHeader?.offsetHeight || 0;
    const inputH = form?.offsetHeight || 0;
    const available = panel.clientHeight - headerH - inputH;
    if (available > 0) {
      chatBody.style.height = `${available}px`;
      chatBody.style.maxHeight = `${available}px`;
    }
  };
  window.addEventListener('resize', resizeChatBody);

  const hideSuggestions = () => {
    suggestBox.classList.remove('open');
    suggestBox.innerHTML = '';
  };
  const renderSuggestions = (items) => {
    suggestBox.innerHTML = '';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'suggest-empty';
      empty.textContent = 'Aucun utilisateur';
      suggestBox.appendChild(empty);
      suggestBox.classList.add('open');
      return;
    }
    items.forEach((u) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'suggest-item';
      btn.innerHTML = `
        <div class="avatar" style="${u.avatarUrl ? `background-image:url(${u.avatarUrl});background-size:cover;background-position:center;` : ''}">
          ${u.avatarUrl ? '' : (u.handle || '--').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div class="handle">@${u.handle}</div>
        </div>
      `;
      btn.addEventListener('click', async () => {
        await loadConversation(u.handle);
        if (searchInput) searchInput.value = '';
        hideSuggestions();
        renderThreads();
      });
      suggestBox.appendChild(btn);
    });
    suggestBox.classList.add('open');
  };
  const fetchSuggestions = () => {
    if (!searchInput) return;
    const q = normalizeHandle(searchInput.value);
    if (!q) {
      hideSuggestions();
      return;
    }
    clearTimeout(suggestTimer);
    suggestTimer = setTimeout(async () => {
      try {
        const users = await Skies.searchUsers(q);
        renderSuggestions(users);
      } catch (err) {
        console.error(err);
        hideSuggestions();
      }
    }, 200);
  };

  if (searchInput) {
    searchInput.placeholder = 'Rechercher ou ouvrir @handle puis Entrer';
    if (preselectHandle) {
      searchInput.value = `@${preselectHandle}`;
    }
  }

  const renderThreads = () => {
    const raw = (searchInput.value || '').trim();
    const q = normalizeHandle(raw);
    const filtered = conversations
      
      .slice()
      .sort((a, b) => {
        // Priorise les correspondances si une recherche est tapée, sinon date de MAJ
        const aMatch = q && a.handle.toLowerCase().includes(q) ? 1 : 0;
        const bMatch = q && b.handle.toLowerCase().includes(q) ? 1 : 0;
        if (aMatch !== bMatch) return bMatch - aMatch;
        return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
      });

    threadList.innerHTML = '';
    if (!filtered.length) {
      threadList.innerHTML =
        '<div class="empty" style="padding:20px 0;">Aucune conversation pour le moment. Lancez une recherche pour démarrer un chat !</div>';
      return;
    }

    filtered.forEach((c) => {
      const item = document.createElement('div');
      item.className = `thread conversation-card ${current?.handle === c.handle ? 'active' : ''}`;
      const initials = (c.handle || '--').slice(0, 2).toUpperCase();
      const avatarStyle = c.avatarUrl
        ? `style="background-image:url(${c.avatarUrl});background-size:cover;background-position:center;"`
        : '';
      const lastMessageObj = Array.isArray(c.messages) && c.messages.length ? c.messages[c.messages.length - 1] : null;
      const lastText = c.last || (lastMessageObj ? lastMessageObj.text : '');
      const updatedAt = c.updatedAt || (lastMessageObj ? lastMessageObj.createdAt : '');
      item.innerHTML = `
        <div class="avatar pp" ${avatarStyle}>${c.avatarUrl ? '' : initials}</div>
        <div class="text-block">
          <p class="username handle">@${c.handle}</p>
          <p class="last-message thread-snippet">${lastText || ''}</p>
        </div>
        <div class="thread-meta">
          <span class="time">${updatedAt ? shortRel(Date.parse(updatedAt)) : ''}</span>
          ${c.unread ? '<span class="dot"></span>' : '<span></span>'}
        </div>
      `;
      item.addEventListener('click', async () => {
        await loadConversation(c.handle);
      });
      threadList.appendChild(item);
    });
  };

  const renderChat = (conv) => {
    if (!conv) {
      chatBody.classList.add('empty');
      chatBody.innerHTML = 'Choisis un contact pour afficher la conversation.';
      chatHandle.textContent = '';
      chatStatus.textContent = 'Selectionne un contact';
      chatProfileLink.style.display = 'none';
      resizeChatBody();
      return;
    }

    chatBody.classList.remove('empty');
    chatBody.innerHTML = '';
    chatHandle.textContent = `@${conv.handle}`;
    chatStatus.textContent = 'En ligne';
    chatProfileLink.style.display = 'inline-flex';
    chatProfileLink.href = `profile.html?handle=${encodeURIComponent(conv.handle)}`;
    const peerHref = `profile.html?handle=${encodeURIComponent(conv.handle)}`;
    const peerTitle = `Voir le profil de @${conv.handle}`;
    chatPeer?.setAttribute('href', peerHref);
    chatPeer?.setAttribute('title', peerTitle);
    chatPeer?.setAttribute('aria-label', peerTitle);
    Skies.setAvatar(chatAvatar, conv.handle, conv.avatarUrl);

    conv.messages.forEach((m) => {
      const bubble = document.createElement('div');
      bubble.className = `bubble ${m.fromMe ? 'me' : ''}`;
      const textEl = document.createElement('div');
      textEl.className = 'bubble-text';
      textEl.textContent = m.text;
      const time = document.createElement('small');
      time.textContent = new Date(m.createdAt || Date.now()).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      bubble.append(textEl, time);
      chatBody.appendChild(bubble);
    });

    resizeChatBody();
    scrollToBottom();

    // Sur mobile, ouvrir la vue chat
    if (window.innerWidth <= 768) {
      document.body.classList.add('chat-open');
    }
  };

  const loadThreads = async () => {
    try {
      conversations = (await Skies.fetchThreads()).map((c) => {
        const meta = inferLastFromMessages(c);
        return {
          ...c,
          last: meta.last,
          updatedAt: meta.updatedAt,
        };
      });
    } catch (err) {
      console.error(err);
      conversations = [];
    }
    renderThreads();
  };

  const loadConversation = async (handle) => {
    try {
      const conv = await Skies.fetchConversation(normalizeHandle(handle));
      current = {
        handle: conv.handle,
        avatarUrl: conv.avatarUrl || '',
        messages: conv.messages || [],
      };
      const meta = inferLastFromMessages(current);
      current.last = meta.last;
      current.updatedAt = meta.updatedAt;
      // inject in list if not present yet (permet de lancer une nouvelle conv)
      const existing = conversations.find((c) => c.handle === current.handle);
      if (!existing) {
        conversations.unshift({
          handle: current.handle,
          avatarUrl: current.avatarUrl,
          last: current.last || '',
          updatedAt: current.updatedAt || new Date().toISOString(),
          unread: false,
        });
      }
      renderThreads();
      renderChat(current);
    } catch (err) {
      console.error(err);
      chatBody.classList.add('empty');
      chatBody.innerHTML = err.message || 'Erreur de chargement';
    }
  };

  searchInput?.addEventListener('input', renderThreads);
  searchInput?.addEventListener('input', fetchSuggestions);
  searchInput?.addEventListener('blur', () => {
    setTimeout(hideSuggestions, 150);
  });
  searchInput?.addEventListener('search', async () => {
    const h = normalizeHandle(searchInput.value);
    if (h) {
      await loadConversation(h);
      if (searchInput) searchInput.value = '';
      hideSuggestions();
      renderThreads();
    }
  });
  searchInput?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const h = normalizeHandle(searchInput.value);
      if (h) {
        await loadConversation(h);
        if (searchInput) searchInput.value = '';
        hideSuggestions();
        renderThreads();
      }
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current) return;
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    try {
      await Skies.sendMessage(current.handle, text);
      current.messages.push({ fromMe: true, text, createdAt: new Date().toISOString() });
      const idx = conversations.findIndex((c) => c.handle === current.handle);
      if (idx !== -1) {
        conversations[idx].last = text;
        conversations[idx].updatedAt = new Date().toISOString();
        conversations[idx].unread = false;
      } else {
        conversations.unshift({
          handle: current.handle,
          avatarUrl: current.avatarUrl,
          last: text,
          updatedAt: new Date().toISOString(),
          unread: false,
        });
      }
      renderThreads();
      renderChat(current);
      scrollToBottom();
    } catch (err) {
      alert(err.message);
    }
  });

  chatBack?.addEventListener('click', () => {
    document.body.classList.remove('chat-open');
  });

  chatPeer?.addEventListener('click', () => {
    if (window.innerWidth <= 768 && chatProfileLink?.href) {
      window.location.href = chatProfileLink.href;
    }
  });

  await loadThreads();
  if (preselectHandle) {
    await loadConversation(preselectHandle);
  } else {
    renderChat(null);
  }

  window.addEventListener('load', scrollToBottom);
});
