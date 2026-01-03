import { Skies } from './skies.js';

document.addEventListener('DOMContentLoaded', async () => {
  let session = Skies.requireSession();
  if (!session) return;

  session = await Skies.ensureSession();
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const bioForm = document.getElementById('bio-form');
  const bioInput = document.getElementById('bio-input');
  const avatarInput = document.getElementById('avatar-input');
  const bioCount = document.getElementById('bio-count');
  const maxBio = 300;

  const updateCount = () => {
    if (!bioInput || !bioCount) return;
    const len = bioInput.value.trim().length;
    bioCount.textContent = `${len}/${maxBio}`;
    bioCount.classList.toggle('error', len > maxBio);
  };

  bioInput?.addEventListener('input', updateCount);

  const renderProfile = async () => {
    try {
      const data = await Skies.fetchProfile(session.handle);
      if (bioInput) {
        bioInput.value = data.bio || '';
      }
      updateCount();
    } catch (err) {
      bioCount.textContent = err.message || 'Erreur chargement profil';
    }
  };

  bioForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!bioInput) return;
    const bio = bioInput.value.trim();
    if (bio.length > maxBio) {
      bioCount?.classList.add('error');
      return;
    }
    try {
      const avatarFile = avatarInput?.files?.[0];
      const result = await Skies.updateProfile({ bio, avatarFile });
      if (result.avatarUrl) {
        const sess = Skies.getSession();
        Skies.setSession({ ...sess, avatarUrl: result.avatarUrl });
      }
      window.location.href = 'profile.html';
    } catch (err) {
      alert(err.message);
    }
  });

  await renderProfile();
});
