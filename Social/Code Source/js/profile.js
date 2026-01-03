import { Skies } from './skies.js';

document.addEventListener('DOMContentLoaded', async () => {
  let session = Skies.requireSession();
  if (!session) return;

  session = await Skies.ensureSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // Swipe navigation: profil -> accueil (droite vers gauche)
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

  const params = new URLSearchParams(window.location.search);
  const targetHandle = params.get('handle') || session.handle;
  const isSelf = targetHandle.toLowerCase() === session.handle.toLowerCase();

  const profileHandle = document.getElementById('profile-handle');
  const profileAvatar = document.getElementById('profile-avatar');
  const profileCreated = document.getElementById('profile-created');
  const bioDisplay = document.getElementById('bio-display');
  const dmButton = document.getElementById('dm-button');
  const followBtn = document.getElementById('follow-btn');
  const followersCountEl = document.getElementById('followers-count');
  const editBtn = document.getElementById('edit-profile-btn');
  const profileLogout = document.getElementById('profile-logout');
  const maxBio = 300;

  if (dmButton) {
    dmButton.style.display = isSelf ? 'none' : 'inline-flex';
    dmButton.href = `messages.html?to=${encodeURIComponent(targetHandle)}`;
  }
  if (!isSelf && editBtn) {
    editBtn.style.display = 'none';
  }
  if (profileLogout) {
    profileLogout.style.display = isSelf ? 'inline-flex' : 'none';
  }
  if (followBtn) {
    followBtn.style.display = isSelf ? 'none' : 'inline-flex';
  }

  const renderProfile = async () => {
    try {
      const data = await Skies.fetchProfile(targetHandle);
      profileHandle.textContent = `@${data.handle}`;
      Skies.setAvatar(profileAvatar, data.handle, data.avatarUrl);
      profileCreated.textContent = data.createdAt
        ? `Compte cree le ${new Date(data.createdAt).toLocaleDateString('fr-FR')}`
        : '';
      const followers = Number(data.followersCount ?? 0);
      if (followersCountEl) followersCountEl.textContent = followers;
      if (followBtn && !isSelf) {
        const following = Boolean(data.following);
        followBtn.textContent = following ? 'Se désabonner' : "S'abonner";
        followBtn.dataset.following = following ? '1' : '0';
      }
      const bio = data.bio || '';
      if (bioDisplay) {
        bioDisplay.textContent = bio || 'Pas encore de bio.';
        bioDisplay.classList.toggle('bio-empty', bio.length === 0);
      }
    } catch (err) {
      bioDisplay.textContent = err.message || 'Profil introuvable';
      bioDisplay.classList.add('bio-empty');
    }
  };

  followBtn?.addEventListener('click', async () => {
    try {
      const result = await Skies.toggleFollow(targetHandle);
      const following = Boolean(result.following);
      if (followersCountEl) followersCountEl.textContent = Number(result.followersCount ?? followersCountEl.textContent || 0);
      if (followBtn) {
        followBtn.textContent = following ? 'Se désabonner' : "S'abonner";
        followBtn.dataset.following = following ? '1' : '0';
      }
    } catch (err) {
      alert(err.message || 'Action impossible');
    }
  });

  profileLogout?.addEventListener('click', () => {
    Skies.clearSession();
    window.location.href = 'login.html';
  });

  renderProfile();
});
