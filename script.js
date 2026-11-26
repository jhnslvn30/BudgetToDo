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
let monthlyLimit = Number(localStorage.getItem("monthlyBudgetLimit")) || 0;
let expensePeriod = "all";

function getEntryDate(entry) {
  // New entries store an ISO date. This fallback supports older saved entries.
  if (entry.dateISO && /^\d{4}-\d{2}-\d{2}$/.test(entry.dateISO)) {
    return entry.dateISO;
  }

  if (entry.date) {
    const parsed = new Date(entry.date);
    if (!Number.isNaN(parsed.getTime())) {
      return getLocalDateString(parsed);
    }
  }

  return getTodayString();
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function getWeekStart(date) {
  const weekStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day); // Sunday is the first day.
  return weekStart;
}

function isEntryInPeriod(entry, period) {
  const entryDate = makeDateFromString(getEntryDate(entry));
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (period === "day") {
    return getLocalDateString(entryDate) === getLocalDateString(startOfToday);
  }

  if (period === "week") {
    const start = getWeekStart(startOfToday);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return entryDate >= start && entryDate < end;
  }

  if (period === "month") {
    return entryDate.getFullYear() === today.getFullYear() &&
      entryDate.getMonth() === today.getMonth();
  }

  if (period === "year") {
    return entryDate.getFullYear() === today.getFullYear();
  }

  return true;
}

function calculateTotals() {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (let entryIndex = 0; entryIndex < budgetEntries.length; entryIndex++) {
    const currentEntry = budgetEntries[entryIndex];

    if (currentEntry.type === "income") {
      totalIncome += currentEntry.amount;
    }

    if (currentEntry.type === "expense") {
      totalExpenses += currentEntry.amount;
    }
  }

  return {
    income: totalIncome,
    expenses: totalExpenses,
    balance: totalIncome - totalExpenses,
  };
}

function getCurrentMonthExpenses() {
  let monthExpenses = 0;
  const now = new Date();

  for (let i = 0; i < budgetEntries.length; i++) {
    const entry = budgetEntries[i];
    const entryDate = makeDateFromString(getEntryDate(entry));

    if (entry.type === "expense" &&
        entryDate.getFullYear() === now.getFullYear() &&
        entryDate.getMonth() === now.getMonth()) {
      monthExpenses += entry.amount;
    }
  }

  return monthExpenses;
}

function drawLimit() {
  const spent = getCurrentMonthExpenses();
  const progress = monthlyLimit > 0 ? Math.min((spent / monthlyLimit) * 100, 100) : 0;
  const remaining = monthlyLimit - spent;

  getElement("monthlyLimit").value = monthlyLimit > 0 ? monthlyLimit : "";
  getElement("limitSpent").textContent = "Spent this month: " + formatPeso(spent);
  getElement("limitProgress").style.width = progress + "%";

  if (monthlyLimit <= 0) {
    getElement("limitStatus").textContent = "Not set";
    getElement("limitRemaining").textContent = "No limit set";
    getElement("limitStatus").className = "limit-status";
    getElement("limitProgress").className = "limit-progress";
    return;
  }

  getElement("limitRemaining").textContent = remaining >= 0
    ? formatPeso(remaining) + " remaining"
    : formatPeso(Math.abs(remaining)) + " over limit";

  if (remaining < 0) {
    getElement("limitStatus").textContent = "Over limit";
    getElement("limitStatus").className = "limit-status danger";
    getElement("limitProgress").className = "limit-progress danger";
  } else if (progress >= 80) {
    getElement("limitStatus").textContent = "Near limit";
    getElement("limitStatus").className = "limit-status warning";
    getElement("limitProgress").className = "limit-progress warning";
  } else {
    getElement("limitStatus").textContent = "On track";
    getElement("limitStatus").className = "limit-status good";
    getElement("limitProgress").className = "limit-progress";
  }
}

