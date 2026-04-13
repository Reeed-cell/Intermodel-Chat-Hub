/**
 * OpenRouter Chat — Secure Backend Bridge
 * ----------------------------------------
 * - API key lives ONLY here, loaded from .env
 * - All OpenRouter traffic is proxied through this server
 * - The browser never sees the key, the base URL, or stack traces
 * - Server identity headers are stripped
 */
const path = require("path");
const fs = require("fs"); // Added this to 'peek' at your files
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("--- DEBUG START ---");
console.log("Current Directory:", __dirname);
console.log("Files in this folder:", fs.readdirSync(__dirname));
console.log("API Key found in process.env:", process.env.OPENROUTER_API_KEY ? "YES" : "NO");
console.log("--- DEBUG END ---");

const express = require("express");
const https   = require("https");
const http    = require("http");
const url     = require("url");

const app  = express();
const PORT = process.env.PORT || 3000;
const KEY  = process.env.OPENROUTER_API_KEY;


if (!KEY || KEY === "your_openrouter_api_key_here") {
  console.error(
    "\n  ❌  Missing API key.\n" +
    "  Copy .env.example → .env and add your OPENROUTER_API_KEY.\n"
  );
  process.exit(1);
}

// ── Security middleware ────────────────────────────────────────────────────────
app.disable("x-powered-by");                        // hide "Express"
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options":    "nosniff",
    "X-Frame-Options":           "DENY",
    "Referrer-Policy":           "no-referrer",
    "Cache-Control":             "no-store",
  });
  res.removeHeader("Server");                       // hide Node/http version
  next();
});

app.use(express.json({ limit: "64kb" }));
app.use(express.static(__dirname));;

// ── Simple in-memory rate limiter (per IP, 60 req/min) ────────────────────────
const ipWindows = new Map();
function rateLimit(req, res, next) {
  const ip  = req.ip;
  const now = Date.now();
  const win = ipWindows.get(ip) || [];
  const recent = win.filter(t => now - t < 60_000);
  if (recent.length >= 60) {
    return res.status(429).json({ error: "Too many requests. Slow down." });
  }
  recent.push(now);
  ipWindows.set(ip, recent);
  next();
}

// ── Internal helper: HTTPS request to OpenRouter ──────────────────────────────
const OR_HOST = "openrouter.ai";

function orRequest(method, path, body, onData, onEnd, onError) {
  const postBody = body ? JSON.stringify(body) : null;
  const options = {
    hostname: OR_HOST,
    port: 443,
    path,
    method,
    headers: {
      "Authorization":  `Bearer ${KEY}`,
      "Content-Type":   "application/json",
      "HTTP-Referer":   "http://localhost",
      "X-Title":        "OpenRouter Free Chat",
      ...(postBody ? { "Content-Length": Buffer.byteLength(postBody) } : {}),
    },
  };

  const req = https.request(options, (res) => {
    res.on("data", onData);
    res.on("end",  onEnd);
  });

  req.on("error", onError);
  if (postBody) req.write(postBody);
  req.end();
}

// ── Route: GET /api/models ─────────────────────────────────────────────────────
// Cached for 5 min server-side so the key is never used excessively
let _modelsCache   = null;
let _modelsCacheTs = 0;

const ICONS = {
  deepseek: "⚡", "meta-llama": "🦙", google: "🔷",
  qwen: "🌀", mistralai: "🟣", microsoft: "🟠",
  nvidia: "🟢", openai: "🔵", anthropic: "🟡",
  openrouter: "🤖", cohere: "🧡", nousresearch: "🔴", "x-ai": "🌐",
};

app.get("/api/models", rateLimit, (req, res) => {
  if (_modelsCache && Date.now() - _modelsCacheTs < 300_000) {
    return res.json(_modelsCache);
  }

  let raw = "";
  orRequest(
    "GET", "/api/v1/models", null,
    (chunk) => { raw += chunk; },
    () => {
      try {
        const data = JSON.parse(raw).data || [];
        const models = {};

        for (const m of data) {
          const p = m.pricing || {};
          if (String(p.prompt ?? "1") !== "0" || String(p.completion ?? "1") !== "0") continue;

          const provider = m.id.includes("/") ? m.id.split("/")[0] : m.id;
          const icon     = ICONS[provider] || "🔮";
          const ctxK     = Math.round((m.context_length || 0) / 1000);
          const label    = `${icon} ${m.name || m.id} (${ctxK}K ctx)`;
          models[label]  = { id: m.id, ctx: m.context_length || 0 };
        }

        // Sort by context window descending
        const sorted = Object.fromEntries(
          Object.entries(models)
            .sort((a, b) => b[1].ctx - a[1].ctx)
            .map(([label, v]) => [label, v.id])
        );

        _modelsCache   = sorted;
        _modelsCacheTs = Date.now();
        res.json(sorted);
      } catch {
        res.status(502).json({ error: "Could not load models." });
      }
    },
    () => res.status(502).json({ error: "Could not reach upstream." })
  );
});

// ── Route: POST /api/chat  (Server-Sent Events stream) ───────────────────────
app.post("/api/chat", rateLimit, (req, res) => {
  const { model, messages } = req.body;

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid request body." });
  }

  // Validate messages: only allow role + content strings
  const clean = messages.map(m => ({
    role:    String(m.role    || "").slice(0, 20),
    content: String(m.content || "").slice(0, 32_000),
  }));

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");

  orRequest(
    "POST", "/api/v1/chat/completions",
    { model, messages: clean, stream: true },
    (chunk) => {
      // Pass raw SSE chunks straight through — never adds or logs the key
      res.write(chunk);
    },
    () => {
      res.write("data: [DONE]\n\n");
      res.end();
    },
    () => {
      res.write(`data: ${JSON.stringify({ error: "Stream failed." })}\n\n`);
      res.end();
    }
  );
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found." }));

// ── Global error handler: never leak stack traces ─────────────────────────────
app.use((err, req, res, next) => {            // eslint-disable-line no-unused-vars
  console.error("[server error]", err.message); // stays on the server only
  res.status(500).json({ error: "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`\n  ✅  OpenRouter Chat running → http://localhost:${PORT}\n`);
});
