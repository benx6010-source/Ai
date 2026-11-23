// User interface only. Talks to conversation.js, memory.js, provider.js, icon.js, tools.js.
import { handleMessage, getHistory, clearHistory } from "./conversation.js";
import { Memory } from "./memory.js";
import { provider, getKey, setKey, clearKey, getChoice, setChoice } from "./provider.js";
import { state } from "./emotion.js";

// Optional modules: if one is missing on the site, Opu still works without it.
let Tools = { list: () => [] };
let Icon = { apply() {}, stored: () => null, save() {}, reset() {}, fromFile: async () => { throw new Error("icon.js is missing on your site."); } };
try { Tools = (await import("./tools.js")).Tools; } catch {}
try { Icon = await import("./icon.js"); } catch {}
if (document.documentElement.dataset.build !== "3") window.opuBoot?.("Some Opu files are old (index.html and app.js don’t match). Upload all files again, then reload.");

const $ = id => document.getElementById(id);
const chat = $("chat"), input = $("input"), send = $("send"), app = $("app");
const NAMES = { gemini: "Gemini", openrouter: "OpenRouter", auto: "Auto" };
const hasAnyKey = () => !!(getKey("gemini") || getKey("openrouter"));

// ---------- views, theme ----------
const setView = v => { app.dataset.view = v; if (v === "chat") chat.scrollTop = chat.scrollHeight; };
document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => setView(b.dataset.go));

function applyMotion(m) { if (m === "off") document.documentElement.dataset.motion = "off"; else delete document.documentElement.dataset.motion; }
function applyTheme(t) {
  if (t === "system") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = t;
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector("meta[name=theme-color]").content = dark ? "#0b0b0c" : "#f5f5f2";
}

// ---------- dashboard cards ----------
function refresh() {
  const n = Memory.all().length;
  $("memVal").textContent = `${n} ${n === 1 ? "memory" : "memories"}`;
  $("setMem").textContent = `${n} saved on this device.`;
  const mood = state.mood === "neutral" ? "Calm" : state.mood[0].toUpperCase() + state.mood.slice(1), mv = $("moodVal");
  if (mv.textContent !== mood) { mv.textContent = mood; mv.classList.remove("pop"); void mv.offsetWidth; mv.classList.add("pop"); }
  $("provVal").textContent = NAMES[getChoice()];
  $("provSub").textContent = provider.last ? `Last reply: ${provider.last}` : "Tap to change";
  $("status").textContent = hasAnyKey() ? "Opu is ready" : "Add an API key in Settings to start";
  $("gState").textContent = getKey("gemini") ? "Saved" : "Not set";
  $("oState").textContent = getKey("openrouter") ? "Saved" : "Not set";
}

// ---------- chat ----------
function add(cls, text) {
  const d = document.createElement("div");
  d.className = cls; d.textContent = text;   // textContent = no HTML injection
  chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
  return d;
}
function renderHistory() {
  chat.innerHTML = "";
  const h = getHistory();
  if (!h.length) add("msg opu", "Hey. You’re here.");
  h.forEach(m => add(m.role === "user" ? "msg me" : "msg opu", m.text));
  if (!hasAnyKey()) add("note", "To start talking, open Settings and add a free Gemini or OpenRouter key.");
}
$("form").addEventListener("submit", async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = ""; send.disabled = true;
  add("msg me", text);
  const typing = add("note typing", ""); typing.innerHTML = "<i></i><i></i><i></i>";
  provider.onEvent = t => { typing.textContent = t; $("status").textContent = t; };
  try {
    const { reply, changes } = await handleMessage(text);
    typing.remove(); add("msg opu", reply); changes.forEach(c => add("note", c));
  } catch (err) { typing.remove(); add("err", err.message); }
  provider.onEvent = () => {};
  send.disabled = false; input.focus(); refresh();
});

// ---------- memory manager (unchanged behaviour) ----------
function renderMemory() {
  const list = $("memList"); list.innerHTML = "";
  if (!Memory.all().length) list.textContent = "Nothing saved yet.";
  Memory.all().forEach(m => {
    const row = document.createElement("div"); row.className = "mem";
    const info = document.createElement("div"); info.textContent = `${m.key.replace(/_/g, " ")}: ${m.value}`;
    const cat = document.createElement("small"); cat.textContent = m.category.replace("_", " "); info.appendChild(cat);
    const edit = document.createElement("button"); edit.textContent = "Edit";
    edit.onclick = () => { const v = prompt("New value", m.value); if (v) { Memory.edit(m.id, v.trim()); renderMemory(); refresh(); } };
    const del = document.createElement("button"); del.textContent = "Delete"; del.className = "danger";
    del.onclick = () => { Memory.remove(m.id); renderMemory(); refresh(); };
    row.append(info, edit, del); list.appendChild(row);
  });
}
const openMemory = () => { renderMemory(); $("memDlg").showModal(); };
const exportMemory = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([Memory.export()], { type: "application/json" }));
  a.download = "opu-memory.json"; a.click();
};
$("cardMem").onclick = $("qMem").onclick = $("setMemOpen").onclick = openMemory;
$("memClose").onclick = () => { $("memDlg").close(); refresh(); };
$("memExport").onclick = $("setMemExport").onclick = exportMemory;

