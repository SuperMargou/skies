import { Skies } from './skies.js';

document.addEventListener('DOMContentLoaded', async () => {
  let session = Skies.requireSession();
  if (!session) return;

  // Verifie que le token est encore valide
  session = await Skies.ensureSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // Swipe navigation: home -> messages
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
      if (dx < 0) {
        document.body.classList.add('swipe-left-transition');
        setTimeout(() => (window.location.href = 'messages.html'), 140);
      } else if (dx > 0) {
        document.body.classList.add('swipe-right-transition');
        setTimeout(() => (window.location.href = 'create.html'), 140);
      }
    }
    touchStartX = null;
    touchStartY = null;
  };
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });

  const avatar = document.getElementById('avatar');
  const userHandle = document.getElementById('user-handle');
  const profileLink = document.getElementById('profile-link');
  Skies.setAvatar(avatar, session.handle, session.avatarUrl);
  if (userHandle) {
    userHandle.textContent = `@${session.handle}`;
  }
  if (profileLink) {
    profileLink.href = `profile.html?handle=${encodeURIComponent(session.handle)}`;
  }
  Skies.initTopbar();

  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn?.addEventListener('click', () => {
    Skies.clearSession();
    window.location.href = 'login.html';
  });

  const textArea = document.getElementById('post-text');
  const charCount = document.getElementById('char-count');
  const imageInput = document.getElementById('image-input');
  const imageName = document.getElementById('image-name');
  const form = document.getElementById('post-form');
  const maxChars = 400;

  if (textArea && charCount && form) {
    const updateCount = () => {
      const len = textArea.value.trim().length;
      charCount.textContent = `${len}/${maxChars}`;
      charCount.classList.toggle('error', len > maxChars);
    };

    textArea.addEventListener('input', updateCount);
    updateCount();

    imageInput?.addEventListener('change', () => {
      if (imageName) {
        imageName.textContent = imageInput.files[0]?.name || '';
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = textArea.value.trim();
      if (!text && !imageInput?.files.length) {
        textArea.focus();
        return;
      }
      if (text.length > maxChars) {
        charCount.classList.add('error');
        return;
      }

      try {
        await Skies.createPost({
          text,
          imageFile: imageInput?.files[0],
        });
        textArea.value = '';
        if (imageInput) imageInput.value = '';
        if (imageName) imageName.textContent = '';
        updateCount();
        await renderFeed();
      } catch (err) {
        console.error(err);
        alert('Publication impossible : ' + err.message);
      }
    });
  }

  renderFeed();
});

async function renderFeed() {
  const feed = document.getElementById('feed');
  feed.innerHTML = '<div class="empty">Chargement...</div>';
  try {
    const posts = await Skies.fetchFeed();
    if (!posts.length) {
      feed.innerHTML = '<div class="empty">Aucun post pour le moment.</div>';
      return;
    }
    feed.innerHTML = '';
    posts.forEach((post) => feed.appendChild(buildPostCard(post)));
  } catch (err) {
    console.error(err);
    feed.innerHTML = `<div class="empty">Erreur de chargement : ${err.message}</div>`;
  }
}

