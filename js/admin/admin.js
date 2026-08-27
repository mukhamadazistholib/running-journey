(function () {
  "use strict";

  const SESSION_KEY = "rj_admin_pw";

  const els = {
    loginView: document.getElementById("loginView"),
    dashView: document.getElementById("dashView"),
    loginForm: document.getElementById("loginForm"),
    pwInput: document.getElementById("pwInput"),
    loginBtn: document.getElementById("loginBtn"),
    loginStatus: document.getElementById("loginStatus"),
    logoutBtn: document.getElementById("logoutBtn"),
    reloadBtn: document.getElementById("reloadBtn"),
    openAddBtn: document.getElementById("openAddBtn"),
    adminListState: document.getElementById("adminListState"),
    adminList: document.getElementById("adminList"),

    eventModal: document.getElementById("eventModal"),
    eventModalClose: document.getElementById("eventModalClose"),
    eventModalTitle: document.getElementById("eventModalTitle"),
    eventForm: document.getElementById("eventForm"),
    eventId: document.getElementById("eventId"),
    iconInput: document.getElementById("iconInput"),
    colorInput: document.getElementById("colorInput"),
    titleInput: document.getElementById("titleInput"),
    descInput: document.getElementById("descInput"),
    timeInput: document.getElementById("timeInput"),
    statusInput: document.getElementById("statusInput"),
    eventSubmitBtn: document.getElementById("eventSubmitBtn"),
    eventFormStatus: document.getElementById("eventFormStatus"),

    deleteModal: document.getElementById("deleteModal"),
    deleteModalClose: document.getElementById("deleteModalClose"),
    deleteModalText: document.getElementById("deleteModalText"),
    deleteCancelBtn: document.getElementById("deleteCancelBtn"),
    deleteConfirmBtn: document.getElementById("deleteConfirmBtn"),
    deleteFormStatus: document.getElementById("deleteFormStatus"),
  };

  function getPassword() {
    return sessionStorage.getItem(SESSION_KEY) || "";
  }

  /* ---------------- Networking helpers ---------------- */
  function callApi(payload, timeoutMs) {
    if (!CONFIG.ENDPOINT_URL) {
      return Promise.reject(
        new Error("ENDPOINT_URL is not set in js/config.js"),
      );
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);

    return fetch(CONFIG.ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        console.error("callApi error:", payload.action, err);
        throw err;
      });
  }

  function fetchData(timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
    return fetch(CONFIG.ENDPOINT_URL, {
      method: "GET",
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timer);
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .catch((err) => {
        clearTimeout(timer);
        console.error("fetchData error:", err);
        throw err;
      });
  }

  /* ---------------- Auth flow ---------------- */
  function showLogin(message) {
    els.dashView.hidden = true;
    els.loginView.hidden = false;
    if (message) {
      els.loginStatus.textContent = message;
      els.loginStatus.classList.add("err");
    }
  }

  function showDashboard() {
    els.loginView.hidden = true;
    els.dashView.hidden = false;
    loadEvents();
  }

  function attemptSession() {
    const pw = getPassword();
    if (!pw) return showLogin();

    callApi({ action: "login", password: pw })
      .then((res) => {
        if (res.ok) {
          showDashboard();
        } else {
          sessionStorage.removeItem(SESSION_KEY);
          showLogin("Session expired, please log in again.");
        }
      })
      .catch(() => showLogin("Couldn't reach the server. Please try again."));
  }

  els.loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pw = els.pwInput.value;
    els.loginBtn.disabled = true;
    els.loginBtn.textContent = "Checking…";
    els.loginStatus.textContent = "";
    els.loginStatus.className = "form-status";

    callApi({ action: "login", password: pw })
      .then((res) => {
        if (res.ok) {
          sessionStorage.setItem(SESSION_KEY, pw);
          showDashboard();
        } else {
          els.loginStatus.textContent = res.error || "Wrong password.";
          els.loginStatus.classList.add("err");
        }
      })
      .catch(() => {
        els.loginStatus.textContent =
          "Couldn't reach the server. Please try again.";
        els.loginStatus.classList.add("err");
      })
      .finally(() => {
        els.loginBtn.disabled = false;
        els.loginBtn.textContent = "Log in";
      });
  });

  els.logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    els.pwInput.value = "";
    showLogin();
  });

  /* ---------------- Load & render events ---------------- */
  let currentEvents = [];

  function loadEvents() {
    els.adminListState.hidden = false;
    els.adminListState.textContent = "Loading…";
    els.adminList.hidden = true;

    fetchData()
      .then((data) => {
        currentEvents = data.events || [];
        renderEvents();
      })
      .catch(() => {
        els.adminListState.textContent =
          "Failed to load data. Try ⟳ to reload.";
      });
  }

  function renderEvents() {
    if (!currentEvents.length) {
      els.adminListState.hidden = false;
      els.adminListState.textContent = 'No events yet. Click "+ Add Event".';
      els.adminList.hidden = true;
      return;
    }
    els.adminListState.hidden = true;
    els.adminList.hidden = false;
    els.adminList.innerHTML = "";

    currentEvents.forEach((ev) => {
      const status = String(ev.status || "pending").toLowerCase();
      const isDone = status === "done";
      const isActive = status === "active";

      const li = document.createElement("li");
      li.className =
        "todo-item" +
        (isDone ? " is-done" : "") +
        (isActive ? " is-active" : "");
      li.innerHTML = `
        <div class="todo-icon" style="background:${escapeAttr(ev.color || "#4c3ae3")}">${escapeHtml(ev.icon || "🏁")}</div>
        <div class="todo-body">
          <p class="todo-title">${escapeHtml(ev.title || "Untitled")}</p>
          <p class="todo-desc">${escapeHtml(ev.description || "")}</p>
          ${ev.time ? `<p class="todo-time">${escapeHtml(formatTodoDate(ev.time))}</p>` : ""}
        </div>
        <div class="admin-item-actions">
          <button class="icon-btn" title="Edit" data-action="edit" data-id="${escapeAttr(ev.id)}">✏️</button>
          <button class="icon-btn danger" title="Delete" data-action="delete" data-id="${escapeAttr(ev.id)}">🗑️</button>
        </div>
      `;
      els.adminList.appendChild(li);
    });
  }

  els.adminList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const ev = currentEvents.find((row) => String(row.id) === String(id));
    if (!ev) return;

    if (btn.dataset.action === "edit") {
      openEventModal(ev);
    } else if (btn.dataset.action === "delete") {
      openDeleteModal(ev);
    }
  });

  els.reloadBtn.addEventListener("click", loadEvents);

  /* ---------------- Add/Edit modal ---------------- */
  function openEventModal(ev) {
    els.eventForm.reset();
    els.eventFormStatus.textContent = "";
    els.eventFormStatus.className = "form-status";

    if (ev) {
      els.eventModalTitle.textContent = "Edit event";
      els.eventId.value = ev.id;
      els.iconInput.value = ev.icon || "";
      els.colorInput.value = /^#[0-9a-fA-F]{6}$/.test(ev.color)
        ? ev.color
        : "#4c3ae3";
      els.titleInput.value = ev.title || "";
      els.descInput.value = ev.description || "";
      els.timeInput.value = ev.time || "";
      els.statusInput.value = ["pending", "active", "done"].includes(
        String(ev.status).toLowerCase(),
      )
        ? String(ev.status).toLowerCase()
        : "pending";
    } else {
      els.eventModalTitle.textContent = "New event";
      els.eventId.value = "";
      els.colorInput.value = "#4c3ae3";
      els.statusInput.value = "pending";
    }
    els.eventModal.classList.add("is-open");
  }

  function closeEventModal() {
    els.eventModal.classList.remove("is-open");
  }

  els.openAddBtn.addEventListener("click", () => openEventModal(null));
  els.eventModalClose.addEventListener("click", closeEventModal);
  els.eventModal.addEventListener("click", (e) => {
    if (e.target === els.eventModal) closeEventModal();
  });

  els.eventForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = els.eventId.value;
    const payload = {
      action: id ? "updateEvent" : "addEvent",
      password: getPassword(),
      id: id || undefined,
      icon: els.iconInput.value.trim() || "🏁",
      color: els.colorInput.value,
      title: els.titleInput.value.trim(),
      description: els.descInput.value.trim(),
      time: els.timeInput.value.trim(),
      status: els.statusInput.value,
    };

    els.eventSubmitBtn.disabled = true;
    els.eventSubmitBtn.textContent = "Saving…";
    els.eventFormStatus.textContent = "";
    els.eventFormStatus.className = "form-status";

    callApi(payload)
      .then((res) => {
        if (!res.ok) throw new Error(res.error || "Failed to save");
        closeEventModal();
        loadEvents();
      })
      .catch((err) => {
        els.eventFormStatus.textContent = err.message || "Failed to save.";
        els.eventFormStatus.classList.add("err");
      })
      .finally(() => {
        els.eventSubmitBtn.disabled = false;
        els.eventSubmitBtn.textContent = "Save Event";
      });
  });

  /* ---------------- Delete confirm modal ---------------- */
  let pendingDeleteId = null;

  function openDeleteModal(ev) {
    pendingDeleteId = ev.id;
    els.deleteModalText.textContent = `This will permanently remove "${ev.title}" from your sheet.`;
    els.deleteFormStatus.textContent = "";
    els.deleteFormStatus.className = "form-status";
    els.deleteConfirmBtn.disabled = false;
    els.deleteConfirmBtn.textContent = "Delete";
    els.deleteModal.classList.add("is-open");
  }

  function closeDeleteModal() {
    els.deleteModal.classList.remove("is-open");
    pendingDeleteId = null;
  }

  els.deleteModalClose.addEventListener("click", closeDeleteModal);
  els.deleteCancelBtn.addEventListener("click", closeDeleteModal);
  els.deleteModal.addEventListener("click", (e) => {
    if (e.target === els.deleteModal) closeDeleteModal();
  });

  els.deleteConfirmBtn.addEventListener("click", () => {
    if (!pendingDeleteId) return;
    els.deleteConfirmBtn.disabled = true;
    els.deleteConfirmBtn.textContent = "Deleting…";
    els.deleteFormStatus.textContent = "";
    els.deleteFormStatus.className = "form-status";

    callApi({
      action: "deleteEvent",
      password: getPassword(),
      id: pendingDeleteId,
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.error || "Failed to delete");
        closeDeleteModal();
        loadEvents();
      })
      .catch((err) => {
        els.deleteFormStatus.textContent = err.message || "Failed to delete.";
        els.deleteFormStatus.classList.add("err");
      })
      .finally(() => {
        els.deleteConfirmBtn.disabled = false;
        els.deleteConfirmBtn.textContent = "Delete";
      });
  });

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
  attemptSession();
})();
