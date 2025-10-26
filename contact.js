"use strict";

/* ========================= Helpers ========================= */
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const SLOT_MINUTES = 30;

// lokalni YYYY-MM-DD (bez timezone pomaka)
const fmtDateIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};

const fmtTime = (isoOrDate) => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
};

// vrati startove (ISO) koji imaju dovoljno uzastopnih 30-min slotova
function validStartsForDuration(freeSlots, requiredMinutes) {
  const need = Math.ceil((requiredMinutes || SLOT_MINUTES) / SLOT_MINUTES);
  if (!Array.isArray(freeSlots) || freeSlots.length === 0) return [];

  const byStart = new Map(
    freeSlots.map((s) => [new Date(s.start).getTime(), s])
  );
  const sorted = [...freeSlots].sort(
    (a, b) => new Date(a.start) - new Date(b.start)
  );

  const starts = [];
  for (const s of sorted) {
    let ok = true;
    let t = new Date(s.start);
    for (let i = 1; i < need; i++) {
      t = new Date(t.getTime() + SLOT_MINUTES * 60000);
      if (!byStart.has(t.getTime())) {
        ok = false;
        break;
      }
    }
    if (ok) starts.push(s.start);
  }
  return starts;
}

/* ===================== NOVO: lead-time filter ===================== */

// vrati true ako su datumi (lokalno) isti kalendarski dan
function isSameLocalDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// filtrira startove prema pravilima:
function applyLeadTimeFilter(starts, selectedDateStr, leadMinutes = 30) {
  if (!Array.isArray(starts) || starts.length === 0) return [];

  const now = new Date();
  const selectedDate = new Date(selectedDateStr + "T00:00:00");

  if (
    selectedDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())
  ) {
    return [];
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (selectedDate > today) return starts;

  const minStart = new Date(now.getTime() + leadMinutes * 60000);
  return starts.filter((iso) => new Date(iso) >= minStart);
}

// praktični wrapper
function filteredValidStarts(
  freeSlots,
  requiredMinutes,
  selectedDateStr,
  leadMinutes = 30
) {
  let starts = validStartsForDuration(freeSlots, requiredMinutes);
  return applyLeadTimeFilter(starts, selectedDateStr, leadMinutes);
}

/* ========================= API ========================= */
const API_BASE = "https://localhost:7021/api";
console.log("API_BASE =", API_BASE);

async function apiGetJson(url) {
  console.log("GET", url);
  const res = await fetch(url, { cache: "no-store" });
  console.log("status", res.status);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  console.log("data", data);
  return data;
}

const loadStaff = () => apiGetJson(`${API_BASE}/staff`);
const loadServices = (staffId) =>
  apiGetJson(`${API_BASE}/services?staffId=${staffId}`);
const fetchSlotsForDay = (staffId, dateStr) =>
  apiGetJson(
    `${API_BASE}/slots?staffId=${staffId}&date=${dateStr}&nocache=${Date.now()}`
  );

async function postBookingByStart({
  staffId,
  date,
  startTime, // "HH:mm"
  serviceId,
  fullName = null,
  email = null,
  phone = null,
}) {
  const url = `${API_BASE}/book-by-start`;
  console.log("POST", url, {
    staffId,
    date,
    startTime,
    serviceId,
    fullName,
    email,
    phone,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      staffId,
      date,
      startTime,
      serviceId,
      fullName,
      email,
      phone,
    }),
  });
  const text = await res.text().catch(() => "");
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {}
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      message: text || "Greška pri rezervaciji.",
    };
  }
  return { ok: true, ...json };
}

/* ========================= Global state ========================= */
const state = {
  staff: [],
  servicesByStaff: {}, // { [staffId]: [{id,name,durationMin}, ...] }
  staffId: null,
  staffName: null,
  serviceId: null,
  selectedDateStr: null, // "yyyy-MM-dd"
  selectedStartIso: null, // ISO of chosen start
  calendar: null,
};

