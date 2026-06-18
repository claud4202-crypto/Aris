// Aris — main controller. Wires the UI to the Engine + Storage.

import {
  Engine,
  LOCAL_MODELS,
  CLOUD_PROVIDERS,
  DEFAULT_SYSTEM_PROMPT,
  isWebGpuSupported,
  isShaderCompileError,
  providerNeedsKey,
} from "./engine.js";
import {
  loadSettings,
  saveSettings,
  loadChats,
  saveChats,
  getActiveChatId,
  setActiveChatId,
  DEFAULT_SETTINGS,
} from "./storage.js";
import {
  renderMarkdown,
  renderMarkdownSync,
  attachCodeCopyButtons,
  preloadMarkdownDeps,
} from "./markdown.js";

/* ===== State ===== */
const state = {
  settings: loadSettings(),
  chats: loadChats(),
  activeChatId: getActiveChatId(),
  engine: new Engine(),
  generating: false,
  abortCtrl: null,
};

/* ===== DOM helpers ===== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const els = {
  app: $("#app"),
  sidebar: $("#sidebar"),
  sidebarOpen: $("#sidebarOpen"),
  sidebarClose: $("#sidebarClose"),
  newChatBtn: $("#newChatBtn"),
  chatList: $("#chatList"),
  themeBtn: $("#themeBtn"),
  settingsBtn: $("#settingsBtn"),

  chatTitle: $("#chatTitle"),
  engineBadge: $("#engineBadge"),
  engineHint: $("#engineHint"),
  exportBtn: $("#exportBtn"),
  clearBtn: $("#clearBtn"),

  messages: $("#messages"),
  welcome: $("#welcome"),
  status: $("#status"),

  composer: $("#composer"),
  input: $("#input"),
  sendBtn: $("#sendBtn"),
  stopBtn: $("#stopBtn"),

  toast: $("#toast"),

  // settings modal
  settingsModal: $("#settingsModal"),
  settingsClose: $("#settingsClose"),
  settingsSave: $("#settingsSave"),
  settingsCancel: $("#settingsCancel"),
  localModelSelect: $("#localModelSelect"),
  loadLocalBtn: $("#loadLocalBtn"),
  unloadLocalBtn: $("#unloadLocalBtn"),
  localProgress: $("#localProgress"),
  localProgressBar: $("#localProgressBar"),
  localProgressText: $("#localProgressText"),
  webgpuWarn: $("#webgpuWarn"),
  providerSelect: $("#providerSelect"),
  baseUrlInput: $("#baseUrlInput"),
  apiKeyInput: $("#apiKeyInput"),
  apiKeyField: $("#apiKeyField"),
  apiKeyHelp: $("#apiKeyHelp"),
  cloudModelInput: $("#cloudModelInput"),
  cloudModelList: $("#cloudModelList"),
  testApiBtn: $("#testApiBtn"),
  apiStatus: $("#apiStatus"),
  systemPromptInput: $("#systemPromptInput"),
  tempInput: $("#tempInput"),
  tempOut: $("#tempOut"),
  topPInput: $("#topPInput"),
  topPOut: $("#topPOut"),
  maxTokensInput: $("#maxTokensInput"),
  streamInput: $("#streamInput"),
};

/* ===== Boot ===== */
function init() {
  applyTheme(state.settings.theme);
  populateLocalModels();
  populateProviders();
  bindEvents();
  preloadMarkdownDeps();

  // Engine mode follows settings
  state.engine.setMode(state.settings.mode);
  state.engine.configureCloud({
    baseUrl: state.settings.cloud.baseUrl,
    apiKey: state.settings.cloud.apiKey,
    model: state.settings.cloud.model,
    providerKey: state.settings.cloud.providerKey,
  });

  // Initial chat
  if (!state.chats.length) {
    createChat();
  } else if (
    !state.activeChatId ||
    !state.chats.find((c) => c.id === state.activeChatId)
  ) {
    state.activeChatId = state.chats[0].id;
    setActiveChatId(state.activeChatId);
  }
  renderChatList();
  renderActiveChat();
  refreshHints();

  if (!isWebGpuSupported()) {
    els.webgpuWarn.hidden = false;
  }
}

/* ===== Theme ===== */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}
function toggleTheme() {
  state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
  applyTheme(state.settings.theme);
  saveSettings(state.settings);
}

