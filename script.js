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
// BUDGET FUNCTIONS AND FINANCIAL ANALYTICS
// =====================================
let deletedEntries = loadData("deletedBudget");
let spendingLimits = JSON.parse(localStorage.getItem("spendingLimits") || "{}");
let entrySearchText = "";
let editingEntry = null;

function entryISO(entry) {
  if (entry.dateISO) return entry.dateISO;
  if (entry.date) {
    const parsed = new Date(entry.date);
    if (!Number.isNaN(parsed.getTime())) {
      return [parsed.getFullYear(), String(parsed.getMonth()+1).padStart(2,"0"), String(parsed.getDate()).padStart(2,"0")].join("-");
    }
  }
  return getTodayString();
}
function totalsFor(entries) {
  return entries.reduce((t,e) => {
    if (e.type === "income") t.income += Number(e.amount)||0;
    if (e.type === "expense") t.expenses += Number(e.amount)||0;
    t.balance=t.income-t.expenses; return t;
  },{income:0,expenses:0,balance:0});
}
function calculateTotals(){ return totalsFor(budgetEntries); }
function startOfWeek(d) {
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setDate(x.getDate()-x.getDay()); return x;
}
function inPeriod(entry, period) {
  const d=makeDateFromString(entryISO(entry)), now=new Date();
  if(period==="day") return entryISO(entry)===getTodayString();
  if(period==="week") { const s=startOfWeek(now), e=new Date(s); e.setDate(e.getDate()+7); return d>=s&&d<e; }
  if(period==="month") return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
  if(period==="year") return d.getFullYear()===now.getFullYear();
  return true;
}
function periodEntries(period) { return budgetEntries.filter(e=>e.type==="expense"&&inPeriod(e,period)); }
function drawLimits() {
  const labels={day:"Today",week:"This week",month:"This month",year:"This year"};
  const box=getElement("limitOverview"); box.innerHTML="";
  ["day","week","month","year"].forEach(period=>{
    const limit=Number(spendingLimits[period])||0;
    const spent=periodEntries(period).reduce((s,e)=>s+Number(e.amount),0);
    const remaining=limit-spent, pct=limit>0?Math.min(100,spent/limit*100):0;
    const card=document.createElement("div"); card.className="limit-item";
    const title=document.createElement("strong"); title.textContent=labels[period];
    const detail=document.createElement("span"); detail.textContent=limit>0?
      `${formatPeso(spent)} of ${formatPeso(limit)} · ${remaining>=0?formatPeso(remaining)+" left":formatPeso(-remaining)+" over"}`:
      `${formatPeso(spent)} spent · No limit`;
    const track=document.createElement("div"); track.className="limit-progress-track";
    const bar=document.createElement("div"); bar.className="limit-progress"+(remaining<0?" danger":pct>=80?" warning":"");
    bar.style.width=pct+"%"; track.appendChild(bar);
    card.append(title,detail,track); box.appendChild(card);
    getElement("limit-"+period).value=limit||"";
  });
}
getElement("limitForm").addEventListener("submit",e=>{
  e.preventDefault();
  ["day","week","month","year"].forEach(k=>{
    const v=getElement("limit-"+k).value.trim();
    spendingLimits[k]=v===""?0:Math.max(0,Number(v)||0);
  });
  localStorage.setItem("spendingLimits",JSON.stringify(spendingLimits));
  getElement("limitMsg").textContent="Spending limits saved."; drawBudget();
});
function canAddExpense(amount, oldAmount=0) {
  const now=new Date();
  for(const period of ["day","week","month","year"]) {
    const limit=Number(spendingLimits[period])||0;
    if(!limit) continue;
    const spent=periodEntries(period).reduce((s,e)=>s+Number(e.amount),0)-oldAmount;
    if(spent+amount>limit+0.00001) return period;
  }
  return "";
}
function addToDeleted(entry) {
  deletedEntries.unshift({entry,deletedAt:new Date().toISOString()});
  saveData("deletedBudget",deletedEntries);
}
function drawDeletedHistory() {
  const list=getElement("deletedList"); list.innerHTML="";
  getElement("deletedCount").textContent=deletedEntries.length;
  getElement("clearHistoryButton").hidden=!deletedEntries.length;
  if(!deletedEntries.length){list.appendChild(createEmptyRow("No deleted entries."));return;}
  deletedEntries.forEach((record,index)=>{
    const li=document.createElement("li"), info=document.createElement("div"); info.className="grow";
    info.textContent=record.entry.desc;
    const meta=document.createElement("small");
    meta.textContent=`${record.entry.category||"Uncategorized"} · ${formatPeso(record.entry.amount)} · Deleted ${new Date(record.deletedAt).toLocaleString()}`;
    info.appendChild(meta);
    const restore=document.createElement("button"); restore.className="small-action"; restore.textContent="Restore";
    restore.onclick=()=>{budgetEntries.unshift(record.entry);deletedEntries.splice(index,1);saveData("budget",budgetEntries);saveData("deletedBudget",deletedEntries);drawBudget();};
    const remove=document.createElement("button"); remove.className="del"; remove.textContent="✕";
    remove.onclick=()=>{if(confirm("Permanently delete this history record?")){deletedEntries.splice(index,1);saveData("deletedBudget",deletedEntries);drawDeletedHistory();}};
    li.append(info,restore,remove);list.appendChild(li);
  });
}
function clearDeletedHistory(){
  if(deletedEntries.length&&confirm("Permanently clear all deleted history?")){
    deletedEntries=[];saveData("deletedBudget",deletedEntries);drawDeletedHistory();
  }
}
function drawBudget() {
  const totals=calculateTotals();
  getElement("income").textContent=formatPeso(totals.income);
  getElement("expenses").textContent=formatPeso(totals.expenses);
  getElement("balance").textContent=(totals.balance<0?"−":"")+formatPeso(Math.abs(totals.balance));
  const period=getElement("expensePeriod").value;
  const list=getElement("budgetList"); list.innerHTML="";
  const q=entrySearchText.toLowerCase();
  const visible=budgetEntries.filter(e=>inPeriod(e,period)&&
    (e.desc.toLowerCase().includes(q)||(e.category||"").toLowerCase().includes(q)));
  if(!visible.length) list.appendChild(createEmptyRow("No matching entries."));
  visible.forEach(entry=>{
    const li=document.createElement("li"), info=document.createElement("div");info.className="grow";
    info.textContent=entry.desc;
    const meta=document.createElement("small");meta.textContent=`${entry.date||entryISO(entry)} · ${entry.category||"Other"} · ${entry.type}`;
    info.appendChild(meta);
    const amount=document.createElement("span");amount.className="amt "+(entry.type==="income"?"in":"out");
    amount.textContent=(entry.type==="income"?"+":"−")+formatPeso(entry.amount);
    const edit=document.createElement("button");edit.className="small-action";edit.textContent="Edit";
    edit.onclick=()=>beginEdit(entry);
    const del=document.createElement("button");del.className="del";del.textContent="✕";del.setAttribute("aria-label","Delete "+entry.desc);
    del.onclick=()=>{if(confirm("Move this entry to deleted history?\n\n"+entry.desc+" ("+formatPeso(entry.amount)+")")){
      const i=budgetEntries.indexOf(entry);if(i>=0){addToDeleted(budgetEntries.splice(i,1)[0]);saveData("budget",budgetEntries);drawBudget();}
    }};
    li.append(info,amount,edit,del);list.appendChild(li);
  });
  getElement("budgetCount").textContent=visible.length+" entr"+(visible.length===1?"y":"ies")+" shown";
  drawLimits();drawDeletedHistory();drawExpenseChart();drawMonthlyReport();
}
function beginEdit(entry){
  editingEntry=entry;
  getElement("desc").value=entry.desc;
  getElement("amount").value=entry.amount;
  getElement("type").value=entry.type;
  getElement("category").value=entry.category||"Other";
  getElement("budgetSubmit").textContent="Save changes";
  getElement("cancelEdit").hidden=false;
  getElement("desc").focus();
}
function cancelEdit(){
  editingEntry=null;getElement("budgetForm").reset();
  getElement("budgetSubmit").textContent="Add entry";getElement("cancelEdit").hidden=true;
}
getElement("cancelEdit").addEventListener("click",cancelEdit);
getElement("expensePeriod").addEventListener("change",drawBudget);
getElement("entrySearch").addEventListener("input",e=>{entrySearchText=e.target.value.trim();drawBudget();});
getElement("budgetForm").addEventListener("submit",e=>{
  e.preventDefault();
  const desc=getElement("desc").value.trim(), amount=Math.round(Number(getElement("amount").value)*100)/100;
  const type=getElement("type").value, category=getElement("category").value;
  const msg=getElement("budgetMsg");
  if(!desc||!Number.isFinite(amount)||amount<=0){msg.textContent="Enter a description and an amount greater than 0.";return;}
  const oldExpense=editingEntry&&editingEntry.type==="expense"?Number(editingEntry.amount):0;
  if(type==="expense"){
    const balance=calculateTotals().balance+(editingEntry?(editingEntry.type==="expense"?editingEntry.amount:-editingEntry.amount):0);
    if(amount>balance){msg.textContent="Not enough balance for this expense.";return;}
    const exceeded=canAddExpense(amount,oldExpense);
    if(exceeded){msg.textContent="This entry exceeds your "+exceeded+" spending limit.";return;}
  }
  msg.textContent="";
  if(editingEntry){
    Object.assign(editingEntry,{desc,amount,type,category});
    cancelEdit();
  } else {
    const now=new Date();
    budgetEntries.unshift({desc,amount,type,category,date:now.toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}),dateISO:getTodayString()});
    getElement("budgetForm").reset();
  }
  saveData("budget",budgetEntries);drawBudget();
});
function clearBudget(){
  if(!budgetEntries.length)return;
  if(confirm(`Move all ${budgetEntries.length} entries to deleted history?`)){
    budgetEntries.forEach(addToDeleted);budgetEntries=[];saveData("budget",budgetEntries);drawBudget();
  }
}