function buildPostCard(post) {
  const sessionHandle = Skies.getSession()?.handle || 'anon';
  const storageKey = `views_${sessionHandle}`;
  const viewed = new Set(
    (() => {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || [];
      } catch (_) {
        return [];
      }
    })()
  );
  const persistViewed = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([...viewed]));
    } catch (_) {
      // ignore
    }
  };

  const card = document.createElement('article');
  card.className = 'card post';

  const head = document.createElement('div');
  head.className = 'post-head';
  const handleLink = document.createElement('a');
  handleLink.className = 'handle-link';
  handleLink.href = `profile.html?handle=${encodeURIComponent(post.authorHandle)}`;
  handleLink.textContent = `@${post.authorHandle}`;

  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  timestamp.textContent = Skies.formatTime(post.createdAt);

  head.append(handleLink, timestamp);

  const body = document.createElement('div');
  body.className = 'post-body';
  const text = document.createElement('p');
  text.className = 'post-text';
  text.textContent = post.text || '';
  body.appendChild(text);

  const imageUrl =
    post.imageUrl ||
    post.image ||
    post.image_url ||
    post.imageURL ||
    post.imagePath ||
    post.image_path ||
    post.imagepath;
  if (imageUrl) {
    const img = document.createElement('img');
    const normalized =
      typeof imageUrl === 'string' && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')
        ? `/${imageUrl}`
        : imageUrl;
    img.src = normalized;
    img.alt = 'image du post';
    body.appendChild(img);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';
  const views = Number(
    post.viewCount ?? post.views ?? post.viewsCount ?? post.nbViews ?? post.view_count ?? 0
  );
  const spanViewsValue = document.createElement('span');
  spanViewsValue.textContent = views;

  const likeBtn = document.createElement('button');
  likeBtn.className = `action like-btn ${post.liked ? 'liked' : ''}`;
  likeBtn.innerHTML = `
    <span class="action-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12.1 20.3c-.1 0-.3-.1-.4-.2-3.2-3-5.3-5-6.6-6.6-1.1-1.4-1.6-2.6-1.6-3.9 0-2.4 1.9-4.3 4.2-4.3 1.3 0 2.6.6 3.5 1.7.9-1.1 2.2-1.7 3.5-1.7 2.3 0 4.2 1.9 4.2 4.3 0 1.3-.5 2.5-1.6 3.9-1.3 1.6-3.4 3.6-6.6 6.6-.1.1-.2.2-.4.2z" />
      </svg>
    </span>
    <span class="like-count">${post.likeCount || 0}</span>
  `;
  likeBtn.addEventListener('click', async () => {
    try {
      const result = await Skies.toggleLike(post.id);
      likeBtn.classList.toggle('liked', result.liked);
      likeBtn.innerHTML = `
        <span class="action-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12.1 20.3c-.1 0-.3-.1-.4-.2-3.2-3-5.3-5-6.6-6.6-1.1-1.4-1.6-2.6-1.6-3.9 0-2.4 1.9-4.3 4.2-4.3 1.3 0 2.6.6 3.5 1.7.9-1.1 2.2-1.7 3.5-1.7 2.3 0 4.2 1.9 4.2 4.3 0 1.3-.5 2.5-1.6 3.9-1.3 1.6-3.4 3.6-6.6 6.6-.1.1-.2.2-.4.2z" />
          </svg>
        </span>
        <span class="like-count">${result.likeCount}</span>
      `;
    } catch (err) {
      alert(err.message);
    }
  });

  const commentLink = document.createElement('a');
  commentLink.className = 'action comment-btn';
  commentLink.href = `post.html?id=${post.id}`;
  commentLink.innerHTML = `
    <span class="action-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 5h16v9H7l-3 3V5z"/>
      </svg>
    </span>
    <span class="comment-count">${post.commentCount || 0}</span>
  `;

  const viewsEl = document.createElement('span');
  viewsEl.className = 'counts views-count';
  viewsEl.innerHTML = `
    <svg class="view-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M1.5 12c1.8-3.7 5.4-6.5 10.5-6.5S20.7 8.3 22.5 12c-1.8 3.7-5.4 6.5-10.5 6.5S3.3 15.7 1.5 12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/>
    </svg>
    <span class="view-value"></span>
  `;
  viewsEl.querySelector('.view-value').replaceWith(spanViewsValue);

  actions.append(likeBtn, commentLink, viewsEl);
  card.append(head, body, actions);

  const markView = () => {
    if (viewed.has(post.id)) return;
    viewed.add(post.id);
    const current = parseInt(spanViewsValue.textContent || '0', 10) || 0;
    spanViewsValue.textContent = current + 1;
    persistViewed();
    // sync server
    Skies.addView(post.id).catch(() => {});
    cleanup();
  };

  const isInViewport = () => {
    const rect = card.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < (window.innerHeight || document.documentElement.clientHeight);
  };

  const onScrollOrResize = () => {
    if (isInViewport()) markView();
  };

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        markView();
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px' });

  const cleanup = () => {
    window.removeEventListener('scroll', onScrollOrResize, true);
    window.removeEventListener('resize', onScrollOrResize, true);
    observer.disconnect();
  };

  window.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize, true);
  observer.observe(card);
  requestAnimationFrame(() => requestAnimationFrame(onScrollOrResize));

  return card;
}