/* ===== Chats ===== */
function uid() {
  return "c_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function createChat() {
  const chat = {
    id: uid(),
    title: "Новый чат",
    createdAt: Date.now(),
    messages: [],
  };
  state.chats.unshift(chat);
  state.activeChatId = chat.id;
  saveChats(state.chats);
  setActiveChatId(chat.id);
  return chat;
}

function activeChat() {
  return state.chats.find((c) => c.id === state.activeChatId);
}

function deleteChat(id) {
  state.chats = state.chats.filter((c) => c.id !== id);
  if (state.activeChatId === id) {
    state.activeChatId = state.chats[0]?.id || null;
    if (!state.activeChatId) createChat();
  }
  saveChats(state.chats);
  setActiveChatId(state.activeChatId);
  renderChatList();
  renderActiveChat();
}

function setChatTitle(chat, text) {
  const t = text.trim().split("\n")[0].slice(0, 50) || "Новый чат";
  if (chat.title === "Новый чат" || !chat.title) {
    chat.title = t;
    saveChats(state.chats);
    renderChatList();
    els.chatTitle.textContent = chat.title;
  }
}

function renderChatList() {
  els.chatList.innerHTML = "";
  for (const c of state.chats) {
    const btn = document.createElement("button");
    btn.className =
      "chat-item" + (c.id === state.activeChatId ? " is-active" : "");
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-6A8.4 8.4 0 1 1 21 11.5z"
          stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
      </svg>
      <span class="chat-item__title"></span>
      <span class="chat-item__del" title="Удалить">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2m1 0l-1 14H7L6 6"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>
        </svg>
      </span>`;
    btn.querySelector(".chat-item__title").textContent = c.title || "Без названия";
    btn.addEventListener("click", (e) => {
      if (e.target.closest(".chat-item__del")) {
        e.stopPropagation();
        if (confirm("Удалить этот чат?")) deleteChat(c.id);
        return;
      }
      state.activeChatId = c.id;
      setActiveChatId(c.id);
      renderChatList();
      renderActiveChat();
      closeSidebarOnMobile();
    });
    els.chatList.appendChild(btn);
  }
}

function renderActiveChat() {
  const c = activeChat();
  els.chatTitle.textContent = c?.title || "Новый чат";
  els.messages.innerHTML = "";
  if (!c || c.messages.length === 0) {
    els.messages.appendChild(els.welcome);
    return;
  }
  for (const m of c.messages) {
    els.messages.appendChild(renderMessage(m));
  }
  scrollToEnd();
}

function renderMessage(m) {
  const wrap = document.createElement("div");
  wrap.className = `message message--${m.role}`;
  wrap.dataset.id = m.id;

  const avatar = document.createElement("div");
  avatar.className = "message__avatar";
  avatar.textContent = m.role === "user" ? "Вы" : "AI";

  const body = document.createElement("div");
  body.className = "message__body";
  body.innerHTML = `
    <div class="message__role">${m.role === "user" ? "Вы" : "Aris"}</div>
    <div class="message__content"></div>
    <div class="message__actions">
      <button type="button" class="msg-action" data-action="copy">Копировать</button>
      ${m.role === "user" ? '<button type="button" class="msg-action" data-action="edit">Изменить</button>' : ""}
      ${m.role === "assistant" ? '<button type="button" class="msg-action" data-action="regen">Перегенерировать</button>' : ""}
    </div>`;
  wrap.appendChild(avatar);
  wrap.appendChild(body);

  const content = body.querySelector(".message__content");
  renderInto(content, m.content || "");

  body
    .querySelector('[data-action="copy"]')
    .addEventListener("click", () => copyText(m.content));
  body.querySelector('[data-action="edit"]')?.addEventListener("click", () => {
    els.input.value = m.content;
    els.input.focus();
    autoresize();
  });
  body.querySelector('[data-action="regen"]')?.addEventListener("click", () => {
    regenerate(m.id);
  });

  return wrap;
}

function renderInto(el, text) {
  el.innerHTML = renderMarkdownSync(text);
  attachCodeCopyButtons(el);
  // Upgrade once async deps are ready. Swallow rejections (e.g. CDN
  // unreachable) so they don't surface as unhandled promise errors —
  // the sync renderer already provided a usable fallback.
  renderMarkdown(text)
    .then((html) => {
      if (el.dataset.lastText === text) return; // unchanged
      el.dataset.lastText = text;
      el.innerHTML = html;
      attachCodeCopyButtons(el);
    })
    .catch(() => {});
}

function scrollToEnd() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

/* ===== Sending ===== */
async function send(text) {
  text = text.trim();
  if (!text) return;
  if (state.generating) return;
  if (!state.engine.ready()) {
    toast(
      state.engine.mode === "local"
        ? "Сначала загрузите локальную модель в Настройках."
        : "Сначала укажите API-ключ и модель в Настройках.",
      true
    );
    openSettings(state.engine.mode === "local" ? "local" : "cloud");
    return;
  }

  const chat = activeChat() || createChat();
  if (chat.messages.length === 0) setChatTitle(chat, text);

  const userMsg = { id: uid(), role: "user", content: text, ts: Date.now() };
  chat.messages.push(userMsg);
  saveChats(state.chats);
  els.welcome.remove();
  els.messages.appendChild(renderMessage(userMsg));
  scrollToEnd();

  els.input.value = "";
  autoresize();

  await streamReply(chat);
}

async function streamReply(chat) {
  const asstMsg = { id: uid(), role: "assistant", content: "", ts: Date.now() };
  chat.messages.push(asstMsg);
  const node = renderMessage(asstMsg);
  node.classList.add("is-streaming");
  els.messages.appendChild(node);
  const content = node.querySelector(".message__content");
  content.innerHTML = '<span class="typing"></span>';
  scrollToEnd();

  const systemPrompt =
    (state.settings.systemPrompt && state.settings.systemPrompt.trim()) ||
    DEFAULT_SYSTEM_PROMPT;
  const payload = [
    { role: "system", content: systemPrompt },
    ...chat.messages
      .filter((m) => m.id !== asstMsg.id)
      .map(({ role, content }) => ({ role, content })),
  ];

  state.abortCtrl = new AbortController();
  state.generating = true;
  setGenerating(true);

  let buffer = "";
  try {
    for await (const chunk of state.engine.chat(
      payload,
      state.settings.generation,
      state.abortCtrl.signal
    )) {
      if (state.abortCtrl.signal.aborted) break;
      buffer += chunk;
      asstMsg.content = buffer;
      content.innerHTML =
        renderMarkdownSync(buffer) + '<span class="typing"></span>';
      attachCodeCopyButtons(content);
      scrollToEnd();
    }
    // final render w/ async deps
    const html = await renderMarkdown(buffer || "*(пустой ответ)*");
    content.innerHTML = html;
    attachCodeCopyButtons(content);
  } catch (err) {
    asstMsg.content =
      buffer + `\n\n> Ошибка: ${err.message || String(err)}`;
    content.innerHTML = renderMarkdownSync(asstMsg.content);
    attachCodeCopyButtons(content);
    toast(err.message || String(err), true);
  } finally {
    node.classList.remove("is-streaming");
    state.generating = false;
    state.abortCtrl = null;
    setGenerating(false);
    saveChats(state.chats);
  }
}

function regenerate(assistantId) {
  if (state.generating) return;
  const chat = activeChat();
  if (!chat) return;
  const idx = chat.messages.findIndex((m) => m.id === assistantId);
  if (idx === -1) return;
  chat.messages.splice(idx); // drop this and everything after
  saveChats(state.chats);
  renderActiveChat();
  streamReply(chat);
}

function setGenerating(on) {
  els.sendBtn.hidden = on;
  els.stopBtn.hidden = !on;
  els.input.disabled = on;
}

function stopGenerating() {
  if (state.abortCtrl) state.abortCtrl.abort();
}

/* ===== Composer behaviour ===== */
function autoresize() {
  const ta = els.input;
  ta.style.height = "auto";
  ta.style.height = Math.min(ta.scrollHeight, 220) + "px";
}

/* ===== Settings modal ===== */
function populateLocalModels() {
  els.localModelSelect.innerHTML = "";
  for (const m of LOCAL_MODELS) {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = m.label;
    els.localModelSelect.appendChild(o);
  }
  els.localModelSelect.value = state.settings.localModel;
}

function populateProviders() {
  const sel = els.providerSelect;
  sel.value = state.settings.cloud.providerKey;
  syncProviderFields(sel.value, /*initial*/ true);
}

function syncProviderFields(providerKey, initial = false) {
  const p = CLOUD_PROVIDERS[providerKey];
  if (!p) return;
  if (initial) {
    els.baseUrlInput.value = state.settings.cloud.baseUrl || p.baseUrl;
    els.apiKeyInput.value = state.settings.cloud.apiKey || "";
    els.cloudModelInput.value =
      state.settings.cloud.model || p.defaultModel || "";
  } else {
    els.baseUrlInput.value = p.baseUrl;
    els.cloudModelInput.value = p.defaultModel || "";
    if (!providerNeedsKey(providerKey)) {
      // Clear stale key when switching to a no-key provider so the field
      // doesn't look misleading.
      els.apiKeyInput.value = "";
    }
  }
  els.cloudModelList.innerHTML = "";
  for (const m of p.models) {
    const o = document.createElement("option");
    o.value = m;
    els.cloudModelList.appendChild(o);
  }
  const needsKey = providerNeedsKey(providerKey);
  if (els.apiKeyField) {
    els.apiKeyField.hidden = !needsKey;
  }
  els.apiKeyInput.required = needsKey;
  if (els.apiKeyHelp) {
    els.apiKeyHelp.textContent = needsKey
      ? "Хранится только в вашем браузере (localStorage)."
      : "Этому провайдеру ключ не нужен.";
  }
}

function openSettings(tab = "local") {
  // sync inputs
  els.localModelSelect.value = state.settings.localModel;
  els.providerSelect.value = state.settings.cloud.providerKey;
  syncProviderFields(state.settings.cloud.providerKey, true);
  els.systemPromptInput.value =
    state.settings.systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  els.tempInput.value = state.settings.generation.temperature;
  els.tempOut.value = state.settings.generation.temperature;
  els.topPInput.value = state.settings.generation.top_p;
  els.topPOut.value = state.settings.generation.top_p;
  els.maxTokensInput.value = state.settings.generation.max_tokens;
  els.streamInput.checked = !!state.settings.generation.stream;
  setTab(tab);
  if (!isWebGpuSupported()) els.webgpuWarn.hidden = false;
  els.settingsModal.showModal();
}

function closeSettings() {
  if (els.settingsModal.open) els.settingsModal.close();
}

function setTab(name) {
  $$(".tab").forEach((t) =>
    t.classList.toggle("is-active", t.dataset.tab === name)
  );
  $$(".tab-panel").forEach((p) =>
    p.classList.toggle("is-active", p.dataset.panel === name)
  );
}

function commitSettings() {
  // Local
  const newLocalModel = els.localModelSelect.value;
  state.settings.localModel = newLocalModel;

  // Cloud
  const newProviderKey = els.providerSelect.value;
  state.settings.cloud.providerKey = newProviderKey;
  state.settings.cloud.baseUrl = els.baseUrlInput.value.trim();
  state.settings.cloud.apiKey = providerNeedsKey(newProviderKey)
    ? els.apiKeyInput.value.trim()
    : "";
  state.settings.cloud.model = els.cloudModelInput.value.trim();

  // Generation
  state.settings.systemPrompt = els.systemPromptInput.value;
  state.settings.generation.temperature = parseFloat(els.tempInput.value);
  state.settings.generation.top_p = parseFloat(els.topPInput.value);
  state.settings.generation.max_tokens = parseInt(els.maxTokensInput.value, 10);
  state.settings.generation.stream = els.streamInput.checked;

  // Mode is chosen implicitly:
  //  - if cloud config is complete (key-free providers count when baseUrl+model
  //    are set), stay/switch to cloud;
  //  - otherwise fall back to local.
  const cloudComplete =
    !!state.settings.cloud.baseUrl &&
    !!state.settings.cloud.model &&
    (!providerNeedsKey(state.settings.cloud.providerKey) ||
      !!state.settings.cloud.apiKey);
  if (cloudComplete) {
    if (!state.engine.cloud.ready()) state.settings.mode = "cloud";
  } else if (state.engine.mode === "cloud") {
    state.settings.mode = "local";
  }

  saveSettings(state.settings);
  state.engine.setMode(state.settings.mode);
  state.engine.configureCloud({ ...state.settings.cloud });
  closeSettings();
  refreshHints();
  toast("Настройки сохранены");
}

// Translate WebLLM's English status strings to friendly Russian.
function localizeProgress(text, pct, elapsedSec) {
  if (!text) return `Загрузка модели… ${pct}%`;
  let t = text
    .replace(/^Start to fetch params.*/i, "Началась загрузка весов модели…")
    .replace(/Fetching param cache\s*\[(\d+)\/(\d+)\]:?.*?MB fetched\.?\s*(\d+)% completed.*/i,
             "Скачивается фрагмент $1/$2 · $3% общего объёма")
    .replace(/Loading model from cache.*/i, "Загрузка модели из кеша браузера…")
    .replace(/Loading model from\s*\S+.*/i, "Загрузка модели…")
    .replace(/Finish loading on .*?cuda.*$/i, "Модель загружена на GPU")
    .replace(/Finish loading on .*$/i, "Модель загружена")
    .replace(/Loading GPU shader modules.*/i, "Сборка GPU-шейдеров…")
    .replace(/Compile\b.*?modules?/i, "Компиляция GPU-модулей")
    .replace(/^\s+|\s+$/g, "");
  // Always append percentage so the user sees movement.
  if (!/\d+%/.test(t)) t += ` · ${pct}%`;
  if (elapsedSec > 1) t += `  •  прошло ${formatDuration(elapsedSec)}`;
  return t;
}

function formatDuration(s) {
  s = Math.round(s);
  if (s < 60) return `${s} с`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m} м${sec ? " " + sec + " с" : ""}`;
}

async function loadLocalModel() {
  if (!isWebGpuSupported()) {
    toast("WebGPU не поддерживается этим браузером", true);
    return;
  }
  const id = els.localModelSelect.value;
  const meta = LOCAL_MODELS.find((m) => m.id === id);
  const sizeLabel = meta?.label?.match(/~[\d.]+\s*ГБ/i)?.[0] || "";
  els.loadLocalBtn.disabled = true;
  els.localProgress.hidden = false;
  els.localProgressBar.style.width = "0%";
  els.localProgressText.textContent =
    `Подготовка к загрузке… ${sizeLabel ? "(" + sizeLabel + ")" : ""}`;
  const startedAt = performance.now();
  try {
    await state.engine.loadLocal(id, (r) => {
      const pct = Math.max(0, Math.min(100, Math.round((r.progress || 0) * 100)));
      const elapsed = (performance.now() - startedAt) / 1000;
      els.localProgressBar.style.width = pct + "%";
      els.localProgressText.textContent = localizeProgress(r.text, pct, elapsed);
    });
    els.localProgressBar.style.width = "100%";
    els.localProgressText.textContent = "Модель готова к работе · 100%";
    state.settings.mode = "local";
    state.settings.localModel = id;
    state.engine.setMode("local");
    saveSettings(state.settings);
    toast("Модель загружена");
    refreshHints();
  } catch (err) {
    if (isShaderCompileError(err)) {
      const compatible = LOCAL_MODELS.filter((m) => !m.coding)[0];
      const tryDifferent =
        compatible && compatible.id !== id ? compatible : null;
      els.localProgressText.innerHTML = `
        <strong>Не удалось скомпилировать GPU-шейдер этой модели.</strong><br>
        Драйвер / версия WebGPU в браузере не поддерживает операции, которые использует эта модель
        (это свойство вашего железа/браузера, не приложения).<br>
        ${tryDifferent
          ? `Попробуйте совместимую модель: <em>${tryDifferent.label}</em>, или перейдите на <strong>Облачный API</strong>.`
          : `Перейдите на <strong>Облачный API</strong> — там ограничения WebGPU не имеют значения.`}
        <br>
        <button type="button" class="btn btn--accent" data-action="goto-cloud" style="margin-top:8px">Открыть Облачный API</button>
        ${tryDifferent
          ? ` <button type="button" class="btn" data-action="try-compatible" style="margin-top:8px">Скачать совместимую</button>`
          : ""}
      `;
      els.localProgressText
        .querySelector('[data-action="goto-cloud"]')
        ?.addEventListener("click", () => setTab("cloud"));
      els.localProgressText
        .querySelector('[data-action="try-compatible"]')
        ?.addEventListener("click", () => {
          if (tryDifferent) {
            els.localModelSelect.value = tryDifferent.id;
            loadLocalModel();
          }
        });
      toast("Несовместимая WebGPU-реализация — перейдите на Cloud API", true);
    } else {
      els.localProgressText.textContent = `Ошибка: ${err.message || err}`;
      toast(err.message || String(err), true);
    }
  } finally {
    els.loadLocalBtn.disabled = false;
  }
}

async function unloadLocalModel() {
  await state.engine.unloadLocal();
  els.localProgress.hidden = true;
  toast("Модель выгружена");
  refreshHints();
}

async function testApi() {
  els.apiStatus.className = "status-pill";
  els.apiStatus.textContent = "Проверка…";
  // Probe a transient config — do NOT mutate the engine's saved config,
  // so cancelling the dialog leaves the existing setup intact.
  try {
    await state.engine.pingCloudConfig({
      providerKey: els.providerSelect.value,
      baseUrl: els.baseUrlInput.value.trim(),
      apiKey: els.apiKeyInput.value.trim(),
      model: els.cloudModelInput.value.trim(),
    });
    els.apiStatus.className = "status-pill is-ok";
    els.apiStatus.textContent = "OK · подключено";
  } catch (err) {
    els.apiStatus.className = "status-pill is-bad";
    els.apiStatus.textContent = "Ошибка: " + (err.message || err);
  }
}

/* ===== Hints / badges ===== */
function refreshHints() {
  els.engineBadge.textContent = state.engine.describe();
  if (state.engine.mode === "local") {
    els.engineHint.textContent = state.engine.ready()
      ? `Локальная модель загружена · ${state.engine.local.modelId}`
      : "Локальный режим. Откройте Настройки → «Загрузить модель».";
  } else {
    if (state.engine.ready()) {
      els.engineHint.textContent = `Облачный API · ${state.engine.cloud.config.model}`;
    } else {
      const needsKey = providerNeedsKey(
        state.engine.cloud.config?.providerKey
      );
      els.engineHint.textContent = needsKey
        ? "Облачный режим: укажите API-ключ в Настройках."
        : "Облачный режим: укажите модель/URL провайдера в Настройках.";
    }
  }
}

/* ===== Misc ===== */
function copyText(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast("Скопировано"))
    .catch(() => toast("Не удалось скопировать", true));
}