let slotsRefreshTimer = null;
let isRefreshingSlots = false;

/* ========================= Toast ========================= */
function showToast(message, isError = false) {
  const t = $("toast");
  if (!t) return;
  t.textContent = message;
  t.className = "toast"; // reset
  if (isError) t.classList.add("error");
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

/* ========================= Contact form (optional) ========================= */
(function attachContactForm() {
  const form = $("contactForm");
  if (!form) return;
  const nameEl = $("name");
  const emailEl = $("email");
  const messageEl = $("message");
  const phoneEl = $("phone");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nameVal = (nameEl?.value || "").trim();
    const emailVal = (emailEl?.value || "").trim().toLowerCase();
    const msgVal = (messageEl?.value || "").trim();
    const phoneVal = phoneEl ? (phoneEl.value || "").trim() : "";

    if (
      !nameVal ||
      !emailVal ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal) ||
      !msgVal
    ) {
      showToast("Molimo ispunite ispravno polja forme.", true);
      return;
    }

    const payload = {
      fullName: nameVal,
      email: emailVal,
      phone: phoneVal || null,
      subject: "Kontakt s weba",
      body: msgVal,
    };

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok)
        throw new Error(await res.text().catch(() => "Greška pri slanju."));
      showToast(
        "Pažnja! Ova rezervacija isključivo demonstiria rad web stranice u akademske svrhe i nije stvarna rezervacija."
      );
      form.reset();
    } catch (err) {
      console.error(err);
      showToast("Nažalost, slanje nije uspjelo.", true);
    }
  });
})();

/* ========================= Slots modal ========================= */
async function refreshSlotsInModal(silent = false) {
  if (isRefreshingSlots) return;
  isRefreshingSlots = true;

  const listWrap = $("slotsList");
  const header = $("slotsHeader");
  const subHeader = $("slotsSubHeader");
  const empty = $("slotsEmpty");
  const skeleton = $("slotsSkeleton");

  if (!listWrap || !header || !subHeader || !empty || !skeleton) {
    isRefreshingSlots = false;
    return;
  }

  if (!state.staffId || !state.serviceId || !state.selectedDateStr) {
    header.textContent = "Dostupni termini";
    subHeader.textContent = "Odaberite djelatnika i uslugu.";
    listWrap.innerHTML = "";
    empty.style.display = "block";
    isRefreshingSlots = false;
    return;
  }

  const svc =
    state.servicesByStaff[state.staffId]?.find(
      (x) => x.id === state.serviceId
    ) || null;
  const durationMin = svc?.durationMin || SLOT_MINUTES;

  header.textContent = "Dostupni termini";
  subHeader.textContent =
    `${new Date(state.selectedDateStr).toLocaleDateString("hr-HR")} · ` +
    `Djelatnik: ${state.staffName || "-"} · ` +
    `Usluga: ${svc?.name || "-"} (${durationMin} min)`;

  if (!silent) {
    empty.style.display = "none";
    listWrap.innerHTML = "";
    skeleton.style.display = "block";
  }

  try {
    const daySlots = await fetchSlotsForDay(
      state.staffId,
      state.selectedDateStr
    );
    const starts = filteredValidStarts(
      daySlots,
      durationMin,
      state.selectedDateStr,
      30
    );

    const render = () => {
      if (!silent) skeleton.style.display = "none";

      if (!starts || starts.length === 0) {
        empty.style.display = "block";
        listWrap.innerHTML = "";
        return;
      }

      empty.style.display = "none";
      listWrap.innerHTML = starts
        .map(
          (iso) => `
            <button class="button is-light is-medium slot-start" data-start="${iso}">
              ${fmtTime(iso)}
            </button>`
        )
        .join("");

      // click => open confirm
      $$(".slot-start", listWrap).forEach((btn) => {
        btn.addEventListener("click", () => {
          state.selectedStartIso = btn.dataset.start;

          const det = $("slotDetails");
          if (det) {
            const endDate = new Date(state.selectedStartIso);
            endDate.setMinutes(endDate.getMinutes() + durationMin);
            det.innerHTML = `
              <p><strong>${state.staffName}</strong></p>
              <p>${new Date(state.selectedDateStr).toLocaleDateString("hr-HR")}
                 · ${fmtTime(state.selectedStartIso)}–${fmtTime(endDate)}</p>
              <p class="is-size-7 has-text-grey">Trajanje usluge: ${durationMin} min</p>`;
          }
          const me = $("modalErr");
          if (me) me.style.display = "none";
          openConfirmModal(); // <- modal se otvara PRAZAN (resetiramo ga u openConfirmModal)
        });
      });
    };

    silent ? render() : setTimeout(render, 100);
  } catch (e) {
    console.error(e);
    if (!silent) {
      skeleton.style.display = "none";
      empty.style.display = "block";
    }
    showToast("Greška pri dohvaćanju termina.", true);
  } finally {
    isRefreshingSlots = false;
  }
}

