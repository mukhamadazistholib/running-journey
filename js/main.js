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
    listState: document.getElementById("listState"),
    todoList: document.getElementById("todoList"),
    refreshBtn: document.getElementById("refreshBtn"),
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
  };

  let cheeringQueue = [];
  let bubbleTimer = null;

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
        weekday: "long",
        day: "2-digit",
        month: "long",
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
    const res = await fetch(CONFIG.ENDPOINT_URL, { method: "GET" });
    if (!res.ok) throw new Error("Failed to fetch data (" + res.status + ")");
    return res.json();
  }

  async function loadAll() {
    els.listState.hidden = false;
    els.listState.textContent = "Loading..";
    els.todoList.hidden = true;

    try {
      const data = await fetchData();
      renderTodos(data.events || []);
      startBubbleStream(data.semangat || []);
    } catch (err) {
      els.listState.textContent =
        "Failed to fetch the data. Try to refresh ⟳ for try again.";
      console.error(err);
    }
  }

  /* ---------------- Todo rendering ---------------- */
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

  function renderTodos(events) {
    if (!events.length) {
      els.listState.hidden = false;
      els.listState.textContent =
        "Belum ada event. Tambahkan lewat Google Sheet kamu.";
      els.todoList.hidden = true;
      return;
    }

    els.listState.hidden = true;
    els.todoList.hidden = false;
    els.todoList.innerHTML = "";

    let doneCount = 0;

    events.forEach((ev) => {
      const status = String(ev.status || "pending").toLowerCase();
      const isDone =
        status === "done" || status === "true" || status === "Done";
      const isActive =
        status === "active" || status === "ongoing" || status === "berjalan";
      if (isDone) doneCount++;

      const li = document.createElement("li");
      li.className =
        "todo-item" +
        (isDone ? " is-done" : "") +
        (isActive ? " is-active" : "");

      const iconBg = ev.color || "#4c3ae3";
      li.innerHTML = `
        <div class="todo-icon" style="background:${escapeAttr(iconBg)}">${escapeHtml(ev.icon || "🏁")}</div>
        <div class="todo-body">
          <p class="todo-title">${escapeHtml(ev.title || "Tanpa judul")}</p>
          <p class="todo-desc">${escapeHtml(ev.description || "")}</p>
          ${ev.time ? `<p class="todo-time">${escapeHtml(formatTodoDate(ev.time))}</p>` : ""}
        </div>
        <div class="todo-check">${isDone ? "✓" : ""}</div>
      `;
      els.todoList.appendChild(li);
    });

    const total = events.length;
    const pct = total ? Math.round((doneCount / total) * 100) : 0;
    els.progressFill.style.width = pct + "%";
    els.progressLabel.textContent = `${doneCount} / ${total} Done`;
  }

  /* ---------------- Bubble stream (semangat) ---------------- */
  function startBubbleStream(semangatList) {
    cheeringQueue = (semangatList || []).slice(-40); // batasi biar ga kebanyakan
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

    const leftPct = 6 + Math.random() * 60; // posisi horizontal acak
    const drift = (Math.random() * 60 - 30).toFixed(0) + "px";
    const duration =
      (CONFIG.BUBBLE_DURATION_S || 12) + (Math.random() * 3 - 1.5);

    bubble.style.left = leftPct + "%";
    bubble.style.setProperty("--drift", drift);
    bubble.style.animationDuration = duration + "s";

    bubble.innerHTML = `
      <span class="bubble-name">${escapeHtml(item.name || "@anonim")}</span>
      <span class="bubble-msg">${escapeHtml(item.message || "")}</span>
    `;

    els.bubbleLane.appendChild(bubble);
    bubble.addEventListener("animationend", () => bubble.remove());
  }

  /* ---------------- Modal & form ---------------- */
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
    const name = els.nameInput.value.trim() || "@anonim";

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
        MOCK_DATA.semangat.push(payload); // mode demo lokal
      }

      // langsung munculkan bubble tanpa nunggu refetch
      cheeringQueue.push(payload);
      spawnBubble(payload);

      els.formStatus.textContent =
        "Yay, it’s sent! Thanks for cheering them on 💛";
      els.formStatus.classList.add("ok");
      els.semangatForm.reset();
      els.charCount.textContent = "0";
      setTimeout(closeModal, 1200);
    } catch (err) {
      console.error(err);
      els.formStatus.textContent = "Oops, that didn’t go through. Try again?";
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
  initProfile();
  loadAll();
})();
