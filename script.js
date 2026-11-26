// =====================================
// STORAGE FUNCTIONS
// =====================================

function loadData(storageKey) {
  try {
    const savedData = localStorage.getItem(storageKey);

    if (savedData === null) {
      return [];
    }

    return JSON.parse(savedData);
  } catch (error) {
    return [];
  }
}

function saveData(storageKey, dataToSave) {
  try {
    const jsonData = JSON.stringify(dataToSave);
    localStorage.setItem(storageKey, jsonData);
  } catch (error) {
    // Ignore storage errors
  }
}

// =====================================
// GLOBAL VARIABLES
// =====================================

let budgetEntries = loadData("budget");
let todoTasks = loadData("tasks");
let currentFilter = "all";

// =====================================
// HELPER FUNCTIONS
// =====================================

function getElement(elementId) {
  return document.getElementById(elementId);
}

function formatPeso(amount) {
  const formattedNumber = amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return "₱" + formattedNumber;
}

function createEmptyRow(messageText) {
  const listItem = document.createElement("li");

  listItem.className = "empty";
  listItem.textContent = messageText;

  return listItem;
}

// =====================================
// DATE HELPER FUNCTIONS (new)
// A date from the date box looks like "2026-11-20"
// (year-month-day). These helpers work with that text.
// =====================================

// Today's date as text, like "2026-11-20".
function getTodayString() {
  const now = new Date();

  const year = now.getFullYear();
  let month = now.getMonth() + 1; // months start at 0, so add 1
  let day = now.getDate();

  // Add a zero in front of single digits: 5 becomes "05"
  if (month < 10) {
    month = "0" + month;
  }

  if (day < 10) {
    day = "0" + day;
  }

  return year + "-" + month + "-" + day;
}

// Turn "2026-11-20" into a real date at midnight, local time.
function makeDateFromString(dateString) {
  const parts = dateString.split("-");

  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1; // months start at 0
  const day = Number(parts[2]);

  return new Date(year, month, day);
}