// Chart: native canvas drawing, no external chart library required.
function drawExpenseChart(){
  const canvas=getElement("expenseChart"),ctx=canvas.getContext("2d");
  const month=getElement("chartMonth").value||getTodayString().slice(0,7);
  const sums={};
  budgetEntries.filter(e=>e.type==="expense"&&entryISO(e).slice(0,7)===month)
    .forEach(e=>{const c=e.category||"Other";sums[c]=(sums[c]||0)+Number(e.amount);});
  const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||300,h=240;
  canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const items=Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  getElement("chartLegend").innerHTML="";
  if(!items.length){ctx.fillStyle=getComputedStyle(document.body).color;ctx.font="14px sans-serif";ctx.textAlign="center";ctx.fillText("No expenses for this month",w/2,120);return;}
  const colors=["#3767c7","#e08a36","#269b78","#ad65c7","#d65b62","#5c9eb5","#9b9b45","#777"];
  const total=items.reduce((s,x)=>s+x[1],0);let angle=-Math.PI/2;
  items.forEach(([name,value],i)=>{
    const slice=value/total*Math.PI*2;ctx.beginPath();ctx.moveTo(w/2,112);ctx.arc(w/2,112,82,angle,angle+slice);ctx.closePath();ctx.fillStyle=colors[i%colors.length];ctx.fill();angle+=slice;
    const legend=document.createElement("span");legend.textContent=`${name}: ${formatPeso(value)}`;legend.style.borderLeft=`4px solid ${colors[i%colors.length]}`;getElement("chartLegend").appendChild(legend);
  });
  ctx.fillStyle=getComputedStyle(document.body).color;ctx.font="bold 13px sans-serif";ctx.textAlign="center";ctx.fillText(formatPeso(total),w/2,116);
}
function drawMonthlyReport(){
  const month=getElement("reportMonth").value||getTodayString().slice(0,7);
  const entries=budgetEntries.filter(e=>entryISO(e).slice(0,7)===month);
  const t=totalsFor(entries);
  const container=getElement("monthlyReport");
  const heading=document.createElement("h3");heading.textContent=new Date(month+"-02").toLocaleDateString("en-PH",{month:"long",year:"numeric"});
  const table=document.createElement("table");table.className="report-table";
  [["Total income",t.income],["Total expenses",t.expenses],["Net balance",t.balance]].forEach(([label,value])=>{
    const tr=document.createElement("tr"),th=document.createElement("th"),td=document.createElement("td");
    th.textContent=label;td.textContent=formatPeso(value);tr.append(th,td);table.appendChild(tr);
  });
  const categoryTotals={};entries.filter(e=>e.type==="expense").forEach(e=>{const c=e.category||"Other";categoryTotals[c]=(categoryTotals[c]||0)+Number(e.amount);});
  const categoryTitle=document.createElement("h4");categoryTitle.textContent="Expenses by category";
  const categoryList=document.createElement("ul");
  Object.entries(categoryTotals).sort((a,b)=>b[1]-a[1]).forEach(([cat,val])=>{const li=document.createElement("li");li.textContent=cat+": "+formatPeso(val);categoryList.appendChild(li);});
  container.replaceChildren(heading,table,categoryTitle,categoryList);
}
getElement("chartMonth").addEventListener("change",drawExpenseChart);
getElement("reportMonth").addEventListener("change",drawMonthlyReport);
getElement("printReport").addEventListener("click",()=>window.print());

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
      if (!confirm("Delete this task?")) return;
      todoTasks.splice(todoTasks.indexOf(currentTask), 1);

      saveData("tasks", todoTasks);

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
const currentMonthValue = getTodayString().slice(0, 7);
getElement("chartMonth").value = currentMonthValue;
getElement("reportMonth").value = currentMonthValue;

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
