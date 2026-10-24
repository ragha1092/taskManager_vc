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
const DAY_MS = 24 * 60 * 60 * 1000;
const FOCUS_DEFAULT_MINUTES = 25;
// Matches r="90" on the progress circle in index.html
const FOCUS_RING_LENGTH = 2 * Math.PI * 90;
const PAGE_TITLE = document.title;
// Quick add: "!high", "!med", "!l" and so on
const PRIORITY_ALIASES = { high: "High", h: "High", medium: "Medium", med: "Medium", m: "Medium", low: "Low", l: "Low" };
// Index matches Date.getDay(), so Sunday is 0
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAY_WORDS = "monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thu|friday|fri|saturday|sat|sunday|sun";
const MONTH_WORDS = "january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec";

// --- Elements ---

const els = {
  openAddBtn: document.getElementById("open-add-task"),
  loadExamplesBtn: document.getElementById("load-examples"),
  quickAddForm: document.getElementById("quick-add-form"),
  quickAddInput: document.getElementById("quick-add-input"),
  quickAddPreview: document.getElementById("quick-add-preview"),
  cancelAddBtn: document.getElementById("cancel-add-task"),
  saveBtn: document.getElementById("save-task"),
  clearDateBtn: document.getElementById("clear-date-filter"),
  themeBtn: document.getElementById("theme-toggle"),
  editCategoriesBtn: document.getElementById("edit-categories"),
  confirmOkBtn: document.getElementById("confirm-ok"),
  confirmCancelBtn: document.getElementById("confirm-cancel"),
  heroWeekday: document.getElementById("hero-weekday"),
  heroDate: document.getElementById("hero-date"),
  heroSummary: document.getElementById("hero-summary"),
  focusModal: document.getElementById("focus-modal"),
  focusTitle: document.getElementById("focus-title"),
  focusDurations: document.getElementById("focus-durations"),
  focusRing: document.getElementById("focus-ring-progress"),
  focusTime: document.getElementById("focus-time"),
  focusStatus: document.getElementById("focus-status"),
  focusToggleBtn: document.getElementById("focus-toggle"),
  focusStopBtn: document.getElementById("focus-stop"),
  focusMarkDoneBtn: document.getElementById("focus-mark-done"),
  modal: document.getElementById("task-modal"),
  modalTitle: document.getElementById("modal-title"),
  form: document.getElementById("task-form"),
  formError: document.getElementById("form-error"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
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
// Task to highlight on the next render (a task that was just added)
let highlightTaskId = null;
// phase is "ready", "running", "paused" or "done"; endsAt is only set while running
const focus = {
  taskId: null,
  phase: "ready",
  durationMs: FOCUS_DEFAULT_MINUTES * 60 * 1000,
  remainingMs: FOCUS_DEFAULT_MINUTES * 60 * 1000,
  savedMs: 0,
  endsAt: null,
  intervalId: null,
};
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

init();

// --- Setup ---

function init() {
  applyTheme(loadTheme());
  renderCategoryPills();
  renderQuickAddPreview();
  bindEvents();
  render();
}

function bindEvents() {
  els.openAddBtn.addEventListener("click", () => openModal());
  els.loadExamplesBtn.addEventListener("click", loadExampleTasks);
  els.quickAddForm.addEventListener("submit", handleQuickAddSubmit);
  els.quickAddInput.addEventListener("input", renderQuickAddPreview);
  els.quickAddInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearQuickAdd();
  });
  els.cancelAddBtn.addEventListener("click", closeModal);
  els.clearDateBtn.addEventListener("click", clearDateFilter);
  els.themeBtn.addEventListener("click", toggleTheme);
  els.editCategoriesBtn.addEventListener("click", toggleCategoryEditing);
  els.confirmCancelBtn.addEventListener("click", () => els.confirmModal.close());
  els.focusDurations.addEventListener("click", handleFocusDurationClick);
  els.focusToggleBtn.addEventListener("click", toggleFocus);
  els.focusStopBtn.addEventListener("click", () => els.focusModal.close());
  els.focusMarkDoneBtn.addEventListener("click", markFocusTaskDone);
  els.focusModal.addEventListener("close", handleFocusClose);
  els.modal.addEventListener("cancel", closeModal);
  els.form.addEventListener("submit", handleSubmit);
  els.pills.addEventListener("click", handlePillClick);
  els.filters.addEventListener("click", handleFilterClick);
  els.categoryForm.addEventListener("submit", handleCategorySubmit);
  els.board.addEventListener("click", handleTaskListClick);
  els.board.addEventListener("change", handleTaskListChange);
  els.board.addEventListener("animationend", () => els.board.classList.remove("is-switching"));
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
    // First visit: start with example tasks so the app isn't empty
    if (raw === null) {
      const examples = exampleTasks();
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(examples));
      return examples;
    }
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
    focusSeconds: Number.isFinite(task.focusSeconds) ? task.focusSeconds : 0,
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

