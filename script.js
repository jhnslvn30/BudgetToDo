// =====================================
// STORAGE
// =====================================

function loadData(key) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? [] : JSON.parse(value);
  } catch (error) {
    return [];
  }
}

function loadArray(key) {
  const value = loadData(key);
  return Array.isArray(value) ? value : [];
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Could not save " + key + " to local storage.", error);
  }
}

function loadLimits() {
  try {
    const value = JSON.parse(localStorage.getItem("spendingLimits") || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch (error) {
    return {};
  }
}

let budgetEntries = loadArray("budget").map((entry) => ({
  ...entry,
  desc: typeof entry.desc === "string" ? entry.desc : "",
  amount: Number.isFinite(Number(entry.amount)) ? Number(entry.amount) : 0,
  type: entry.type === "income" ? "income" : "expense",
  category: typeof entry.category === "string" ? entry.category : "Other",
}));

let todoTasks = loadArray("tasks").map((task) => ({
  ...task,
  text: typeof task.text === "string" ? task.text : "",
  done: task.done === true,
  dueDate: typeof task.dueDate === "string" ? task.dueDate : "",
}));

// =====================================
// GLOBAL VARIABLES
// =====================================


let deletedEntries = loadArray("deletedBudget");
let spendingLimits = loadLimits();
let currentFilter = "all";
let selectedSummaryPeriod = "daily";
let entrySearchText = "";
let editingEntry = null;

// =====================================
// SHARED HELPERS
// =====================================

function getElement(id) {
  return document.getElementById(id);
}

function formatPeso(amount) {
  const value = Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;

  return (
    "₱" +
    safeValue.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function createEmptyRow(message) {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = message;
  return item;
}

function getTodayString() {
  return formatDateString(new Date());
}

function formatDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return year + "-" + month + "-" + day;
}

function makeDateFromString(value) {
  const parts = value.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return formatDateString(makeDateFromString(value)) === value;
}

// =====================================
// TABS
// =====================================

function showTab(tabName) {
  const tabNames = ["budget", "todo"];

  tabNames.forEach((name) => {
    const selected = name === tabName;
    getElement(name).hidden = !selected;
    getElement("tab-" + name).setAttribute(
      "aria-selected",
      String(selected),
    );
  });

  try {
    history.replaceState(null, "", "#" + tabName);
  } catch (error) {
    // The tab still works if the URL cannot be updated.
  }
}

// =====================================
// TASK DATES AND REMINDERS
// =====================================

function updateDateLimit() {
  const dateBox = getElement("dueDate");

  if (dateBox === null) {
    return;
  }

  dateBox.min = getTodayString();
}

function getDaysUntil(dateString) {
  const dueDate = makeDateFromString(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((dueDate - today) / (24 * 60 * 60 * 1000));
}

function formatDueDate(dateString) {
  return makeDateFromString(dateString).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDueInfo(task) {
  if (!isValidISODate(task.dueDate)) {
    return { text: "No due date", style: "" };
  }

  const formattedDate = formatDueDate(task.dueDate);

  if (task.done) {
    return { text: "Due " + formattedDate, style: "" };
  }

  const daysLeft = getDaysUntil(task.dueDate);

  if (daysLeft < 0) {
    const daysLate = -daysLeft;
    const dayWord = daysLate === 1 ? " day" : " days";

    return {
      text: "Due " + formattedDate + " · Overdue by " + daysLate + dayWord,
      style: "overdue",
    };
  }

  if (daysLeft === 0) {
    return { text: "Due today", style: "today" };
  }

  if (daysLeft === 1) {
    return { text: "Due tomorrow", style: "soon" };
  }

  if (daysLeft <= 3) {
    return { text: "Due in " + daysLeft + " days", style: "soon" };
  }

  return { text: "Due " + formattedDate, style: "" };
}

function sortTasksByDueDate() {
  todoTasks.sort((first, second) => {
    const firstDate = first.dueDate || "9999-12-31";
    const secondDate = second.dueDate || "9999-12-31";

    return firstDate.localeCompare(secondDate);
  });
}

function updateReminderBox() {
  const reminderBox = getElement("reminderBox");

  if (reminderBox === null) {
    return;
  }

  let overdueCount = 0;
  let todayCount = 0;

  todoTasks.forEach((task) => {
    const info = getDueInfo(task);
    if (info.style === "overdue") overdueCount++;
    if (info.style === "today") todayCount++;
  });

  if (overdueCount === 0 && todayCount === 0) {
    reminderBox.hidden = true;
    return;
  }

  const messages = [];

  if (overdueCount) {
    messages.push(
      overdueCount + (overdueCount === 1 ? " task overdue" : " tasks overdue"),
    );
  }

  if (todayCount) {
    messages.push(
      todayCount + (todayCount === 1 ? " task due today" : " tasks due today"),
    );
  }

  reminderBox.textContent = "⚠ Reminder: " + messages.join(" · ");
  reminderBox.className =
    overdueCount > 0 ? "reminder" : "reminder soon";
  reminderBox.hidden = false;
}

function drawTodo() {
  const list = getElement("todoList");
  list.textContent = "";

  const tasksToShow = todoTasks.filter((task) => {
    if (currentFilter === "done") return task.done;
    if (currentFilter === "active") return !task.done;
    return true;
  });

  if (tasksToShow.length === 0) {
    list.appendChild(
      createEmptyRow(
        todoTasks.length === 0
          ? "Nothing to do yet. Add a task above."
          : "No tasks in this view.",
      ),
    );
  }

  tasksToShow.forEach((task) => {
    const item = document.createElement("li");
    const info = getDueInfo(task);
    item.className = task.done ? "done" : info.style;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "Mark " + task.text + " as done");
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveData("tasks", todoTasks);
      drawTodo();
    });

    const label = document.createElement("div");
    label.className = "grow";
    label.textContent = task.text;

    const dueText = document.createElement("small");
    dueText.textContent = info.text;
    label.appendChild(dueText);

    const deleteButton = document.createElement("button");
    deleteButton.className = "del";
    deleteButton.textContent = "✕";
    deleteButton.setAttribute("aria-label", "Delete " + task.text);
    deleteButton.addEventListener("click", () => {
      if (!confirm("Delete this task?")) return;

      todoTasks = todoTasks.filter((savedTask) => savedTask !== task);
      saveData("tasks", todoTasks);
      drawTodo();
    });

    item.append(checkbox, label, deleteButton);
    list.appendChild(item);
  });

  const remaining = todoTasks.filter((task) => !task.done).length;
  getElement("todoCount").textContent =
    remaining + (remaining === 1 ? " task left" : " tasks left");

  updateReminderBox();
}

getElement("todoForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const taskText = getElement("task").value.trim();
  const dueDate = getElement("dueDate").value;
  const message = getElement("todoMsg");

  if (!taskText) {
    message.textContent = "Type a task first.";
    return;
  }

  if (!dueDate) {
    message.textContent = "Pick a due date for this task.";
    return;
  }

  if (!isValidISODate(dueDate) || dueDate < getTodayString()) {
    message.textContent = "Choose a valid date that is today or later.";
    return;
  }

  message.textContent = "";
  todoTasks.unshift({ text: taskText, done: false, dueDate });
  sortTasksByDueDate();
  saveData("tasks", todoTasks);
  drawTodo();

  getElement("task").value = "";
  getElement("dueDate").value = "";
  getElement("task").focus();
});

getElement("filters").addEventListener("click", (event) => {
  const selectedFilter = event.target.dataset.f;
  if (!selectedFilter) return;

  currentFilter = selectedFilter;

  Array.from(getElement("filters").children).forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.f === selectedFilter),
    );
  });

  drawTodo();
});

