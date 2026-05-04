const heroMetrics = document.getElementById("heroMetrics");
const summaryGrid = document.getElementById("summaryGrid");
const coursesList = document.getElementById("coursesList");
const dashboardMeta = document.getElementById("dashboardMeta");
const statusPill = document.getElementById("statusPill");
const importForm = document.getElementById("importForm");
const importMessage = document.getElementById("importMessage");
const courseForm = document.getElementById("courseForm");
const profileForm = document.getElementById("profileForm");
const resetBtn = document.getElementById("resetBtn");
const studentNameInput = document.getElementById("studentNameInput");
const semesterLabelInput = document.getElementById("semesterLabelInput");
const scopeSelect = document.getElementById("scopeSelect");
const targetSelect = document.getElementById("targetSelect");
const calculatorRemaining = document.getElementById("calculatorRemaining");
const calculatorResult = document.getElementById("calculatorResult");
const metricTemplate = document.getElementById("metricTemplate");
const courseTemplate = document.getElementById("courseTemplate");

let currentState = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "n/a";
  }
  return `${value.toFixed(1)}%`;
}

function formatNumber(value) {
  return Number.isFinite(value) ? String(value) : "0";
}

function metricCard(label, value, detail) {
  const node = metricTemplate.content.cloneNode(true);
  node.querySelector(".metric-label").textContent = label;
  node.querySelector(".metric-value").textContent = value;
  node.querySelector(".metric-detail").textContent = detail;
  return node;
}

function summaryCard(label, value, detail) {
  return `
    <article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <span>${escapeHtml(detail)}</span>
    </article>
  `;
}

function targetText(needed, target) {
  if (needed === 0) {
    return `Already above ${target}%`;
  }
  return `Need ${needed} more attended classes to reach ${target}% if every future class is attended.`;
}

function remainingPlanText(plan, target) {
  if (plan.mustAttend === null) {
    return `Add expected classes to see how many you must attend for ${target}%.`;
  }
  return `With ${plan.mustAttend} of the next classes attended, you stay above ${target}% and can miss ${plan.canMiss}.`;
}

function buildScopeOptions(state) {
  const options = [`<option value="overall">Overall</option>`];
  for (const course of state.courses) {
    options.push(
      `<option value="${escapeHtml(course.id)}">${escapeHtml(course.name)}${course.code ? ` (${escapeHtml(course.code)})` : ""}</option>`,
    );
  }
  scopeSelect.innerHTML = options.join("");
}

function getSelectedScope() {
  if (!currentState) {
    return null;
  }

  const scope = scopeSelect.value;
  if (scope === "overall") {
    return {
      label: "Overall",
      attended: currentState.totals.attended,
      conducted: currentState.totals.conducted,
      remainingExpected: currentState.totals.remainingExpected,
      currentPercent: currentState.totals.currentPercent,
      requiredNow: currentState.totals.requiredNow,
      remainingPlan: currentState.totals.remainingPlan,
    };
  }

  return currentState.courses.find((course) => course.id === scope) || null;
}

function renderHeroMetrics(state) {
  heroMetrics.innerHTML = "";

  const overall = state.totals;
  const cards = [
    metricCard("Current overall", formatPercent(overall.currentPercent), `${overall.attended}/${overall.conducted}`),
    metricCard("Need for 75%", formatNumber(overall.requiredNow[75]), "Assuming perfect attendance from now"),
    metricCard("Need for 80%", formatNumber(overall.requiredNow[80]), "Assuming perfect attendance from now"),
  ];

  cards.forEach((card) => heroMetrics.appendChild(card));
}

function renderSummary(state) {
  const overall = state.totals;
  summaryGrid.innerHTML = [
    summaryCard("Subjects tracked", formatNumber(state.courses.length), state.semesterLabel),
    summaryCard("Attendance total", formatPercent(overall.currentPercent), `${overall.attended} attended / ${overall.conducted} held`),
    summaryCard("Need for 75%", formatNumber(overall.requiredNow[75]), targetText(overall.requiredNow[75], 75)),
    summaryCard("Need for 80%", formatNumber(overall.requiredNow[80]), targetText(overall.requiredNow[80], 80)),
  ].join("");
}

function updateCalculator() {
  if (!currentState) {
    calculatorResult.textContent = "Add ERP data to use the calculator.";
    return;
  }

  const scope = getSelectedScope();
  if (!scope) {
    calculatorResult.textContent = "Pick a subject first.";
    return;
  }

  const target = Number(targetSelect.value);
  const remainingValue = calculatorRemaining.value.trim();
  const remaining = remainingValue === "" ? Number(scope.remainingExpected || 0) : Number(remainingValue);
  const current = Number(scope.currentPercent || 0);
  const attended = Number(scope.attended || 0);
  const conducted = Number(scope.conducted || 0);
  const targetRatio = target / 100;
  const needNow = scope.requiredNow?.[target] ?? 0;
  const mustAttend = remaining
    ? Math.max(0, Math.min(remaining, Math.ceil((targetRatio * (conducted + remaining)) - attended)))
    : null;
  const canMiss = mustAttend === null ? null : Math.max(0, remaining - mustAttend);

  calculatorResult.innerHTML = `
    <div class="insight-line"><strong>${escapeHtml(scope.label || scope.name || "Selected subject")}</strong></div>
    <div class="insight-line">Current attendance: <strong>${escapeHtml(formatPercent(current))}</strong></div>
    <div class="insight-line">${escapeHtml(targetText(needNow, target))}</div>
    <div class="insight-line">${escapeHtml(remainingPlanText({ mustAttend, canMiss }, target))}</div>
  `;
}

