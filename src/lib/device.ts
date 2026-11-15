const DEVICE_ID_KEY = "fiorenza_device_id";

/** UUID v4 (usa crypto.randomUUID quando disponível). */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Identificador fixo deste aparelho/navegador. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "sem-storage";
  }
}

/** Descrição legível do aparelho, ex.: "Celular Android · Chrome". */
export function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Outro";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Firefox\//.test(ua)
            ? "Firefox"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Navegador";
  const kind = /Mobi|Android|iPhone/i.test(ua) ? "Celular" : /iPad|Tablet/i.test(ua) ? "Tablet" : "Computador";
  return `${kind} ${os} · ${browser}`;
}

let audioCtx: AudioContext | null = null;

/** Bipe curto (ok) ou grave (alerta) + vibração. */
export function beep(kind: "ok" | "warn" = "ok") {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioCtx) audioCtx = new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "square";
    osc.frequency.value = kind === "ok" ? 1800 : 420;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + (kind === "ok" ? 0.09 : 0.3));
  } catch {
    // sem áudio disponível
  }
  try {
    navigator.vibrate?.(kind === "ok" ? 80 : [120, 60, 120]);
  } catch {
    // sem vibração
  }
}
