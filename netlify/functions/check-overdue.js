// Netlify Scheduled Function: check-overdue.js
// Runs every hour to check for newly overdue tasks
// Schedule set in netlify.toml
const handler = async () => {
  const APP_URL = process.env.APP_URL || "https://tfsmakeithappen.netlify.app";
  const JESSICA_PLAYER_ID = process.env.JESSICA_PLAYER_ID;
  let tasks = [];
  let playerIdMap = {};
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({
      name: "floorstore",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });
    const rawTasks = await store.get("todos");
    // BUGFIX: this used to read a "people" key, but nothing in the app ever
    // writes a key by that name -- save-player-id.js writes to "playerIds"
    // instead, as a map of personId -> { playerId, name, updatedAt }. Reading
    // the wrong key meant the actual task assignee never got found here, so
    // only Jessica (via the separate JESSICA_PLAYER_ID env var) ever got
    // pinged for overdue tasks -- never the person it was assigned to.
    const rawPlayerIds = await store.get("playerIds");
    if (rawTasks) tasks = JSON.parse(rawTasks);
    if (rawPlayerIds) playerIdMap = JSON.parse(rawPlayerIds);
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
    const assigneePlayerId = playerIdMap[task.assigneeId]?.playerId;
    const playerIds = [];
    if (assigneePlayerId) playerIds.push(assigneePlayerId);
    if (JESSICA_PLAYER_ID && JESSICA_PLAYER_ID !== assigneePlayerId) playerIds.push(JESSICA_PLAYER_ID);
    if (!playerIds.length) continue;
    await fetch(`${APP_URL}/.netlify/functions/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "overdue",
        playerIds,
        title: "Task Overdue!",
        message: `"${task.title}" is now overdue.`,
        url: APP_URL,
      }),
    }).catch(e => console.error("Push failed:", e));
    console.log(`Overdue alert sent for: ${task.title}`);
  }
  return { statusCode: 200, body: JSON.stringify({ checked: tasks.length, overdue: overdueTasks.length }) };
};

exports.handler = handler;
