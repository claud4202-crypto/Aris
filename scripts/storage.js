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
  // Default to local WebLLM so the app is key-free out of the box. The
  // user only needs WebGPU — model weights are downloaded once and cached.
  // (Pollinations would have been a zero-setup cloud alternative, but their
  // API now rejects browser-origin requests with a canned deprecation
  // notice, so we no longer route to it by default.)
  mode: "local", // "local" | "cloud"
  localModel: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
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
  const merged = {
    ...DEFAULT_SETTINGS,
    ...s,
    cloud: { ...DEFAULT_SETTINGS.cloud, ...(s.cloud || {}) },
    generation: { ...DEFAULT_SETTINGS.generation, ...(s.generation || {}) },
  };
  // Migration: an earlier dev build defaulted to Pollinations as a
  // key-free cloud provider. Their API has since started gating on the
  // Origin header and only returns a canned deprecation notice to the
  // browser, so we move those users back to the local key-free path.
  const cloud = merged.cloud;
  if (cloud.providerKey === "pollinations" && !cloud.apiKey) {
    cloud.providerKey = "openrouter";
    cloud.baseUrl = "https://openrouter.ai/api/v1";
    cloud.model = "qwen/qwen-2.5-coder-32b-instruct";
    merged.mode = "local";
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