getElement("limitForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const limitText = getElement("monthlyLimit").value.trim();
  const message = getElement("limitMsg");

  if (limitText === "") {
    monthlyLimit = 0;
    localStorage.removeItem("monthlyBudgetLimit");
    message.textContent = "Monthly spending limit removed.";
    drawLimit();
    return;
  }

  const limitValue = Math.round(Number(limitText) * 100) / 100;
  if (!Number.isFinite(limitValue) || limitValue <= 0) {
    message.textContent = "Enter a limit greater than 0, or leave it blank to remove it.";
    return;
  }

  monthlyLimit = limitValue;
  localStorage.setItem("monthlyBudgetLimit", String(monthlyLimit));
  message.textContent = "Monthly spending limit saved.";
  drawLimit();
});

// Filter expenses and income entries by the selected date period.
getElement("expensePeriod").addEventListener("change", function (event) {
  expensePeriod = event.target.value;
  drawBudget();
});

function addToDeletedHistory(entry, source) {
  deletedEntries.unshift({
    entry: entry,
    source: source,
    deletedAt: new Date().toISOString(),
  });
  saveData("deletedBudget", deletedEntries);
}

function drawDeletedHistory() {
  const deletedList = getElement("deletedList");
  deletedList.innerHTML = "";
  getElement("deletedCount").textContent = deletedEntries.length;

  if (deletedEntries.length === 0) {
    deletedList.appendChild(createEmptyRow("No deleted entries."));
    getElement("clearHistoryButton").hidden = true;
    return;
  }

  getElement("clearHistoryButton").hidden = false;

  for (let i = 0; i < deletedEntries.length; i++) {
    const record = deletedEntries[i];
    const entry = record.entry;
    const row = document.createElement("li");
    const info = document.createElement("div");
    info.className = "grow";
    info.textContent = entry.desc;

    const meta = document.createElement("small");
    const deletedDate = new Date(record.deletedAt);
    meta.textContent = (entry.type === "task" ? "To-do task" :
      (entry.type === "income" ? "Income · " : "Expense · " + formatPeso(entry.amount))) +
      " · Deleted " +
      deletedDate.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
    info.appendChild(meta);

    const restoreButton = document.createElement("button");
    restoreButton.type = "button";
    restoreButton.className = "small-action";
    restoreButton.textContent = "Restore";
    restoreButton.onclick = function () {
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

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "del";
    removeButton.textContent = "✕";
    removeButton.setAttribute("aria-label", "Permanently delete " + entry.desc);
    removeButton.onclick = function () {
      if (!confirm("Permanently delete this history record? This cannot be undone.")) {
        return;
      }
      deletedEntries.splice(i, 1);
      saveData("deletedBudget", deletedEntries);
      drawDeletedHistory();
    };

    row.appendChild(info);
    row.appendChild(restoreButton);
    row.appendChild(removeButton);
    deletedList.appendChild(row);
  }
}

function clearDeletedHistory() {
  if (deletedEntries.length === 0) return;

  if (confirm("Permanently clear all " + deletedEntries.length +
      " deleted history records? This cannot be undone.")) {
    deletedEntries = [];
    saveData("deletedBudget", deletedEntries);
    drawDeletedHistory();
  }
}

function drawBudget() {
  const totals = calculateTotals();

  getElement("income").textContent = formatPeso(totals.income);
  getElement("expenses").textContent = formatPeso(totals.expenses);

  const balanceSign = totals.balance < 0 ? "−" : "";
  getElement("balance").textContent =
    balanceSign + formatPeso(Math.abs(totals.balance));

  const budgetList = getElement("budgetList");
  budgetList.innerHTML = "";

  const visibleEntries = budgetEntries.filter(function (entry) {
    return isEntryInPeriod(entry, expensePeriod);
  });

  if (visibleEntries.length === 0) {
    budgetList.appendChild(createEmptyRow(
      expensePeriod === "all" ? "No entries yet. Add your first income or expense above."
        : "No entries found for this period."
    ));
  }

  for (let i = 0; i < visibleEntries.length; i++) {
    const currentEntry = visibleEntries[i];
    const listItem = document.createElement("li");
    const informationContainer = document.createElement("div");
    informationContainer.className = "grow";
    informationContainer.textContent = currentEntry.desc;

    const dateText = document.createElement("small");
    dateText.textContent = currentEntry.date || getEntryDate(currentEntry);
    informationContainer.appendChild(dateText);

    const amountSpan = document.createElement("span");
    if (currentEntry.type === "income") {
      amountSpan.className = "amt in";
      amountSpan.textContent = "+" + formatPeso(currentEntry.amount);
    } else {
      amountSpan.className = "amt out";
      amountSpan.textContent = "−" + formatPeso(currentEntry.amount);
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "del";
    deleteButton.textContent = "✕";
    deleteButton.setAttribute("aria-label", "Delete " + currentEntry.desc);
    deleteButton.onclick = function () {
      const question = "Move this entry to deleted history?\n\n" +
        currentEntry.desc + " (" + formatPeso(currentEntry.amount) + ")";
      if (!confirm(question)) return;

      const originalIndex = budgetEntries.indexOf(currentEntry);
      if (originalIndex !== -1) {
        const removedEntry = budgetEntries.splice(originalIndex, 1)[0];
        addToDeletedHistory(removedEntry, "budget");
        saveData("budget", budgetEntries);
        drawBudget();
      }
    };

    listItem.appendChild(informationContainer);
    listItem.appendChild(amountSpan);
    listItem.appendChild(deleteButton);
    budgetList.appendChild(listItem);
  }

  let countText = visibleEntries.length === 1 ? " entry shown" : " entries shown";
  getElement("budgetCount").textContent = visibleEntries.length + countText;

  drawLimit();
  drawDeletedHistory();
}

// =====================================
// BUDGET FORM
// =====================================

getElement("budgetForm").addEventListener("submit", function (event) {
  event.preventDefault();

  const descriptionText = getElement("desc").value.trim();
  const amountText = getElement("amount").value.trim();
  const selectedType = getElement("type").value;
  const messageBox = getElement("budgetMsg");

  if (descriptionText === "" || amountText === "") {
    messageBox.textContent = "Enter a description and an amount.";
    return;
  }

  const amountValue = Math.round(Number(amountText) * 100) / 100;
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    messageBox.textContent = "The amount must be greater than 0.";
    return;
  }

  if (selectedType === "expense") {
    const totals = calculateTotals();
    const balanceInCentavos = Math.round(totals.balance * 100);
    const amountInCentavos = Math.round(amountValue * 100);

    if (balanceInCentavos <= 0) {
      messageBox.textContent = "You have no balance left to spend. Add income first.";
      return;
    }

    if (amountInCentavos > balanceInCentavos) {
      messageBox.textContent = "Not enough balance. You have " +
        formatPeso(totals.balance) + " but this expense is " +
        formatPeso(amountValue) + ".";
      return;
    }

    // The monthly limit blocks a new expense that would exceed the saved limit.
    if (monthlyLimit > 0) {
      const remainingLimit = monthlyLimit - getCurrentMonthExpenses();
      if (amountInCentavos > Math.round(remainingLimit * 100)) {
        messageBox.textContent = "Monthly limit reached. You have " +
          formatPeso(Math.max(remainingLimit, 0)) +
          " left in your monthly spending limit.";
        return;
      }
    }
  }

  messageBox.textContent = "";

  const now = new Date();
  const currentDate = now.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  budgetEntries.unshift({
    desc: descriptionText,
    amount: amountValue,
    type: selectedType,
    date: currentDate,
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
  if (budgetEntries.length === 0) return;

  const question = "Move all " + budgetEntries.length +
    " entries to deleted history?\n\nYou can restore them later from Deleted history.";

  if (confirm(question)) {
    for (let i = 0; i < budgetEntries.length; i++) {
      addToDeletedHistory(budgetEntries[i], "budget");
    }
    budgetEntries = [];
    saveData("budget", budgetEntries);
    drawBudget();
  }
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
      if (!confirm("Delete this task?\\n\\n" + currentTask.text)) return;

      deletedEntries.unshift({
        entry: {
          desc: "To-do: " + currentTask.text,
          amount: 0,
          type: "task",
          date: currentTask.dueDate || "",
          task: currentTask,
        },
        source: "todo",
        deletedAt: new Date().toISOString(),
      });
      saveData("deletedBudget", deletedEntries);

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
    if (todoTasks[taskIndex].done === false) {
      remainingTasks.push(todoTasks[taskIndex]);
    }
  }

  todoTasks = remainingTasks;

  saveData("tasks", todoTasks);

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
