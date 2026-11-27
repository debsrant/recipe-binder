export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatMinutes(minutes) {
  const num = Number(minutes || 0);
  if (!Number.isFinite(num) || num <= 0) return '0m';
  if (num < 60) return `${Math.round(num)}m`;
  const hrs = Math.floor(num / 60);
  const rem = Math.round(num % 60);
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function formatDateShort(msOrIso) {
  if (!msOrIso) return '';
  const date = new Date(msOrIso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function generateId(prefix = 'rec') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(filename, blob);
}

export function downloadJson(filename, data) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json');
}

/**
 * Manages the Screen Wake Lock API for kitchen cooking mode.
 */
export function createWakeLockController(onStateChange) {
  let sentinel = null;
  let desiredActive = false;

  const isSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

  async function requestLock() {
    if (!isSupported) {
      onStateChange(false, 'Screen Wake Lock is not supported in this browser.');
      return false;
    }
    try {
      sentinel = await navigator.wakeLock.request('screen');
      desiredActive = true;
      sentinel.addEventListener('release', () => {
        sentinel = null;
        if (!desiredActive) {
          onStateChange(false, '');
        }
      });
      onStateChange(true, '');
      return true;
    } catch {
      desiredActive = false;
      onStateChange(false, 'Could not keep screen awake in this browser context.');
      return false;
    }
  }

  async function releaseLock() {
    desiredActive = false;
    if (sentinel) {
      try {
        await sentinel.release();
      } catch {
        // Ignore release errors when tab is inactive
      }
      sentinel = null;
    }
    onStateChange(false, '');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && desiredActive && !sentinel) {
        requestLock();
      }
    });
  }

  return {
    isSupported,
    isActive: () => Boolean(sentinel) || desiredActive,
    toggle: async () => (desiredActive ? releaseLock() : requestLock()),
    release: releaseLock,
  };
}

/**
 * Compresses an uploaded image File/Blob in the browser to a compact data URL safe for IndexedDB & Firestore.
 */
export function compressImageFileToDataUrl(file, { maxWidth = 640, quality = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No image file selected.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        try {
          const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
          const width = Math.max(1, Math.round(img.width * ratio));
          const height = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(String(reader.result || ''));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          let dataUrl = canvas.toDataURL('image/webp', quality);
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}
