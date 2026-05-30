// Netlify Scheduled Function: check-overdue.js
// Runs every hour to check for newly overdue tasks
// Schedule set in netlify.toml

exports.handler = async () => {
  const APP_URL = process.env.APP_URL || "https://tfsmakeithappen.netlify.app";
  const JESSICA_PLAYER_ID = process.env.JESSICA_PLAYER_ID;

  let tasks = [];
  let people = [];
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore("floorstore");
    const rawTasks = await store.get("todos");
    const rawPeople = await store.get("people");
    if (rawTasks) tasks = JSON.parse(rawTasks);
    if (rawPeople) people = JSON.parse(rawPeople);
  } catch(e) {
    console.log("No data in blob store yet");
    return { statusCode: 200, body: "No data" };
  }

  const now = new Date();
  const overdueTasks = tasks.filter(t => {
    if (t.done || !t.due || !t.assigneeId) return false;
    const dueDate = new Date(t.due);
    // Newly overdue = past due but less than 2 hours ago (to avoid repeat pings)
    const diff = now - dueDate;
    return diff > 0 && diff < 2 * 3600000;
  });

  for (const task of overdueTasks) {
    const assignee = people.find(p => p.id === task.assigneeId);
    const playerIds = [];
    if (assignee?.playerId) playerIds.push(assignee.playerId);
    if (JESSICA_PLAYER_ID && JESSICA_PLAYER_ID !== assignee?.playerId) playerIds.push(JESSICA_PLAYER_ID);

    if (!playerIds.length) continue;

    await fetch(`${APP_URL}/.netlify/functions/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "overdue",
        playerIds,
        title: "Task Overdue!",
        message: `"${task.title}" at ${task.storeName} is now overdue.`,
        url: APP_URL,
      }),
    }).catch(e => console.error("Push failed:", e));

    console.log(`Overdue alert sent for: ${task.title}`);
  }

  return { statusCode: 200, body: JSON.stringify({ checked: tasks.length, overdue: overdueTasks.length }) };
};
