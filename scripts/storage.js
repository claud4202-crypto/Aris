// Lightweight wrapper around localStorage with JSON + namespacing.

const NS = "aris:";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (_) {
    // ignore quota errors
  }
}

function remove(key) {
  try {
    localStorage.removeItem(NS + key);
  } catch (_) {}
}

export const Storage = { read, write, remove };

/* ===== Settings ===== */
const SETTINGS_KEY = "settings";

export const DEFAULT_SETTINGS = {
  mode: "local", // "local" | "cloud"
  localModel: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
  cloud: {
    providerKey: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "",
    model: "qwen/qwen-2.5-coder-32b-instruct",
  },
  generation: {
    temperature: 0.3,
    top_p: 0.95,
    max_tokens: 1024,
    stream: true,
  },
  systemPrompt: null, // null => use built-in default
  theme: "dark",
};

export function loadSettings() {
  const s = read(SETTINGS_KEY, null);
  if (!s) return structuredClone(DEFAULT_SETTINGS);
  // merge with defaults so newer fields appear
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    cloud: { ...DEFAULT_SETTINGS.cloud, ...(s.cloud || {}) },
    generation: { ...DEFAULT_SETTINGS.generation, ...(s.generation || {}) },
  };
}

export function saveSettings(s) {
  write(SETTINGS_KEY, s);
}

/* ===== Chats ===== */
const CHATS_KEY = "chats";
const ACTIVE_KEY = "activeChat";

export function loadChats() {
  return read(CHATS_KEY, []);
}

export function saveChats(chats) {
  write(CHATS_KEY, chats);
}

export function getActiveChatId() {
  return read(ACTIVE_KEY, null);
}

export function setActiveChatId(id) {
  write(ACTIVE_KEY, id);
}