function clearDone() {
  todoTasks = todoTasks.filter((task) => !task.done);
  saveData("tasks", todoTasks);
  drawTodo();
}

// =====================================
// BUDGET DATES, TOTALS, AND FILTERS
// =====================================

function entryISO(entry) {
  const savedISO = entry.dateISO || entry.isoDate;

  if (typeof savedISO === "string" && isValidISODate(savedISO)) {
    return savedISO;
  }

  if (typeof entry.date === "string") {
    const parsed = new Date(entry.date);

    if (!Number.isNaN(parsed.getTime())) {
      return formatDateString(parsed);
    }
  }

  return "";
}

function totalsFor(entries) {
  return entries.reduce(
    (totals, entry) => {
      const amount = Number(entry.amount) || 0;

      if (entry.type === "income") totals.income += amount;
      if (entry.type === "expense") totals.expenses += amount;

      totals.balance = totals.income - totals.expenses;
      return totals;
    },
    { income: 0, expenses: 0, balance: 0 },
  );
}

function calculateTotals() {
  return totalsFor(budgetEntries);
}

function startOfWeek(date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysFromMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysFromMonday);
  return monday;
}

function inPeriod(entry, period) {
  if (period === "all") return true;

  const dateString = entryISO(entry);
  if (!dateString) return false;

  const entryDate = makeDateFromString(dateString);
  const today = new Date();
  const dateToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  if (period === "day") {
    return dateString === getTodayString();
  }

  if (period === "week") {
    const start = startOfWeek(dateToday);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return entryDate >= start && entryDate < end;
  }

  if (period === "month") {
    return (
      entryDate.getFullYear() === today.getFullYear() &&
      entryDate.getMonth() === today.getMonth()
    );
  }

  if (period === "year") {
    return entryDate.getFullYear() === today.getFullYear();
  }

  return false;
}

