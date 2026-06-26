// Netlify Function: notify.js
// Handles instant push notifications via OneSignal
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };
  const { type, playerIds, title, message, url } = JSON.parse(event.body || "{}");
  if (!playerIds || !playerIds.length || !message) {
    return { statusCode: 400, body: "Missing required fields" };
  }

  // Delivery priority + iOS interruption level scale with urgency.
  // type is "overdue" (existing reminder pushes) or the task's own
  // priority -- "normal" | "medium" | "high" -- set by the app when a
  // task is assigned.
  let priority = 5;
  let iosInterruptionLevel; // omitted unless we want to override the default ("active")
  if (type === "overdue" || type === "high") {
    priority = 10;
    iosInterruptionLevel = "time-sensitive"; // breaks through Focus modes, shown with a more urgent banner on iOS 15+
  } else if (type === "medium") {
    priority = 7;
  }

  const payload = {
    app_id: process.env.ONESIGNAL_APP_ID,
    target_channel: "push",
    include_subscription_ids: playerIds,
    headings: { en: title || "The Floor Store" },
    contents: { en: message },
    url: url || process.env.APP_URL || "https://tfsmakeithappen.netlify.app",
    chrome_web_icon: "https://tfsmakeithappen.netlify.app/icon-192.png",
    priority,
    ...(iosInterruptionLevel ? { ios_interruption_level: iosInterruptionLevel } : {}),
  };
  const res = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${process.env.ONESIGNAL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return {
    statusCode: res.ok ? 200 : 500,
    headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ success: res.ok, data }),
  };
};