// Show a date nicely, like "Nov 20, 2026".
function formatDueDate(dateString) {
  return makeDateFromString(dateString).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// How many days from today until the due date?
//   negative = already late, 0 = today, 1 = tomorrow, and so on
function getDaysUntil(dateString) {
  const dueDate = makeDateFromString(dateString);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((dueDate - today) / millisecondsPerDay);
}

// Work out the reminder text and style for one task.
// style is "overdue", "today", "soon" or "" (nothing special).
function getDueInfo(task) {
  // Older tasks saved before this feature have no date.
  if (!task.dueDate) {
    return { text: "No due date", style: "" };
  }

  const formattedDate = formatDueDate(task.dueDate);

  // Finished tasks need no reminder.
  if (task.done === true) {
    return { text: "Due " + formattedDate, style: "" };
  }

  const daysLeft = getDaysUntil(task.dueDate);

  if (daysLeft < 0) {
    const daysLate = -daysLeft;

    let dayWord = " days";
    if (daysLate === 1) {
      dayWord = " day";
    }

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

// Put the tasks in order: earliest due date first.
// Tasks with no date go to the end.
function sortTasksByDueDate() {
  todoTasks.sort(function (firstTask, secondTask) {
    const firstDate = firstTask.dueDate || "9999-12-31";
    const secondDate = secondTask.dueDate || "9999-12-31";

    if (firstDate < secondDate) {
      return -1;
    }

    if (firstDate > secondDate) {
      return 1;
    }

    return 0;
  });
}

// The date box should not allow dates before today.
function updateDateLimit() {
  const dateBox = getElement("dueDate");

  if (dateBox !== null) {
    dateBox.min = getTodayString();
  }
}

// =====================================
// TAB FUNCTIONS
// =====================================

function showTab(tabName) {
  const tabNames = ["budget", "todo"];

  for (let tabIndex = 0; tabIndex < tabNames.length; tabIndex++) {
    const currentTabName = tabNames[tabIndex];

    if (currentTabName === tabName) {
      getElement(currentTabName).hidden = false;

      getElement("tab-" + currentTabName).setAttribute("aria-selected", "true");
    } else {
      getElement(currentTabName).hidden = true;

      getElement("tab-" + currentTabName).setAttribute(
        "aria-selected",
        "false",
      );
    }
  }

  try {
    history.replaceState(null, "", "#" + tabName);
  } catch (error) {
    // Ignore history errors
  }
}

// =====================================
// BUDGET FUNCTIONS
// =====================================

let deletedEntries = loadData("deletedBudget");
let spendingLimits = loadData("spendingLimits");
if (!spendingLimits || Array.isArray(spendingLimits)) {
  spendingLimits = { day: 0, week: 0, month: 0, year: 0 };
}
let expensePeriod = "all";
let entrySearchText = "";

function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function getEntryDateISO(entry) {
  if (entry.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(entry.dateISO)) return entry.dateISO;
  if (entry.date) {
    const parsed = new Date(entry.date);
    if (!Number.isNaN(parsed.getTime())) return getLocalDateString(parsed);
  }
  return getTodayString();
}

function entryDateObject(entry) {
  return makeDateFromString(getEntryDateISO(entry));
}

function getWeekStart(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function matchesPeriod(entry, period) {
  const date = entryDateObject(entry);
  const now = new Date();
  if (period === "day") return getLocalDateString(date) === getLocalDateString(now);
  if (period === "week") {
    const start = getWeekStart(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return date >= start && date < end;
  }
  if (period === "month") return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (period === "year") return date.getFullYear() === now.getFullYear();
  return true;
}

function calculateTotals() {
  let totalIncome = 0;
  let totalExpenses = 0;
  for (let i = 0; i < budgetEntries.length; i++) {
    if (budgetEntries[i].type === "income") totalIncome += Number(budgetEntries[i].amount) || 0;
    if (budgetEntries[i].type === "expense") totalExpenses += Number(budgetEntries[i].amount) || 0;
  }
  return { income: totalIncome, expenses: totalExpenses, balance: totalIncome - totalExpenses };
}

function getExpensesForPeriod(period) {
  let total = 0;
  for (let i = 0; i < budgetEntries.length; i++) {
    const entry = budgetEntries[i];
    if (entry.type === "expense" && matchesPeriod(entry, period)) total += Number(entry.amount) || 0;
  }
  return total;
}

function periodLabel(period) {
  return { day: "Today", week: "This week", month: "This month", year: "This year" }[period];
}

function drawLimitSummaries() {
  const container = getElement("limitSummaries");
  container.innerHTML = "";
  const periods = ["day", "week", "month", "year"];
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const limit = Number(spendingLimits[period]) || 0;
    const spent = getExpensesForPeriod(period);
    const remaining = limit - spent;
    const card = document.createElement("div");
    card.className = "limit-summary";
    const title = document.createElement("strong");
    title.textContent = periodLabel(period);
    const detail = document.createElement("span");
    detail.textContent = "Spent: " + formatPeso(spent);
    const status = document.createElement("small");
    if (limit <= 0) status.textContent = "No limit set";
    else if (remaining < 0) status.textContent = formatPeso(Math.abs(remaining)) + " over limit";
    else status.textContent = formatPeso(remaining) + " remaining";
    const track = document.createElement("div");
    track.className = "limit-progress-track";
    const bar = document.createElement("div");
    bar.className = "limit-progress";
    bar.style.width = limit > 0 ? Math.min((spent / limit) * 100, 100) + "%" : "0%";
    if (limit > 0 && spent > limit) bar.classList.add("danger");
    else if (limit > 0 && spent >= limit * 0.8) bar.classList.add("warning");
    track.appendChild(bar);
    card.append(title, detail, status, track);
    container.appendChild(card);
  }
}

getElement("limitsForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const periods = ["day", "week", "month", "year"];
  const ids = { day: "dailyLimit", week: "weeklyLimit", month: "monthlyLimit", year: "yearlyLimit" };
  const updated = {};
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const raw = getElement(ids[period]).value.trim();
    if (raw === "") updated[period] = 0;
    else {
      const value = Math.round(Number(raw) * 100) / 100;
      if (!Number.isFinite(value) || value <= 0) {
        getElement("limitsMsg").textContent = "Enter a positive amount or leave the field blank.";
        return;
      }
      updated[period] = value;
    }
  }
  spendingLimits = updated;
  saveData("spendingLimits", spendingLimits);
  getElement("limitsMsg").textContent = "Spending limits saved.";
  drawLimitSummaries();
});

function loadLimitInputs() {
  getElement("dailyLimit").value = spendingLimits.day || "";
  getElement("weeklyLimit").value = spendingLimits.week || "";
  getElement("monthlyLimit").value = spendingLimits.month || "";
  getElement("yearlyLimit").value = spendingLimits.year || "";
}

function addToDeletedHistory(entry, source) {
  deletedEntries.unshift({ entry: entry, source: source, deletedAt: new Date().toISOString() });
  saveData("deletedBudget", deletedEntries);
}

function drawDeletedHistory() {
  const list = getElement("deletedList");
  list.innerHTML = "";
  getElement("deletedCount").textContent = deletedEntries.length;
  getElement("clearHistoryButton").hidden = deletedEntries.length === 0;
  if (deletedEntries.length === 0) {
    list.appendChild(createEmptyRow("No deleted records."));
    return;
  }

  for (let i = 0; i < deletedEntries.length; i++) {
    const record = deletedEntries[i];
    const entry = record.entry;
    const row = document.createElement("li");
    const info = document.createElement("div");
    info.className = "grow";
    info.textContent = entry.type === "task" ? "To-do: " + entry.task.text : entry.desc;
    const meta = document.createElement("small");
    const deletedDate = new Date(record.deletedAt);
    meta.textContent = (entry.type === "task" ? "Task" : (entry.category || "Other") + " · " + formatPeso(entry.amount)) +
      " · Deleted " + deletedDate.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
    info.appendChild(meta);

    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "small-action";
    restore.textContent = "Restore";
    restore.onclick = function () {
      if (record.source === "todo" && entry.task) {
        todoTasks.unshift(entry.task);
        sortTasksByDueDate();
        saveData("tasks", todoTasks);
        drawTodo();
      } else {
        budgetEntries.unshift(entry);
        saveData("budget", budgetEntries);
      }
      deletedEntries.splice(i, 1);
      saveData("deletedBudget", deletedEntries);
      drawBudget();
    };

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "del";
    remove.textContent = "✕";
    remove.setAttribute("aria-label", "Permanently delete history record");
    remove.onclick = function () {
      if (!confirm("Permanently delete this history record? This cannot be undone.")) return;
      deletedEntries.splice(i, 1);
      saveData("deletedBudget", deletedEntries);
      drawDeletedHistory();
    };
    row.append(info, restore, remove);
    list.appendChild(row);
  }
}

function clearDeletedHistory() {
  if (!deletedEntries.length) return;
  if (confirm("Permanently clear all deleted history records? This cannot be undone.")) {
    deletedEntries = [];
    saveData("deletedBudget", deletedEntries);
    drawDeletedHistory();
  }
}

function editBudgetEntry(entry) {
  const newDesc = prompt("Edit description:", entry.desc);
  if (newDesc === null) return;
  if (!newDesc.trim()) { alert("Description cannot be empty."); return; }

  const newAmountText = prompt("Edit amount (₱):", String(entry.amount));
  if (newAmountText === null) return;
  const newAmount = Math.round(Number(newAmountText) * 100) / 100;
  if (!Number.isFinite(newAmount) || newAmount <= 0) { alert("Enter an amount greater than 0."); return; }

  const categories = ["Food", "Transportation", "School", "Bills", "Shopping", "Health", "Entertainment", "Other"];
  const categoryPrompt = "Choose category by number:\n" + categories.map((c, i) => (i + 1) + ". " + c).join("\n");
  const selected = prompt(categoryPrompt, String(Math.max(1, categories.indexOf(entry.category || "Other") + 1)));
  if (selected === null) return;
  const categoryIndex = Number(selected) - 1;
  if (!Number.isInteger(categoryIndex) || categoryIndex < 0 || categoryIndex >= categories.length) {
    alert("Invalid category selection.");
    return;
  }

  const old = { desc: entry.desc, amount: entry.amount, category: entry.category };
  entry.desc = newDesc.trim();
  entry.amount = newAmount;
  entry.category = categories[categoryIndex];

  const totals = calculateTotals();
  if (totals.balance < -0.000001) {
    Object.assign(entry, old);
    alert("This change would make your balance negative.");
    return;
  }

  const periods = ["day", "week", "month", "year"];
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const limit = Number(spendingLimits[period]) || 0;
    if (entry.type === "expense" && limit > 0 && getExpensesForPeriod(period) > limit + 0.000001) {
      Object.assign(entry, old);
      alert("This change would exceed your " + period + " spending limit.");
      return;
    }
  }

  saveData("budget", budgetEntries);
  drawBudget();
}

function drawBudget() {
  const totals = calculateTotals();
  getElement("income").textContent = formatPeso(totals.income);
  getElement("expenses").textContent = formatPeso(totals.expenses);
  getElement("balance").textContent = (totals.balance < 0 ? "−" : "") + formatPeso(Math.abs(totals.balance));

  const list = getElement("budgetList");
  list.innerHTML = "";
  const visible = budgetEntries.filter(function (entry) {
    const matchesText = (entry.desc + " " + (entry.category || "Other")).toLowerCase().includes(entrySearchText);
    return matchesPeriod(entry, expensePeriod) && matchesText;
  });

  if (visible.length === 0) {
    list.appendChild(createEmptyRow(budgetEntries.length ? "No entries match your filter or search." : "No entries yet. Add your first income or expense above."));
  }

  for (let i = 0; i < visible.length; i++) {
    const entry = visible[i];
    const row = document.createElement("li");
    const info = document.createElement("div");
    info.className = "grow";
    info.textContent = entry.desc;
    const meta = document.createElement("small");
    meta.textContent = (entry.category || "Other") + " · " + (entry.date || getEntryDateISO(entry));
    info.appendChild(meta);

    const amount = document.createElement("span");
    amount.className = entry.type === "income" ? "amt in" : "amt out";
    amount.textContent = (entry.type === "income" ? "+" : "−") + formatPeso(entry.amount);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "small-action";
    edit.textContent = "Edit";
    edit.onclick = function () { editBudgetEntry(entry); };

    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Delete " + entry.desc);
    del.onclick = function () {
      if (!confirm("Move this entry to deleted history?\n\n" + entry.desc + " (" + formatPeso(entry.amount) + ")")) return;
      const index = budgetEntries.indexOf(entry);
      if (index !== -1) {
        addToDeletedHistory(budgetEntries.splice(index, 1)[0], "budget");
        saveData("budget", budgetEntries);
        drawBudget();
      }
    };
    row.append(info, amount, edit, del);
    list.appendChild(row);
  }

  getElement("budgetCount").textContent = visible.length + (visible.length === 1 ? " entry shown" : " entries shown");
  drawLimitSummaries();
  drawDeletedHistory();
}

getElement("expensePeriod").addEventListener("change", function (event) {
  expensePeriod = event.target.value;
  drawBudget();
});
getElement("entrySearch").addEventListener("input", function (event) {
  entrySearchText = event.target.value.trim().toLowerCase();
  drawBudget();
});

// =====================================
// BUDGET FORM
// =====================================

getElement("budgetForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const description = getElement("desc").value.trim();
  const amountText = getElement("amount").value.trim();
  const type = getElement("type").value;
  const category = getElement("category").value;
  const message = getElement("budgetMsg");

  if (!description || !amountText) { message.textContent = "Enter a description and an amount."; return; }
  const amount = Math.round(Number(amountText) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) { message.textContent = "The amount must be greater than 0."; return; }

  if (type === "expense") {
    const totals = calculateTotals();
    if (amount > totals.balance + 0.000001) {
      message.textContent = "Not enough balance. Available balance: " + formatPeso(Math.max(0, totals.balance)) + ".";
      return;
    }
    const candidate = { type: "expense", amount: amount, dateISO: getLocalDateString(new Date()) };
    const periods = ["day", "week", "month", "year"];
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const limit = Number(spendingLimits[period]) || 0;
      if (limit > 0 && getExpensesForPeriod(period) + amount > limit + 0.000001) {
        message.textContent = "This expense exceeds your remaining " + period + " limit of " +
          formatPeso(Math.max(0, limit - getExpensesForPeriod(period))) + ".";
        return;
      }
    }
  }

  message.textContent = "";
  const now = new Date();
  budgetEntries.unshift({
    desc: description,
    amount: amount,
    type: type,
    category: category,
    date: now.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }),
    dateISO: getLocalDateString(now),
  });
  saveData("budget", budgetEntries);
  drawBudget();
  getElement("desc").value = "";
  getElement("amount").value = "";
  getElement("desc").focus();
});

