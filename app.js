(() => {
  "use strict";

  const DEFAULTS = Object.freeze({
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
    autoStart: true
  });

  const SESSION = Object.freeze({ FOCUS: "focus", SHORT_BREAK: "shortBreak", LONG_BREAK: "longBreak" });
  const STORAGE_KEY = "pomodoro-focus-timer-settings";
  const STATS_KEY = "pomodoro-focus-timer-stats";
  const circleRadius = 105;
  const circumference = 2 * Math.PI * circleRadius;

  const $ = (id) => document.getElementById(id);
  const elements = {
    timerDisplay: $("timerDisplay"), progressCircle: $("progressCircle"), sessionLabel: $("sessionLabel"),
    sessionMessage: $("sessionMessage"), startButton: $("startButton"), resetButton: $("resetButton"),
    skipButton: $("skipButton"), roundDots: $("roundDots"), roundCount: $("roundCount"), todayCount: $("todayCount"),
    settingsButton: $("settingsButton"), settingsDialog: $("settingsDialog"), settingsForm: $("settingsForm"),
    focusMinutes: $("focusMinutes"), shortBreakMinutes: $("shortBreakMinutes"), longBreakMinutes: $("longBreakMinutes"),
    sessionsBeforeLongBreak: $("sessionsBeforeLongBreak"), autoStart: $("autoStart"),
    notificationButton: $("notificationButton"), notificationStatus: $("notificationStatus"), toast: $("toast")
  };

  let settings = loadSettings();
  let stats = loadStats();
  let sessionType = SESSION.FOCUS;
  let completedInRound = 0;
  let totalSeconds = durationFor(sessionType);
  let remainingSeconds = totalSeconds;
  let isRunning = false;
  let endsAt = null;
  let intervalId = null;
  let toastTimeout = null;

  elements.progressCircle.style.strokeDasharray = `${circumference}`;
  renderRoundDots();
  updateNotificationStatus();
  render();

  function loadSettings() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) }; }
    catch { return { ...DEFAULTS }; }
  }

  function loadStats() {
    const today = new Date().toLocaleDateString("en-CA");
    try {
      const saved = JSON.parse(localStorage.getItem(STATS_KEY));
      return saved?.date === today ? saved : { date: today, completed: 0 };
    } catch { return { date: today, completed: 0 }; }
  }

  function durationFor(type) {
    const minutes = type === SESSION.FOCUS ? settings.focusMinutes
      : type === SESSION.SHORT_BREAK ? settings.shortBreakMinutes : settings.longBreakMinutes;
    return minutes * 60;
  }

  function sessionCopy(type) {
    if (type === SESSION.FOCUS) return { label: "專注時間", message: "一次只做好眼前這件事。", action: "開始專注" };
    if (type === SESSION.SHORT_BREAK) return { label: "短休息", message: "起身走走，讓眼睛休息一下。", action: "開始休息" };
    return { label: "長休息", message: "做得很好，給自己完整的休息。", action: "開始休息" };
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function render() {
    const copy = sessionCopy(sessionType);
    const progress = totalSeconds ? remainingSeconds / totalSeconds : 0;
    elements.timerDisplay.textContent = formatTime(remainingSeconds);
    elements.sessionLabel.textContent = copy.label;
    elements.sessionMessage.textContent = copy.message;
    elements.startButton.textContent = isRunning ? "暫停" : copy.action;
    elements.progressCircle.style.strokeDashoffset = `${circumference * (1 - progress)}`;
    elements.roundCount.textContent = `${completedInRound} / ${settings.sessionsBeforeLongBreak}`;
    elements.todayCount.textContent = stats.completed;
    document.body.classList.toggle("break-mode", sessionType !== SESSION.FOCUS);
    document.title = `${formatTime(remainingSeconds)} · ${copy.label}｜蕃茄時光`;
  }

  function renderRoundDots() {
    elements.roundDots.replaceChildren();
    for (let i = 0; i < settings.sessionsBeforeLongBreak; i += 1) {
      const dot = document.createElement("span");
      dot.className = `round-dot${i < completedInRound ? " completed" : ""}`;
      elements.roundDots.append(dot);
    }
  }

  function start() {
    if (isRunning) return pause();
    primeAudio();
    isRunning = true;
    endsAt = Date.now() + remainingSeconds * 1000;
    intervalId = window.setInterval(tick, 250);
    render();
  }

  function pause() {
    if (!isRunning) return;
    remainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    stopInterval();
    render();
  }

  function tick() {
    remainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (remainingSeconds <= 0) completeSession();
    else render();
  }

  function stopInterval() {
    window.clearInterval(intervalId);
    intervalId = null;
    isRunning = false;
    endsAt = null;
  }

  function reset() {
    stopInterval();
    totalSeconds = durationFor(sessionType);
    remainingSeconds = totalSeconds;
    render();
    showToast("已重設目前計時");
  }

  function completeSession({ skipped = false } = {}) {
    stopInterval();
    const finishedType = sessionType;

    if (finishedType === SESSION.FOCUS && !skipped) {
      completedInRound += 1;
      stats.completed += 1;
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    }

    if (finishedType === SESSION.FOCUS) {
      sessionType = completedInRound >= settings.sessionsBeforeLongBreak ? SESSION.LONG_BREAK : SESSION.SHORT_BREAK;
    } else {
      if (finishedType === SESSION.LONG_BREAK) completedInRound = 0;
      sessionType = SESSION.FOCUS;
    }

    totalSeconds = durationFor(sessionType);
    remainingSeconds = totalSeconds;
    renderRoundDots();
    render();

    if (!skipped) notifyTransition(finishedType);
    else showToast(`已切換至${sessionCopy(sessionType).label}`);

    if (!skipped && settings.autoStart) start();
  }

  function notifyTransition(finishedType) {
    const nextLabel = sessionCopy(sessionType).label;
    const title = finishedType === SESSION.FOCUS ? "專注完成！" : "休息結束！";
    const body = `接下來是${nextLabel}，時間為 ${durationFor(sessionType) / 60} 分鐘。`;
    playChime();
    showToast(`${title} ${body}`);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: "pomodoro-transition", renotify: true });
    }
  }

  let audioContext = null;
  function primeAudio() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
    } catch { /* Page notification remains available. */ }
  }

  function playChime() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now + index * 0.16);
      gain.gain.linearRampToValueAtTime(0.18, now + index * 0.16 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.16 + 0.55);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now + index * 0.16);
      oscillator.stop(now + index * 0.16 + 0.56);
    });
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => elements.toast.classList.remove("show"), 4200);
  }

  async function requestNotifications() {
    if (!("Notification" in window)) return showToast("這個瀏覽器不支援桌面通知");
    const permission = await Notification.requestPermission();
    updateNotificationStatus();
    showToast(permission === "granted" ? "桌面通知已開啟" : "通知未開啟，仍會播放提示音");
  }

  function updateNotificationStatus() {
    if (!("Notification" in window)) {
      elements.notificationStatus.textContent = "瀏覽器不支援";
      elements.notificationButton.disabled = true;
      return;
    }
    const labels = { granted: "已開啟", denied: "已封鎖，請至瀏覽器設定修改", default: "尚未開啟" };
    elements.notificationStatus.textContent = labels[Notification.permission];
    elements.notificationButton.textContent = Notification.permission === "granted" ? "已開啟" : "開啟通知";
    elements.notificationButton.disabled = Notification.permission === "granted";
  }

  function openSettings() {
    elements.focusMinutes.value = settings.focusMinutes;
    elements.shortBreakMinutes.value = settings.shortBreakMinutes;
    elements.longBreakMinutes.value = settings.longBreakMinutes;
    elements.sessionsBeforeLongBreak.value = settings.sessionsBeforeLongBreak;
    elements.autoStart.checked = settings.autoStart;
    updateNotificationStatus();
    elements.settingsDialog.showModal();
  }

  function saveSettings(event) {
    if (event.submitter?.value !== "default") return;
    event.preventDefault();
    if (!elements.settingsForm.reportValidity()) return;
    settings = {
      focusMinutes: Number(elements.focusMinutes.value),
      shortBreakMinutes: Number(elements.shortBreakMinutes.value),
      longBreakMinutes: Number(elements.longBreakMinutes.value),
      sessionsBeforeLongBreak: Number(elements.sessionsBeforeLongBreak.value),
      autoStart: elements.autoStart.checked
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    completedInRound = Math.min(completedInRound, settings.sessionsBeforeLongBreak - 1);
    stopInterval();
    totalSeconds = durationFor(sessionType);
    remainingSeconds = totalSeconds;
    renderRoundDots();
    render();
    elements.settingsDialog.close();
    showToast("設定已儲存");
  }

  elements.startButton.addEventListener("click", start);
  elements.resetButton.addEventListener("click", reset);
  elements.skipButton.addEventListener("click", () => completeSession({ skipped: true }));
  elements.settingsButton.addEventListener("click", openSettings);
  elements.notificationButton.addEventListener("click", requestNotifications);
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.settingsDialog.addEventListener("click", (event) => {
    if (event.target === elements.settingsDialog) elements.settingsDialog.close();
  });
})();