function renderCourses(state) {
  coursesList.innerHTML = "";

  if (!state.courses.length) {
    coursesList.innerHTML = `<p class="section-copy">No subjects yet. Import ERP data or add a subject manually.</p>`;
    return;
  }

  for (const course of state.courses) {
    const node = courseTemplate.content.cloneNode(true);
    const card = node.querySelector(".course-card");
    const form = node.querySelector(".course-form");
    const nameEl = node.querySelector(".course-name");
    const codeEl = node.querySelector(".course-code");
    const badge = node.querySelector(".status-badge");
    const insights = node.querySelector(".course-insights");
    const deleteButton = node.querySelector('[data-action="delete"]');

    form.dataset.id = course.id;
    form.elements.name.value = course.name || "";
    form.elements.code.value = course.code || "";
    form.elements.attended.value = course.attended ?? 0;
    form.elements.conducted.value = course.conducted ?? 0;
    form.elements.remainingExpected.value = course.remainingExpected ?? 0;
    form.elements.notes.value = course.notes || "";

    nameEl.textContent = course.name;
    codeEl.textContent = course.code ? course.code : "No course code";

    const current = course.currentPercent ?? 0;
    if (current >= 80) {
      badge.textContent = "Above 80%";
      badge.className = "status-badge status-good";
    } else if (current >= 75) {
      badge.textContent = "Above 75%";
      badge.className = "status-badge status-warning";
    } else {
      badge.textContent = "Below 75%";
      badge.className = "status-badge status-danger";
    }

    insights.innerHTML = `
      <div class="insight-line">Current: <strong>${escapeHtml(formatPercent(course.currentPercent))}</strong> (${course.attended}/${course.conducted})</div>
      <div class="insight-line">${escapeHtml(targetText(course.requiredNow[75], 75))}</div>
      <div class="insight-line">${escapeHtml(targetText(course.requiredNow[80], 80))}</div>
      <div class="insight-line">${escapeHtml(remainingPlanText(course.remainingPlan[75], 75))}</div>
      <div class="insight-line">${escapeHtml(remainingPlanText(course.remainingPlan[80], 80))}</div>
      <div class="insight-line">${course.notes ? `Notes: ${escapeHtml(course.notes)}` : "No notes added."}</div>
    `;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      try {
        await api(`/api/courses/${course.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        await refreshData();
      } catch (error) {
        importMessage.textContent = error.message;
      }
    });

    deleteButton.addEventListener("click", async () => {
      try {
        await api(`/api/courses/${course.id}`, { method: "DELETE" });
        await refreshData();
      } catch (error) {
        importMessage.textContent = error.message;
      }
    });

    coursesList.appendChild(card);
  }
}

function syncProfileFields(state) {
  studentNameInput.value = state.studentName || "";
  semesterLabelInput.value = state.semesterLabel || "";
  dashboardMeta.textContent = `${state.studentName} • ${state.semesterLabel}`;
  statusPill.textContent = `${state.courses.length} subjects`;
}

async function refreshData() {
  const payload = await api("/api/state");
  currentState = payload.state;
  syncProfileFields(currentState);
  buildScopeOptions(currentState);
  renderHeroMetrics(currentState);
  renderSummary(currentState);
  renderCourses(currentState);
  updateCalculator();
}

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  importMessage.textContent = "";

  const formData = new FormData(importForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const result = await api("/api/import", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    currentState = result.state;
    importMessage.textContent = `Imported ${result.imported} subject(s).`;
    syncProfileFields(currentState);
    buildScopeOptions(currentState);
    renderHeroMetrics(currentState);
    renderSummary(currentState);
    renderCourses(currentState);
    updateCalculator();
  } catch (error) {
    importMessage.textContent = error.message;
  }
});

courseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(courseForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    await api("/api/courses", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    courseForm.reset();
    courseForm.elements.remainingExpected.value = "0";
    await refreshData();
  } catch (error) {
    importMessage.textContent = error.message;
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    await api("/api/profile", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await refreshData();
  } catch (error) {
    importMessage.textContent = error.message;
  }
});

resetBtn.addEventListener("click", async () => {
  try {
    await api("/api/reset", { method: "POST" });
    await refreshData();
    importMessage.textContent = "Sample dashboard restored.";
  } catch (error) {
    importMessage.textContent = error.message;
  }
});

scopeSelect.addEventListener("change", updateCalculator);
targetSelect.addEventListener("change", updateCalculator);
calculatorRemaining.addEventListener("input", updateCalculator);

refreshData().catch((error) => {
  importMessage.textContent = error.message;
});
