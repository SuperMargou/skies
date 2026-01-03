import { Skies } from './skies.js';

document.addEventListener('DOMContentLoaded', async () => {
  let session = Skies.requireSession();
  if (!session) return;
  session = await Skies.ensureSession();
  if (!session) return;

  const avatar = document.getElementById('avatar');
  const handleEl = document.getElementById('user-handle');
  const profileLink = document.getElementById('profile-link');
  Skies.setAvatar(avatar, session.handle, session.avatarUrl);
  if (handleEl) {
    handleEl.textContent = `@${session.handle}`;
  }
  if (profileLink) {
    profileLink.href = `profile.html?handle=${encodeURIComponent(session.handle)}`;
  }
  Skies.initTopbar();

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    Skies.clearSession();
    window.location.href = 'login.html';
  });

  const postId = new URLSearchParams(window.location.search).get('id');
  if (!postId) {
    renderMissing();
    return;
  }

  await renderPost(postId);

  const form = document.getElementById('comment-form');
  const input = document.getElementById('comment-input');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    try {
      await Skies.addComment(postId, text);
      input.value = '';
      await renderPost(postId);
    } catch (err) {
      console.error(err);
      alert('Erreur commentaire : ' + err.message);
    }
  });
});

function renderMissing() {
  const container = document.getElementById('post-container');
  container.innerHTML = '<div class="empty">Post introuvable.</div>';
  document.getElementById('comments-section').style.display = 'none';
}

async function renderPost(postId) {
  const container = document.getElementById('post-container');
  container.innerHTML = '<div class="empty">Chargement...</div>';

  try {
    const { post, comments } = await Skies.fetchPost(postId);
    if (!post) {
      renderMissing();
      return;
    }

    container.innerHTML = '';
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

    actions.append(likeBtn, commentLink);
    card.append(head, body, actions);
    container.appendChild(card);

    renderComments(comments);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty">Erreur : ${err.message}</div>`;
  }
}

function renderComments(comments = []) {
  const list = document.getElementById('comments-list');
  if (!comments.length) {
    list.innerHTML =
      "<div class=\"empty\" style=\"padding:12px 0;\">Personne n'a commente pour le moment.</div>";
    return;
  }
  list.innerHTML = '';
  comments.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'comment';
    const handleLink = document.createElement('a');
    handleLink.className = 'handle-link';
    handleLink.href = `profile.html?handle=${encodeURIComponent(c.authorHandle)}`;
    handleLink.textContent = `@${c.authorHandle}`;

    const text = document.createElement('div');
    text.textContent = c.text;

    const date = document.createElement('small');
    date.textContent = Skies.formatTime(c.createdAt);

    el.append(handleLink, text, date);
    list.appendChild(el);
  });
}