// =====================================
// CLEAR BUDGET
// =====================================

function clearBudget() {
  if (!budgetEntries.length) return;
  if (!confirm("Move all " + budgetEntries.length + " entries to deleted history?")) return;
  for (let i = 0; i < budgetEntries.length; i++) addToDeletedHistory(budgetEntries[i], "budget");
  budgetEntries = [];
  saveData("budget", budgetEntries);
  drawBudget();
}

// =====================================
// TO-DO FUNCTIONS
// =====================================

// NEW: the reminder button under the tabs.
// It shows how many tasks are overdue or due today.
function updateReminderBox() {
  const reminderBox = getElement("reminderBox");

  if (reminderBox === null) {
    return;
  }

  let overdueCount = 0;
  let todayCount = 0;

  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    const dueInfo = getDueInfo(todoTasks[taskIndex]);

    if (dueInfo.style === "overdue") {
      overdueCount++;
    }

    if (dueInfo.style === "today") {
      todayCount++;
    }
  }

  // Nothing to remind about, so hide the box.
  if (overdueCount === 0 && todayCount === 0) {
    reminderBox.hidden = true;
    return;
  }

  const messageParts = [];

  if (overdueCount === 1) {
    messageParts.push("1 task overdue");
  } else if (overdueCount > 1) {
    messageParts.push(overdueCount + " tasks overdue");
  }

  if (todayCount === 1) {
    messageParts.push("1 task due today");
  } else if (todayCount > 1) {
    messageParts.push(todayCount + " tasks due today");
  }

  reminderBox.textContent = "⚠ Reminder: " + messageParts.join(" · ");

  // Red if something is late, amber if tasks are only due today.
  if (overdueCount > 0) {
    reminderBox.className = "reminder";
  } else {
    reminderBox.className = "reminder soon";
  }

  reminderBox.hidden = false;
}

