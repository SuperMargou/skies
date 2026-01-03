import { Skies } from './skies.js';

document.addEventListener('DOMContentLoaded', async () => {
  let session = Skies.requireSession();
  if (!session) return;

  session = await Skies.ensureSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // Swipe navigation: create -> home (droite vers gauche)
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
        setTimeout(() => (window.location.href = 'index.html'), 160);
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

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    Skies.clearSession();
    window.location.href = 'login.html';
  });

  const textArea = document.getElementById('post-text');
  const charCount = document.getElementById('char-count');
  const imageInput = document.getElementById('image-input');
  const imageName = document.getElementById('image-name');
  const form = document.getElementById('post-form');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const maxChars = 400;

  const updateCount = () => {
    if (!textArea || !charCount) return;
    const len = textArea.value.trim().length;
    charCount.textContent = `${len}/${maxChars}`;
    charCount.classList.toggle('error', len > maxChars);
  };

  if (textArea) {
    textArea.addEventListener('input', updateCount);
    updateCount();
  }

  imageInput?.addEventListener('change', () => {
    if (imageName) {
      imageName.textContent = imageInput.files[0]?.name || '';
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!textArea) return;
    const text = textArea.value.trim();
    if (!text && !imageInput?.files.length) {
      textArea.focus();
      return;
    }
    if (text.length > maxChars) {
      charCount?.classList.add('error');
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Publication...';
      }
      await Skies.createPost({
        text,
        imageFile: imageInput?.files[0],
      });
      textArea.value = '';
      if (imageInput) imageInput.value = '';
      if (imageName) imageName.textContent = '';
      updateCount();
      window.location.href = 'index.html';
    } catch (err) {
      console.error(err);
      alert('Publication impossible : ' + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publier';
      }
    }
  });
});
