(function () {
  "use strict";

  const els = {
    greeting: document.getElementById("greeting"),
    profileName: document.getElementById("profileName"),
    profileBio: document.getElementById("profileBio"),
    profilePhoto: document.getElementById("profilePhoto"),
    todayDate: document.getElementById("todayDate"),
    progressFill: document.getElementById("progressFill"),
    progressLabel: document.getElementById("progressLabel"),
    countdownBadge: document.getElementById("countdownBadge"),
    listState: document.getElementById("listState"),
    todoList: document.getElementById("todoList"),
    refreshBtn: document.getElementById("refreshBtn"),
    statsBtn: document.getElementById("statsBtn"),
    fabBtn: document.getElementById("fabBtn"),
    modalOverlay: document.getElementById("modalOverlay"),
    modalClose: document.getElementById("modalClose"),
    encouragementForm: document.getElementById("encouragementForm"),
    nameInput: document.getElementById("nameInput"),
    msgInput: document.getElementById("msgInput"),
    charCount: document.getElementById("charCount"),
    submitBtn: document.getElementById("submitBtn"),
    formStatus: document.getElementById("formStatus"),
    bubbleLane: document.getElementById("bubbleLane"),
    themeToggle: document.getElementById("themeToggle"),
    themeToggleIcon: document.getElementById("themeToggleIcon"),
    statsOverlay: document.getElementById("statsOverlay"),
    statsClose: document.getElementById("statsClose"),
    statsGrid: document.getElementById("statsGrid"),
    badgesRow: document.getElementById("badgesRow"),
    shareBtn: document.getElementById("shareBtn"),
    shareStatus: document.getElementById("shareStatus"),
    nextEventOverlay: document.getElementById("nextEventOverlay"),
    nextEventClose: document.getElementById("nextEventClose"),
    nextEventCard: document.getElementById("nextEventCard"),
    nextEventShareBtn: document.getElementById("nextEventShareBtn"),
    nextEventShareStatus: document.getElementById("nextEventShareStatus"),
  };

  let cheeringQueue = [];
  let bubbleTimer = null;
  let lastEvents = []; // last successfully loaded events, used for stats/countdown/share
  let nextEvent = null; // { ev, date, diff } for the nearest upcoming event

  const REMINDER_KEY = "runReminders"; // { [eventKey]: { notified: bool } }
  const BADGE_MILESTONES = [
    { count: 1, label: "🥉 First Finish", labelEn: "🥉 First Finish" },
    { count: 3, label: "🥈 3 Events Done", labelEn: "🥈 3 Events Done" },
    { count: 5, label: "🥇 5 Events Done", labelEn: "🥇 5 Events Done" },
    { count: 10, label: "🏆 10 Events Done", labelEn: "🏆 10 Events Done" },
  ];

  /* ---------------- Theme toggle ---------------- */
  function applyThemeIcon(theme) {
    els.themeToggleIcon.textContent = theme === "dark" ? "☀️" : "🌙";
  }

  function initTheme() {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    applyThemeIcon(current);

    els.themeToggle.addEventListener("click", () => {
      const next =
        document.documentElement.getAttribute("data-theme") === "dark"
          ? "light"
          : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
      applyThemeIcon(next);
    });
  }

  /* ---------------- Profile & date ---------------- */
  function initProfile() {
    const hour = new Date().getHours();
    els.greeting.textContent =
      hour < 11
        ? "Morning 🌤️"
        : hour < 15
          ? "Afternoon ☀️"
          : hour < 18
            ? "Evening 🌥️"
            : "Evening 🌙";

    els.profileName.textContent = CONFIG.PROFILE.name;
    els.profileBio.textContent = CONFIG.PROFILE.bio;
    if (CONFIG.PROFILE.photo) els.profilePhoto.src = CONFIG.PROFILE.photo;

    function updateDateTime() {
      const now = new Date();

      const date = now.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const time = [
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join(":");

      els.todayDate.textContent = `${date}, ${time}`;
    }

    updateDateTime();

    setInterval(updateDateTime, 1000);
  }

  /* ---------------- Data fetching ---------------- */
  async function fetchData() {
    if (!CONFIG.ENDPOINT_URL) {
      return MOCK_DATA;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(CONFIG.ENDPOINT_URL, {
        method: "GET",
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Failed to fetch data (" + res.status + ")");
      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error("Request timed out after 12s");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadAll() {
    els.listState.hidden = false;
    els.listState.textContent = "Loading..";
    els.todoList.hidden = true;

    try {
      const data = await fetchData();
      lastEvents = sortEventsByDate(data.events || []);
      renderTodos(lastEvents);
      renderCountdown(lastEvents);
      startBubbleStream(data.semangat || []);
    } catch (err) {
      els.listState.textContent =
        "Failed to fetch the data. Try refreshing ⟳ and try again.";
      console.error(err);
    }
  }

  /* ---------------- Sorting ---------------- */
  function sortEventsByDate(events) {
    // Events with valid dates are sorted ascending (closest first);
    // events without parseable dates are moved to the end, preserving their original order.
    return events
      .map((ev, index) => ({ ev, index, date: parseEventDate(ev) }))
      .sort((a, b) => {
        if (a.date && b.date) return a.date - b.date;
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        return a.index - b.index;
      })
      .map((item) => item.ev);
  }

  /* ---------------- Status & date helpers ---------------- */
  function classifyStatus(ev) {
    const status = String(ev.status || "pending").toLowerCase();

    const isCanceled =
      status === "canceled" ||
      status === "cancelled" ||
      status === "cancelled";

    const explicitlyDone = status === "done" || status === "true";

    // Events whose date has already passed are automatically treated as "done",
    // unless they were explicitly marked as canceled in the sheet.
    const date = parseEventDate(ev);
    const isBackdated = Boolean(date) && daysUntil(date) < 0;

    const isDone = !isCanceled && (explicitlyDone || isBackdated);
    const isActive =
      !isDone &&
      !isCanceled &&
      (status === "active" || status === "ongoing" || status === "in_progress");

    return { isDone, isActive, isCanceled };
  }

  function parseEventDate(ev) {
    if (!ev || !ev.time) return null;
    const date = new Date(ev.time);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function eventKey(ev) {
    if (ev.id !== undefined && ev.id !== null && ev.id !== "") {
      return "id:" + ev.id;
    }
    return "ev:" + (ev.title || "") + "|" + (ev.time || "");
  }

  function formatTodoDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  /* ---------------- Todo rendering ---------------- */
  function renderTodos(events) {
    if (!events.length) {
      els.listState.hidden = false;
      els.listState.textContent =
        "No events yet. Add them via your Google Sheet.";
      els.todoList.hidden = true;
      return;
    }

    els.listState.hidden = true;
    els.todoList.hidden = false;
    els.todoList.innerHTML = "";

    const reminders = loadReminders();
    const now = Date.now();
    let doneCount = 0;

    events.forEach((ev) => {
      const { isDone, isActive, isCanceled } = classifyStatus(ev);
      if (isDone) doneCount++;

      const li = document.createElement("li");
      li.className =
        "todo-item" +
        (isDone ? " is-done" : "") +
        (isActive ? " is-active" : "") +
        (isCanceled ? " is-canceled" : "");

      const iconBg = ev.color || "#4c3ae3";
      const key = eventKey(ev);
      const evDate = parseEventDate(ev);
      const canRemind =
        !isDone && !isCanceled && evDate && evDate.getTime() > now;
      const isArmed = Boolean(reminders[key]);

      const bellHtml = canRemind
        ? `<button type="button" class="todo-bell${isArmed ? " is-active" : ""}" data-key="${encodeURIComponent(key)}" title="Remind me 1 day before">🔔</button>`
        : "";

      li.innerHTML = `
        <div class="todo-icon" style="background:${escapeAttr(iconBg)}">${escapeHtml(ev.icon || "🏁")}</div>
        <div class="todo-body">
          <p class="todo-title">${escapeHtml(ev.title || "Untitled")}</p>
          <p class="todo-desc">${escapeHtml(ev.description || "")}</p>
          ${ev.time ? `<p class="todo-time">${escapeHtml(formatTodoDate(ev.time))}</p>` : ""}
        </div>
        ${bellHtml}
        <div class="todo-check">${isCanceled ? "✗" : isDone ? "✓" : ""}</div>
      `;
      els.todoList.appendChild(li);
    });

    const total = events.length;
    const pct = total ? Math.round((doneCount / total) * 100) : 0;
    els.progressFill.style.width = pct + "%";
    els.progressLabel.textContent = `${doneCount} / ${total} Done`;
  }

  els.todoList.addEventListener("click", (e) => {
    const btn = e.target.closest(".todo-bell");
    if (!btn) return;
    toggleReminder(decodeURIComponent(btn.dataset.key), btn);
  });

  /* ---------------- Countdown to the nearest event ---------------- */
  function daysUntil(date) {
    const now = new Date();
    const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((b - a) / 86400000);
  }

  function renderCountdown(events) {
    const upcoming = events
      .map((ev) => ({ ev, date: parseEventDate(ev) }))
      .filter(({ ev, date }) => {
        if (!date) return false;
        const { isDone, isCanceled } = classifyStatus(ev);
        return !isDone && !isCanceled && daysUntil(date) >= 0;
      })
      .sort((a, b) => a.date - b.date);

    if (!upcoming.length) {
      nextEvent = null;
      els.countdownBadge.hidden = true;
      return;
    }

    const { ev, date } = upcoming[0];
    const diff = daysUntil(date);
    const label = diff === 0 ? "Today!" : `D-${diff}`;

    nextEvent = { ev, date, diff };
    els.countdownBadge.hidden = false;
    els.countdownBadge.textContent = `⏳ ${ev.title || "Event"} · ${label}`;
  }

  /* ---------------- Next Event modal ---------------- */
  function openNextEventModal() {
    if (!nextEvent) return;

    const { ev, diff } = nextEvent;
    const label = diff === 0 ? "TODAY" : `D-${diff}`;

    els.nextEventCard.innerHTML = `
      <div class="next-event-icon" style="background:${escapeAttr(ev.color || "#4c3ae3")}">${escapeHtml(ev.icon || "🏁")}</div>
      <div class="next-event-info">
        <p class="next-event-title">${escapeHtml(ev.title || "Event")}</p>
        <p class="next-event-date">${escapeHtml(formatTodoDate(ev.time))}</p>
        <span class="next-event-countdown">${label}</span>
      </div>
    `;

    els.nextEventShareStatus.textContent = "";
    els.nextEventShareStatus.className = "form-status";
    els.nextEventOverlay.classList.add("is-open");
  }

  function closeNextEventModal() {
    els.nextEventOverlay.classList.remove("is-open");
  }

  els.countdownBadge.addEventListener("click", openNextEventModal);
  els.nextEventClose.addEventListener("click", closeNextEventModal);
  els.nextEventOverlay.addEventListener("click", (e) => {
    if (e.target === els.nextEventOverlay) closeNextEventModal();
  });

  /* ---------------- Share next event (as a PNG image) ---------------- */
  async function generateNextEventImage(entry) {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }

    const { ev, diff } = entry;
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background gradient (same violet brand gradient as the header)
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#6c4cf5");
    bgGrad.addColorStop(0.55, "#4c3ae3");
    bgGrad.addColorStop(1, "#241a5e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle diagonal lane-line pattern
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    for (let x = -H; x < W + H; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.stroke();
    }
    ctx.restore();

    ctx.textAlign = "center";

    // Eyebrow label
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 30px Inter, sans-serif";
    ctx.fillText("UPCOMING RUN", W / 2, 150);

    // Event icon badge
    const iconSize = 150;
    const iconX = W / 2 - iconSize / 2;
    const iconY = 220;
    ctx.fillStyle = ev.color || "#ffffff";
    drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 40);
    ctx.fill();
    ctx.font = "70px serif"; // font generik, cukup buat render emoji
    ctx.fillText(ev.icon || "🏁", W / 2, iconY + iconSize / 2 + 25);

    // Event title (wrap if it is too long)
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 58px Sora, sans-serif";
    wrapCanvasText(ctx, ev.title || "Running Event", W / 2, 480, W - 140, 68);

    // Date
    ctx.font = "600 32px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(formatTodoDate(ev.time), W / 2, 590);

    // Big countdown
    const countdownText = diff === 0 ? "TODAY" : `D-${diff}`;
    ctx.font = "800 240px Sora, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(countdownText, W / 2, 900);

    ctx.font = "600 34px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(
      diff === 0 ? "The race is today!" : "days to go — get ready!",
      W / 2,
      960,
    );

    // Description, if available
    if (ev.description) {
      ctx.font = "500 28px Inter, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      wrapCanvasText(ctx, ev.description, W / 2, 1050, W - 200, 38, 2);
    }

    // Footer watermark
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("milesandsmiles.space", W / 2, H - 60);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  }

  els.nextEventShareBtn.addEventListener("click", async () => {
    if (!nextEvent) return;

    els.nextEventShareStatus.textContent = "";
    els.nextEventShareStatus.className = "form-status";
    els.nextEventShareBtn.disabled = true;
    const originalLabel = els.nextEventShareBtn.textContent;
    els.nextEventShareBtn.textContent = "Preparing image..";

    try {
      const blob = await generateNextEventImage(nextEvent);
      if (!blob) throw new Error("Canvas produced no image data");

      const { ev, diff } = nextEvent;
      const caption =
        diff === 0
          ? `${ev.title} is happening today! 🏁`
          : `${ev.title} is coming up in ${diff} day${diff === 1 ? "" : "s"}! 🏃`;
      const file = new File([blob], "next-run-event.png", {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Running Journey",
          text: caption,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "next-run-event.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        els.nextEventShareStatus.textContent =
          "Image downloaded — share it from your gallery!";
        els.nextEventShareStatus.classList.add("ok");
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user closed the share sheet
      console.error(err);
      els.nextEventShareStatus.textContent =
        "Couldn't generate the image. Try again?";
      els.nextEventShareStatus.classList.add("err");
    } finally {
      els.nextEventShareBtn.disabled = false;
      els.nextEventShareBtn.textContent = originalLabel;
    }
  });

  /* ---------------- Reminder D-1 (browser notifications) ---------------- */
  function loadReminders() {
    try {
      return JSON.parse(localStorage.getItem(REMINDER_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveReminders(reminders) {
    try {
      localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders));
    } catch (e) {}
  }

  function toggleReminder(key, btn) {
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }

    const reminders = loadReminders();

    if (reminders[key]) {
      delete reminders[key];
      saveReminders(reminders);
      btn.classList.remove("is-active");
      return;
    }

    const arm = () => {
      reminders[key] = { notified: false };
      saveReminders(reminders);
      btn.classList.add("is-active");
    };

    if (Notification.permission === "granted") {
      arm();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((perm) => {
        if (perm === "granted") arm();
      });
    } else {
      alert(
        "Notification permission is blocked. Please enable it in your browser settings first.",
      );
    }
  }

  function checkReminders() {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;

    const reminders = loadReminders();
    const keys = Object.keys(reminders);
    if (!keys.length || !lastEvents.length) return;

    const now = Date.now();
    let changed = false;

    lastEvents.forEach((ev) => {
      const key = eventKey(ev);
      const reminder = reminders[key];
      if (!reminder || reminder.notified) return;

      const date = parseEventDate(ev);
      if (!date) return;

      const remindAt = date.getTime() - 24 * 60 * 60 * 1000;
      if (now >= remindAt && now < date.getTime()) {
        try {
          new Notification("Event tomorrow: " + (ev.title || "Running event"), {
            body: ev.description || "Don't forget to get ready! 🏃",
            icon: "/assets/emoji-trophy.ico",
          });
        } catch (e) {}
        reminder.notified = true;
        changed = true;
      }
    });

    if (changed) saveReminders(reminders);
  }

  /* ---------------- Statistik & badge ---------------- */
  function computeStats(events) {
    const total = events.length;
    let done = 0,
      active = 0,
      canceled = 0;

    events.forEach((ev) => {
      const { isDone, isActive, isCanceled } = classifyStatus(ev);
      if (isDone) done++;
      else if (isActive) active++;
      else if (isCanceled) canceled++;
    });

    const pending = total - done - active - canceled;
    const pct = total ? Math.round((done / total) * 100) : 0;

    return { total, done, active, canceled, pending, pct };
  }

  function renderStats() {
    const s = computeStats(lastEvents);

    els.statsGrid.innerHTML = `
      <div class="stat-box">
        <div class="stat-value">${s.total}</div>
        <div class="stat-label">Total Events</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${s.done}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${s.pct}%</div>
        <div class="stat-label">Progress</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${s.pending + s.active}</div>
        <div class="stat-label">Upcoming</div>
      </div>
    `;

    els.badgesRow.innerHTML = BADGE_MILESTONES.map((b) => {
      const unlocked = s.done >= b.count;
      return `<span class="badge-chip${unlocked ? "" : " is-locked"}">${b.label}</span>`;
    }).join("");

    return s;
  }

  function openStatsModal() {
    renderStats();
    els.shareStatus.textContent = "";
    els.shareStatus.className = "form-status";
    els.statsOverlay.classList.add("is-open");
  }
  function closeStatsModal() {
    els.statsOverlay.classList.remove("is-open");
  }

  els.statsBtn.addEventListener("click", openStatsModal);
  els.statsClose.addEventListener("click", closeStatsModal);
  els.statsOverlay.addEventListener("click", (e) => {
    if (e.target === els.statsOverlay) closeStatsModal();
  });

  /* ---------------- Share progress (as a PNG image) ---------------- */
  function drawRoundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  async function generateProgressImage() {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {}
    }

    const s = computeStats(lastEvents);
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");

    // Background gradient (same violet brand gradient as the header)
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, "#6c4cf5");
    bgGrad.addColorStop(0.55, "#4c3ae3");
    bgGrad.addColorStop(1, "#241a5e");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Subtle diagonal lane-line pattern
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    for (let x = -H; x < W + H; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + H, H);
      ctx.stroke();
    }
    ctx.restore();

    ctx.textAlign = "center";

    // Eyebrow label
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "600 30px Inter, sans-serif";
    ctx.fillText("RUNNING JOURNEY", W / 2, 130);

    // Name / headline
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 52px Sora, sans-serif";
    ctx.fillText(`${CONFIG.PROFILE.name}'s Progress`, W / 2, 205);

    // Big percentage
    ctx.font = "800 220px Sora, sans-serif";
    ctx.fillText(`${s.pct}%`, W / 2, 500);

    ctx.font = "600 34px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("of running events completed", W / 2, 555);

    // Progress bar
    const barX = 140;
    const barY = 620;
    const barW = W - 280;
    const barH = 26;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    drawRoundedRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    drawRoundedRect(
      ctx,
      barX,
      barY,
      Math.max(barH, barW * (s.pct / 100)),
      barH,
      barH / 2,
    );
    ctx.fill();

    // Stat boxes row
    const boxes = [
      { value: s.done, label: "Done" },
      { value: s.active + s.pending, label: "Upcoming" },
      { value: s.total, label: "Total" },
    ];
    const boxW = 260;
    const boxH = 150;
    const gap = 30;
    const totalW = boxes.length * boxW + (boxes.length - 1) * gap;
    let bx = (W - totalW) / 2;
    const by = 720;

    boxes.forEach((box) => {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      drawRoundedRect(ctx, bx, by, boxW, boxH, 24);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 62px Sora, sans-serif";
      ctx.fillText(String(box.value), bx + boxW / 2, by + 78);

      ctx.font = "600 26px Inter, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText(box.label, bx + boxW / 2, by + 118);

      bx += boxW + gap;
    });

    // Unlocked badges
    const unlocked = BADGE_MILESTONES.filter((b) => s.done >= b.count).map(
      (b) => b.labelEn,
    );
    ctx.font = "600 30px Inter, sans-serif";
    if (unlocked.length) {
      ctx.fillStyle = "#ffffff";
      ctx.fillText(unlocked.join("    "), W / 2, 980);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText("No badges unlocked yet — keep going!", W / 2, 980);
    }

    // Footer watermark
    ctx.font = "500 28px Inter, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("milesandsmiles.space", W / 2, H - 60);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
    });
  }

  els.shareBtn.addEventListener("click", async () => {
    els.shareStatus.textContent = "";
    els.shareStatus.className = "form-status";
    els.shareBtn.disabled = true;
    const originalLabel = els.shareBtn.textContent;
    els.shareBtn.textContent = "Preparing image..";

    try {
      const blob = await generateProgressImage();
      if (!blob) throw new Error("Canvas produced no image data");

      const s = computeStats(lastEvents);
      const caption = `My running progress: ${s.done}/${s.total} events completed (${s.pct}%)! 🏃`;
      const file = new File([blob], "running-progress.png", {
        type: "image/png",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Running Journey",
          text: caption,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "running-progress.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        els.shareStatus.textContent =
          "Image downloaded — share it from your gallery!";
        els.shareStatus.classList.add("ok");
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user closed the share sheet, not an error
      console.error(err);
      els.shareStatus.textContent = "Couldn't generate the image. Try again?";
      els.shareStatus.classList.add("err");
    } finally {
      els.shareBtn.disabled = false;
      els.shareBtn.textContent = originalLabel;
    }
  });

  /* ---------------- Bubble stream (encouragement) ---------------- */
  function startBubbleStream(encouragementList) {
    cheeringQueue = (encouragementList || []).slice(-40); // limit to avoid too many
    if (bubbleTimer) clearInterval(bubbleTimer);
    if (!cheeringQueue.length) return;

    let i = 0;
    spawnBubble(cheeringQueue[i % cheeringQueue.length]);
    i++;

    bubbleTimer = setInterval(() => {
      spawnBubble(cheeringQueue[i % cheeringQueue.length]);
      i++;
    }, CONFIG.BUBBLE_INTERVAL_MS || 3500);
  }

  function spawnBubble(item) {
    if (!item) return;
    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const leftPct = 6 + Math.random() * 60; // random horizontal position
    const drift = (Math.random() * 60 - 30).toFixed(0) + "px";
    const duration =
      (CONFIG.BUBBLE_DURATION_S || 12) + (Math.random() * 3 - 1.5);

    bubble.style.left = leftPct + "%";
    bubble.style.setProperty("--drift", drift);
    bubble.style.animationDuration = duration + "s";

    bubble.innerHTML = `
      <span class="bubble-name">${escapeHtml(item.name || "Anonymous")}</span>
      <span class="bubble-msg">${escapeHtml(item.message || "")}</span>
    `;

    els.bubbleLane.appendChild(bubble);
    bubble.addEventListener("animationend", () => bubble.remove());
  }

  /* ---------------- Modal & form (encouragement) ---------------- */
  function openModal() {
    els.modalOverlay.classList.add("is-open");
  }
  function closeModal() {
    els.modalOverlay.classList.remove("is-open");
    els.formStatus.textContent = "";
    els.formStatus.className = "form-status";
  }

  els.fabBtn.addEventListener("click", openModal);
  els.modalClose.addEventListener("click", closeModal);
  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeModal();
  });

  els.msgInput.addEventListener("input", () => {
    els.charCount.textContent = els.msgInput.value.length;
  });

  els.encouragementForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = els.msgInput.value.trim();
    if (!message) return;
    const name = els.nameInput.value.trim() || "Anonymous";

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Sending..";
    els.formStatus.textContent = "";
    els.formStatus.className = "form-status";

    const payload = { name, message };

    try {
      if (CONFIG.ENDPOINT_URL) {
        // text/plain avoids CORS preflight, which Apps Script does not support
        const res = await fetch(CONFIG.ENDPOINT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        if (!res.ok)
          throw new Error("Whoops, something went wrong (" + res.status + ")");
      } else {
        MOCK_DATA.semangat.push(payload); // local demo mode
      }

      // show the bubble immediately without waiting for a refetch
      cheeringQueue.push(payload);
      spawnBubble(payload);

      els.formStatus.textContent =
        "Yay, it's sent! Thanks for cheering them on 💛";
      els.formStatus.classList.add("ok");
      els.encouragementForm.reset();
      els.charCount.textContent = "0";
      setTimeout(closeModal, 1200);
    } catch (err) {
      console.error(err);
      els.formStatus.textContent = "Oops, that didn't go through. Try again?";
      els.formStatus.classList.add("err");
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.textContent = "Send a Cheer 🙌";
    }
  });

  els.refreshBtn.addEventListener("click", loadAll);

  /* ---------------- Helpers ---------------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return String(str).replace(/[^#a-zA-Z0-9(),.%\s-]/g, "");
  }

  // Simple word wrapping for text inside <canvas> (fillText does not wrap automatically).
  // If maxLines is omitted, there is no limit; if set, the last line ends with "…".
  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text).split(/\s+/);
    let line = "";
    let curY = y;
    const lines = [];

    words.forEach((word) => {
      const testLine = line ? line + " " + word : word;
      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    });
    if (line) lines.push(line);

    const limited = maxLines ? lines.slice(0, maxLines) : lines;
    if (maxLines && lines.length > maxLines) {
      limited[limited.length - 1] = limited[limited.length - 1].replace(
        /\s*$/,
        "",
      ) + "…";
    }

    limited.forEach((l) => {
      ctx.fillText(l, x, curY);
      curY += lineHeight;
    });
  }

  /* ---------------- Init ---------------- */
  initTheme();
  initProfile();
  loadAll();
  setInterval(checkReminders, 60 * 1000);
})();