function drawTodo() {
  const todoList = getElement("todoList");

  todoList.innerHTML = "";

  const tasksToShow = [];

  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    const currentTask = todoTasks[taskIndex];

    if (currentFilter === "all") {
      tasksToShow.push(currentTask);
    } else if (currentFilter === "done") {
      if (currentTask.done === true) {
        tasksToShow.push(currentTask);
      }
    } else {
      if (currentTask.done === false) {
        tasksToShow.push(currentTask);
      }
    }
  }

  if (tasksToShow.length === 0) {
    if (todoTasks.length === 0) {
      todoList.appendChild(
        createEmptyRow("Nothing to do yet. Add a task above."),
      );
    } else {
      todoList.appendChild(createEmptyRow("No tasks in this view."));
    }
  }

  for (let taskIndex = 0; taskIndex < tasksToShow.length; taskIndex++) {
    const currentTask = tasksToShow[taskIndex];

    const listItem = document.createElement("li");

    // NEW: the due-date reminder for this task.
    const dueInfo = getDueInfo(currentTask);

    // The style (overdue / today / soon) colors the due text.
    listItem.className = dueInfo.style;

    if (currentTask.done === true) {
      listItem.className = "done";
    }

    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.checked = currentTask.done;

    checkbox.setAttribute(
      "aria-label",
      "Mark " + currentTask.text + " as done",
    );

    checkbox.onchange = function () {
      currentTask.done = checkbox.checked;

      saveData("tasks", todoTasks);

      drawTodo();
    };

    const taskLabel = document.createElement("div");

    taskLabel.className = "grow";
    taskLabel.textContent = currentTask.text;

    // NEW: the due date line under the task text.
    const dueText = document.createElement("small");

    dueText.textContent = dueInfo.text;

    taskLabel.appendChild(dueText);

    const deleteButton = document.createElement("button");

    deleteButton.className = "del";
    deleteButton.textContent = "✕";

    deleteButton.setAttribute("aria-label", "Delete " + currentTask.text);

    deleteButton.onclick = function () {
      if (!confirm("Move this task to deleted history?\\n\\n" + currentTask.text)) return;
      addToDeletedHistory({ type: "task", task: currentTask }, "todo");
      todoTasks.splice(todoTasks.indexOf(currentTask), 1);
      saveData("tasks", todoTasks);
      drawDeletedHistory();
      drawTodo();
    };

    listItem.appendChild(checkbox);
    listItem.appendChild(taskLabel);
    listItem.appendChild(deleteButton);

    todoList.appendChild(listItem);
  }

  let remainingTaskCount = 0;

  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    if (todoTasks[taskIndex].done === false) {
      remainingTaskCount++;
    }
  }

  let taskText = " tasks left";

  if (remainingTaskCount === 1) {
    taskText = " task left";
  }

  getElement("todoCount").textContent = remainingTaskCount + taskText;

  // NEW: refresh the reminder box every time the list is drawn.
  updateReminderBox();
}