function periodEntries(period) {
  return budgetEntries.filter(
    (entry) => entry.type === "expense" && inPeriod(entry, period),
  );
}

function calculatePeriodExpenses(period) {
  const today = makeDateFromString(getTodayString());
  let start;
  let end;

  if (period === "daily") {
    start = today;
    end = new Date(today);
    end.setDate(end.getDate() + 1);
  } else if (period === "weekly") {
    start = startOfWeek(today);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (period === "monthly") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  } else {
    return 0;
  }

  const startString = formatDateString(start);
  const endString = formatDateString(end);

  return budgetEntries.reduce((total, entry) => {
    const date = entryISO(entry);

    if (
      entry.type === "expense" &&
      date >= startString &&
      date < endString
    ) {
      return total + (Number(entry.amount) || 0);
    }

    return total;
  }, 0);
}

function showSummaryPeriod(period) {
  selectedSummaryPeriod = period;
  getElement("expenseTotal").textContent = formatPeso(
    calculatePeriodExpenses(period),
  );

  document
    .querySelectorAll("[data-summary-period]")
    .forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.summaryPeriod === period),
      );
    });
}

getElement("expenseSummaryFilters").addEventListener("click", (event) => {
  const period = event.target.dataset.summaryPeriod;

  if (period) {
    showSummaryPeriod(period);
  }
});

// =====================================
// SPENDING LIMITS
// =====================================

function drawLimits() {
  const labels = {
    day: "Today",
    week: "This week",
    month: "This month",
    year: "This year",
  };
  const box = getElement("limitOverview");
  box.textContent = "";

  ["day", "week", "month", "year"].forEach((period) => {
    const limit = Math.max(0, Number(spendingLimits[period]) || 0);
    const spent = periodEntries(period).reduce(
      (sum, entry) => sum + (Number(entry.amount) || 0),
      0,
    );
    const remaining = limit - spent;
    const percentage =
      limit > 0 ? Math.min(100, Math.max(0, (spent / limit) * 100)) : 0;

    const card = document.createElement("div");
    card.className = "limit-item";

    const title = document.createElement("strong");
    title.textContent = labels[period];

    const detail = document.createElement("span");
    detail.textContent =
      limit > 0
        ? formatPeso(spent) +
          " of " +
          formatPeso(limit) +
          " · " +
          (remaining >= 0
            ? formatPeso(remaining) + " left"
            : formatPeso(-remaining) + " over")
        : formatPeso(spent) + " spent · No limit";

    const track = document.createElement("div");
    track.className = "limit-progress-track";

    const bar = document.createElement("div");
    bar.className =
      "limit-progress" +
      (remaining < 0 ? " danger" : percentage >= 80 ? " warning" : "");
    bar.style.width = percentage + "%";

    track.appendChild(bar);
    card.append(title, detail, track);
    box.appendChild(card);

    getElement("limit-" + period).value = limit || "";
  });
}

getElement("limitForm").addEventListener("submit", (event) => {
  event.preventDefault();

  ["day", "week", "month", "year"].forEach((period) => {
    const value = getElement("limit-" + period).value.trim();
    const number = value === "" ? 0 : Number(value);

    spendingLimits[period] =
      Number.isFinite(number) && number > 0 ? number : 0;
  });

  try {
    localStorage.setItem("spendingLimits", JSON.stringify(spendingLimits));
  } catch (error) {
    getElement("limitMsg").textContent =
      "Could not save spending limits in this browser.";
    return;
  }

  getElement("limitMsg").textContent = "Spending limits saved.";
  drawBudget();
});

