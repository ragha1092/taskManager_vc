const STORAGE_KEY = "taskflow-tasks";
const CATEGORIES = ["Work", "Academics", "Personal", "Family", "Fun", "High Priority"];
const FILTER_ALL = "All";

const els = {
  openAdd: document.getElementById("open-add-task"),
  cancelAdd: document.getElementById("cancel-add-task"),
  modal: document.getElementById("task-modal"),
  modalTitle: document.getElementById("modal-title"),
  form: document.getElementById("task-form"),
  saveBtn: document.getElementById("save-task"),
  formError: document.getElementById("form-error"),
  pills: document.getElementById("category-pills"),
  filters: document.getElementById("category-filters"),
  board: document.getElementById("task-board"),
  filterLabel: document.getElementById("filter-label"),
  statTotal: document.getElementById("stat-total"),
  statCompleted: document.getElementById("stat-completed"),
  statDueToday: document.getElementById("stat-due-today"),
  statOverdue: document.getElementById("stat-overdue"),
};

let tasks = loadTasks();
let activeFilter = FILTER_ALL;
let selectedCategories = [];
let editingTaskId = null;

init();

function init() {
  renderCategoryPills();
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
        ("categories" in task || !Array.isArray(task.category))
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

  let category = [];
  if (Array.isArray(task.category)) {
    category = uniqueCategories(task.category);
  } else if (typeof task.category === "string") {
    category = uniqueCategories([task.category]);
  }
  if (Array.isArray(task.categories)) {
    category = uniqueCategories([...category, ...task.categories]);
  }

  const { categories: _unusedCategories, ...rest } = task;
  return { ...rest, category };
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
    selectedCategories = [...task.category];
  } else {
    editingTaskId = null;
    els.modalTitle.textContent = "Add task";
    els.saveBtn.textContent = "Save task";
    els.form.dueDate.value = todayIsoDate();
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
  if (activeFilter === FILTER_ALL) return tasks;
  return tasks.filter((task) => task.category.includes(activeFilter));
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
  els.filterLabel.textContent = `Showing: ${activeFilter}`;

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
        <div class="badge-row">${badges}</div>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
