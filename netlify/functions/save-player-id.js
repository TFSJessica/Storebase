// netlify/functions/save-player-id.js
// Called by the app the moment someone enables push notifications.
// Stores their playerId in a shared Netlify Blob so every device/admin
// can see who is subscribed, not just the device that subscribed.

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

  const { personId, playerId, name } = body;
  if (!personId || !playerId) {
    return { statusCode: 400, body: "Missing personId or playerId" };
  }

  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({
      name: "floorstore",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });

    // Read the current map of personId -> playerId
    let map = {};
    const raw = await store.get("playerIds");
    if (raw) {
      try { map = JSON.parse(raw); } catch (e) { map = {}; }
    }

    map[personId] = { playerId, name: name || "", updatedAt: new Date().toISOString() };

    await store.set("playerIds", JSON.stringify(map));

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    console.error("save-player-id failed:", e);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: e.message }),
    };
  }
};