function canAddExpense(amount, entryBeingEdited, targetDate) {
  const date = targetDate || getTodayString();

  for (const period of ["day", "week", "month", "year"]) {
    const limit = Number(spendingLimits[period]) || 0;
    if (!limit || !inPeriod({ dateISO: date }, period)) continue;

    const spent = periodEntries(period)
      .filter((entry) => entry !== entryBeingEdited)
      .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

    if (spent + amount > limit + 0.00001) {
      return period;
    }
  }

  return "";
}

// =====================================
// DELETED ENTRY HISTORY
// =====================================

function addToDeleted(entry) {
  deletedEntries.unshift({
    entry,
    deletedAt: new Date().toISOString(),
  });
}

function drawDeletedHistory() {
  const list = getElement("deletedList");
  list.textContent = "";

  getElement("deletedCount").textContent = String(deletedEntries.length);
  getElement("clearHistoryButton").hidden = deletedEntries.length === 0;

  if (deletedEntries.length === 0) {
    list.appendChild(createEmptyRow("No deleted entries."));
    return;
  }

  deletedEntries.forEach((record) => {
    const item = document.createElement("li");
    const info = document.createElement("div");
    info.className = "grow";
    info.textContent = record.entry.desc || "Untitled entry";

    const meta = document.createElement("small");
    const amount = formatPeso(record.entry.amount);
    const category = record.entry.category || "Uncategorized";
    const deletedDate = new Date(record.deletedAt).toLocaleString();
    meta.textContent =
      category + " · " + amount + " · Deleted " + deletedDate;
    info.appendChild(meta);

    const restoreButton = document.createElement("button");
    restoreButton.className = "small-action";
    restoreButton.textContent = "Restore";
    restoreButton.addEventListener("click", () => {
      budgetEntries.unshift(record.entry);
      deletedEntries = deletedEntries.filter((saved) => saved !== record);
      saveData("budget", budgetEntries);
      saveData("deletedBudget", deletedEntries);
      drawBudget();
    });

    const removeButton = document.createElement("button");
    removeButton.className = "del";
    removeButton.textContent = "✕";
    removeButton.setAttribute(
      "aria-label",
      "Permanently delete " + (record.entry.desc || "entry"),
    );
    removeButton.addEventListener("click", () => {
      if (!confirm("Permanently delete this history record?")) return;

      deletedEntries = deletedEntries.filter((saved) => saved !== record);
      saveData("deletedBudget", deletedEntries);
      drawDeletedHistory();
    });

    item.append(info, restoreButton, removeButton);
    list.appendChild(item);
  });
}

function clearDeletedHistory() {
  if (
    deletedEntries.length > 0 &&
    confirm("Permanently clear all deleted history?")
  ) {
    deletedEntries = [];
    saveData("deletedBudget", deletedEntries);
    drawDeletedHistory();
  }
}

// =====================================
// BUDGET DISPLAY AND ENTRY EDITING
// =====================================

function drawBudget() {
  const totals = calculateTotals();

  getElement("income").textContent = formatPeso(totals.income);
  getElement("expenses").textContent = formatPeso(totals.expenses);
  getElement("balance").textContent =
    (totals.balance < 0 ? "−" : "") + formatPeso(Math.abs(totals.balance));

  const period = getElement("expensePeriod").value;
  const query = entrySearchText.toLowerCase();
  const visibleEntries = budgetEntries.filter((entry) => {
    const description = entry.desc.toLowerCase();
    const category = (entry.category || "Other").toLowerCase();

    return (
      inPeriod(entry, period) &&
      (description.includes(query) || category.includes(query))
    );
  });

  const list = getElement("budgetList");
  list.textContent = "";

if (visibleEntries.length === 0) {
  list.appendChild(
    createEmptyRow(
      budgetEntries.length === 0
        ? "No entries yet. Add your first income or expense above."
        : "No matching entries.",
    ),
  );
}

  visibleEntries.forEach((entry) => {
    const item = document.createElement("li");
    const info = document.createElement("div");
    info.className = "grow";
    info.textContent = entry.desc;

    const meta = document.createElement("small");
    meta.textContent =
      (entry.date || entryISO(entry)) +
      " · " +
      (entry.category || "Other") +
      " · " +
      entry.type;
    info.appendChild(meta);

    const amount = document.createElement("span");
    amount.className = "amt " + (entry.type === "income" ? "in" : "out");
    amount.textContent =
      (entry.type === "income" ? "+" : "−") + formatPeso(entry.amount);

    const editButton = document.createElement("button");
    editButton.className = "small-action";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => beginEdit(entry));

    const deleteButton = document.createElement("button");
    deleteButton.className = "del";
    deleteButton.textContent = "✕";
    deleteButton.setAttribute("aria-label", "Delete " + entry.desc);
    deleteButton.addEventListener("click", () => {
      if (
        !confirm(
          "Move this entry to deleted history?\n\n" +
            entry.desc +
            " (" +
            formatPeso(entry.amount) +
            ")",
        )
      ) {
        return;
      }

      budgetEntries = budgetEntries.filter((saved) => saved !== entry);
      addToDeleted(entry);
      saveData("budget", budgetEntries);
      saveData("deletedBudget", deletedEntries);
      drawBudget();
    });

    item.append(info, amount, editButton, deleteButton);
    list.appendChild(item);
  });

  getElement("budgetCount").textContent =
    visibleEntries.length +
    (visibleEntries.length === 1 ? " entry shown" : " entries shown");

  showSummaryPeriod(selectedSummaryPeriod);
  drawLimits();
  drawDeletedHistory();
  drawExpenseChart();
  drawMonthlyReport();
}

