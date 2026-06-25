// netlify/functions/get-player-ids.js
// Returns the shared map of personId -> { playerId, name, updatedAt }
// so any device (e.g. Jessica's phone) can know who has push enabled,
// even if they enabled it on a completely different device.

exports.handler = async () => {
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore("floorstore");

    const raw = await store.get("playerIds");
    const map = raw ? JSON.parse(raw) : {};

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true, playerIds: map }),
    };
  } catch (e) {
    console.error("get-player-ids failed:", e);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: e.message, playerIds: {} }),
    };
  }
};
