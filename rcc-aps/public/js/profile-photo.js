// Profile photos belong to the signed-in account and are saved immediately.
let profilePhotoBusy = false;

function userPhotoMarkup(emp) {
  const photo = PROFILES[emp.id]?.photo || '';
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)) {
    return esc(((emp.first[0] || '') + (emp.last[0] || '')).toUpperCase());
  }
  return `<img src="${photo}" alt="${esc(displayName(emp))} profile photo" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit">`;
}

function chooseProfilePhoto() {
  if (!loggedInUser || profilePhotoBusy) return;
  const input = document.getElementById('profilePhotoInput');
  input.value = '';
  input.click();
}

function renderProfilePhotos(emp) {
  if (!emp) return;
  const photo = PROFILES[emp.id]?.photo || '';
  const valid = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo);
  const initials = ((emp.first[0] || '') + (emp.last[0] || '')).toUpperCase();
  ['empAvatar', 'finAvatar', 'admAvatar', 'empProfAvatar', 'finProfAvatar', 'admProfAvatar'].forEach(id => {
    const avatar = document.getElementById(id);
    if (!avatar) return;
    avatar.textContent = initials;
    avatar.style.overflow = 'hidden';
    if (valid) {
      const img = document.createElement('img');
      img.src = photo;
      img.alt = displayName(emp) + ' profile photo';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit';
      avatar.replaceChildren(img);
    }
  });
}

function resizeProfilePhoto(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, 256, 256);
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        if (!side) throw new Error('Invalid image');
        ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Invalid image')); };
    img.src = url;
  });
}

async function uploadProfilePhoto(input) {
  const file = input.files && input.files[0];
  const uid = loggedInUser && loggedInUser.id;
  if (!file || !uid || profilePhotoBusy) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    showToast('⚠️', 'Choose a JPG, PNG, or WebP image.'); input.value = ''; return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('⚠️', 'Choose an image smaller than 5 MB.'); input.value = ''; return;
  }
  profilePhotoBusy = true;
  const buttons = document.querySelectorAll('.profile-photo-button');
  buttons.forEach(button => { button.disabled = true; });
  try {
    const photo = await resizeProfilePhoto(file);
    if (!loggedInUser || loggedInUser.id !== uid) return;
    PROFILES[uid] = { ...(PROFILES[uid] || {}), photo };
    renderProfilePhotos(users.find(emp => emp.id === uid));
    const saved = await saveDemo();
    if (loggedInUser && loggedInUser.id === uid) showToast(saved ? '✅' : '⚠️', saved
      ? 'Profile photo saved.' : 'Photo saved on this device, but server sync failed. Please try uploading again.');
  } catch (error) {
    showToast('⚠️', 'Unable to save this image. Please choose another photo and try again.');
  } finally {
    profilePhotoBusy = false;
    buttons.forEach(button => { button.disabled = false; });
    input.value = '';
  }
}
