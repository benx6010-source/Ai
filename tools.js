// Future-capability registry + approval gate.
// Nothing here performs real actions yet. Every tool below is "future" and Tools.run() refuses it honestly.
export const Approval = {
  ask({ title, detail = "", yes = "Approve", no = "Cancel" }) {
    const d = document.getElementById("apprDlg");
    const ok = d.querySelector("[data-yes]"), no_ = d.querySelector("[data-no]");
    d.querySelector("h2").textContent = title; d.querySelector("p").textContent = detail;
    ok.textContent = yes; no_.textContent = no;
    return new Promise(res => {
      const done = v => { ok.onclick = no_.onclick = d.oncancel = null; d.close(); res(v); };
      ok.onclick = () => done(true); no_.onclick = () => done(false); d.oncancel = () => done(false);
      d.showModal();
    });
  }
};

const T = {};
export const Tools = {
  // tool = { id, name, status: "available"|"future", platform: "web"|"android", sensitive, describe(args), run(args) }
  register(t) { T[t.id] = t; },
  list: () => Object.values(T),
  async run(id, args = {}) {
    const t = T[id];
    if (!t) return { ok: false, reason: "Unknown tool." };
    if (t.status !== "available" || !t.run) return { ok: false, reason: `${t.name} isn’t built yet (${t.platform === "android" ? "Future Android Feature" : "planned"}).` };
    if (t.sensitive && !(await Approval.ask({ title: `Allow: ${t.name}?`, detail: t.describe ? t.describe(args) : "" })))
      return { ok: false, reason: "Cancelled by you." };
    return { ok: true, result: await t.run(args) };
  }
};

// [id, name, platform, sensitive]
[["voice_replies", "Spoken replies", "web", false], ["wake_phrase", "Wake phrase (“Opu, come here”)", "android", true],
 ["avatar_3d", "Animated 3D avatar", "web", false], ["camera", "Camera", "android", true],
 ["screen_control", "Screen and app interaction", "android", true], ["youtube", "YouTube control", "android", true],
 ["spotify", "Spotify control", "android", true], ["chrome", "Chrome assistance", "android", true],
 ["discord", "Discord assistance", "android", true], ["instagram", "Instagram assistance", "android", true],
 ["ai_handoff", "Claude / ChatGPT / Gemini handoff", "web", true], ["code_prompts", "Code and prompt generation", "web", false],
 ["reminders", "Reminders and notifications", "android", true], ["morning", "Morning wake-up assistant", "android", true]
].forEach(([id, name, platform, sensitive]) => Tools.register({ id, name, platform, sensitive, status: "future" }));
