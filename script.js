const STORAGE_KEY = "taskflow-tasks";
const CATEGORIES = ["Work", "Academics", "Personal", "Family", "Fun"];
const LEGACY_HIGH_PRIORITY_CATEGORY = "High Priority"; // old category, now priority "High"
const NO_PRIORITY = "None"; // not chosen: no priority badge on the card
const PRIORITIES = [NO_PRIORITY, "Low", "Medium", "High"];
const DEFAULT_PRIORITY = NO_PRIORITY;
const FILTER_ALL = "All";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const els = {
  openAdd: document.getElementById("open-add-task"),
  cancelAdd: document.getElementById("cancel-add-task"),
  modal: document.getElementById("task-modal"),
  modalTitle: document.getElementById("modal-title"),
  form: document.getElementById("task-form"),
  saveBtn: document.getElementById("save-task"),
  formError: document.getElementById("form-error"),
  pills: document.getElementById("category-pills"),
  prioritySelect: document.getElementById("priority-select"),
  filters: document.getElementById("category-filters"),
  board: document.getElementById("task-board"),
  filterLabel: document.getElementById("filter-label"),
  statTotal: document.getElementById("stat-total"),
  statCompleted: document.getElementById("stat-completed"),
  statDueToday: document.getElementById("stat-due-today"),
  statOverdue: document.getElementById("stat-overdue"),
  calendarTitle: document.getElementById("calendar-title"),
  calendarGrid: document.getElementById("calendar-grid"),
  clearDate: document.getElementById("clear-date-filter"),
  calendarNav: document.getElementById("calendar-nav"),
};

let tasks = loadTasks();
let activeFilter = FILTER_ALL;
let selectedCategories = [];
let editingTaskId = null;
let activeDate = null; // ISO date selected in the calendar, or null for no date filter
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

init();

function init() {
  renderCategoryPills();
  renderPriorityOptions();
  renderFilters();
  bindEvents();
  render();
}

function bindEvents() {
  els.openAdd.addEventListener("click", () => openModal());
  els.cancelAdd.addEventListener("click", closeModal);
  els.modal.addEventListener("cancel", closeModal);
  els.form.addEventListener("submit", handleSubmit);
  els.filters.addEventListener("click", handleFilterClick);
  els.pills.addEventListener("click", handlePillClick);
  els.board.addEventListener("click", handleTaskListClick);
  els.board.addEventListener("change", handleTaskListChange);
  els.calendarGrid.addEventListener("click", handleCalendarClick);
  els.clearDate.addEventListener("click", clearDateFilter);
  els.calendarNav.addEventListener("click", handleCalendarNav);
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const needsMigration = parsed.some(
      (task) =>
        task &&
        ("categories" in task ||
          !Array.isArray(task.category) ||
          task.category.includes(LEGACY_HIGH_PRIORITY_CATEGORY) ||
          !PRIORITIES.includes(task.priority))
    );
    const normalized = parsed.map(normalizeTask).filter(isValidTask);
    if (needsMigration) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") return task;

  // Collect categories from every format used so far (string, array, or old "categories" array)
  let rawCategories = [];
  if (Array.isArray(task.category)) {
    rawCategories = [...task.category];
  } else if (typeof task.category === "string") {
    rawCategories = [task.category];
  }
  if (Array.isArray(task.categories)) {
    rawCategories = [...rawCategories, ...task.categories];
  }

  // Old tasks used a "High Priority" category: it becomes priority "High".
  // Tasks without any priority get the default one.
  const wasHighPriority = rawCategories.includes(LEGACY_HIGH_PRIORITY_CATEGORY);
  let priority = DEFAULT_PRIORITY;
  if (PRIORITIES.includes(task.priority)) {
    priority = task.priority;
  } else if (wasHighPriority) {
    priority = "High";
  }

  const { categories: _unusedCategories, ...rest } = task;
  return { ...rest, category: uniqueCategories(rawCategories), priority };
}

function uniqueCategories(values) {
  return CATEGORIES.filter((category) => values.includes(category));
}

