// Aris engine: abstracts local (WebLLM) and cloud (OpenAI-compatible) backends
// behind a single `chat(messages, opts)` async generator.

const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm";

/**
 * Curated list of coding-capable WebLLM models. The strings are model_id
 * values from prebuiltAppConfig — keep them in sync with the WebLLM release.
 * Approx VRAM is just a hint to help the user pick.
 */
/*
 * IMPORTANT: order matters — the first item is the default. Models known to
 * compile on the broadest set of WebGPU implementations (older Intel iGPUs,
 * older Chrome/Edge builds, mobile) come FIRST. The Qwen2.5-Coder family
 * gives the best coding quality but uses ops that some drivers reject with
 * an "Invalid ShaderModule" error during pipeline compilation — it stays in
 * the list (clearly labelled), but is not the default.
 */
export const LOCAL_MODELS = [
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B Instruct (совместимая, стартовый выбор) — ~1.8 ГБ",
    vram: 3,
    coding: false,
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 1B (самая лёгкая, совместимая) — ~0.7 ГБ",
    vram: 1,
    coding: false,
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    label: "Phi-3.5 mini 3.8B (совместимая, быстрая) — ~2.4 ГБ",
    vram: 3,
    coding: false,
  },
  {
    id: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
    label: "Llama 3.1 8B Instruct (универсальная) — ~4.5 ГБ",
    vram: 6,
    coding: false,
  },
  {
    id: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5-Coder 1.5B (лучше для кода, нужен свежий WebGPU) — ~1 ГБ",
    vram: 2,
    coding: true,
  },
  {
    id: "Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5-Coder 3B (баланс, нужен свежий WebGPU) — ~2 ГБ",
    vram: 3,
    coding: true,
  },
  {
    id: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5-Coder 7B (самая мощная локальная для кода) — ~4 ГБ",
    vram: 6,
    coding: true,
  },
  {
    id: "Qwen2.5-7B-Instruct-q4f16_1-MLC",
    label: "Qwen2.5 7B Instruct (универсальная) — ~4 ГБ",
    vram: 6,
    coding: false,
  },
];

/**
 * Detect WebGPU shader-compile failures (driver/op incompatibility).
 * The exact message varies, but "Invalid ShaderModule" / "validating compute
 * stage" / "entryPoint" is the signature.
 */
export function isShaderCompileError(err) {
  const msg = String(err?.message || err || "");
  return /Invalid ShaderModule|compute stage|entryPoint|WGSL|shader module/i.test(
    msg
  );
}

export const CLOUD_PROVIDERS = {
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keysUrl: "https://openrouter.ai/keys",
    models: [
      "qwen/qwen-2.5-coder-32b-instruct",
      "deepseek/deepseek-chat",
      "deepseek/deepseek-coder",
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini",
      "openai/gpt-4o",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    defaultModel: "qwen/qwen-2.5-coder-32b-instruct",
    needsKey: true,
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keysUrl: "https://platform.openai.com/api-keys",
    models: ["gpt-4o-mini", "gpt-4o", "o1-mini", "o1"],
    defaultModel: "gpt-4o-mini",
    needsKey: true,
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    keysUrl: "https://platform.deepseek.com/api_keys",
    models: ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
    defaultModel: "deepseek-coder",
    needsKey: true,
  },
  groq: {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keysUrl: "https://console.groq.com/keys",
    models: [
      "llama-3.3-70b-versatile",
      "llama-3.1-70b-versatile",
      "mixtral-8x7b-32768",
    ],
    defaultModel: "llama-3.3-70b-versatile",
    needsKey: true,
  },
  together: {
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    keysUrl: "https://api.together.xyz/settings/api-keys",
    models: [
      "Qwen/Qwen2.5-Coder-32B-Instruct",
      "deepseek-ai/DeepSeek-V3",
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    ],
    defaultModel: "Qwen/Qwen2.5-Coder-32B-Instruct",
    needsKey: true,
  },
  pollinations: {
    // Listed last and clearly labelled because the upstream currently
    // refuses browser-origin requests — it answers them with a canned
    // "upgrade to our paid product" notice. A future serverless proxy
    // could revive it; keeping the config for that path.
    name: "Pollinations (без ключа, может не работать)",
    baseUrl: "https://text.pollinations.ai",
    keysUrl: null,
    needsKey: false,
    models: ["openai-fast", "gpt-oss-20b"],
    defaultModel: "openai-fast",
  },
  custom: {
    name: "Свой URL",
    baseUrl: "",
    keysUrl: null,
    needsKey: false,
    models: [],
    defaultModel: "",
  },
};

