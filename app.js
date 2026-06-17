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
      { name: "深呼吸でおやすみ", emoji: "😮‍💨", sec: 180, desc: "仰向けで全身の力を抜き、鼻から4秒吸って口から6秒かけて吐く。眠りに入る準備をする" },
    ],
  },
];

/* ---------- ストレージ ---------- */
const LS = {
  log: "ht_log_v1",          // { "2026-06-17": { routineId, doneSteps, total, ts } }
  settings: "ht_settings_v1",
  custom: "ht_custom_v1",    // ユーザー追加ルーティン
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
});
if (settings.music === undefined) settings.music = true; // 既存ユーザーは音楽ONをデフォルトに
let log = store.get(LS.log, {});
let customRoutines = store.get(LS.custom, []);

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
  for (let d = 1; d <= days; d++) {
    const key = todayKey(new Date(y, m, d));
    const entry = log[key];
    const c = document.createElement("div");
    c.className = "cal-cell" + (entry ? " has" : "") + (key === tk ? " today" : "");
    const r = entry ? routineById(entry.routineId) : null;
    c.innerHTML = `${d}${entry ? `<span class="dot">${r ? r.emoji : "✓"}</span>` : ""}`;
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
  const sel = $("#set-default");
  sel.innerHTML = `<option value="auto">時間帯でおすすめ（自動）</option>` +
    allRoutines().map(r => `<option value="${r.id}">${r.emoji} ${r.name}</option>`).join("");
  sel.value = settings.defaultRoutine;
  updateNotifyHint();
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
  startMusic();
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
  if (player.paused) stopMusic(); else startMusic();
}
function finishPlayer(partial) {
  clearInterval(player.timer);
  stopMusic();
  const r = player.routine;
  // 1種目でも進めていれば達成として記録（「少しでもやる」を尊重）
  const done = partial ? player.doneSteps : r.steps.length;
  if (done > 0) {
    log[todayKey()] = { routineId: r.id, doneSteps: done, total: r.steps.length, ts: Date.now() };
    store.set(LS.log, log);
  }
  $("#player").classList.remove("active");
  renderToday();
  if (done >= r.steps.length) {
    showToast("🎉 全部完了！おつかれさま");
    celebrate();
  } else if (done > 0) {
    showToast(`👍 ${done}種目できた！記録したよ`);
  }
}
function exitPlayer() {
  // 途中終了：進んだ分を記録するか確認
  clearInterval(player.timer);
  stopMusic();
  if (player.doneSteps > 0 || player.idx > 0) {
    finishPlayer(true);
  } else {
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

/* ---------- リラックス音楽（ブラウザ内で生成。著作権フリー・通信不要） ----------
   穏やかな和音パッドを呼吸のようにゆっくり揺らす環境音。 */
let musicNodes = null;
function startMusic() {
  if (!settings.music || musicNodes) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(0.16, now + 3); // ふわっとフェードイン（スマホ向けに音量UP）

    // スマホの小型スピーカーでも聞こえるよう、低音は控えめ・中音域中心に
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    filter.connect(master);
    master.connect(ctx.destination);

    // Cメジャー系の落ち着いた和音を中音域で（C4 E4 G4 C5）→スマホでも明瞭
    const freqs = [261.63, 329.63, 392.00, 523.25];
    const nodes = [];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? "sine" : "triangle";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.16 - i * 0.02;
      // 呼吸のようなゆっくりした音量の揺らぎ
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06 + i * 0.013;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.06;
      lfo.connect(lfoGain); lfoGain.connect(g.gain);
      o.connect(g); g.connect(filter);
      o.start(now); lfo.start(now);
      nodes.push(o, lfo);
    });
    musicNodes = { master, nodes };
  } catch {}
}
function stopMusic() {
  if (!musicNodes) return;
  try {
    const { master, nodes } = musicNodes;
    const now = audioCtx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 1.2); // ふわっとフェードアウト
    nodes.forEach(n => { try { n.stop(now + 1.4); } catch {} });
  } catch {}
  musicNodes = null;
}
function updateMusicBtn() {
  const b = $("#p-music");
  if (b) b.textContent = settings.music ? "🎵" : "🔇";
}
function toggleMusic() {
  settings.music = !settings.music;
  store.set(LS.settings, settings);
  updateMusicBtn();
  if ($("#set-music")) $("#set-music").checked = settings.music;
  if (settings.music && !player.paused && $("#player").classList.contains("active")) startMusic();
  else stopMusic();
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
        new Notification("そろそろ体を動かす時間です 🧘", { body: "10分だけでもOK。アプリを開いて始めよう！", icon: "icons/icon.svg" });
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
  $("#set-default").onchange = e => { settings.defaultRoutine = e.target.value; store.set(LS.settings, settings); };
  $("#set-music").onchange = e => { settings.music = e.target.checked; store.set(LS.settings, settings); updateMusicBtn(); if (!settings.music) stopMusic(); showToast(settings.music ? "音楽をオンにしました" : "音楽をオフにしました"); };
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
