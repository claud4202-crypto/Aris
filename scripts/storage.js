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
  // Default to the cloud key-free provider so the app works out of the box
  // with zero setup. Users can switch to local WebLLM or a paid provider
  // through Settings.
  mode: "cloud", // "local" | "cloud"
  localModel: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
  cloud: {
    providerKey: "pollinations",
    baseUrl: "https://text.pollinations.ai/openai",
    apiKey: "",
    model: "openai",
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
  const merged = {
    ...DEFAULT_SETTINGS,
    ...s,
    cloud: { ...DEFAULT_SETTINGS.cloud, ...(s.cloud || {}) },
    generation: { ...DEFAULT_SETTINGS.generation, ...(s.generation || {}) },
  };
  // Migration for users with leftover settings from before Pollinations
  // existed: if the saved cloud config is still the old "openrouter / no
  // key" stub (i.e. they never really configured anything), point it at
  // the new key-free default so the app just works after refresh.
  const cloud = merged.cloud;
  if (cloud.providerKey === "openrouter" && !cloud.apiKey) {
    cloud.providerKey = "pollinations";
    cloud.baseUrl = "https://text.pollinations.ai/openai";
    cloud.model = "openai";
    // Force cloud mode since local is also likely "not loaded" for these users.
    merged.mode = "cloud";
  }
  return merged;
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
