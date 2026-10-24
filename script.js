// --- Constants ---

const TASKS_STORAGE_KEY = "taskflow-tasks";
const CATEGORIES_STORAGE_KEY = "taskflow-categories";
const THEME_STORAGE_KEY = "taskflow-theme";
// Colors are numbers that match --cat-1 to --cat-8 in style.css
const DEFAULT_CATEGORIES = [
  { name: "Work", color: 1 },
  { name: "Academics", color: 2 },
  { name: "Personal", color: 3 },
  { name: "Family", color: 4 },
  { name: "Fun", color: 5 },
];
const CATEGORY_COLOR_COUNT = 8;
const CATEGORY_NAME_MAX_LENGTH = 20;
const PRIORITIES = ["Low", "Medium", "High"];
const DEFAULT_PRIORITY = "Medium";
// Old category, now a priority level
const LEGACY_HIGH_PRIORITY_CATEGORY = "High Priority";
const FILTER_ALL = "All";
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// --- Elements ---

const els = {
  openAddBtn: document.getElementById("open-add-task"),
  cancelAddBtn: document.getElementById("cancel-add-task"),
  saveBtn: document.getElementById("save-task"),
  clearDateBtn: document.getElementById("clear-date-filter"),
  themeBtn: document.getElementById("theme-toggle"),
  editCategoriesBtn: document.getElementById("edit-categories"),
  modal: document.getElementById("task-modal"),
  modalTitle: document.getElementById("modal-title"),
  form: document.getElementById("task-form"),
  formError: document.getElementById("form-error"),
  pills: document.getElementById("category-pills"),
  filters: document.getElementById("category-filters"),
  categoryForm: document.getElementById("new-category-form"),
  categoryError: document.getElementById("category-error"),
  board: document.getElementById("task-board"),
  filterLabel: document.getElementById("filter-label"),
  statTotal: document.getElementById("stat-total"),
  statCompleted: document.getElementById("stat-completed"),
  statDueToday: document.getElementById("stat-due-today"),
  statOverdue: document.getElementById("stat-overdue"),
  calendarNav: document.getElementById("calendar-nav"),
  calendarTitle: document.getElementById("calendar-title"),
  calendarGrid: document.getElementById("calendar-grid"),
};

// --- State ---

let categories = loadCategories();
let tasks = loadTasks();
let activeFilter = FILTER_ALL;
// ISO date picked in the calendar, or null for no date filter
let activeDate = null;
let selectedCategories = [];
let editingTaskId = null;
let isEditingCategories = false;
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

init();

// --- Setup ---

function init() {
  applyTheme(loadTheme());
  renderCategoryPills();
  bindEvents();
  render();
}

function bindEvents() {
  els.openAddBtn.addEventListener("click", () => openModal());
  els.cancelAddBtn.addEventListener("click", closeModal);
  els.clearDateBtn.addEventListener("click", clearDateFilter);
  els.themeBtn.addEventListener("click", toggleTheme);
  els.editCategoriesBtn.addEventListener("click", toggleCategoryEditing);
  els.modal.addEventListener("cancel", closeModal);
  els.form.addEventListener("submit", handleSubmit);
  els.pills.addEventListener("click", handlePillClick);
  els.filters.addEventListener("click", handleFilterClick);
  els.categoryForm.addEventListener("submit", handleCategorySubmit);
  els.board.addEventListener("click", handleTaskListClick);
  els.board.addEventListener("change", handleTaskListChange);
  els.calendarNav.addEventListener("click", handleCalendarNav);
  els.calendarGrid.addEventListener("click", handleCalendarClick);
}

// --- Theme ---

function loadTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const otherTheme = theme === "light" ? "dark" : "light";
  els.themeBtn.setAttribute("aria-label", `Switch to ${otherTheme} theme`);
}

