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
    semangatForm: document.getElementById("semangatForm"),
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
  };

  let cheeringQueue = [];
  let bubbleTimer = null;
  let lastEvents = []; // Last successfully loaded events, used for stats/countdown/share

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
        "Failed to fetch the data. Try refreshing ⟳ to try again.";
      console.error(err);
    }
  }

  /* ---------------- Sorting ---------------- */
  function sortEventsByDate(events) {
    // Sort valid dates first, nearest event first; keep undated events in their original order.
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
    return {
      isDone: status === "done" || status === "true",
      isActive:
        status === "active" || status === "ongoing" || status === "berjalan",
      isCanceled:
        status === "canceled" ||
        status === "cancelled" ||
        status === "dibatalkan",
    };
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
        "No events yet. Add them through your Google Sheet.";
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
        ? `<button type="button" class="todo-bell${isArmed ? " is-active" : ""}" data-key="${encodeURIComponent(key)}" title="Remind me one day before">🔔</button>`
        : "";

      li.innerHTML = `
        <div class="todo-icon" style="background:${escapeAttr(iconBg)}">${escapeHtml(ev.icon || "🏁")}</div>
        <div class="todo-body">
          <p class="todo-title">${escapeHtml(ev.title || "Tanpa judul")}</p>
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
      els.countdownBadge.hidden = true;
      return;
    }

    const { ev, date } = upcoming[0];
    const diff = daysUntil(date);
    const label = diff === 0 ? "Today!" : `D-${diff}`;

    els.countdownBadge.hidden = false;
    els.countdownBadge.textContent = `⏳ ${ev.title || "Event"} · ${label}`;
  }

  /* ---------------- One-day browser reminder ---------------- */
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
        "Notifications are blocked. Enable them in your browser settings first.",
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
            body: ev.description || "Do not forget to get ready! 🏃",
            icon: "/assets/emoji-trophy.ico",
          });
        } catch (e) {}
        reminder.notified = true;
        changed = true;
      }
    });

    if (changed) saveReminders(reminders);
  }

  /* ---------------- Stats & badges ---------------- */
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
  function startBubbleStream(semangatList) {
    cheeringQueue = (semangatList || []).slice(-40); // Keep the stream manageable
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

    const leftPct = 6 + Math.random() * 60; // Random horizontal position
    const drift = (Math.random() * 60 - 30).toFixed(0) + "px";
    const duration =
      (CONFIG.BUBBLE_DURATION_S || 12) + (Math.random() * 3 - 1.5);

    bubble.style.left = leftPct + "%";
    bubble.style.setProperty("--drift", drift);
    bubble.style.animationDuration = duration + "s";

    bubble.innerHTML = `
      <span class="bubble-name">${escapeHtml(item.name || "Anonym")}</span>
      <span class="bubble-msg">${escapeHtml(item.message || "")}</span>
    `;

    els.bubbleLane.appendChild(bubble);
    bubble.addEventListener("animationend", () => bubble.remove());
  }

  /* ---------------- Encouragement modal & form ---------------- */
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

  els.semangatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = els.msgInput.value.trim();
    if (!message) return;
    const name = els.nameInput.value.trim() || "Anonym";

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Sending..";
    els.formStatus.textContent = "";
    els.formStatus.className = "form-status";

    const payload = { name, message };

    try {
      if (CONFIG.ENDPOINT_URL) {
        // text/plain menghindari CORS preflight yang tidak didukung Apps Script
        const res = await fetch(CONFIG.ENDPOINT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });
        if (!res.ok)
          throw new Error("Whoops, something went wrong (" + res.status + ")");
      } else {
        MOCK_DATA.semangat.push(payload); // Local demo mode
      }

      // Show the bubble immediately without waiting for a refetch
      cheeringQueue.push(payload);
      spawnBubble(payload);

      els.formStatus.textContent =
        "Yay, it's sent! Thanks for cheering them on 💛";
      els.formStatus.classList.add("ok");
      els.semangatForm.reset();
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

  /* ---------------- Init ---------------- */
  initTheme();
  initProfile();
  loadAll();
  setInterval(checkReminders, 60 * 1000);
})();