function exportChat() {
  const c = activeChat();
  if (!c) return;
  const md = `# ${c.title}\n\n` +
    c.messages
      .map(
        (m) =>
          `## ${m.role === "user" ? "Вы" : "Aris"}\n\n${m.content}\n`
      )
      .join("\n");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${c.title.replace(/[^\wа-яА-Я]+/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearActiveChat() {
  const c = activeChat();
  if (!c) return;
  if (!confirm("Очистить сообщения в этом чате?")) return;
  c.messages = [];
  c.title = "Новый чат";
  saveChats(state.chats);
  renderChatList();
  renderActiveChat();
}

let toastTimer;
function toast(text, isError = false) {
  els.toast.textContent = text;
  els.toast.classList.toggle("is-error", isError);
  els.toast.classList.add("is-show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove("is-show"), 2400);
}

function openSidebarMobile() {
  els.app.classList.add("is-sidebar-open");
  els.sidebar.classList.add("is-open");
}
function closeSidebarOnMobile() {
  els.app.classList.remove("is-sidebar-open");
  els.sidebar.classList.remove("is-open");
}

/* ===== Bind ===== */
function bindEvents() {
  els.newChatBtn.addEventListener("click", () => {
    createChat();
    renderChatList();
    renderActiveChat();
    els.input.focus();
    closeSidebarOnMobile();
  });
  els.themeBtn.addEventListener("click", toggleTheme);
  els.settingsBtn.addEventListener("click", () => openSettings("local"));
  els.exportBtn.addEventListener("click", exportChat);
  els.clearBtn.addEventListener("click", clearActiveChat);

  els.sidebarOpen.addEventListener("click", openSidebarMobile);
  els.sidebarClose.addEventListener("click", closeSidebarOnMobile);

  els.composer.addEventListener("submit", (e) => {
    e.preventDefault();
    send(els.input.value);
  });
  els.input.addEventListener("input", autoresize);
  els.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(els.input.value);
    }
  });
  els.stopBtn.addEventListener("click", stopGenerating);

  document.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-prompt]");
    if (chip) {
      els.input.value = chip.dataset.prompt.replace(/\\n/g, "\n");
      autoresize();
      els.input.focus();
    }
  });

  // Settings tabs
  $$(".tab").forEach((t) =>
    t.addEventListener("click", () => setTab(t.dataset.tab))
  );
  els.settingsClose.addEventListener("click", closeSettings);
  els.settingsCancel.addEventListener("click", closeSettings);
  els.settingsSave.addEventListener("click", commitSettings);
  els.loadLocalBtn.addEventListener("click", loadLocalModel);
  els.unloadLocalBtn.addEventListener("click", unloadLocalModel);
  els.testApiBtn.addEventListener("click", testApi);
  els.providerSelect.addEventListener("change", (e) =>
    syncProviderFields(e.target.value)
  );
  els.tempInput.addEventListener(
    "input",
    () => (els.tempOut.value = els.tempInput.value)
  );
  els.topPInput.addEventListener(
    "input",
    () => (els.topPOut.value = els.topPInput.value)
  );

  // Esc closes modal
  els.settingsModal.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeSettings();
  });
}

init();
