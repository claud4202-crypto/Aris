// Markdown + code highlighting via CDN ESM modules.
// We load lazily to keep first paint fast.

let marked = null;
let DOMPurify = null;
let hljs = null;
let markedConfigured = false;

async function ensureDeps() {
  if (!marked) {
    const m = await import("https://esm.run/marked@12");
    marked = m.marked || m.default;
  }
  if (!DOMPurify) {
    const m = await import("https://esm.run/dompurify@3");
    DOMPurify = m.default || m;
  }
  if (!hljs) {
    try {
      const m = await import("https://esm.run/highlight.js@11/lib/common");
      hljs = m.default || m;
    } catch (_) {
      const m = await import("https://esm.run/highlight.js@11");
      hljs = m.default || m;
    }
  }
  configureMarked();
}

function highlight(code, lang) {
  if (!hljs) return escapeHtml(code);
  try {
    if (lang && hljs.getLanguage?.(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    }
    return hljs.highlightAuto(code).value;
  } catch (_) {
    return escapeHtml(code);
  }
}

function configureMarked() {
  if (markedConfigured || !marked) return;
  // marked v5+ removed the `highlight` option — use a renderer override.
  // Signature differs between marked majors:
  //   v12 and older:  renderer.code(code, infostring, escaped)
  //   v15+:           renderer.code({ text, lang, escaped })
  const renderer = new marked.Renderer();
  renderer.code = function (codeOrToken, infostring) {
    const code =
      typeof codeOrToken === "object" ? codeOrToken.text : codeOrToken;
    const lang =
      typeof codeOrToken === "object" ? codeOrToken.lang : infostring;
    const cleanLang = (lang || "").split(/\s+/)[0];
    const langClass = cleanLang
      ? ` class="language-${escapeHtml(cleanLang)} hljs"`
      : ' class="hljs"';
    const body = highlight(code, cleanLang);
    return `<pre><code${langClass}>${body}</code></pre>\n`;
  };
  marked.setOptions({
    breaks: true,
    gfm: true,
    renderer,
  });
  markedConfigured = true;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Synchronous, escape-only renderer used until deps load (and as fallback)
function renderPlain(text) {
  return `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>`;
}

let depsPromise = null;

export async function renderMarkdown(text) {
  if (!text) return "";
  depsPromise = depsPromise || ensureDeps();
  await depsPromise;

  configureMarked();
  const html = marked.parse(text);
  const clean = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: ["class", "href", "target", "rel"],
  });
  return clean;
}

export function renderMarkdownSync(text) {
  // Optimistic: if deps are loaded use the real renderer, otherwise plain.
  if (marked && DOMPurify) {
    try {
      configureMarked();
      const html = marked.parse(text || "");
      return DOMPurify.sanitize(html, {
        USE_PROFILES: { html: true },
        ALLOWED_ATTR: ["class", "href", "target", "rel"],
      });
    } catch (_) {
      return renderPlain(text || "");
    }
  }
  // Kick off load and return placeholder
  depsPromise = depsPromise || ensureDeps();
  return renderPlain(text || "");
}

export function attachCodeCopyButtons(root) {
  const pres = root.querySelectorAll("pre");
  pres.forEach((pre) => {
    if (pre.dataset.copyAttached) return;
    pre.dataset.copyAttached = "1";
    pre.classList.add("code-block");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "code-block__copy";
    btn.textContent = "Копировать";
    btn.addEventListener("click", async () => {
      const code = pre.querySelector("code")?.innerText ?? pre.innerText;
      try {
        await navigator.clipboard.writeText(code);
        btn.textContent = "Скопировано";
        setTimeout(() => (btn.textContent = "Копировать"), 1200);
      } catch (_) {
        btn.textContent = "Ошибка";
      }
    });
    pre.appendChild(btn);
  });
}

export async function preloadMarkdownDeps() {
  depsPromise = depsPromise || ensureDeps();
  return depsPromise;
}
