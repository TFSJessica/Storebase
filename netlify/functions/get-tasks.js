// netlify/functions/get-tasks.js
// Returns the shared task list so every device shows the same data --
// whoever opens the app sees tasks that were added or changed on any
// other device, not just their own local copy.

exports.handler = async () => {
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({
      name: "floorstore",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });

    const raw = await store.get("todos");
    const todos = raw ? JSON.parse(raw) : [];

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, todos }),
    };
  } catch (e) {
    console.error("get-tasks failed:", e);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: e.message, todos: [] }),
    };
  }
};
