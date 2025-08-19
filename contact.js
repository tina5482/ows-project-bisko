// ==================== Kontakt forma (ostaje kao kod tebe) ====================
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contactForm");
  if (!form) return;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    let isValid = true;

    const name = document.getElementById("name");
    const email = document.getElementById("email");
    const message = document.getElementById("message");

    [name, email, message].forEach((el) => el.classList.remove("invalid"));

    const nameVal = (name.value || "").trim();
    const emailVal = (email.value || "").trim().toLowerCase();
    const msgVal = (message.value || "").trim();

    if (!nameVal) {
      name.classList.add("invalid");
      isValid = false;
    }
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      email.classList.add("invalid");
      isValid = false;
    }
    if (!msgVal) {
      message.classList.add("invalid");
      isValid = false;
    }

    if (isValid) {
      alert("Form submitted successfully");
      // TODO: fetch(...) na backend za slanje poruke (ako želiš)
    }
  });
});

// ==================== Helperi ====================
const $ = (id) => document.getElementById(id);
const fmtTime = (isoOrDate) => {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return d.toLocaleTimeString("hr-HR", { hour: "2-digit", minute: "2-digit" });
};
// lokalni yyyy-MM-dd (bez UTC pomaka)
const fmtDateIso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
};
const SLOT_MINUTES = 30;

// Vrati listu POČETAKA (ISO) koji imaju dovoljno uzastopnih 30-min slotova
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

// ==================== API ====================
const API_BASE = "https://localhost:7021/api";

