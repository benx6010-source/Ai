// AI provider layer: Gemini + OpenRouter, retry with backoff, and Auto fallback.
// conversation.js only calls provider.generateStructuredOutput() and is unaware of any of this.
import { CONFIG } from "./config.js";

const get = k => localStorage.getItem(k) || "";
const KEYS = { gemini: "opu_api_key", openrouter: "opu_openrouter_key" }; // gemini key name kept from V1
export const getKey = (n = "gemini") => get(KEYS[n]);
export const setKey = (k, n = "gemini") => localStorage.setItem(KEYS[n], k.trim());
export const clearKey = n => localStorage.removeItem(KEYS[n]);
export const getChoice = () => get("opu_provider") || "auto";
export const setChoice = c => localStorage.setItem("opu_provider", c);

class ProviderError extends Error {
  constructor(msg, status, kind) { super(msg); this.status = status; this.kind = kind; }
}
function httpError(status, d) {
  const raw = d?.error?.message || "";
  if (status === 429) return new ProviderError("AI is receiving too many requests right now.", status, "busy");
  if ([500, 502, 503, 504].includes(status)) return new ProviderError("The AI service is temporarily busy.", status, "busy");
  if ([401, 403].includes(status) || /api key/i.test(raw)) return new ProviderError("Your API key appears to be invalid. Check Settings.", status, "key");
  if (status === 404) return new ProviderError("That AI model isn’t available any more. Change the model name in config.js.", status, "model");
  return new ProviderError(raw || `The AI service returned an error (${status}).`, status, "other");
}
async function post(url, headers, body) {
  let r;
  try { r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }); }
  catch { throw new ProviderError("I can’t reach the AI service right now. Check your internet connection.", 0, "network"); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw httpError(r.status, d);
  return d;
}

const impl = {
  gemini: {
    name: "Gemini",
    async text(system, msgs, json) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${encodeURIComponent(getKey("gemini"))}`;
      const d = await post(url, {}, {
        systemInstruction: { parts: [{ text: system }] },
        contents: msgs.map(m => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.text }] })),
        generationConfig: { temperature: CONFIG.temperature, ...(json ? { responseMimeType: "application/json" } : {}) }
      });
      return (d.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    }
  },
  openrouter: {
    name: "OpenRouter",
    async text(system, msgs) {
      const d = await post("https://openrouter.ai/api/v1/chat/completions",
        { Authorization: "Bearer " + getKey("openrouter"), "X-Title": "Opu" },
        { model: CONFIG.OPENROUTER_MODEL, temperature: CONFIG.temperature,
          messages: [{ role: "system", content: system }, ...msgs.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }))] });
      return d.choices?.[0]?.message?.content || "";
    }
  }
};

// Same JSON contract as V1: { reply, memory_ops }. Tolerates code fences / extra text (free models).
function parse(t) {
  t = t.replace(/```json|```/g, "").trim();
  for (const s of [t, t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)]) {
    try { const o = JSON.parse(s); if (o && typeof o === "object") return o; } catch {}
  }
  return { reply: t, memory_ops: [] };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

class Router {
  last = "";                 // name of the provider that answered last
  onEvent = () => {};        // UI hook for "retrying / trying another provider" messages
  order() {
    const c = getChoice();
    const list = (c === "auto" ? ["gemini", "openrouter"] : [c]).filter(n => getKey(n));
    if (!list.length) throw new ProviderError(c === "auto" ? "No API key yet. Open Settings and add a Gemini or OpenRouter key." : `No ${impl[c].name} key yet. Open Settings and add it.`, 0, "key");
    return list;
  }
  // History and memory are only touched by conversation.js AFTER this returns, so retries can't duplicate anything.
  async run(system, msgs, json) {
    const order = this.order(), errors = [];
    for (let p = 0; p < order.length; p++) {
      const n = order[p];
      for (let i = 0; i <= CONFIG.retries; i++) {
        try { const t = await impl[n].text(system, msgs, json); this.last = impl[n].name; return t; }
        catch (e) {
          if (!(e instanceof ProviderError)) e = new ProviderError("Something went wrong talking to the AI.", 0, "other");
          if ((e.kind === "busy" || e.kind === "network") && i < CONFIG.retries) {
            this.onEvent(e.message + " I’ll try again."); await sleep(CONFIG.retryBaseMs * 2 ** i); continue;
          }
          errors.push(e.message); break;
        }
      }
      if (p < order.length - 1) this.onEvent("The AI service is temporarily busy. Trying another provider...");
    }
    throw new Error([...new Set(errors)].join(" "));
  }
  sendMessage(system, msgs) { return this.run(system, msgs, false); }
  async *streamResponse(system, msgs) { yield await this.sendMessage(system, msgs); } // real streaming: later
  async generateStructuredOutput(system, msgs) { return parse(await this.run(system, msgs, true)); }
}
export const provider = new Router();