function beginEdit(entry) {
  editingEntry = entry;
  getElement("desc").value = entry.desc;
  getElement("amount").value = entry.amount;
  getElement("type").value = entry.type;
  getElement("category").value = entry.category || "Other";
  getElement("budgetSubmit").textContent = "Save changes";
  getElement("cancelEdit").hidden = false;
  getElement("desc").focus();
}

function cancelEdit() {
  editingEntry = null;
  getElement("budgetForm").reset();
  getElement("budgetSubmit").textContent = "Add entry";
  getElement("cancelEdit").hidden = true;
  getElement("budgetMsg").textContent = "";
}

getElement("cancelEdit").addEventListener("click", cancelEdit);
getElement("expensePeriod").addEventListener("change", drawBudget);
getElement("entrySearch").addEventListener("input", (event) => {
  entrySearchText = event.target.value.trim();
  drawBudget();
});

getElement("budgetForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const description = getElement("desc").value.trim();
  const amount =
    Math.round(Number(getElement("amount").value) * 100) / 100;
  const type = getElement("type").value;
  const category = getElement("category").value;
  const message = getElement("budgetMsg");

  if (!description || !Number.isFinite(amount) || amount <= 0) {
    message.textContent =
      "Enter a description and an amount greater than 0.";
    return;
  }

  const entriesWithoutEdited = editingEntry
    ? budgetEntries.filter((entry) => entry !== editingEntry)
    : budgetEntries;
  const balanceWithoutEdited = totalsFor(entriesWithoutEdited).balance;

  if (type === "expense" && amount > balanceWithoutEdited) {
    message.textContent = "Not enough balance for this expense.";
    return;
  }

  if (type === "expense") {
    const targetDate = editingEntry
      ? entryISO(editingEntry) || getTodayString()
      : getTodayString();
    const exceeded = canAddExpense(amount, editingEntry, targetDate);

    if (exceeded) {
      message.textContent =
        "This entry exceeds your " + exceeded + " spending limit.";
      return;
    }
  }

  message.textContent = "";

  if (editingEntry) {
    Object.assign(editingEntry, { desc: description, amount, type, category });
    cancelEdit();
  } else {
    const now = new Date();

    budgetEntries.unshift({
      desc: description,
      amount,
      type,
      category,
      date: now.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      dateISO: getTodayString(),
    });

    getElement("budgetForm").reset();
  }

  saveData("budget", budgetEntries);
  drawBudget();
});

function clearBudget() {
  if (budgetEntries.length === 0) return;

if (
  confirm(
    "Move all " +
      budgetEntries.length +
      " entries to deleted history? You can restore them later.",
  )
) {
  budgetEntries.forEach(addToDeleted);
  budgetEntries = [];
  saveData("budget", budgetEntries);
  saveData("deletedBudget", deletedEntries);
  drawBudget();
}
}

// =====================================
// CHART AND MONTHLY REPORT
// =====================================

