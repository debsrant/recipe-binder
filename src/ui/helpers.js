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

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