function isValidTask(task) {
  return (
    task &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    Array.isArray(task.category) &&
    task.category.every((category) => CATEGORIES.includes(category)) &&
    PRIORITIES.includes(task.priority) &&
    typeof task.dueDate === "string" &&
    typeof task.completed === "boolean"
  );
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysIso(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function createTask(data) {
  return {
    id: crypto.randomUUID(),
    title: data.title.trim(),
    description: data.description.trim(),
    category: uniqueCategories(data.category),
    priority: PRIORITIES.includes(data.priority) ? data.priority : DEFAULT_PRIORITY,
    dueDate: data.dueDate,
    startTime: data.startTime || "",
    endTime: data.endTime || "",
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

function openModal(task) {
  els.form.reset();
  els.formError.hidden = true;

  if (task) {
    editingTaskId = task.id;
    els.modalTitle.textContent = "Edit task";
    els.saveBtn.textContent = "Save changes";
    els.form.title.value = task.title;
    els.form.description.value = task.description || "";
    els.form.dueDate.value = task.dueDate;
    els.form.startTime.value = task.startTime || "";
    els.form.endTime.value = task.endTime || "";
    els.form.elements.priority.value = task.priority;
    selectedCategories = [...task.category];
  } else {
    editingTaskId = null;
    els.modalTitle.textContent = "Add task";
    els.saveBtn.textContent = "Save task";
    els.form.dueDate.value = todayIsoDate();
    els.form.elements.priority.value = DEFAULT_PRIORITY;
    selectedCategories = [];
  }

  updatePillSelection();
  els.modal.showModal();
  els.form.title.focus();
}

function closeModal() {
  editingTaskId = null;
  els.modal.close();
}

function handlePillClick(event) {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  const category = button.dataset.category;
  if (selectedCategories.includes(category)) {
    selectedCategories = selectedCategories.filter((item) => item !== category);
  } else {
    selectedCategories = uniqueCategories([...selectedCategories, category]);
  }
  updatePillSelection();
}

function handleFilterClick(event) {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  render();
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(els.form);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dueDate = String(formData.get("dueDate") || "");
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const priorityValue = String(formData.get("priority") || "");
  const priority = PRIORITIES.includes(priorityValue) ? priorityValue : DEFAULT_PRIORITY;

  if (!title) {
    showFormError("Title is required.");
    return;
  }
  if (!dueDate) {
    showFormError("Due date is required.");
    return;
  }
  if (selectedCategories.length === 0) {
    showFormError("Select at least one category.");
    return;
  }
  if (startTime && endTime && endTime < startTime) {
    showFormError("End time must be after start time.");
    return;
  }

  const fields = {
    title,
    description,
    category: selectedCategories,
    priority,
    dueDate,
    startTime,
    endTime,
  };

  if (editingTaskId) {
    const task = tasks.find((item) => item.id === editingTaskId);
    if (task) {
      task.title = fields.title;
      task.description = fields.description;
      task.category = uniqueCategories(fields.category);
      task.priority = fields.priority;
      task.dueDate = fields.dueDate;
      task.startTime = fields.startTime || "";
      task.endTime = fields.endTime || "";
    }
  } else {
    tasks.push(createTask(fields));
  }

  saveTasks();
  closeModal();
  render();
}

function showFormError(message) {
  els.formError.hidden = false;
  els.formError.textContent = message;
}

function handleTaskListChange(event) {
  const checkbox = event.target.closest("[data-complete]");
  if (!checkbox) return;
  toggleComplete(checkbox.dataset.complete, checkbox.checked);
}

function handleTaskListClick(event) {
  const deleteBtn = event.target.closest("[data-delete]");
  if (deleteBtn) {
    deleteTask(deleteBtn.dataset.delete);
    return;
  }

  const editBtn = event.target.closest("[data-edit]");
  if (editBtn) {
    const task = tasks.find((item) => item.id === editBtn.dataset.edit);
    if (task) openModal(task);
  }
}

function toggleComplete(id, completed) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  task.completed = completed;
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((item) => item.id !== id);
  saveTasks();
  render();
}

function getVisibleTasks() {
  return tasks.filter(
    (task) =>
      (activeFilter === FILTER_ALL || task.category.includes(activeFilter)) &&
      (!activeDate || task.dueDate === activeDate)
  );
}

function getTaskSection(task) {
  const today = todayIsoDate();
  const weekEnd = addDaysIso(today, 7);

  if (task.dueDate < today) return "backlog";
  if (task.dueDate === today) return "today";
  if (task.dueDate <= weekEnd) return "week";
  return "upcoming";
}

function render() {
  renderFilters();
  renderDashboard();
  try {
    renderCalendar();
  } catch (error) {
    console.error("Calendar failed to render:", error);
  }
  renderTaskSections();
}

function renderCategoryPills() {
  els.pills.innerHTML = CATEGORIES.map(
    (category) =>
      `<button type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join("");
  updatePillSelection();
}

function updatePillSelection() {
  els.pills.querySelectorAll("[data-category]").forEach((button) => {
    const pressed = selectedCategories.includes(button.dataset.category);
    button.setAttribute("aria-pressed", String(pressed));
  });
}

function renderPriorityOptions() {
  els.prioritySelect.innerHTML = PRIORITIES.map(
    (priority) =>
      `<option value="${escapeHtml(priority)}">${escapeHtml(priority)}</option>`
  ).join("");
  els.prioritySelect.value = DEFAULT_PRIORITY;
}

function renderFilters() {
  const filters = [FILTER_ALL, ...CATEGORIES];
  els.filters.innerHTML = filters
    .map(
      (filter) =>
        `<button type="button" data-filter="${escapeHtml(filter)}" aria-pressed="${filter === activeFilter}">${escapeHtml(filter)}</button>`
    )
    .join("");
}

function renderDashboard() {
  const today = todayIsoDate();
  const completed = tasks.filter((task) => task.completed).length;
  const dueToday = tasks.filter((task) => task.dueDate === today && !task.completed).length;
  const overdue = tasks.filter((task) => task.dueDate < today && !task.completed).length;

  els.statTotal.textContent = String(tasks.length);
  els.statCompleted.textContent = String(completed);
  els.statDueToday.textContent = String(dueToday);
  els.statOverdue.textContent = String(overdue);
}

function renderTaskSections() {
  const visible = getVisibleTasks();
  els.filterLabel.textContent = activeDate
    ? `Showing: ${activeFilter} · due ${activeDate}`
    : `Showing: ${activeFilter}`;

  const grouped = {
    today: [],
    week: [],
    upcoming: [],
    backlog: [],
  };

  visible.forEach((task) => {
    grouped[getTaskSection(task)].push(task);
  });

  els.board.querySelectorAll(".task-section").forEach((section) => {
    const key = section.dataset.section;
    const items = grouped[key] || [];
    const empty = section.querySelector(".empty-state");
    const list = section.querySelector(".task-list");
    empty.hidden = items.length > 0;
    list.innerHTML = items.map(taskCardHtml).join("");
  });
}

function taskCardHtml(task) {
  const timeRange = formatTimeRange(task.startTime, task.endTime);
  const description = task.description
    ? `<p class="task-meta">${escapeHtml(task.description)}</p>`
    : "";
  const time = timeRange ? `<p class="task-meta">${escapeHtml(timeRange)}</p>` : "";
  const badges = task.category
    .map(
      (category) =>
        `<span class="badge ${badgeClass(category)}">${escapeHtml(category)}</span>`
    )
    .join(" ");
  const priorityBadge =
    task.priority === NO_PRIORITY
      ? ""
      : `<span class="badge ${priorityBadgeClass(task.priority)}">Priority: ${escapeHtml(task.priority)}</span>`;

  return `
    <li class="task-card ${task.completed ? "completed" : ""}" data-id="${escapeHtml(task.id)}">
      <input
        type="checkbox"
        data-complete="${escapeHtml(task.id)}"
        ${task.completed ? "checked" : ""}
        aria-label="Mark ${escapeHtml(task.title)} as completed"
      />
      <div>
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <div class="badge-row">${badges} ${priorityBadge}</div>
        <p class="task-meta">Due ${escapeHtml(task.dueDate)}</p>
        ${time}
        ${description}
      </div>
      <div class="task-actions">
        <button type="button" data-edit="${escapeHtml(task.id)}">Edit</button>
        <button type="button" data-delete="${escapeHtml(task.id)}">Delete</button>
      </div>
    </li>
  `;
}

function formatTimeRange(startTime, endTime) {
  if (startTime && endTime) return `${startTime} – ${endTime}`;
  if (startTime) return `From ${startTime}`;
  if (endTime) return `Until ${endTime}`;
  return "";
}

function badgeClass(category) {
  return `badge-${category.toLowerCase().replace(/\s+/g, "-")}`;
}

// "High" keeps the red look the old "High Priority" badge had; Low/Medium use plain .badge
function priorityBadgeClass(priority) {
  return priority === "High"
    ? "badge-priority badge-high-priority"
    : `badge-priority badge-priority-${priority.toLowerCase()}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


// calendar
function handleCalendarClick(event) {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  const date = button.dataset.date;
  activeDate = activeDate === date ? null : date; // click again to clear
  render();
}

function handleCalendarNav(event) {
  const button = event.target.closest("[data-nav]");
  if (!button) return;
  const first = new Date(viewYear, viewMonth + Number(button.dataset.nav), 1);
  viewYear = first.getFullYear();
  viewMonth = first.getMonth();
  renderCalendar();
}

function clearDateFilter() {
  activeDate = null;
  render();
}

function renderCalendar() {
  const today = todayIsoDate();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const leading = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7; // week starts Monday
  const trailing = (7 - ((leading + daysInMonth) % 7)) % 7;

  // Count tasks per due date (all tasks, regardless of completion or category)
  const counts = {};
  tasks.forEach((task) => {
    counts[task.dueDate] = (counts[task.dueDate] || 0) + 1;
  });

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  els.calendarTitle.textContent = monthLabel;

  const cells = WEEKDAY_LABELS.map(
    (label) => `<div class="calendar-weekday">${label}</div>`
  );

  // greyed-out days from the previous month
  for (let i = leading - 1; i >= 0; i--) {
    cells.push(`<div class="calendar-other">${daysInPrevMonth - i}</div>`);
  }

  // days of the shown month
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = toIsoDate(new Date(viewYear, viewMonth, day));
    const count = counts[iso] || 0;
    const classes = ["calendar-day"];
    if (iso === today) classes.push("today");
    const noun = count === 1 ? "task" : "tasks";
    const label = `${day} ${monthLabel}, ${count} ${noun}${iso === today ? ", today" : ""}`;

    cells.push(
      `<button type="button" class="${classes.join(" ")}" data-date="${iso}" aria-pressed="${iso === activeDate}" aria-label="${escapeHtml(label)}">` +
        `<span class="calendar-num">${day}</span>` +
        `<span class="calendar-count">${count > 0 ? count : ""}</span>` +
      `</button>`
    );
  }

  // greyed-out days from the next month
  for (let day = 1; day <= trailing; day++) {
    cells.push(`<div class="calendar-other">${day}</div>`);
  }

  els.calendarGrid.innerHTML = cells.join("");
  els.clearDate.hidden = !activeDate;
}