// --- Example tasks ---

function exampleTasks() {
  const today = todayIsoDate();
  const examples = [
    { title: "Group project meeting", description: "Plan the final report and split the sections", categories: ["Academics"], priority: "Medium", days: 0, startTime: "13:00", endTime: "14:30" },
    { title: "Gym – leg day", categories: ["Personal"], priority: "Low", days: 0, startTime: "17:00", endTime: "18:00" },
    { title: "Read chapter 4", description: "Intro to machine learning", categories: ["Academics"], priority: "Low", days: 0, completed: true, focusMinutes: 25 },
    { title: "Part-time shift", categories: ["Work"], priority: "Medium", days: 1, startTime: "16:00", endTime: "20:00" },
    { title: "Study for algorithms exam", description: "Chapters 5–8 and two old exams", categories: ["Academics"], priority: "High", days: 3, startTime: "10:00", endTime: "14:00", focusMinutes: 50 },
    { title: "Family dinner", description: "Bring dessert", categories: ["Family"], priority: "Medium", days: 5, startTime: "18:00" },
    { title: "Movie night with friends", categories: ["Fun"], priority: "Low", days: 10, startTime: "20:00" },
    { title: "Submit lab report", description: "Upload the PDF to Canvas", categories: ["Academics"], priority: "High", days: -1 },
  ];

  return examples.map(({ days, completed = false, focusMinutes = 0, ...fields }) => ({
    ...createTask({
      description: "",
      startTime: "",
      endTime: "",
      ...fields,
      dueDate: addDaysToIsoDate(today, days),
    }),
    completed,
    focusSeconds: focusMinutes * 60,
  }));
}

function loadExampleTasks() {
  tasks = exampleTasks();
  saveTasks();
  render();
}