const loadStaff = async () => {
  const res = await fetch(`${API_BASE}/staff`, { cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
};

const loadServices = async (staffId) => {
  const res = await fetch(`${API_BASE}/services?staffId=${staffId}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
};

const fetchSlotsForDay = async (dateStr) => {
  if (!state.staffId) return [];
  const res = await fetch(
    `${API_BASE}/slots?staffId=${
      state.staffId
    }&date=${dateStr}&nocache=${Date.now()}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(await res.text());
  return await res.json();
};

// BOOKING: pošalji početak + serviceId (backend zaključa potreban lanac)
const postBookingByStart = async ({
  staffId,
  date,
  startTime,
  serviceId,
  fullName = null,
  email = null,
  phone = null,
}) => {
  const res = await fetch(`${API_BASE}/book-by-start`, {
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
  if (res.ok) return { ok: true, ...(await res.json().catch(() => ({}))) };
  return {
    ok: false,
    status: res.status,
    message: await res.text().catch(() => "Greška pri rezervaciji."),
  };
};

// ==================== Global state ====================
const state = {
  staff: [],
  servicesByStaff: {}, // { [staffId]: Service[] }
  staffId: null,
  staffName: null,
  serviceId: null,
  selectedDateStr: null, // "yyyy-MM-dd"
  selectedStartIso: null, // ISO za odabrani početak
  calendar: null,
};

// auto-refresh kontrola
let slotsRefreshTimer = null;
let isRefreshingSlots = false;

// ==================== Toast ====================
function showToast(message, isError = false) {
  const t = $("toast");
  if (!t) return;
  t.textContent = message;
  t.classList.remove("error");
  if (isError) t.classList.add("error");
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ==================== Slots modal render ====================
async function refreshSlotsInModal(silent = false) {
  if (isRefreshingSlots) return; // spriječi preklapanje poziva
  isRefreshingSlots = true;

  const modal = $("slotsModal");
  const listWrap = $("slotsList");
  const header = $("slotsHeader");
  const empty = $("slotsEmpty");
  const skeleton = $("slotsSkeleton");
  if (!modal || !listWrap || !header || !empty || !skeleton) {
    isRefreshingSlots = false;
    return;
  }

  if (!state.staffId || !state.serviceId || !state.selectedDateStr) {
    listWrap.innerHTML = "";
    empty.style.display = "block";
    header.textContent = "Odaberite djelatnika i uslugu";
    isRefreshingSlots = false;
    return;
  }

  const svc = state.servicesByStaff[state.staffId]?.find(
    (x) => x.id === state.serviceId
  );
  const durationMin = svc?.durationMin || SLOT_MINUTES;

  header.innerHTML = `
    <strong>${new Date(state.selectedDateStr).toLocaleDateString(
      "hr-HR"
    )}</strong>
    · Djelatnik: ${state.staffName || "-"}
    · Usluga: ${svc?.name || "-"} (${durationMin} min)
    <button id="slotsRefresh" class="button is-small is-light" style="float:right;">Osvježi</button>
  `;
  document
    .getElementById("slotsRefresh")
    ?.addEventListener("click", () => refreshSlotsInModal(false));

  if (!silent) {
    empty.style.display = "none";
    listWrap.innerHTML = "";
    skeleton.style.display = "block";
  }

  try {
    const daySlots = await fetchSlotsForDay(state.selectedDateStr);
    const starts = validStartsForDuration(daySlots, durationMin);

    const render = () => {
      if (!silent) skeleton.style.display = "none";
      if (!starts || starts.length === 0) {
        empty.style.display = "block";
        listWrap.innerHTML = "";
      } else {
        empty.style.display = "none";
        const html = starts
          .map(
            (
              iso
            ) => `<button class="button is-light is-medium slot-start" data-start="${iso}">
                        ${fmtTime(iso)}
                      </button>`
          )
          .join("");
        listWrap.innerHTML = html;

        listWrap.querySelectorAll("button.slot-start").forEach((btn) => {
          btn.addEventListener("click", () => {
            state.selectedStartIso = btn.dataset.start;

            const det = $("slotDetails");
            if (det) {
              const endDate = new Date(state.selectedStartIso);
              endDate.setMinutes(endDate.getMinutes() + durationMin);
              det.innerHTML = `
                <p><strong>${state.staffName}</strong></p>
                <p>${new Date(state.selectedDateStr).toLocaleDateString(
                  "hr-HR"
                )}
                   · ${fmtTime(state.selectedStartIso)}–${fmtTime(endDate)}</p>
                <p class="is-size-7 has-text-grey">Trajanje usluge: ${durationMin} min</p>`;
            }
            const me = $("modalErr");
            if (me) me.style.display = "none";
            openConfirmModal();
          });
        });
      }
    };

    if (silent) {
      render();
    } else {
      setTimeout(render, 100);
    }
  } catch (e) {
    if (!silent) {
      skeleton.style.display = "none";
      empty.style.display = "block";
    }
    console.error(e);
    showToast("Greška pri dohvaćanju termina.", true);
  } finally {
    isRefreshingSlots = false;
  }
}

// ==================== Calendar ====================
function buildCalendar() {
  const el = $("calendar");
  if (!el || typeof FullCalendar === "undefined") return;

  state.calendar = new FullCalendar.Calendar(el, {
    locale: "hr",
    initialView: "dayGridMonth",
    firstDay: 1,
    height: "auto",
    headerToolbar: { left: "prev,next today", center: "title", right: "" },
    validRange: (now) => ({ start: fmtDateIso(now) }),
    events: [],
    dateClick: async (info) => {
      state.selectedDateStr = info.dateStr; // "yyyy-MM-dd"
      openSlotsModal();
      await refreshSlotsInModal(false);
    },
  });

  state.calendar.render();
}

// ==================== Modali ====================
function openSlotsModal() {
  $("slotsModal")?.classList.add("is-active");

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
      await refreshSlotsInModal(true); // silent refresh svakih 10s
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
  $("bookModal")?.classList.add("is-active");
}
function closeConfirmModal() {
  $("bookModal")?.classList.remove("is-active");
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
      confirm.classList.add("is-loading");
      confirm.disabled = true;

      // "HH:mm"
      const startHHmm = new Date(state.selectedStartIso).toLocaleTimeString(
        "hr-HR",
        {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      );

      const res = await postBookingByStart({
        staffId: state.staffId,
        date: state.selectedDateStr,
        startTime: startHHmm,
        serviceId: state.serviceId,
        fullName: null,
        email: null,
        phone: null,
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
      closeConfirmModal();
      closeSlotsModal();
      showToast("Termin rezerviran ✅");
      state.selectedStartIso = null;
    };
  }
}

// ==================== Selektori ====================
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

  staffSel.addEventListener("change", async (e) => {
    state.staffId = parseInt(e.target.value || "0") || null;
    state.staffName =
      state.staff.find((x) => x.id === state.staffId)?.name || null;

    // reset servisa i izbora
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

// ==================== Bootstrap ====================
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

// ==================== Refresh on window focus ====================
window.addEventListener("focus", () => {
  if (
    document.getElementById("slotsModal")?.classList.contains("is-active") &&
    state.staffId &&
    state.serviceId &&
    state.selectedDateStr
  ) {
    refreshSlotsInModal(true); // silent refresh kad se vratiš na browser
  }
});
