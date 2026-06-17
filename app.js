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
    when: "night",          // 時間帯のおすすめ判定用
    desc: "1日の緊張をほぐして寝つきを良く",
    steps: [
      { name: "深呼吸でリラックス", emoji: "🫁", sec: 30, desc: "鼻から4秒吸って、口から6秒かけて吐く" },
      { name: "首をゆっくり回す", emoji: "🙆", sec: 40, desc: "右回り・左回り。肩の力を抜いて" },
      { name: "肩を大きく回す", emoji: "💪", sec: 40, desc: "前回し・後ろ回し。肩甲骨を動かす意識で" },
      { name: "前屈で背中を伸ばす", emoji: "🧎", sec: 45, desc: "息を吐きながら無理なく前へ。膝は軽く曲げてOK" },
      { name: "太もも裏ストレッチ(右)", emoji: "🦵", sec: 40, desc: "脚を伸ばしてつま先に手を。痛気持ちいい所で止める" },
      { name: "太もも裏ストレッチ(左)", emoji: "🦵", sec: 40, desc: "反対側も同じように" },
      { name: "お尻・腰のひねり", emoji: "🔄", sec: 60, desc: "仰向けで膝を倒す。左右ゆっくり" },
      { name: "全身脱力", emoji: "😌", sec: 45, desc: "仰向けで力を抜き、ゆっくり呼吸" },
    ],
  },
  {
    id: "morning",
    name: "朝の目覚め筋トレ",
    emoji: "☀️",
    when: "morning",
    desc: "軽く動いて体にスイッチを入れる",
    steps: [
      { name: "その場で伸び", emoji: "🙌", sec: 20, desc: "両手を上げて全身をぐーっと伸ばす" },
      { name: "スクワット", emoji: "🏋️", sec: 40, desc: "膝がつま先より前に出すぎないよう、ゆっくり10回目安" },
      { name: "休憩", emoji: "💧", sec: 15, desc: "呼吸を整える", rest: true },
      { name: "もも上げ足踏み", emoji: "🚶", sec: 40, desc: "腿を高く上げてその場で足踏み" },
      { name: "腕立て(膝つきOK)", emoji: "💪", sec: 40, desc: "きつければ膝をついて。無理なく回数を" },
      { name: "休憩", emoji: "💧", sec: 15, desc: "呼吸を整える", rest: true },
      { name: "プランク", emoji: "🧱", sec: 30, desc: "肘とつま先で体を一直線に。お腹に力" },
      { name: "深呼吸でクールダウン", emoji: "🫁", sec: 20, desc: "ゆっくり呼吸して終了" },
    ],
  },
  {
    id: "neck",
    name: "肩こり・首ほぐし",
    emoji: "💆",
    when: "any",
    desc: "デスクワークの合間に。座ったままOK",
    steps: [
      { name: "首を前後に倒す", emoji: "🙇", sec: 30, desc: "ゆっくり。倒した所で軽く止める" },
      { name: "首を左右に倒す", emoji: "↔️", sec: 30, desc: "耳を肩に近づけるイメージ" },
      { name: "肩すくめ→脱力", emoji: "🤷", sec: 30, desc: "肩を上げて3秒、ストンと落とす" },
      { name: "肩甲骨よせ", emoji: "🦅", sec: 40, desc: "胸を開いて肩甲骨を中央に寄せる" },
      { name: "腕を前で伸ばす", emoji: "🤲", sec: 30, desc: "手を組んで前へ。背中を丸める" },
      { name: "脇腹を伸ばす", emoji: "🙆", sec: 40, desc: "片手を上げて体を横に倒す。左右" },
    ],
  },
  {
    id: "lowerback",
    name: "腰・お尻ストレッチ",
    emoji: "🦴",
    when: "any",
    desc: "腰まわりをゆるめて軽くする",
    steps: [
      { name: "猫のポーズ", emoji: "🐱", sec: 45, desc: "四つ這いで背中を丸める・反らすを繰り返す" },
      { name: "お尻ストレッチ(右)", emoji: "🍑", sec: 40, desc: "仰向けで足を組み、太ももを抱える" },
      { name: "お尻ストレッチ(左)", emoji: "🍑", sec: 40, desc: "反対側も同じように" },
      { name: "腰ひねり(右)", emoji: "🔄", sec: 40, desc: "仰向けで膝を片側へ倒す" },
      { name: "腰ひねり(左)", emoji: "🔄", sec: 40, desc: "反対側へ" },
      { name: "膝を抱えて丸まる", emoji: "🫂", sec: 45, desc: "両膝を抱えて背中を伸ばす" },
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
});
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
  if (settings.defaultRoutine && settings.defaultRoutine !== "auto") return settings.defaultRoutine;
  const h = new Date().getHours();
  if (h >= 20 || h < 4) return "bedtime";
  if (h >= 4 && h < 10) return "morning";
  return "neck";
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
  loadStep();
  resumeTimer();
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
}
function finishPlayer(partial) {
  clearInterval(player.timer);
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
  if (player.doneSteps > 0 || player.idx > 0) {
    finishPlayer(true);
  } else {
    $("#player").classList.remove("active");
  }
}

/* ---------- 効果音（軽いビープ） ---------- */
let audioCtx = null;
function beep(soft) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
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
  // ナビ
  $$(".nav button").forEach(b => b.onclick = () => switchView(b.dataset.view));

  // プレイヤー操作
  $("#p-close").onclick = exitPlayer;
  $("#p-play").onclick = () => { if (audioCtx && audioCtx.state === "suspended") audioCtx.resume(); togglePause(); };
  $("#p-prev").onclick = prevStep;
  $("#p-skip").onclick = () => nextStep(true);

  // 履歴の月送り
  $("#cal-prev").onclick = () => { calMonth.setMonth(calMonth.getMonth() - 1); renderHistory(); };
  $("#cal-next").onclick = () => { calMonth.setMonth(calMonth.getMonth() + 1); renderHistory(); };

  // 設定
  $("#set-time").onchange = e => { settings.reminderTime = e.target.value; store.set(LS.settings, settings); scheduleReminder(); showToast("リマインド時刻を保存"); };
  $("#set-default").onchange = e => { settings.defaultRoutine = e.target.value; store.set(LS.settings, settings); };
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