// =====================================
// ADD TASK
// =====================================

getElement("todoForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const taskText = getElement("task").value.trim();

  // NEW: read the due date from the date box.
  const dueDateValue = getElement("dueDate").value;

  if (taskText === "") {
    getElement("todoMsg").textContent = "Type a task first.";

    return;
  }

  // NEW: every task needs a due date.
  if (dueDateValue === "") {
    getElement("todoMsg").textContent = "Pick a due date for this task.";

    return;
  }

  // NEW: the date cannot be before today.
  // Dates written as year-month-day can be compared as text.
  if (dueDateValue < getTodayString()) {
    getElement("todoMsg").textContent = "The due date cannot be in the past.";

    return;
  }

  getElement("todoMsg").textContent = "";

  todoTasks.unshift({
    text: taskText,
    done: false,
    dueDate: dueDateValue,
  });

  // NEW: keep the earliest due date at the top.
  sortTasksByDueDate();

  saveData("tasks", todoTasks);

  drawTodo();

  getElement("task").value = "";
  getElement("dueDate").value = "";

  getElement("task").focus();
});

// =====================================
// FILTER BUTTONS
// =====================================

getElement("filters").addEventListener("click", function (event) {
  const selectedFilter = event.target.dataset.f;

  if (!selectedFilter) {
    return;
  }

  currentFilter = selectedFilter;

  const filterButtons = getElement("filters").children;

  for (let buttonIndex = 0; buttonIndex < filterButtons.length; buttonIndex++) {
    const currentButton = filterButtons[buttonIndex];

    if (currentButton.dataset.f === selectedFilter) {
      currentButton.setAttribute("aria-pressed", "true");
    } else {
      currentButton.setAttribute("aria-pressed", "false");
    }
  }

  drawTodo();
});

// =====================================
// CLEAR COMPLETED TASKS
// =====================================

function clearDone() {
  const remainingTasks = [];
  for (let taskIndex = 0; taskIndex < todoTasks.length; taskIndex++) {
    if (todoTasks[taskIndex].done === true) {
      addToDeletedHistory({ type: "task", task: todoTasks[taskIndex] }, "todo");
    } else {
      remainingTasks.push(todoTasks[taskIndex]);
    }
  }
  todoTasks = remainingTasks;
  saveData("tasks", todoTasks);
  drawDeletedHistory();
  drawTodo();
}

// =====================================
// START APPLICATION
// =====================================

sortTasksByDueDate();
updateDateLimit();

drawBudget();
drawTodo();

if (location.hash === "#todo") {
  showTab("todo");
} else {
  showTab("budget");
}

window.addEventListener("hashchange", function () {
  if (location.hash === "#todo") {
    showTab("todo");
  } else {
    showTab("budget");
  }
});

// NEW: when the app comes back on screen (for example you reopen the
// phone app the next morning), update the reminders for the new day.
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    updateDateLimit();
    drawTodo();
  }
});

// =====================================
// SERVICE WORKER
// =====================================

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(function () {
    // Ignore registration errors
  });
}