/* ========================= Calendar ========================= */
function buildCalendar() {
  const el = $("calendar");
  if (!el || typeof FullCalendar === "undefined") {
    console.warn("FullCalendar nije učitan ili #calendar ne postoji");
    return;
  }

  state.calendar = new FullCalendar.Calendar(el, {
    locale: "hr",
    initialView: "dayGridMonth",
    firstDay: 1,
    height: "auto",
    headerToolbar: { left: "prev,next today", center: "title", right: "" },
    validRange: (now) => ({ start: fmtDateIso(now) }),
    events: [],
    dateClick: async (info) => {
      state.selectedDateStr = info.dateStr; // već YYYY-MM-DD
      openSlotsModal();
      await refreshSlotsInModal(false);
    },
  });

  state.calendar.render();
}

/* ========================= Modals ========================= */

/* NOVO: helper koji briše sve vrijednosti u potvrđujućem modalu */
function resetConfirmForm() {
  ["custFullName", "custEmail", "custPhone", "custNote"].forEach((id) => {
    const el = $(id);
    if (el) {
      el.value = "";
      el.classList.remove("invalid");
    }
  });
  const err = $("modalErr");
  if (err) {
    err.textContent = "";
    err.style.display = "none";
  }
  const btn = $("confirmBtn");
  if (btn) {
    btn.classList.remove("is-loading");
    btn.disabled = false;
  }
}

function openSlotsModal() {
  $("slotsModal")?.classList.add("is-active");

  // manual refresh
  const btnRef = $("slotsRefresh");
  if (btnRef) {
    btnRef.onclick = () => refreshSlotsInModal(false);
  }

  if (slotsRefreshTimer) clearInterval(slotsRefreshTimer);
  slotsRefreshTimer = setInterval(async () => {
    const open = $("slotsModal")?.classList.contains("is-active");
    if (!open) return;
    if (
      state.staffId &&
      state.serviceId &&
      state.selectedDateStr &&
      !isRefreshingSlots
    ) {
      await refreshSlotsInModal(true);
    }
  }, 10000);
}

function closeSlotsModal() {
  $("slotsModal")?.classList.remove("is-active");
  if (slotsRefreshTimer) {
    clearInterval(slotsRefreshTimer);
    slotsRefreshTimer = null;
  }
}

function openConfirmModal() {
  resetConfirmForm(); // <<<<< OVO JE KLJUČNO
  $("bookModal")?.classList.add("is-active");
}

function closeConfirmModal() {
  $("bookModal")?.classList.remove("is-active");
  resetConfirmForm(); // reset i na zatvaranju
}