// --- Dates ---

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function addDaysToIsoDate(isoDate, days) {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function daysFromToday(isoDate) {
  return Math.round((parseIsoDate(isoDate) - parseIsoDate(todayIsoDate())) / DAY_MS);
}

// Example: "Fri 24 Oct"
function formatDate(isoDate) {
  return parseIsoDate(isoDate).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTimeRange(startTime, endTime) {
  if (startTime && endTime) return `${startTime}–${endTime}`;
  if (startTime) return startTime;
  if (endTime) return `Until ${endTime}`;
  return "";
}

function dueHint(task) {
  if (task.completed) return "";
  const days = daysFromToday(task.dueDate);
  if (days < 0) return `${pluralize(-days, "day")} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `In ${days} days`;
  return "";
}

// --- Quick add ---

// Turns "Essay due Friday 14:00 #Academics !high" into task fields
function parseQuickAdd(text) {
  const result = {
    title: "",
    dueDate: "",
    startTime: "",
    endTime: "",
    categories: [],
    priority: "",
    unknownTags: [],
  };
  // Padding with spaces lets every pattern start with \s and end with (?=\s)
  let rest = ` ${text} `;

  rest = rest.replace(/\s#([\p{L}\p{N}_-]+)/gu, (match, tag) => {
    const category = findCategoryByTag(tag);
    if (category) result.categories.push(category.name);
    else result.unknownTags.push(tag);
    return " ";
  });
  result.categories = uniqueCategories(result.categories);

  rest = rest.replace(/\s!(high|h|medium|med|m|low|l)(?=\s)/i, (match, level) => {
    result.priority = PRIORITY_ALIASES[level.toLowerCase()];
    return " ";
  });

  rest = extractDate(rest, result);
  rest = extractTime(rest, result);

  result.title = capitalize(
    rest
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\s+(due|on|by|at|from)$/i, "")
      .replace(/^[\s,.;:–-]+|[\s,.;:–-]+$/g, "")
  );
  return result;
}

// Matches "#acad" to "Academics" and "#gym-time" to "Gym time"
function findCategoryByTag(tag) {
  const simplify = (value) => value.toLowerCase().replace(/[\s_-]/g, "");
  const key = simplify(tag);
  const exact = categories.find((category) => simplify(category.name) === key);
  if (exact) return exact;
  const prefixMatches = categories.filter((category) => simplify(category.name).startsWith(key));
  return prefixMatches.length === 1 ? prefixMatches[0] : null;
}

function extractDate(rest, result) {
  const today = todayIsoDate();
  const prefix = String.raw`\s(?:(?:due|on|by)\s+)?`;
  const rules = [
    [String.raw`(today|tonight)`, () => today],
    [String.raw`(tomorrow|tmrw|tmr)`, () => addDaysToIsoDate(today, 1)],
    [String.raw`in\s+(\d{1,3})\s+(days?|weeks?)`, (m) => addDaysToIsoDate(today, Number(m[1]) * (m[2].startsWith("week") ? 7 : 1))],
    [String.raw`next\s+week`, () => addDaysToIsoDate(today, 7)],
    [String.raw`(next\s+)?(${WEEKDAY_WORDS})`, (m) => nextWeekday(m[2], Boolean(m[1]))],
    [String.raw`(\d{4})-(\d{2})-(\d{2})`, (m) => makeIsoDate(Number(m[1]), Number(m[2]) - 1, Number(m[3]))],
    [String.raw`(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?`, (m) => dateFromParts(m[1], m[2] - 1, m[3])],
    [String.raw`(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_WORDS})\.?`, (m) => dateFromParts(m[1], monthIndex(m[2]))],
    [String.raw`(${MONTH_WORDS})\.?\s+(\d{1,2})(?:st|nd|rd|th)?`, (m) => dateFromParts(m[2], monthIndex(m[1]))],
  ];

  for (const [pattern, resolve] of rules) {
    const regex = new RegExp(`${prefix}${pattern}(?=\\s)`, "i");
    const match = rest.match(regex);
    const date = match && resolve(match);
    if (date) {
      result.dueDate = date;
      return rest.replace(match[0], " ");
    }
  }
  return rest;
}

// Accepts "14:00", "2pm", "2:30pm", "at 9", "14:00-16:00", "2-4pm" and "from 10 to 12"
function extractTime(rest, result) {
  const clock = String.raw`(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`;
  const range = new RegExp(String.raw`\s(?:(at|from)\s+)?${clock}\s*(?:-|–|to)\s*${clock}(?=\s)`, "gi");
  const single = new RegExp(String.raw`\s(?:(at|from|kl\.?)\s+)?${clock}(?=\s)`, "gi");

  rest = rest.replace(range, (match, prefix, h1, m1, ap1, h2, m2, ap2) => {
    if (result.startTime || !(prefix || m1 || ap1 || m2 || ap2)) return match;
    const start = toClock(h1, m1, ap1 || ap2);
    const end = toClock(h2, m2, ap2);
    if (!start || !end) return match;
    result.startTime = start;
    result.endTime = end > start ? end : "";
    return " ";
  });
  if (result.startTime) return rest;

  return rest.replace(single, (match, prefix, hours, minutes, ampm) => {
    if (result.startTime || !(prefix || minutes || ampm)) return match;
    const time = toClock(hours, minutes, ampm);
    if (!time) return match;
    result.startTime = time;
    return " ";
  });
}

function toClock(hours, minutes = "0", ampm = "") {
  let hour = Number(hours);
  const minute = Number(minutes || 0);
  const suffix = (ampm || "").toLowerCase();
  if (suffix && (hour < 1 || hour > 12)) return null;
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// "friday" is the next Friday (today counts); "next friday" never means today
function nextWeekday(word, skipToday) {
  const target = WEEKDAY_KEYS.indexOf(word.slice(0, 3).toLowerCase());
  let days = (target - new Date().getDay() + 7) % 7;
  if (skipToday && days === 0) days = 7;
  return addDaysToIsoDate(todayIsoDate(), days);
}

function monthIndex(word) {
  return MONTH_KEYS.indexOf(word.slice(0, 3).toLowerCase());
}

// Without a year, a date that has already passed means next year
function dateFromParts(day, month, year) {
  if (year) {
    const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year);
    return makeIsoDate(fullYear, month, Number(day));
  }
  const thisYear = new Date().getFullYear();
  const date = makeIsoDate(thisYear, month, Number(day));
  if (date && date < todayIsoDate()) return makeIsoDate(thisYear + 1, month, Number(day));
  return date;
}

// Returns null for impossible dates like 31 February
function makeIsoDate(year, month, day) {
  const date = new Date(year, month, day);
  const isReal = date.getFullYear() === year && date.getMonth() === month && date.getDate() === day;
  return isReal ? toIsoDate(date) : null;
}

function handleQuickAddSubmit(event) {
  event.preventDefault();
  const text = els.quickAddInput.value.trim();
  if (!text) return;

  const parsed = parseQuickAdd(text);
  const fields = {
    title: parsed.title,
    description: "",
    categories: parsed.categories,
    priority: parsed.priority || DEFAULT_PRIORITY,
    dueDate: parsed.dueDate || todayIsoDate(),
    startTime: parsed.startTime,
    endTime: parsed.endTime,
  };
  clearQuickAdd();

  // Missing pieces: open the full form with everything filled in
  if (!fields.title || fields.categories.length === 0) {
    openModal(null, fields);
    showFormError(fields.title ? "Pick a category for this task." : "Add a title for this task.");
    return;
  }

  const task = createTask(fields);
  tasks.push(task);
  saveTasks();
  revealTask(task.id);
}

function clearQuickAdd() {
  els.quickAddInput.value = "";
  renderQuickAddPreview();
}

function renderQuickAddPreview() {
  const text = els.quickAddInput.value.trim();
  if (!text) {
    els.quickAddPreview.innerHTML =
      '<span class="quick-add-hint">Type a sentence. Use <kbd>#category</kbd>, <kbd>!high</kbd>, a day like <kbd>friday</kbd> and a time like <kbd>14:00</kbd>.</span>';
    return;
  }

  const parsed = parseQuickAdd(text);
  const chips = [
    `<span class="preview-title">${escapeHtml(parsed.title || "Add a title")}</span>`,
    `<span class="badge">${escapeHtml(parsed.dueDate ? formatDate(parsed.dueDate) : "Today")}</span>`,
  ];
  const timeRange = formatTimeRange(parsed.startTime, parsed.endTime);
  if (timeRange) chips.push(`<span class="badge">${escapeHtml(timeRange)}</span>`);
  if (parsed.categories.length > 0) {
    chips.push(...parsed.categories.map(categoryBadgeHtml));
  } else {
    chips.push(`<span class="badge badge-missing">No category yet</span>`);
  }
  if (parsed.priority) {
    chips.push(`<span class="badge ${priorityBadgeClass(parsed.priority)}">${parsed.priority} priority</span>`);
  }
  chips.push(
    ...parsed.unknownTags.map(
      (tag) => `<span class="badge badge-missing">#${escapeHtml(tag)} isn't a category</span>`
    )
  );
  els.quickAddPreview.innerHTML = chips.join("");
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

async function deleteCategory(name) {
  if (categories.length === 1) {
    showCategoryError("Keep at least one category.");
    return;
  }

  const usedBy = tasks.filter((task) => task.categories.includes(name)).length;
  const confirmed = await confirmAction({
    title: `Delete "${name}"?`,
    message:
      usedBy > 0
        ? `It will be removed from ${pluralize(usedBy, "task")}. The tasks themselves stay.`
        : "No tasks use this category.",
    confirmLabel: "Delete category",
  });
  if (!confirmed) return;

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
    focusSeconds: 0,
    createdAt: new Date().toISOString(),
  };
}

function findTask(id) {
  return tasks.find((task) => task.id === id);
}

function isOverdue(task) {
  return !task.completed && daysFromToday(task.dueDate) < 0;
}

// Clears filters that would hide the task, then highlights and scrolls to it
function revealTask(id) {
  const task = findTask(id);
  if (task && !getVisibleTasks().includes(task)) {
    activeFilter = FILTER_ALL;
    activeDate = null;
  }
  highlightTaskId = id;
  render();
  highlightTaskId = null;
  document.querySelector(`.task-card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

// Sorts by due date, then start time; tasks without a time come last that day
function compareTasks(a, b) {
  const aKey = a.dueDate + (a.startTime || "99");
  const bKey = b.dueDate + (b.startTime || "99");
  return aKey.localeCompare(bKey);
}

function toggleComplete(id, completed) {
  const task = findTask(id);
  if (!task) return;
  task.completed = completed;
  saveTasks();
  render();
}

async function deleteTask(id) {
  const target = findTask(id);
  if (!target) return;

  const confirmed = await confirmAction({
    title: "Delete task?",
    message: `"${target.title}" will be removed for good.`,
    confirmLabel: "Delete task",
  });
  if (!confirmed) return;

  tasks = tasks.filter((task) => task.id !== id);
  saveTasks();
  render();
}

// --- Modal and form ---

// draft fills a new task form, for example from quick add
function openModal(task, draft = {}) {
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
    els.form.title.value = draft.title || "";
    els.form.dueDate.value = draft.dueDate || todayIsoDate();
    els.form.startTime.value = draft.startTime || "";
    els.form.endTime.value = draft.endTime || "";
    els.form.priority.value = draft.priority || DEFAULT_PRIORITY;
    selectedCategories = draft.categories ? [...draft.categories] : [];
  }

  updatePillSelection();
  els.modal.showModal();
  els.form.title.focus();
}

function closeModal() {
  editingTaskId = null;
  els.modal.close();
}

// Shows the styled confirm dialog and resolves to true when the user confirms
function confirmAction({ title, message, confirmLabel }) {
  els.confirmTitle.textContent = title;
  els.confirmMessage.textContent = message;
  els.confirmOkBtn.textContent = confirmLabel;
  els.confirmModal.returnValue = "";
  els.confirmModal.showModal();

  return new Promise((resolve) => {
    els.confirmModal.addEventListener(
      "close",
      () => resolve(els.confirmModal.returnValue === "confirm"),
      { once: true }
    );
  });
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
    saveTasks();
    closeModal();
    render();
    return;
  }

  const task = createTask(fields);
  tasks.push(task);
  saveTasks();
  closeModal();
  revealTask(task.id);
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
  if (!button || button.dataset.filter === activeFilter) return;
  activeFilter = button.dataset.filter;
  render();
  animateBoard();
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
    return;
  }

  const focusBtn = event.target.closest("[data-focus]");
  if (focusBtn) openFocus(focusBtn.dataset.focus);
}

function getVisibleTasks() {
  return tasks.filter(
    (task) =>
      (activeFilter === FILTER_ALL || task.categories.includes(activeFilter)) &&
      (!activeDate || task.dueDate === activeDate)
  );
}

function getTaskSection(task) {
  const days = daysFromToday(task.dueDate);

  if (days < 0) return task.completed ? "completed" : "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "upcoming";
}

// Fades the task lists in after a filter change
function animateBoard() {
  els.board.classList.remove("is-switching");
  // Reading offsetWidth restarts the CSS animation
  void els.board.offsetWidth;
  els.board.classList.add("is-switching");
}

// --- Rendering ---

function render() {
  renderHero();
  renderFilters();
  renderDashboard();
  renderCalendar();
  renderTaskSections();
}

function renderHero() {
  const now = new Date();
  els.heroWeekday.textContent = now.toLocaleDateString("en-GB", { weekday: "long" });
  els.heroDate.textContent = now.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  const openTasks = tasks.filter((task) => !task.completed);
  const dueToday = openTasks.filter((task) => getTaskSection(task) === "today").length;
  const dueThisWeek = openTasks.filter((task) => getTaskSection(task) === "week").length;
  els.heroSummary.textContent = `${pluralize(dueToday, "task")} today · ${dueThisWeek} more this week`;
  els.loadExamplesBtn.hidden = tasks.length > 0;
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
  const completed = tasks.filter((task) => task.completed).length;
  const dueToday = tasks.filter((task) => !task.completed && getTaskSection(task) === "today").length;
  const overdue = tasks.filter(isOverdue).length;

  els.statTotal.textContent = String(tasks.length);
  els.statCompleted.textContent = String(completed);
  els.statDueToday.textContent = String(dueToday);
  els.statOverdue.textContent = String(overdue);
}

function renderTaskSections() {
  const visible = getVisibleTasks().sort(compareTasks);
  els.filterLabel.textContent = activeDate
    ? `Showing: ${activeFilter} · due ${formatDate(activeDate)}`
    : `Showing: ${activeFilter}`;

  const grouped = {
    today: [],
    week: [],
    upcoming: [],
    overdue: [],
    completed: [],
  };

  visible.forEach((task) => {
    grouped[getTaskSection(task)].push(task);
  });

  els.board.querySelectorAll(".task-section").forEach((section) => {
    const sectionTasks = grouped[section.dataset.section] || [];
    section.querySelector(".section-count").textContent = sectionTasks.length || "";
    section.querySelector(".empty-state").hidden = sectionTasks.length > 0;
    section.querySelector(".task-list").innerHTML = sectionTasks.map(taskCardHtml).join("");
  });
}

function taskCardHtml(task) {
  const description = task.description
    ? `<p class="task-description">${escapeHtml(task.description)}</p>`
    : "";
  const categoryBadges = task.categories.map(categoryBadgeHtml).join("");
  const priorityBadge = `<span class="badge ${priorityBadgeClass(task.priority)}">${escapeHtml(task.priority)} priority</span>`;

  return `
    <li class="task-card ${task.completed ? "completed" : ""} ${task.id === highlightTaskId ? "is-new" : ""}" data-id="${escapeHtml(task.id)}">
      <input
        type="checkbox"
        data-complete="${escapeHtml(task.id)}"
        ${task.completed ? "checked" : ""}
        aria-label="Mark ${escapeHtml(task.title)} as completed"
      />
      <div class="task-body">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        ${description}
        <div class="badge-row">${categoryBadges}${priorityBadge}</div>
        <p class="task-meta">${dueTextHtml(task)}</p>
      </div>
      <div class="task-actions">
        ${task.completed ? "" : `<button type="button" class="focus-start" data-focus="${escapeHtml(task.id)}">Focus</button>`}
        <button type="button" data-edit="${escapeHtml(task.id)}">Edit</button>
        <button type="button" data-delete="${escapeHtml(task.id)}">Delete</button>
      </div>
    </li>
  `;
}

// Example: "Fri 24 Oct · 10:00–12:00 · Due tomorrow"
function dueTextHtml(task) {
  const parts = [formatDate(task.dueDate), formatTimeRange(task.startTime, task.endTime)]
    .filter(Boolean)
    .map(escapeHtml);
  const hint = dueHint(task);
  if (hint) {
    parts.push(`<span class="due-hint ${isOverdue(task) ? "overdue" : ""}">${escapeHtml(hint)}</span>`);
  }
  if (task.focusSeconds >= 60) {
    parts.push(`<span class="focus-total">${formatDuration(task.focusSeconds)} focused</span>`);
  }
  return parts.join(" · ");
}

function categoryBadgeHtml(name) {
  const color = findCategory(name)?.color ?? 1;
  return `<span class="badge badge-category" style="--dot: var(--cat-${color})">${escapeHtml(name)}</span>`;
}

function priorityBadgeClass(priority) {
  return `badge-priority-${priority.toLowerCase()}`;
}

// --- Focus timer ---

function openFocus(id) {
  const task = findTask(id);
  if (!task) return;

  focus.taskId = id;
  focus.savedMs = 0;
  setFocusDuration(FOCUS_DEFAULT_MINUTES);
  els.focusTitle.textContent = task.title;
  renderFocus();
  els.focusModal.showModal();
  els.focusToggleBtn.focus();
}

function setFocusDuration(minutes) {
  focus.phase = "ready";
  focus.durationMs = minutes * 60 * 1000;
  focus.remainingMs = focus.durationMs;
  focus.endsAt = null;
}

function handleFocusDurationClick(event) {
  const button = event.target.closest("[data-minutes]");
  if (!button || focus.phase !== "ready") return;
  setFocusDuration(Number(button.dataset.minutes));
  renderFocus();
}

function toggleFocus() {
  if (focus.phase === "running") {
    focus.remainingMs = Math.max(0, focus.endsAt - Date.now());
    focus.endsAt = null;
    focus.phase = "paused";
    clearInterval(focus.intervalId);
  } else if (focus.phase === "ready" || focus.phase === "paused") {
    // Counting down to a fixed end time keeps the timer right even in a background tab
    focus.endsAt = Date.now() + focus.remainingMs;
    focus.phase = "running";
    focus.intervalId = setInterval(tickFocus, 250);
  }
  renderFocus();
}

function tickFocus() {
  focus.remainingMs = Math.max(0, focus.endsAt - Date.now());
  if (focus.remainingMs === 0) {
    completeFocus();
    return;
  }
  renderFocus();
}

function completeFocus() {
  clearInterval(focus.intervalId);
  focus.endsAt = null;
  focus.phase = "done";
  saveFocusTime();
  playChime();
  renderFocus();
}

// Adds only the time not saved yet, so calling it twice never counts time twice
function saveFocusTime() {
  const task = findTask(focus.taskId);
  const elapsedMs = focus.durationMs - focus.remainingMs;
  const newMs = elapsedMs - focus.savedMs;
  if (!task || newMs < 1000) return;

  task.focusSeconds += Math.round(newMs / 1000);
  focus.savedMs = elapsedMs;
  saveTasks();
}

// Closing the window (Stop, Close or Escape) stops the timer and keeps the time spent
function handleFocusClose() {
  if (focus.phase === "running") {
    focus.remainingMs = Math.max(0, focus.endsAt - Date.now());
  }
  clearInterval(focus.intervalId);
  saveFocusTime();
  focus.phase = "ready";
  focus.endsAt = null;
  document.title = PAGE_TITLE;
  render();
}

function markFocusTaskDone() {
  const id = focus.taskId;
  els.focusModal.close();
  toggleComplete(id, true);
}

function renderFocus() {
  const task = findTask(focus.taskId);
  const time = formatCountdown(focus.remainingMs);
  const elapsedShare = 1 - focus.remainingMs / focus.durationMs;
  const isActive = focus.phase === "running" || focus.phase === "paused";

  els.focusTime.textContent = time;
  // The ring empties as time runs out and fills up again when the session is done
  const ringOffset = focus.phase === "done" ? 0 : FOCUS_RING_LENGTH * elapsedShare;
  els.focusRing.style.strokeDashoffset = String(ringOffset);
  els.focusModal.classList.toggle("is-running", focus.phase === "running");

  els.focusDurations.hidden = focus.phase !== "ready";
  els.focusDurations.querySelectorAll("[data-minutes]").forEach((button) => {
    const pressed = Number(button.dataset.minutes) * 60 * 1000 === focus.durationMs;
    button.setAttribute("aria-pressed", String(pressed));
  });

  els.focusToggleBtn.hidden = focus.phase === "done";
  els.focusToggleBtn.textContent = { ready: "Start", running: "Pause", paused: "Resume" }[focus.phase] || "";
  els.focusMarkDoneBtn.hidden = focus.phase !== "done";
  els.focusStopBtn.textContent = { ready: "Cancel", done: "Close" }[focus.phase] || "Stop";

  const total = (task?.focusSeconds || 0) + Math.round((focus.durationMs - focus.remainingMs - focus.savedMs) / 1000);
  els.focusStatus.textContent = {
    ready: total >= 60 ? `${formatDuration(total)} focused on this task so far.` : "Pick a length and press Start.",
    running: "Stay with it. Stopping keeps the time you've done.",
    paused: "Paused.",
    done: `Session complete! ${formatDuration(focus.durationMs / 1000)} added.`,
  }[focus.phase];

  document.title = isActive ? `${time} · ${task?.title || "Focus"}` : PAGE_TITLE;
}

// Example: 1500000 ms gives "25:00"
function formatCountdown(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Example: 4800 seconds gives "1 h 20 min"
function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}

// Short soft tone when a session ends
function playChime() {
  try {
    const audio = new AudioContext();
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    tone.frequency.value = 880;
    volume.gain.setValueAtTime(0.15, audio.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 1.2);
    tone.connect(volume).connect(audio.destination);
    tone.start();
    tone.stop(audio.currentTime + 1.2);
  } catch {
    // Sound is optional; some browsers block it
  }
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
  animateBoard();
}

function clearDateFilter() {
  activeDate = null;
  render();
  animateBoard();
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
  const label = `${day} ${monthLabel}, ${pluralize(count, "task")}${isToday ? ", today" : ""}`;

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

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Example: pluralize(2, "task") gives "2 tasks"
function pluralize(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
