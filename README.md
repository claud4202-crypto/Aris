# Aris — AI чат-бот для кода

![status](https://img.shields.io/badge/status-ready-22c55e) ![type](https://img.shields.io/badge/static-HTML%20%2B%20JS-7c5cff) ![license](https://img.shields.io/badge/license-MIT-blue)

Статический веб-чат с двумя режимами работы:

1. **Локальная модель в браузере (WebLLM, WebGPU).** Никакие данные не уходят
   на сервер — модель скачивается один раз и работает прямо на вашем
   устройстве.
2. **Мощная облачная модель через OpenAI-совместимый API.** Поддерживаются
   OpenRouter, OpenAI, DeepSeek, Groq, Together AI и любой свой URL.

Заточен под задачи программирования: подсветка синтаксиса, копирование блоков
кода, стриминг ответов по токенам, настраиваемый системный промпт.

## Быстрый старт

> Всё работает чисто на статике — никакой сборки не требуется.

```bash
git clone https://github.com/claud4202-crypto/Aris.git
cd Aris
# Любой статический сервер. Например:
python3 -m http.server 8080
# открыть http://localhost:8080
```

> Файл `index.html` нужно открывать **по HTTP/HTTPS**, а не `file://` — иначе
> браузер не загрузит ESM-модули с CDN и WebGPU не инициализируется.

## Использование

### Вариант A. Локальная модель (бесплатно, приватно)

1. Откройте сайт.
2. Нажмите ⚙️ **Настройки → Локальная модель**.
3. Выберите модель (рекомендуется **Qwen2.5-Coder 7B** для кодинга, либо
   **Qwen2.5-Coder 1.5B**, если устройство слабее).
4. Нажмите **«Загрузить модель»**. При первом запуске модель (~1–4 ГБ)
   будет скачана и закэширована в браузере.
5. Закройте настройки и начинайте диалог.

Требования: Chrome / Edge **113+** (или другой браузер с включённым WebGPU).
Сафари — экспериментально (включается в Develop → Feature Flags).

### Вариант B. Мощная облачная модель

1. Получите API-ключ у одного из провайдеров:
   * [OpenRouter](https://openrouter.ai/keys) — самый широкий выбор моделей
     (Qwen2.5-Coder 32B, DeepSeek-Coder, Claude 3.5 Sonnet, GPT-4o…).
   * [OpenAI](https://platform.openai.com/api-keys)
   * [DeepSeek](https://platform.deepseek.com/api_keys)
   * [Groq](https://console.groq.com/keys) — очень быстрый инференс.
   * [Together AI](https://api.together.xyz/settings/api-keys)
2. ⚙️ **Настройки → Облачный API**.
3. Выберите провайдера, вставьте ключ, при необходимости поменяйте модель
   (например `qwen/qwen-2.5-coder-32b-instruct`).
4. Нажмите **«Проверить соединение»**, затем **«Сохранить»**.

API-ключ хранится **только** в `localStorage` вашего браузера и шлётся
напрямую провайдеру.

## Возможности

* 🗂 Несколько чатов с авто-названием и удалением.
* ⏯ Стриминг ответа по токенам + кнопка «Стоп».
* 🧠 Настраиваемые `temperature`, `top_p`, `max_tokens`, `system prompt`.
* 🧩 Markdown с подсветкой кода (highlight.js) и копированием блоков.
* 🌗 Тёмная / светлая тема.
* 💾 Экспорт чата в Markdown.
* 📱 Адаптивный интерфейс (десктоп + мобильный).
* 🔁 Перегенерация последнего ответа, редактирование своих сообщений.

## Архитектура

```
index.html              # разметка
styles/main.css         # тема + UI
scripts/app.js          # контроллер UI
scripts/engine.js       # абстракция бекендов (local | cloud)
scripts/storage.js      # localStorage helpers
scripts/markdown.js     # marked + DOMPurify + highlight.js
assets/favicon.svg
```

Внешние зависимости подгружаются по ESM с CDN при первом обращении:

* [`@mlc-ai/web-llm`](https://github.com/mlc-ai/web-llm) — локальный
  инференс через WebGPU.
* [`marked`](https://marked.js.org/) — Markdown.
* [`dompurify`](https://github.com/cure53/DOMPurify) — санитайзинг HTML.
* [`highlight.js`](https://highlightjs.org/) — подсветка кода.

## Поддерживаемые модели (локально)

Из коробки в селекторе предлагаются:

| Модель | Размер | Назначение |
|---|---|---|
| `Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC`   | ~4 ГБ | кодинг, мощная |
| `Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC`   | ~2 ГБ | кодинг, баланс |
| `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` | ~1 ГБ | кодинг, лёгкая |
| `Llama-3.1-8B-Instruct-q4f32_1-MLC`       | ~4.5 ГБ | универсальная |
| `Qwen2.5-7B-Instruct-q4f16_1-MLC`         | ~4 ГБ | универсальная |
| `Phi-3.5-mini-instruct-q4f16_1-MLC`       | ~2.4 ГБ | быстрая |

Полный каталог: <https://github.com/mlc-ai/web-llm/blob/main/src/config.ts>.

## Лицензия

MIT.