export function providerNeedsKey(providerKey) {
  const p = CLOUD_PROVIDERS[providerKey];
  // default to requiring a key for unknown providers (safer)
  return p ? p.needsKey !== false : true;
}

export const DEFAULT_SYSTEM_PROMPT =
  "Ты Aris — точный и полезный AI-ассистент по программированию. " +
  "Отвечай по делу. Когда уместно, давай полный, рабочий код в блоках " +
  "```язык. Поясняй ключевые места кратко. Если задача неоднозначна — " +
  "уточняй. Отвечай на языке пользователя (по умолчанию русский).";

export const DEFAULT_GEN = {
  temperature: 0.3,
  top_p: 0.95,
  max_tokens: 1024,
  stream: true,
};

/* ============================================================
   Local backend — WebLLM
   ============================================================ */
class LocalBackend {
  constructor() {
    this.engine = null;
    this.modelId = null;
    this.loading = false;
    this.module = null;
  }

  static isSupported() {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  async _ensureModule() {
    if (!this.module) {
      this.module = await import(/* @vite-ignore */ WEBLLM_CDN);
    }
    return this.module;
  }

  async load(modelId, onProgress) {
    if (this.engine && this.modelId === modelId) return this.engine;
    if (!LocalBackend.isSupported()) {
      throw new Error(
        "WebGPU не поддерживается. Используйте Chrome/Edge 113+ или включите облачный API."
      );
    }
    this.loading = true;
    try {
      const mod = await this._ensureModule();
      if (this.engine) {
        try {
          await this.engine.unload();
        } catch (_) {}
        this.engine = null;
      }
      this.engine = await mod.CreateMLCEngine(modelId, {
        initProgressCallback: (r) => onProgress?.(r),
      });
      this.modelId = modelId;
      return this.engine;
    } finally {
      this.loading = false;
    }
  }

  async unload() {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch (_) {}
      this.engine = null;
      this.modelId = null;
    }
  }

  async *chat(messages, opts, signal) {
    if (!this.engine) throw new Error("Локальная модель не загружена.");
    const {
      temperature = DEFAULT_GEN.temperature,
      top_p = DEFAULT_GEN.top_p,
      max_tokens = DEFAULT_GEN.max_tokens,
      stream = true,
    } = opts || {};

    if (!stream) {
      const resp = await this.engine.chat.completions.create({
        messages,
        temperature,
        top_p,
        max_tokens,
        stream: false,
      });
      yield resp.choices?.[0]?.message?.content ?? "";
      return;
    }

    const chunks = await this.engine.chat.completions.create({
      messages,
      temperature,
      top_p,
      max_tokens,
      stream: true,
    });
    for await (const c of chunks) {
      if (signal?.aborted) {
        try {
          await this.engine.interruptGenerate?.();
        } catch (_) {}
        break;
      }
      const delta = c.choices?.[0]?.delta?.content ?? "";
      if (delta) yield delta;
    }
  }
}

/* ============================================================
   Cloud backend — OpenAI-compatible REST
   ============================================================ */
class CloudBackend {
  constructor() {
    this.config = null;
  }

  configure({ baseUrl, apiKey, model, providerKey }) {
    this.config = {
      baseUrl: (baseUrl || "").replace(/\/+$/, ""),
      apiKey: apiKey || "",
      model: model || "",
      providerKey: providerKey || "openrouter",
    };
  }

  ready() {
    if (!this.config?.baseUrl || !this.config?.model) return false;
    // Some providers (e.g. Pollinations) don't require an API key.
    if (providerNeedsKey(this.config.providerKey)) {
      return !!this.config.apiKey;
    }
    return true;
  }

  _headers() {
    const h = { "Content-Type": "application/json" };
    if (this.config.apiKey) {
      h.Authorization = `Bearer ${this.config.apiKey}`;
    }
    if (this.config.providerKey === "openrouter") {
      // OpenRouter recommends these. Use page origin where available.
      try {
        h["HTTP-Referer"] = window.location.origin || "https://aris.local";
      } catch (_) {}
      h["X-Title"] = "Aris Chat";
    }
    return h;
  }