// ---------- settings ----------
const openSettings = () => {
  document.querySelector(`[name=prov][value=${getChoice()}]`).checked = true;
  document.querySelector(`[name=theme][value=${localStorage.getItem("opu_theme") || "dark"}]`).checked = true;
  document.querySelector(`[name=motion][value=${localStorage.getItem("opu_motion") || "on"}]`).checked = true;
  refresh(); $("setDlg").showModal();
};
$("qSet").onclick = $("cardProv").onclick = openSettings;
$("setClose").onclick = () => { $("setDlg").close(); renderHistory(); refresh(); };
document.querySelectorAll("[name=prov]").forEach(r => r.onchange = () => { setChoice(r.value); refresh(); });
document.querySelectorAll("[name=theme]").forEach(r => r.onchange = () => { localStorage.setItem("opu_theme", r.value); applyTheme(r.value); });

document.querySelectorAll("[name=motion]").forEach(r => r.onchange = () => { localStorage.setItem("opu_motion", r.value); applyMotion(r.value); });
document.querySelectorAll("[data-show]").forEach(b => b.onclick = () => {
  const i = $(b.dataset.show); i.type = i.type === "password" ? "text" : "password"; b.textContent = i.type === "password" ? "Show" : "Hide";
});
document.querySelectorAll("[data-save]").forEach(b => b.onclick = () => {
  const i = $(b.dataset.input);
  if (i.value.trim()) setKey(i.value, b.dataset.save);
  i.value = ""; i.type = "password";                       // never keep the key on screen after saving
  document.querySelector(`[data-show=${b.dataset.input}]`).textContent = "Show"; refresh();
});
document.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => { clearKey(b.dataset.remove); $(b.dataset.input).value = ""; refresh(); });

$("clearChat").onclick = () => { if (confirm("Clear this conversation? Saved memories stay.")) { clearHistory(); renderHistory(); } };
$("clearAll").onclick = () => {
  if (confirm("Delete ALL data (memories, chat, API keys, icon) from this device?")) { localStorage.clear(); location.reload(); }
};

// ---------- icon ----------
let pending = null;
$("iconFile").onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try { pending = await Icon.fromFile(f); $("iconPrev").src = pending.s192; $("iconUse").disabled = false; $("iconMsg").textContent = "Preview ready. Tap Use icon to keep it."; }
  catch (err) { $("iconMsg").textContent = err.message; }
};
$("iconUse").onclick = () => {
  if (!pending) return;
  Icon.save(pending); Icon.apply(); $("iconUse").disabled = true;
  $("iconMsg").textContent = "Saved. The icon inside Opu and the browser tab updated. An app already installed on your home screen keeps its old icon: remove it and install again.";
};
$("iconReset").onclick = () => { Icon.reset(); pending = null; Icon.apply(); $("iconPrev").src = "icon-192.png"; $("iconUse").disabled = true; $("iconMsg").textContent = "Back to the default Opu icon."; };

// ---------- voice (speech to text only; starts only when you tap) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function startMic() {
  if (!SR) return add("note", "Voice input isn’t supported in this browser.");
  const r = new SR(); r.lang = "en-IN";
  r.onresult = e => { input.value = e.results[0][0].transcript; input.focus(); };
  r.start();
}
if (!SR) $("mic").hidden = true; else $("mic").onclick = startMic;
$("qVoice").onclick = () => { setView("chat"); startMic(); };

// ---------- start ----------
$("future").innerHTML = "";
Tools.list().forEach(t => { const s = document.createElement("span"); s.textContent = t.name + (t.platform === "android" ? " (Future Android Feature)" : ""); $("future").appendChild(s); });
applyTheme(localStorage.getItem("opu_theme") || "dark");
Icon.apply(); renderHistory(); refresh();
if (matchMedia("(min-width: 900px)").matches) setView("chat");
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(() => {});