function wireModals() {
  $("slotsClose") && ($("slotsClose").onclick = closeSlotsModal);
  $("slotsCancel") && ($("slotsCancel").onclick = closeSlotsModal);

  $("closeModal") && ($("closeModal").onclick = closeConfirmModal);
  $("cancelBtn") && ($("cancelBtn").onclick = closeConfirmModal);

  const confirm = $("confirmBtn");
  const err = $("modalErr");

  if (confirm) {
    confirm.onclick = async () => {
      if (
        !state.selectedStartIso ||
        !state.serviceId ||
        !state.staffId ||
        !state.selectedDateStr
      ) {
        if (err) {
          err.textContent = "Nedostaju podaci za rezervaciju.";
          err.style.display = "block";
        }
        return;
      }

      const fullName = ($("custFullName")?.value || "").trim();
      const email = ($("custEmail")?.value || "").trim().toLowerCase();
      const phone = ($("custPhone")?.value || "").trim();

      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!fullName || !emailOk) {
        if (err) {
          err.textContent = !fullName
            ? "Upišite ime i prezime."
            : "Upišite ispravan email.";
          err.style.display = "block";
        }
        return;
      }

      confirm.classList.add("is-loading");
      confirm.disabled = true;

      // "HH:mm" from ISO
      const startHHmm = new Date(state.selectedStartIso).toLocaleTimeString(
        "hr-HR",
        { hour: "2-digit", minute: "2-digit", hour12: false }
      );

      const res = await postBookingByStart({
        staffId: state.staffId,
        date: state.selectedDateStr,
        startTime: startHHmm,
        serviceId: state.serviceId,
        fullName,
        email,
        phone,
      });

      confirm.classList.remove("is-loading");
      confirm.disabled = false;

      if (!res.ok) {
        if (err) {
          err.textContent =
            res.message || "Termin je upravo zauzet. Odaberite drugi.";
          err.style.display = "block";
        }
        return;
      }

      // Uspjeh
      closeConfirmModal(); // zatvaranje + reset
      closeSlotsModal();
      showToast("Termin rezerviran ✅");
      state.selectedStartIso = null;
    };
  }
}

/* ========================= Selectors (staff/service) ========================= */
async function initSelectors() {
  const staffSel = $("staffSelect");
  const svcSel = $("serviceSelect");
  if (!staffSel || !svcSel) return;

  // Staff
  state.staff = await loadStaff();
  staffSel.innerHTML = '<option value="">-- Odaberite djelatnika --</option>';
  state.staff.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    staffSel.appendChild(opt);
  });

  // kad promijeniš staff
  staffSel.addEventListener("change", async (e) => {
    state.staffId = parseInt(e.target.value || "0") || null;
    state.staffName =
      state.staff.find((x) => x.id === state.staffId)?.name || null;

    // reset usluge
    svcSel.innerHTML = '<option value="">-- Odaberite uslugu --</option>';
    svcSel.disabled = !state.staffId;
    state.serviceId = null;

    if (state.staffId) {
      const services = await loadServices(state.staffId);
      state.servicesByStaff[state.staffId] = services;
      services.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.durationMin} min)`;
        svcSel.appendChild(opt);
      });
    }

    if (
      $("slotsModal")?.classList.contains("is-active") &&
      state.selectedDateStr
    ) {
      await refreshSlotsInModal(false);
    }
  });

  // kad promijeniš uslugu
  svcSel.addEventListener("change", async () => {
    state.serviceId = parseInt(svcSel.value || "0") || null;
    if (
      $("slotsModal")?.classList.contains("is-active") &&
      state.selectedDateStr
    ) {
      await refreshSlotsInModal(false);
    }
  });
}

/* ========================= Bootstrap ========================= */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await initSelectors();
    buildCalendar();
    wireModals();
  } catch (e) {
    console.error(e);
    showToast("Greška pri inicijalizaciji.", true);
  }
});

// refresh kada se prozor vrati u fokus (ako je modal otvoren)
window.addEventListener("focus", () => {
  if (
    $("slotsModal")?.classList.contains("is-active") &&
    state.staffId &&
    state.serviceId &&
    state.selectedDateStr
  ) {
    refreshSlotsInModal(true);
  }
});