function toggleTheme() {
  const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  applyTheme(theme);
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// --- Storage ---

function loadCategories() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CATEGORIES_STORAGE_KEY));
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidCategory)
      ? parsed
      : [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

function saveCategories() {
  localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.map(normalizeTask).filter(isValidTask);
    // Save back so old tasks are stored in the current format
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
}

// Converts older saves ("category" field, "High Priority" category) to the current format
function normalizeTask(task) {
  if (!task || typeof task !== "object") return task;

  const savedCategories = [task.categories, task.category].flat().filter(Boolean);
  const { category: _oldCategory, ...rest } = task;

  return {
    ...rest,
    categories: uniqueCategories(savedCategories),
    priority: normalizePriority(task.priority, savedCategories),
  };
}

function normalizePriority(priority, savedCategories = []) {
  if (PRIORITIES.includes(priority)) return priority;
  if (savedCategories.includes(LEGACY_HIGH_PRIORITY_CATEGORY)) return "High";
  return DEFAULT_PRIORITY;
}

function isValidCategory(category) {
  return (
    category &&
    typeof category.name === "string" &&
    Number.isInteger(category.color) &&
    category.color >= 1 &&
    category.color <= CATEGORY_COLOR_COUNT
  );
}

function isValidTask(task) {
  return (
    task &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    Array.isArray(task.categories) &&
    task.categories.every((name) => categoryNames().includes(name)) &&
    PRIORITIES.includes(task.priority) &&
    typeof task.dueDate === "string" &&
    typeof task.completed === "boolean"
  );
}

// --- Dates ---

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function addDaysToIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

// --- Categories ---

function categoryNames() {
  return categories.map((category) => category.name);
}

// Keeps only known categories, in the same order as the category list
function uniqueCategories(values) {
  return categoryNames().filter((name) => values.includes(name));
}

function findCategory(name) {
  return categories.find((category) => category.name === name);
}

function nextCategoryColor() {
  const usedColors = categories.map((category) => category.color);
  for (let color = 1; color <= CATEGORY_COLOR_COUNT; color++) {
    if (!usedColors.includes(color)) return color;
  }
  return (categories.length % CATEGORY_COLOR_COUNT) + 1;
}

function validateCategoryName(name) {
  if (!name) return "Enter a category name.";
  if (name.length > CATEGORY_NAME_MAX_LENGTH) {
    return `Use ${CATEGORY_NAME_MAX_LENGTH} characters or fewer.`;
  }
  const taken = [FILTER_ALL, ...categoryNames()].some(
    (existing) => existing.toLowerCase() === name.toLowerCase()
  );
  if (taken) return `"${name}" already exists.`;
  return "";
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const name = els.categoryForm.categoryName.value.trim().replace(/\s+/g, " ");
  const error = validateCategoryName(name);
  if (error) {
    showCategoryError(error);
    return;
  }

  categories.push({ name, color: nextCategoryColor() });
  saveCategories();
  els.categoryForm.reset();
  els.categoryError.hidden = true;
  renderCategoryPills();
  render();
}

function deleteCategory(name) {
  if (categories.length === 1) {
    showCategoryError("Keep at least one category.");
    return;
  }

  const usedBy = tasks.filter((task) => task.categories.includes(name)).length;
  const noun = usedBy === 1 ? "task" : "tasks";
  if (usedBy > 0 && !confirm(`Delete "${name}"? It will be removed from ${usedBy} ${noun}.`)) {
    return;
  }

  categories = categories.filter((category) => category.name !== name);
  tasks.forEach((task) => {
    task.categories = task.categories.filter((category) => category !== name);
  });
  selectedCategories = selectedCategories.filter((selected) => selected !== name);
  if (activeFilter === name) activeFilter = FILTER_ALL;

  saveCategories();
  saveTasks();
  els.categoryError.hidden = true;
  renderCategoryPills();
  render();
}

function toggleCategoryEditing() {
  isEditingCategories = !isEditingCategories;
  els.editCategoriesBtn.textContent = isEditingCategories ? "Done" : "Edit";
  els.editCategoriesBtn.setAttribute("aria-pressed", String(isEditingCategories));
  els.categoryError.hidden = true;
  renderFilters();
}

function showCategoryError(message) {
  els.categoryError.hidden = false;
  els.categoryError.textContent = message;
}

// --- Tasks ---

function cleanTaskFields(fields) {
  return {
    title: fields.title.trim(),
    description: fields.description.trim(),
    categories: uniqueCategories(fields.categories),
    priority: normalizePriority(fields.priority),
    dueDate: fields.dueDate,
    startTime: fields.startTime || "",
    endTime: fields.endTime || "",
  };
}

function createTask(fields) {
  return {
    id: crypto.randomUUID(),
    ...cleanTaskFields(fields),
    completed: false,
    createdAt: new Date().toISOString(),
  };
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

function toggleComplete(id, completed) {
  const task = findTask(id);
  if (!task) return;
  task.completed = completed;
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter((task) => task.id !== id);
  saveTasks();
  render();
}

// --- Modal and form ---

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
    els.form.priority.value = task.priority;
    selectedCategories = [...task.categories];
  } else {
    editingTaskId = null;
    els.modalTitle.textContent = "Add task";
    els.saveBtn.textContent = "Save task";
    els.form.dueDate.value = todayIsoDate();
    els.form.priority.value = DEFAULT_PRIORITY;
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

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(els.form);
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const dueDate = String(formData.get("dueDate") || "");
  const startTime = String(formData.get("startTime") || "");
  const endTime = String(formData.get("endTime") || "");
  const priority = String(formData.get("priority") || DEFAULT_PRIORITY);

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
    categories: selectedCategories,
    priority,
    dueDate,
    startTime,
    endTime,
  };

  if (editingTaskId) {
    const task = findTask(editingTaskId);
    if (task) Object.assign(task, cleanTaskFields(fields));
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

function handlePillClick(event) {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  const category = button.dataset.category;
  if (selectedCategories.includes(category)) {
    selectedCategories = selectedCategories.filter((selected) => selected !== category);
  } else {
    selectedCategories = uniqueCategories([...selectedCategories, category]);
  }
  updatePillSelection();
}

// --- Filters and task list events ---

function handleFilterClick(event) {
  const deleteBtn = event.target.closest("[data-delete-category]");
  if (deleteBtn) {
    deleteCategory(deleteBtn.dataset.deleteCategory);
    return;
  }

  const button = event.target.closest("[data-filter]");
  if (!button) return;
  activeFilter = button.dataset.filter;
  render();
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
    const task = findTask(editBtn.dataset.edit);
    if (task) openModal(task);
  }
}

function getVisibleTasks() {
  return tasks.filter(
    (task) =>
      (activeFilter === FILTER_ALL || task.categories.includes(activeFilter)) &&
      (!activeDate || task.dueDate === activeDate)
  );
}

function getTaskSection(task) {
  const today = todayIsoDate();
  const weekEnd = addDaysToIsoDate(today, 7);

  if (task.dueDate < today) return "overdue";
  if (task.dueDate === today) return "today";
  if (task.dueDate <= weekEnd) return "week";
  return "upcoming";
}

// --- Rendering ---

function render() {
  renderFilters();
  renderDashboard();
  renderCalendar();
  renderTaskSections();
}

function renderCategoryPills() {
  els.pills.innerHTML = categoryNames()
    .map(
      (name) =>
        `<button type="button" data-category="${escapeHtml(name)}">${escapeHtml(name)}</button>`
    )
    .join("");
  updatePillSelection();
}

function updatePillSelection() {
  els.pills.querySelectorAll("[data-category]").forEach((button) => {
    const pressed = selectedCategories.includes(button.dataset.category);
    button.setAttribute("aria-pressed", String(pressed));
  });
}

function renderFilters() {
  els.filters.classList.toggle("editing", isEditingCategories);
  const categoryItems = categoryNames()
    .map(
      (name) => `
        <span class="filter-item">
          ${filterButtonHtml(name)}
          <button type="button" class="delete-category" data-delete-category="${escapeHtml(name)}" aria-label="Delete ${escapeHtml(name)} category">×</button>
        </span>
      `
    )
    .join("");
  els.filters.innerHTML = filterButtonHtml(FILTER_ALL) + categoryItems;
}

function filterButtonHtml(filter) {
  return `<button type="button" data-filter="${escapeHtml(filter)}" aria-pressed="${filter === activeFilter}">${escapeHtml(filter)}</button>`;
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
    overdue: [],
  };

  visible.forEach((task) => {
    grouped[getTaskSection(task)].push(task);
  });

  els.board.querySelectorAll(".task-section").forEach((section) => {
    const sectionTasks = grouped[section.dataset.section] || [];
    const empty = section.querySelector(".empty-state");
    const list = section.querySelector(".task-list");
    empty.hidden = sectionTasks.length > 0;
    list.innerHTML = sectionTasks.map(taskCardHtml).join("");
  });
}

