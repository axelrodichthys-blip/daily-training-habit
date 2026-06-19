/* ============================================================
   毎日トレーニング習慣アプリ
   - データは端末内(localStorage)に保存。サーバー不要。
   ============================================================ */

/* ---------- プリセット・メニュー（おまかせ） ----------
   step: { name, emoji, sec, desc }  sec=その種目の秒数
   ルーティンは「種目を順番に再生」していく。 */
const PRESET_ROUTINES = [
  {
    id: "bedtime",
    name: "寝る前ストレッチ",
    emoji: "🌙",
    when: "night",
    desc: "1日の緊張をほぐして寝つきを良く",
    steps: [
      { name: "猫のポーズ", emoji: "🐱", sec: 180, desc: "四つ這いで、息を吸って背中を反らし、吐いて丸める。背骨を1つずつ動かすイメージでゆっくり繰り返す" },
      { name: "肩・肩甲骨ほぐし", emoji: "🙆", sec: 180, desc: "肩を大きく回す（前回し→後ろ回し）。次に両肩をすくめて3秒キープ、ストンと落とす。最後に肩甲骨を中央へ寄せる" },
      { name: "寝たまま腰ひねり", emoji: "🔄", sec: 180, desc: "仰向けで両膝を立て、左右にゆっくり倒す。肩は床につけたまま。腰とお尻がじんわり伸びる" },
      { name: "ストレッチポールで胸開き", emoji: "🪵", sec: 180, desc: "ポールに背骨を縦に乗せて仰向け。両腕を横に広げ、胸と肩をゆっくり開く。ポールが無ければ丸めたバスタオルでもOK" },
      { name: "深呼吸でおやすみ", emoji: "😌", sec: 180, desc: "仰向けで全身の力を抜き、鼻から4秒吸って口から6秒かけて吐く。眠りに入る準備をする" },
    ],
  },
];

/* ---------- ストレージ ---------- */
const LS = {
  log: "ht_log_v1",          // { "2026-06-17": { routineId, doneSteps, total, ts } }
  settings: "ht_settings_v1",
  custom: "ht_custom_v1",    // ユーザー追加ルーティン
  bgm: "ht_bgm_v1",          // 自分のBGMリストの並び順 [{id, name}]（曲データ本体はIndexedDB）
};
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
};

let settings = store.get(LS.settings, {
  reminderTime: "22:00",
  notify: false,
  defaultRoutine: "auto",
  music: true,
  bgmSource: "default",      // "default"（添付2曲）/ "custom"（自分のリスト）
});
if (settings.music === undefined) settings.music = true; // 既存ユーザーは音楽ONをデフォルトに
if (!settings.bgmSource) settings.bgmSource = "default";
let log = store.get(LS.log, {});
let customRoutines = store.get(LS.custom, []);
let bgmList = store.get(LS.bgm, []);   // [{id, name}] 並び順

function allRoutines() { return [...PRESET_ROUTINES, ...customRoutines]; }
function routineById(id) { return allRoutines().find(r => r.id === id); }