  async ping() {
    if (!this.ready()) {
      throw new Error(
        providerNeedsKey(this.config?.providerKey)
          ? "Не заполнены baseUrl / API-ключ / модель."
          : "Не заполнены baseUrl / модель."
      );
    }
    // Some no-key providers (Pollinations) don't expose /models. Probe with
    // a 1-token chat at the working root endpoint instead.
    if (this.config.providerKey === "pollinations") {
      const probe = await fetch(`${this.config.baseUrl}/`, {
        method: "POST",
        headers: this._headers(),
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: "ping" }],
          reasoning_effort: "low",
          max_tokens: 1,
          stream: false,
        }),
      });
      if (!probe.ok) {
        throw new Error(`HTTP ${probe.status}: ${await probe.text()}`);
      }
      return true;
    }
    const res = await fetch(`${this.config.baseUrl}/models`, {
      headers: this._headers(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return true;
  }

  async *chat(messages, opts, signal) {
    if (!this.ready()) throw new Error("Облачный API не настроен.");
    const {
      temperature = DEFAULT_GEN.temperature,
      top_p = DEFAULT_GEN.top_p,
      max_tokens = DEFAULT_GEN.max_tokens,
      stream = true,
    } = opts || {};

    // Most providers expose OpenAI-style /chat/completions. Pollinations'
    // "/openai" path is cached server-side to return a canned deprecation
    // notice, so we POST to the root instead, which still runs real
    // inference and accepts the same body shape.
    const url =
      this.config.providerKey === "pollinations"
        ? `${this.config.baseUrl}/`
        : `${this.config.baseUrl}/chat/completions`;
    const body = {
      model: this.config.model,
      messages,
      temperature,
      top_p,
      max_tokens,
      stream,
    };
    // Pollinations serves GPT-OSS-20B, a reasoning model that wastes a lot
    // of tokens on internal CoT by default — give it a hint to keep the
    // reasoning short so the user sees an answer quickly.
    if (this.config.providerKey === "pollinations") {
      body.reasoning_effort = "low";
    }

    const res = await fetch(url, {
      method: "POST",
      headers: this._headers(),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }

    if (!stream) {
      const data = await res.json();
      yield data?.choices?.[0]?.message?.content ?? "";
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const raw = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!raw) continue;
        if (!raw.startsWith("data:")) continue;
        const data = raw.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch (_) {
          // ignore parse errors on heartbeats
        }
      }
    }
  }
}

/* ============================================================
   Public façade
   ============================================================ */
export class Engine {
  constructor() {
    this.local = new LocalBackend();
    this.cloud = new CloudBackend();
    this.mode = "local"; // "local" | "cloud"
  }

  setMode(mode) {
    if (mode !== "local" && mode !== "cloud") return;
    this.mode = mode;
  }

  async loadLocal(modelId, onProgress) {
    return this.local.load(modelId, onProgress);
  }

  async unloadLocal() {
    return this.local.unload();
  }

  configureCloud(cfg) {
    this.cloud.configure(cfg);
  }

  async pingCloud() {
    return this.cloud.ping();
  }

  /**
   * Ping a transient cloud config WITHOUT mutating `this.cloud`.
   * Used by the Settings dialog's "Test connection" button so that
   * cancelling the dialog doesn't poison the engine's saved config.
   */
  async pingCloudConfig(cfg) {
    const probe = new CloudBackend();
    probe.configure(cfg);
    return probe.ping();
  }

  ready() {
    if (this.mode === "local") return !!this.local.engine;
    return this.cloud.ready();
  }

  describe() {
    if (this.mode === "local") {
      return this.local.modelId
        ? `Локальная · ${this.local.modelId.split("-Instruct")[0]}`
        : "Локальная · WebLLM";
    }
    const m = this.cloud.config?.model || "—";
    const p = CLOUD_PROVIDERS[this.cloud.config?.providerKey]?.name || "Cloud";
    return `${p} · ${m}`;
  }

  async *chat(messages, opts, signal) {
    if (this.mode === "local") {
      yield* this.local.chat(messages, opts, signal);
    } else {
      yield* this.cloud.chat(messages, opts, signal);
    }
  }
}

export const isWebGpuSupported = () => LocalBackend.isSupported();