function taskCardHtml(task) {
  const timeRange = formatTimeRange(task.startTime, task.endTime);
  const description = task.description
    ? `<p class="task-meta">${escapeHtml(task.description)}</p>`
    : "";
  const time = timeRange ? `<p class="task-meta">${escapeHtml(timeRange)}</p>` : "";
  const categoryBadges = task.categories.map(categoryBadgeHtml).join("");
  const priorityBadge = `<span class="badge ${priorityBadgeClass(task.priority)}">${escapeHtml(task.priority)} priority</span>`;

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
        <div class="badge-row">${categoryBadges}${priorityBadge}</div>
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

function categoryBadgeHtml(name) {
  const color = findCategory(name)?.color ?? 1;
  return `<span class="badge badge-category" style="--dot: var(--cat-${color})">${escapeHtml(name)}</span>`;
}

function priorityBadgeClass(priority) {
  return `badge-priority-${priority.toLowerCase()}`;
}

// --- Calendar ---

function handleCalendarNav(event) {
  const button = event.target.closest("[data-nav]");
  if (!button) return;
  const firstOfMonth = new Date(viewYear, viewMonth + Number(button.dataset.nav), 1);
  viewYear = firstOfMonth.getFullYear();
  viewMonth = firstOfMonth.getMonth();
  render();
}

function handleCalendarClick(event) {
  const button = event.target.closest("[data-date]");
  if (!button) return;
  const date = button.dataset.date;
  // Clicking the same day again clears the filter
  activeDate = activeDate === date ? null : date;
  render();
}

function clearDateFilter() {
  activeDate = null;
  render();
}

function renderCalendar() {
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  // Week starts on Monday
  const leadingDays = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const trailingDays = (7 - ((leadingDays + daysInMonth) % 7)) % 7;
  const taskCounts = countTasksByDate();

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
  els.calendarTitle.textContent = monthLabel;

  const cells = WEEKDAY_LABELS.map(
    (label) => `<div class="calendar-weekday">${label}</div>`
  );

  for (let i = leadingDays - 1; i >= 0; i--) {
    cells.push(`<div class="calendar-other">${daysInPrevMonth - i}</div>`);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isoDate = toIsoDate(new Date(viewYear, viewMonth, day));
    cells.push(calendarDayHtml(isoDate, day, taskCounts[isoDate] || 0, monthLabel));
  }

  for (let day = 1; day <= trailingDays; day++) {
    cells.push(`<div class="calendar-other">${day}</div>`);
  }

  els.calendarGrid.innerHTML = cells.join("");
  els.clearDateBtn.hidden = !activeDate;
}

// Counts all tasks per due date, regardless of completion or category
function countTasksByDate() {
  const counts = {};
  tasks.forEach((task) => {
    counts[task.dueDate] = (counts[task.dueDate] || 0) + 1;
  });
  return counts;
}

function calendarDayHtml(isoDate, day, count, monthLabel) {
  const isToday = isoDate === todayIsoDate();
  const noun = count === 1 ? "task" : "tasks";
  const label = `${day} ${monthLabel}, ${count} ${noun}${isToday ? ", today" : ""}`;

  return `
    <button
      type="button"
      class="calendar-day ${isToday ? "today" : ""}"
      data-date="${escapeHtml(isoDate)}"
      aria-pressed="${isoDate === activeDate}"
      aria-label="${escapeHtml(label)}"
    >
      <span class="calendar-num">${day}</span>
      <span class="calendar-count">${count > 0 ? count : ""}</span>
    </button>
  `;
}

// --- Helpers ---

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
