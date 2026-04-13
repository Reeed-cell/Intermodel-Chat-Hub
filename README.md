# 🚀 OpenRouter Free Chat

A clean, secure chat interface for [OpenRouter's free models](https://openrouter.ai/models?q=free).  
Built with **Node.js** (backend) + **plain HTML/CSS/JS** (frontend). No frameworks, no build steps.

> **Your API key never touches the browser.** All OpenRouter traffic is proxied through a local Node.js server — the key lives in `.env` on your machine only.

---

## ✨ Features

- 🆓 Dynamically loads all free models from OpenRouter's API
- 🔒 API key stays server-side — invisible to DevTools, Network tab, and page source
- 📡 Real-time streaming responses
- 💬 Persistent chat history (saved in `localStorage`)
- 📊 Client-side rate-limit tracker (50 req/day · 20 RPM)
- 🔄 Switch models mid-conversation — full history forwarded as context
- 🗑️ Clear chat and reload models buttons
- Zero npm dependencies beyond `express` and `dotenv`

---

## 🔐 Security model

```
Browser  →  /api/models  →  server.js  →  openrouter.ai
Browser  →  /api/chat    →  server.js  →  openrouter.ai
                              ↑
                    API key lives ONLY here (.env)
                    Never sent to the browser
```

| Threat | How it's handled |
|---|---|
| Key visible in Network tab | Browser only calls your own `/api/*` routes — `openrouter.ai` never appears |
| Key visible in page source | `index.html` has zero references to the key |
| Server fingerprinting | `X-Powered-By` (Express) and `Server` (Node) headers are stripped |
| Stack traces leaking | Errors return `"Something went wrong."` — details stay in your terminal |
| Accidental git push | `.env` is in `.gitignore` — can't be committed |

---

## 🛠 Setup

### Requirements
- [Node.js 18+](https://nodejs.org/) — uses the built-in `https` module, no extra packages needed for HTTP
- An [OpenRouter account](https://openrouter.ai) — free tier works fine

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/your-username/openrouter-chat.git
cd openrouter-chat

# 2. Install dependencies (just express + dotenv)
npm install

# 3. Open .env and paste your OpenRouter API key
#    Get one free at https://openrouter.ai/keys
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxx

# 4. Start the server
npm start

# 5. Open your browser
#    http://localhost:3000
```

For **auto-restart on file save** (Node 18+ built-in watcher):
```bash
npm run dev
```

---

## 📁 Project structure

```
openrouter-chat/
├── server.js          ← Node.js backend  (API key lives here)
├── public/
│   └── index.html     ← Frontend UI      (zero secrets)
├── .env               ← Your key         (git-ignored, never committed)
├── .env.example       ← Safe template    (committed, no real key)
├── .gitignore
├── package.json
├── LICENSE
└── README.md
```

---

## ✏️ Editing

Open the project folder in any editor — recommended options:

| Editor | Notes |
|---|---|
| [WebStorm](https://www.jetbrains.com/webstorm/) | Best-in-class JS/Node support, built-in debugger |
| [VS Code](https://code.visualstudio.com/) | Free, great extensions ecosystem |
| [Cursor](https://www.cursor.com/) | VS Code fork with AI built-in |
| [Zed](https://zed.dev/) | Fast, minimal, good for HTML/JS |
| [Sublime Text](https://www.sublimetext.com/) | Lightweight, no setup required |
| Any plain text editor | It's just `.js` and `.html` — no build step |

---

## 🔧 Configuration

All config lives in `.env`:

```env
OPENROUTER_API_KEY=your_key_here   # Required — get at openrouter.ai/keys
PORT=3000                           # Optional — defaults to 3000
```

To change rate limits, edit the constants at the top of `public/index.html`:
```js
const DAILY_LIMIT = 50;   // requests per day
const RPM_LIMIT   = 20;   // requests per minute
```

---

## 📜 License

[MIT](./LICENSE) — free to use, modify, and distribute.  
If you build something cool with it, a ⭐ on GitHub is always appreciated!
