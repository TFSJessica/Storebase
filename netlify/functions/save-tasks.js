// netlify/functions/save-tasks.js
// Called by the app whenever the task list changes (add, edit, delete,
// complete, comment, etc). Writes the full current task list to a shared
// Netlify Blob so every device sees the same data, not just whichever
// phone happened to create or last touch a task.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { todos } = body;
  if (!Array.isArray(todos)) {
    return { statusCode: 400, body: "Missing or invalid todos array" };
  }

  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({
      name: "floorstore",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });

    await store.set("todos", JSON.stringify(todos));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, count: todos.length }),
    };
  } catch (e) {
    console.error("save-tasks failed:", e);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: e.message }),
    };
  }
};