function drawExpenseChart() {
  const canvas = getElement("expenseChart");
  const context = canvas.getContext("2d");
  const month =
    getElement("chartMonth").value || getTodayString().slice(0, 7);
  const totalsByCategory = {};

  budgetEntries
    .filter(
      (entry) =>
        entry.type === "expense" && entryISO(entry).slice(0, 7) === month,
    )
    .forEach((entry) => {
      const category = entry.category || "Other";
      totalsByCategory[category] =
        (totalsByCategory[category] || 0) + Number(entry.amount || 0);
    });

  const pixelRatio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 300;
  const height = 240;

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  const items = Object.entries(totalsByCategory).sort(
    (first, second) => second[1] - first[1],
  );
  const legend = getElement("chartLegend");
  legend.textContent = "";

  if (items.length === 0) {
    context.fillStyle = getComputedStyle(document.body).color;
    context.font = "14px sans-serif";
    context.textAlign = "center";
    context.fillText("No expenses for this month", width / 2, 120);
    return;
  }

  const colors = [
    "#3767c7",
    "#e08a36",
    "#269b78",
    "#ad65c7",
    "#d65b62",
    "#5c9eb5",
    "#9b9b45",
    "#777777",
  ];
  const total = items.reduce((sum, item) => sum + item[1], 0);
  const centerX = width / 2;
  const centerY = 112;
  let angle = -Math.PI / 2;

  items.forEach(([name, value], index) => {
    const slice = (value / total) * Math.PI * 2;

    context.beginPath();
    context.arc(centerX, centerY, 82, angle, angle + slice);
    context.arc(centerX, centerY, 48, angle + slice, angle, true);
    context.closePath();
    context.fillStyle = colors[index % colors.length];
    context.fill();
    angle += slice;

    const label = document.createElement("span");
    label.textContent = name + ": " + formatPeso(value);
    label.style.borderLeft =
      "4px solid " + colors[index % colors.length];
    legend.appendChild(label);
  });

  context.fillStyle = getComputedStyle(document.body).color;
  context.font = "bold 13px sans-serif";
  context.textAlign = "center";
  context.fillText(formatPeso(total), centerX, centerY + 4);
}

function drawMonthlyReport() {
  const month =
    getElement("reportMonth").value || getTodayString().slice(0, 7);
  const entries = budgetEntries.filter(
    (entry) => entryISO(entry).slice(0, 7) === month,
  );
  const totals = totalsFor(entries);
  const container = getElement("monthlyReport");
  container.textContent = "";

  const heading = document.createElement("h3");
  heading.textContent = makeDateFromString(month + "-01").toLocaleDateString(
    "en-PH",
    { month: "long", year: "numeric" },
  );

  const table = document.createElement("table");
  table.className = "report-table";

  [
    ["Total income", totals.income],
    ["Total expenses", totals.expenses],
    ["Net balance", totals.balance],
  ].forEach(([label, value]) => {
    const row = document.createElement("tr");
    const headingCell = document.createElement("th");
    const valueCell = document.createElement("td");

    headingCell.textContent = label;
    valueCell.textContent = formatPeso(value);
    row.append(headingCell, valueCell);
    table.appendChild(row);
  });

  const categoryTitle = document.createElement("h4");
  categoryTitle.textContent = "Expenses by category";

  const categoryList = document.createElement("ul");
  const categoryTotals = {};

  entries
    .filter((entry) => entry.type === "expense")
    .forEach((entry) => {
      const category = entry.category || "Other";
      categoryTotals[category] =
        (categoryTotals[category] || 0) + Number(entry.amount || 0);
    });

  Object.entries(categoryTotals)
    .sort((first, second) => second[1] - first[1])
    .forEach(([category, amount]) => {
      const item = document.createElement("li");
      item.textContent = category + ": " + formatPeso(amount);
      categoryList.appendChild(item);
    });

  if (categoryList.children.length === 0) {
    categoryList.appendChild(createEmptyRow("No expenses for this month."));
  }

  container.append(heading, table, categoryTitle, categoryList);
}

getElement("chartMonth").addEventListener("change", drawExpenseChart);
getElement("reportMonth").addEventListener("change", drawMonthlyReport);
getElement("printReport").addEventListener("click", () => window.print());

// =====================================
// STARTUP
// =====================================

getElement("clearHistoryButton").addEventListener(
  "click",
  clearDeletedHistory,
);

sortTasksByDueDate();
updateDateLimit();

const currentMonth = getTodayString().slice(0, 7);
getElement("chartMonth").value = currentMonth;
getElement("reportMonth").value = currentMonth;

drawBudget();
drawTodo();

showTab(location.hash === "#todo" ? "todo" : "budget");

window.addEventListener("hashchange", () => {
  showTab(location.hash === "#todo" ? "todo" : "budget");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    updateDateLimit();
    drawTodo();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch((error) => {
    console.error("Service worker registration failed.", error);
  });
}