/* ---------- 日付ユーティリティ ---------- */
function todayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fmtDateJP(d = new Date()) {
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日(${w})`;
}

/* ---------- 連続日数(ストリーク) ---------- */
function computeStreak() {
  let streak = 0;
  const d = new Date();
  // 今日がまだ未達なら昨日から数える（今日やればプラス1表示）
  if (!log[todayKey(d)]) d.setDate(d.getDate() - 1);
  while (log[todayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}
function totalDays() { return Object.keys(log).length; }

/* ---------- リワード（達成バッジ）：通算（加算式）でカウント ----------
   実施した日を古い順に並べ、N日目（通算N日）が
   7の倍数 / 30の倍数 / 50の倍数になった日にバッジを付与。 */
function milestonesFor(n) {
  const out = [];
  if (n > 0 && n % 50 === 0) out.push({ tier: 50, emoji: "👑", title: `通算${n}日達成！`, sub: `${n}日の大台、本当におめでとうございます！🎉` });
  if (n > 0 && n % 30 === 0) out.push({ tier: 30, emoji: "🏅", title: `通算${n}日達成！`, sub: `${Math.round(n / 30)}ヶ月ぶんの積み重ね！🎉` });
  if (n > 0 && n % 7 === 0) out.push({ tier: 7, emoji: "🌟", title: `通算${n}日達成！`, sub: `${Math.round(n / 7)}週間ぶん継続中！🎉` });
  return out; // tierが大きい順
}
// 実施日 → その日に獲得したリワード配列
function computeRewards() {
  const map = {};
  Object.keys(log).sort().forEach((d, i) => {
    const ms = milestonesFor(i + 1);
    if (ms.length) map[d] = ms;
  });
  return map;
}

/* ---------- おすすめルーティン（時間帯で） ---------- */
function suggestedRoutineId() {
  let id = (settings.defaultRoutine && settings.defaultRoutine !== "auto") ? settings.defaultRoutine : null;
  if (!id) {
    const h = new Date().getHours();
    id = (h >= 20 || h < 4) ? "bedtime" : (h < 10 ? "morning" : "neck");
  }
  // 該当ルーティンが無ければ先頭にフォールバック
  return routineById(id) ? id : (allRoutines()[0] && allRoutines()[0].id);
}

/* ============================================================
   画面描画
   ============================================================ */
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

function renderToday() {
  $("#date-label").textContent = fmtDateJP();
  // ストリーク
  const streak = computeStreak();
  $("#streak-num").textContent = streak;
  $("#total-days").textContent = totalDays();
  const todayDone = !!log[todayKey()];
  $("#streak-flame").textContent = todayDone ? "🔥" : (streak > 0 ? "🔥" : "✨");
  $("#today-status").textContent = todayDone ? "今日は達成済み！" : "今日はまだ";

  // ルーティン一覧（おすすめを先頭に）
  const sug = suggestedRoutineId();
  const list = allRoutines().slice().sort((a, b) => (a.id === sug ? -1 : b.id === sug ? 1 : 0));
  const todayLog = log[todayKey()];
  const wrap = $("#routine-list");
  wrap.innerHTML = "";
  list.forEach(r => {
    const mins = Math.round(r.steps.reduce((s, x) => s + x.sec, 0) / 60);
    const isToday = todayLog && todayLog.routineId === r.id;
    const el = document.createElement("div");
    el.className = "routine" + (isToday ? " done" : "");
    el.innerHTML = `
      <div class="emoji">${r.emoji}</div>
      <div class="meta">
        <div class="name">${r.name} ${r.id === sug ? '<span class="tag">おすすめ</span>' : ""}</div>
        <div class="sub">${r.steps.length}種目・約${mins}分　${r.desc}</div>
      </div>
      <div class="go">${isToday ? "✓" : "▶"}</div>`;
    el.onclick = () => startPlayer(r.id);
    wrap.appendChild(el);
  });
}

/* ---------- 履歴カレンダー ---------- */
let calMonth = new Date();
function renderHistory() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $("#cal-title").textContent = `${y}年 ${m + 1}月`;
  const grid = $("#cal-grid");
  grid.innerHTML = "";
  ["日", "月", "火", "水", "木", "金", "土"].forEach(d => {
    const c = document.createElement("div"); c.className = "dow"; c.textContent = d; grid.appendChild(c);
  });
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  for (let i = 0; i < first; i++) { const c = document.createElement("div"); c.className = "cal-cell empty"; grid.appendChild(c); }
  const tk = todayKey();
  const rewards = computeRewards();
  for (let d = 1; d <= days; d++) {
    const key = todayKey(new Date(y, m, d));
    const entry = log[key];
    const rw = rewards[key]; // この日のリワード（あれば）
    const c = document.createElement("div");
    c.className = "cal-cell" + (entry ? " has" : "") + (key === tk ? " today" : "") + (rw ? " reward-cell" : "");
    const r = entry ? routineById(entry.routineId) : null;
    const badge = rw ? `<span class="reward">${rw[0].emoji}</span>` : "";
    c.innerHTML = `${d}${badge}${entry ? `<span class="dot">${r ? r.emoji : "✓"}</span>` : ""}`;
    if (rw) c.onclick = () => showRewardModal(rw, key);
    grid.appendChild(c);
  }
  // 今月の達成数
  const cnt = Object.keys(log).filter(k => k.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)).length;
  $("#month-count").textContent = cnt;
}

/* ---------- 設定 ---------- */
function renderSettings() {
  $("#set-time").value = settings.reminderTime;
  $("#set-notify").checked = settings.notify;
  $("#set-music").checked = settings.music;
  renderBgmSettings();
  updateNotifyHint();
}
function renderBgmSettings() {
  const isCustom = settings.bgmSource === "custom";
  $("#bgm-src-default").classList.toggle("active", !isCustom);
  $("#bgm-src-custom").classList.toggle("active", isCustom);
  $("#bgm-default-info").style.display = isCustom ? "none" : "block";
  $("#bgm-custom-panel").style.display = isCustom ? "block" : "none";
  if (isCustom) renderBgmList();
}
function renderBgmList() {
  const wrap = $("#bgm-list");
  wrap.innerHTML = "";
  bgmList.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "bgm-row";
    row.dataset.id = item.id;
    row.innerHTML = `
      <span class="handle" title="ドラッグで並び替え">⠿</span>
      <span class="idx">${i + 1}</span>
      <span class="nm">${escapeHtml(item.name)}</span>
      <button class="del" title="削除">🗑</button>`;
    row.querySelector(".del").onclick = () => deleteBgm(item.id);
    attachDragHandle(row);
    wrap.appendChild(row);
  });
  $("#bgm-count").textContent = bgmList.length;
  $("#bgm-empty").style.display = bgmList.length ? "none" : "block";
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

/* ---------- リワード・ポップアップ ---------- */
function showRewardModal(ms, dateKey) {
  $("#reward-emoji").textContent = ms[0].emoji;
  $("#reward-title").textContent = ms[0].title;
  const dateNote = dateKey ? `<div class="line" style="opacity:.7;margin-top:8px">${dateKey.replace(/-/g, "/")} 達成</div>` : "";
  $("#reward-body").innerHTML = ms.map(m => `<div class="line">${m.emoji} ${m.sub}</div>`).join("") + dateNote;
  $("#reward-modal").classList.add("active");
  celebrate();
}
function updateNotifyHint() {
  const perm = ("Notification" in window) ? Notification.permission : "unsupported";
  const map = { granted: "通知は許可済みです。", denied: "ブラウザで通知がブロックされています。端末の設定から許可してください。", default: "オンにすると通知の許可を求めます。", unsupported: "この端末/ブラウザは通知に未対応です。" };
  $("#notify-state").textContent = map[perm] || "";
}

/* ============================================================
   トレーニング・プレイヤー
   ============================================================ */
let player = { routine: null, idx: 0, remain: 0, timer: null, paused: false, doneSteps: 0 };

function startPlayer(routineId) {
  const r = routineById(routineId);
  if (!r) return;
  player = { routine: r, idx: 0, remain: r.steps[0].sec, timer: null, paused: false, doneSteps: 0 };
  $("#player").classList.add("active");
  updateMusicBtn();
  loadStep();
  resumeTimer();
  startBGM();
}
function loadStep() {
  const r = player.routine, s = r.steps[player.idx];
  player.remain = s.sec;
  $("#p-emoji").textContent = s.emoji;
  $("#p-name").textContent = s.name;
  $("#p-desc").textContent = s.desc || "";
  $("#p-timer").classList.toggle("rest", !!s.rest);
  $("#p-count").textContent = `${player.idx + 1} / ${r.steps.length}`;
  const next = r.steps[player.idx + 1];
  $("#p-next").textContent = next ? `次は… ${next.emoji} ${next.name}` : "これが最後の種目！";
  updateTimerUI();
  updateProgress();
}
function updateTimerUI() {
  const mm = String(Math.floor(player.remain / 60)).padStart(1, "0");
  const ss = String(player.remain % 60).padStart(2, "0");
  $("#p-timer").textContent = `${mm}:${ss}`;
}
function updateProgress() {
  const r = player.routine;
  const total = r.steps.reduce((a, b) => a + b.sec, 0);
  let elapsed = 0;
  for (let i = 0; i < player.idx; i++) elapsed += r.steps[i].sec;
  elapsed += (r.steps[player.idx].sec - player.remain);
  $("#p-progress").style.width = `${(elapsed / total) * 100}%`;
}
function tick() {
  if (player.paused) return;
  player.remain--;
  if (player.remain <= 0) {
    beep();
    nextStep(true);
    return;
  }
  updateTimerUI();
  updateProgress();
  if (player.remain <= 3) beep(true);
}
function resumeTimer() {
  clearInterval(player.timer);
  player.timer = setInterval(tick, 1000);
}
function nextStep(autoComplete) {
  if (autoComplete) player.doneSteps = Math.max(player.doneSteps, player.idx + 1);
  if (player.idx >= player.routine.steps.length - 1) { finishPlayer(); return; }
  player.idx++;
  loadStep();
}
function prevStep() {
  if (player.idx === 0) return;
  player.idx--;
  loadStep();
}
function togglePause() {
  player.paused = !player.paused;
  $("#p-play").textContent = player.paused ? "再開" : "一時停止";
  if (player.paused) pauseBGM(); else resumeBGM();
}
function finishPlayer(partial) {
  clearInterval(player.timer);
  stopBGM(); // 種目終了 → フェードアウトして停止
  const r = player.routine;
  const wasNew = !log[todayKey()]; // 今日まだ未記録なら新規達成
  // 1種目でも進めていれば達成として記録（「少しでもやる」を尊重）
  const done = partial ? player.doneSteps : r.steps.length;
  if (done > 0) {
    log[todayKey()] = { routineId: r.id, doneSteps: done, total: r.steps.length, ts: Date.now() };
    store.set(LS.log, log);
  }
  $("#player").classList.remove("active");
  renderToday();
  // 新規達成でリワード節目に到達したらお祝いポップアップ
  const newMs = (wasNew && done > 0) ? milestonesFor(totalDays()) : [];
  if (newMs.length) {
    setTimeout(() => showRewardModal(newMs), 400);
  } else if (done >= r.steps.length) {
    showToast("🎉 全部完了！おつかれさま");
    celebrate();
  } else if (done > 0) {
    showToast(`👍 ${done}種目できた！記録したよ`);
  }
}
function exitPlayer() {
  // 途中終了：進んだ分を記録するか確認
  clearInterval(player.timer);
  if (player.doneSteps > 0 || player.idx > 0) {
    finishPlayer(true);
  } else {
    stopBGM();
    $("#player").classList.remove("active");
  }
}

/* ---------- 効果音（軽いビープ） ---------- */
let audioCtx = null;
let audioUnlocked = false;
// AudioContextを用意し、必ずresume（iOSは操作時にresumeしないと無音）
function ensureAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch {}
  return audioCtx;
}
// 最初のタップで音声を解錠（iOSの自動再生制限対策）
function unlockAudio() {
  const ctx = ensureAudio();
  if (!ctx || audioUnlocked) return;
  try {
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination); src.start(0);
    audioUnlocked = true;
  } catch {}
}
function beep(soft) {
  try {
    audioCtx = ensureAudio();
    if (!audioCtx) return;
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = soft ? 660 : 880;
    g.gain.value = soft ? 0.04 : 0.09;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + (soft ? 0.08 : 0.18));
  } catch {}
}
function celebrate() {
  if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 120]);
}

/* ============================================================
   BGM（mp3再生）
   - デフォルト2曲 or 自分のリスト（IndexedDBに保存）を順に再生
   - 開始で1曲目から、種目が全部終わったらフェードアウト停止
   - リスト合計が15分に満たなければ1曲目から繰り返し
   ============================================================ */
const DEFAULT_BGM = [
  { name: "Soft Focus 1", src: "bgm/soft-focus-1.mp3" },
  { name: "Soft Focus 2", src: "bgm/soft-focus-3.mp3" },
];
const BGM_VOL = 0.85;

/* ---- IndexedDB（アップロード曲の本体を保存） ---- */
const IDB = {
  _db: null,
  open() {
    return new Promise((res, rej) => {
      if (this._db) return res(this._db);
      const req = indexedDB.open("nightore-bgm", 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("tracks")) req.result.createObjectStore("tracks", { keyPath: "id" }); };
      req.onsuccess = () => { this._db = req.result; res(this._db); };
      req.onerror = () => rej(req.error);
    });
  },
  async put(track) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").put(track); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
  async get(id) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction("tracks", "readonly").objectStore("tracks").get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async del(id) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction("tracks", "readwrite"); tx.objectStore("tracks").delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); },
};

let bgmAudio = null;       // HTMLAudioElement
let bgmPlaylist = [];      // [{name, src, obj?:bool}]
let bgmIndex = 0;
let bgmFadeTimer = null;

async function buildPlaylist() {
  if (settings.bgmSource === "custom" && bgmList.length) {
    const arr = [];
    for (const item of bgmList) {
      try { const t = await IDB.get(item.id); if (t && t.blob) arr.push({ name: item.name, src: URL.createObjectURL(t.blob), obj: true }); } catch {}
    }
    if (arr.length) return arr;
  }
  return DEFAULT_BGM.map(d => ({ ...d })); // customが空ならデフォルトにフォールバック
}
async function startBGM() {
  if (!settings.music) return;
  stopBGMImmediate();
  bgmPlaylist = await buildPlaylist();
  if (!bgmPlaylist.length) return;
  bgmIndex = 0;
  if (!bgmAudio) { bgmAudio = new Audio(); bgmAudio.addEventListener("ended", onBgmEnded); }
  playBgmCurrent(true);
}
function playBgmCurrent(fadeIn) {
  const tr = bgmPlaylist[bgmIndex];
  if (!tr) return;
  bgmAudio.src = tr.src;
  bgmAudio.volume = fadeIn ? 0 : BGM_VOL;
  const p = bgmAudio.play();
  if (p && p.catch) p.catch(() => {});
  if (fadeIn) fadeAudioTo(BGM_VOL, 2500);
}
function onBgmEnded() {
  if (!bgmPlaylist.length) return;
  bgmIndex = (bgmIndex + 1) % bgmPlaylist.length; // 最後まで来たら1曲目に戻ってリピート
  playBgmCurrent(false);
}
function pauseBGM() { if (bgmAudio) try { bgmAudio.pause(); } catch {} }
function resumeBGM() { if (settings.music && bgmAudio && bgmAudio.src) { const p = bgmAudio.play(); if (p && p.catch) p.catch(() => {}); } }
function stopBGM() { // フェードアウトしてから停止
  if (!bgmAudio || !bgmPlaylist.length) { stopBGMImmediate(); return; }
  fadeAudioTo(0, 2000, stopBGMImmediate);
}
function stopBGMImmediate() {
  if (bgmFadeTimer) { clearInterval(bgmFadeTimer); bgmFadeTimer = null; }
  if (bgmAudio) try { bgmAudio.pause(); } catch {}
  bgmPlaylist.forEach(t => { if (t.obj && t.src.startsWith("blob:")) URL.revokeObjectURL(t.src); });
  bgmPlaylist = [];
}
function fadeAudioTo(target, ms, done) {
  if (!bgmAudio) { if (done) done(); return; }
  if (bgmFadeTimer) clearInterval(bgmFadeTimer);
  const start = bgmAudio.volume, steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  bgmFadeTimer = setInterval(() => {
    i++;
    bgmAudio.volume = Math.min(1, Math.max(0, start + (target - start) * (i / steps)));
    if (i >= steps) { clearInterval(bgmFadeTimer); bgmFadeTimer = null; if (done) done(); }
  }, 50);
}
function updateMusicBtn() {
  const b = $("#p-music");
  if (b) b.textContent = settings.music ? "🎵" : "🔇";
}
function toggleMusic() { // プレイヤー上の🎵ボタン
  settings.music = !settings.music;
  store.set(LS.settings, settings);
  updateMusicBtn();
  if ($("#set-music")) $("#set-music").checked = settings.music;
  if (settings.music && !player.paused && $("#player").classList.contains("active")) startBGM();
  else stopBGMImmediate();
}

/* ---- BGMリストの追加・削除 ---- */
async function addBgmFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith("audio/") || /\.(mp3|m4a|aac|ogg|wav)$/i.test(f.name));
  for (const f of files) {
    if (bgmList.length >= 10) { showToast("BGMは最大10曲までです"); break; }
    const id = (crypto.randomUUID ? crypto.randomUUID() : "id" + Date.now() + Math.random());
    const name = f.name.replace(/\.[^.]+$/, "");
    try {
      await IDB.put({ id, name, blob: f });
      bgmList.push({ id, name });
    } catch { showToast("保存に失敗しました（容量不足の可能性）"); }
  }
  store.set(LS.bgm, bgmList);
  renderBgmList();
}
async function deleteBgm(id) {
  bgmList = bgmList.filter(x => x.id !== id);
  store.set(LS.bgm, bgmList);
  try { await IDB.del(id); } catch {}
  renderBgmList();
}

/* ---- 並び替え（ポインタ・ドラッグ：タッチ対応） ---- */
function attachDragHandle(row) {
  const handle = row.querySelector(".handle");
  handle.addEventListener("pointerdown", e => {
    e.preventDefault();
    const list = $("#bgm-list");
    row.classList.add("dragging");
    handle.setPointerCapture(e.pointerId);
    const onMove = ev => {
      const rows = [...list.querySelectorAll(".bgm-row:not(.dragging)")];
      const after = rows.find(r => ev.clientY < r.getBoundingClientRect().top + r.offsetHeight / 2);
      if (after) list.insertBefore(row, after);
      else list.appendChild(row);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      row.classList.remove("dragging");
      // DOMの並びを配列へ反映
      const ids = [...list.querySelectorAll(".bgm-row")].map(r => r.dataset.id);
      bgmList.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      store.set(LS.bgm, bgmList);
      renderBgmList();
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  });
}

/* ---------- トースト ---------- */
let toastTimer;
function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ============================================================
   通知リマインド（開いている間の簡易版）
   ============================================================ */
let reminderTimeout = null;
function scheduleReminder() {
  clearTimeout(reminderTimeout);
  if (!settings.notify) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const [h, m] = settings.reminderTime.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const ms = target - now;
  // setTimeoutは最大約24日。今日〜明日の範囲なので安全。
  reminderTimeout = setTimeout(() => {
    if (!log[todayKey()]) {
      try {
        new Notification("そろそろストレッチの時間です 🌙", { body: "10分だけでもOK。ナイトレを開いて始めよう！", icon: "icons/icon-192.png" });
      } catch {}
    }
    scheduleReminder(); // 翌日分を再セット
  }, ms);
}
async function requestNotify() {
  if (!("Notification" in window)) { showToast("この端末は通知に未対応です"); return false; }
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  updateNotifyHint();
  return res === "granted";
}

/* ============================================================
   ナビゲーション
   ============================================================ */
function switchView(name) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
  $$(".nav button").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  if (name === "today") renderToday();
  if (name === "history") renderHistory();
  if (name === "settings") renderSettings();
}

/* ============================================================
   イベント結線 & 初期化
   ============================================================ */
function init() {
  // 最初のタップで音声を解錠（iOS/モバイルの自動再生制限対策）
  document.addEventListener("pointerdown", unlockAudio, { passive: true });
  document.addEventListener("touchstart", unlockAudio, { passive: true });

  // ナビ
  $$(".nav button").forEach(b => b.onclick = () => switchView(b.dataset.view));

  // プレイヤー操作
  $("#p-close").onclick = exitPlayer;
  $("#p-play").onclick = () => { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); togglePause(); };
  $("#p-prev").onclick = prevStep;
  $("#p-skip").onclick = () => nextStep(true);
  $("#p-music").onclick = toggleMusic;

  // 履歴の月送り
  $("#cal-prev").onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); renderHistory(); };
  $("#cal-next").onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); renderHistory(); };

  // 設定
  $("#set-time").onchange = e => { settings.reminderTime = e.target.value; store.set(LS.settings, settings); scheduleReminder(); showToast("リマインド時刻を保存"); };
  $("#set-music").onchange = e => { settings.music = e.target.checked; store.set(LS.settings, settings); updateMusicBtn(); if (!settings.music) stopBGMImmediate(); showToast(settings.music ? "BGMをオンにしました" : "BGMをオフにしました"); };

  // BGM: 使う曲の切り替え
  $("#bgm-src-default").onclick = () => { settings.bgmSource = "default"; store.set(LS.settings, settings); renderBgmSettings(); };
  $("#bgm-src-custom").onclick = () => { settings.bgmSource = "custom"; store.set(LS.settings, settings); renderBgmSettings(); };
  // BGM: 追加・ファイル選択
  $("#bgm-add").onclick = () => $("#bgm-file").click();
  $("#bgm-file").onchange = e => { if (e.target.files && e.target.files.length) addBgmFiles(e.target.files); e.target.value = ""; };

  // リワード・ポップアップを閉じる
  $("#reward-ok").onclick = () => $("#reward-modal").classList.remove("active");
  $("#reward-modal").onclick = e => { if (e.target.id === "reward-modal") $("#reward-modal").classList.remove("active"); };
  $("#set-notify").onchange = async e => {
    if (e.target.checked) {
      const ok = await requestNotify();
      settings.notify = ok;
      e.target.checked = ok;
      if (ok) showToast("通知をオンにしました");
    } else {
      settings.notify = false;
    }
    store.set(LS.settings, settings);
    scheduleReminder();
  };
  $("#test-notify").onclick = async () => {
    const ok = await requestNotify();
    if (ok) { try { new Notification("テスト通知 🔔", { body: "この通知が見えればOK！", icon: "icons/icon.svg" }); } catch {} }
  };
  $("#export-data").onclick = () => {
    const data = JSON.stringify({ log, settings, customRoutines }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `training-habit-backup-${todayKey()}.json`;
    a.click();
  };
  $("#reset-data").onclick = () => {
    if (confirm("すべての記録を消去します。よろしいですか？")) {
      log = {}; store.set(LS.log, log);
      renderToday(); renderHistory();
      showToast("記録をリセットしました");
    }
  };

  // 初期表示
  switchView("today");
  scheduleReminder();

  // PWA: service worker 登録
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

document.addEventListener("DOMContentLoaded", init);
