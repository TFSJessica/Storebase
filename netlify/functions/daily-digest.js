// Netlify Scheduled Function: daily-digest.js
// Runs every day at 8:00 AM Pacific (16:00 UTC)
// Schedule is set in netlify.toml

const JESSICA_EMAIL = process.env.ADMIN_EMAIL;
const JESSICA_PLAYER_ID = process.env.JESSICA_PLAYER_ID; // set after Jessica enables notifications
const APP_URL = process.env.APP_URL || "https://tfsmakeithappen.netlify.app";

// FIXME (flagged, not yet resolved): this list is a hand-maintained snapshot,
// not pulled from the live Team tab roster. Any add/remove done in the app
// will NOT show up here until someone edits this array by hand. "David
// Shapiro" was a stale leftover for Richmond -- Katherine Castillo Batres is
// the real, current Richmond manager (already removed below). Ideally this
// should read from the same shared "people" storage check-overdue.js expects,
// once that sync path is confirmed.
const PEOPLE = [
  { name: "Katherine Castillo Batres", email: "jessicac.tfs@gmail.com",     store: "Richmond"   }, // TEMP: real email is KatherineC@floorstores.com -- swap back once domain is verified
  { name: "Jake Popeyus",               email: "JacobP@floorstores.com",         store: "Concord"    },
  { name: "Teza Malmirchegini",         email: "TezaM@floorstores.com",          store: "Dublin"     },
  { name: "Rose Fernandez",             email: "RoselleF@floorstores.com",       store: "S.F."       },
  { name: "Damian Fitzsimmons",         email: "DamianF@floorstores.com",        store: "Santa Rosa" },
  { name: "Xavier Marmier",            email: "XavierM@floorstores.com",        store: "Marin"      },
  { name: "Laurie DeJong",             email: "LaurieD@floorstores.com",        store: "San Carlos" },
  { name: "Diana Earley",              email: "DianaC@floorstores.com",         store: "Sunnyvale"  },
  { name: "Gabriella Trozzo",          email: "GabriellaT@floorstores.com",     store: "San Jose"   },
  { name: "Steve Boardman",            email: "SteveB@floorstores.com",         store: "Burlingame" },
  { name: "Reggie Brown",              email: "ReggieB@floorstores.com",        store: "Fairfield"  },
  { name: "Willie Jefferson",          email: "williej@floorstores.com",        store: "Concord"    },
  { name: "Carlos Amaya",              email: "CarlosA@floorstores.com",        store: "Dublin"     },
  { name: "Francine Steele",           email: "FrancineS@floorstores.com",      store: "Santa Rosa" },
  { name: "Ben Morales",               email: "BenM@floorstores.com",           store: "San Carlos" },
  { name: "Jessica Castillanos",       email: "jessicac.tfs@gmail.com",                    store: "ALL", isAdmin: true }, // TEMP: real email is ADMIN_EMAIL env var -- swap back after domain verified
];

function isOverdue(due) { return due && new Date(due) < new Date(); }
function isDueToday(due) {
  if (!due) return false;
  const d = new Date(due), n = new Date();
  return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth() && d.getDate()===n.getDate();
}
function isDueSoon(due) {
  if (!due) return false;
  const diff = new Date(due) - new Date();
  return diff > 0 && diff < 7 * 86400000;
}
function fmtDate(iso) {
  return new Date(iso).toLocaleString("en-US", { weekday:"short", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" });
}
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
}
// BUGFIX: a store with zero tasks used to score 100 (a fake perfect grade).
// Now returns null ("no data yet") so the scorecard can show it honestly
// instead of grading an empty store as an A -- same fix applied to the
// in-app leaderboard earlier today.
function calcScore(tasks) {
  if (!tasks.length) return null;
  const done = tasks.filter(t=>t.done).length;
  const ov = tasks.filter(t=>!t.done&&isOverdue(t.due)).length;
  return Math.max(0, Math.round((done/tasks.length)*100*0.7+(100-Math.min(ov*10,30))*0.3));
}
function getGrade(score) {
  if (score === null) return "–";
  if (score>=90) return "A";
  if (score>=80) return "B";
  if (score>=70) return "C";
  if (score>=60) return "D";
  return "F";
}

// "3 hours overdue" / "2 days 4h overdue" -- null for tasks that aren't
// currently overdue, OR that are already done (a completed task should
// never be tagged as overdue, even if it was finished after its due time --
// that's what the admin-only "late" tag on the Completed section is for).
function formatOverdueDuration(due, done) {
  if (!due || done) return null;
  const diffMs = new Date() - new Date(due);
  if (diffMs <= 0) return null;
  const hours = diffMs / 3600000;
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return `${h} hour${h !== 1 ? "s" : ""} overdue`;
  }
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  return `${days} day${days !== 1 ? "s" : ""}${remHours > 0 ? ` ${remHours}h` : ""} overdue`;
}

function taskRow(t, color) {
  const overdueDuration = formatOverdueDuration(t.due, t.done);
  return `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin-top:5px;"></div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:3px;">${t.title}</div>
            <div style="font-size:12px;color:#888;">
              Store: ${t.storeName || "No store"}
              ${t.due ? ` &nbsp;·&nbsp; Due: ${fmtDate(t.due)}` : ""}
              ${overdueDuration ? ` &nbsp;·&nbsp; <span style="color:#dc2626;font-weight:700;">${overdueDuration}</span>` : ""}
              ${t.priority === "high" ? " &nbsp;·&nbsp; HIGH PRIORITY" : ""}
            </div>
          </div>
        </div>
      </td>
    </tr>`;
}

// "3 hours late" / "2 days late" -- null if it was completed on time or early.
function formatLateness(due, completedAt) {
  if (!due || !completedAt) return null;
  const diffMs = new Date(completedAt) - new Date(due);
  if (diffMs <= 0) return null;
  const hours = diffMs / 3600000;
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return `${h} hour${h !== 1 ? "s" : ""} late`;
  }
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  return `${days} day${days !== 1 ? "s" : ""}${remHours > 0 ? ` ${remHours}h` : ""} late`;
}

// Admin-only completed-task row: shows exactly when it was marked done, and
// flags how late it was if it slipped past its due date/time. Regular
// non-admin digests keep using the plain taskRow above, unchanged.
function completedTaskRow(t, color) {
  const lateness = formatLateness(t.due, t.completedAt);
  return `
    <tr>
      <td style="padding:10px 16px;border-bottom:1px solid #f0ede8;">
        <div style="display:flex;align-items:flex-start;gap:10px;">
          <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin-top:5px;"></div>
          <div style="flex:1;">
            <div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:3px;">${t.title}</div>
            <div style="font-size:12px;color:#888;">
              Store: ${t.storeName || "No store"}
              ${t.completedAt ? ` &nbsp;·&nbsp; Completed: ${fmtDate(t.completedAt)}` : ""}
              ${t.completedBy ? ` &nbsp;·&nbsp; by ${t.completedBy}` : ""}
              ${lateness ? ` &nbsp;·&nbsp; <span style="color:#dc2626;font-weight:700;">${lateness}</span>` : ""}
            </div>
          </div>
        </div>
      </td>
    </tr>`;
}

function section(emoji, title, color, items, rowFn = taskRow) {
  if (!items.length) return "";
  return `
    <tr><td style="padding:18px 16px 8px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${color};">${emoji} ${title} (${items.length})</div>
    </td></tr>
    ${items.map(t => rowFn(t, color)).join("")}`;
}

function storeSummaryTable(allTasks) {
  const stores = ["Richmond","Concord","Dublin","S.F.","Santa Rosa","Marin","San Carlos","Sunnyvale","San Jose","SAH","Burlingame","Fairfield"];
  const rows = stores.map(store => {
    const st = allTasks.filter(t=>t.storeName===store);
    const open = st.filter(t=>!t.done).length;
    const ov = st.filter(t=>!t.done&&isOverdue(t.due)).length;
    const score = calcScore(st);
    const grade = getGrade(score);
    const gradeLabel = score === null ? "No tasks yet" : `${grade} (${score})`;
    return `
      <tr style="border-bottom:1px solid #f0ede8;">
        <td style="padding:10px 16px;font-size:13px;font-weight:600;color:#1a1a1a;">${store}</td>
        <td style="padding:10px 8px;font-size:13px;color:#555;text-align:center;">${open}</td>
        <td style="padding:10px 8px;font-size:13px;color:${ov>0?"#dc2626":"#16a34a"};font-weight:${ov>0?700:400};text-align:center;">${ov>0?"! "+ov:"OK"}</td>
        <td style="padding:10px 8px;text-align:center;">
          <span style="background:${score===null?"#f0ede8":score>=90?"#dcfce7":score>=80?"#fef9c3":"#fee2e2"};color:${score===null?"#aaa":score>=90?"#16a34a":score>=80?"#ca8a04":"#dc2626"};border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700;">${gradeLabel}</span>
        </td>
      </tr>`;
  }).join("");

  return `
    <tr><td style="padding:18px 16px 8px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#aaa;">All Stores Scorecard</div>
    </td></tr>
    <tr><td style="padding:0 16px 16px;">
      <table style="width:100%;border-collapse:collapse;background:#f9f7f4;border-radius:8px;overflow:hidden;">
        <tr style="background:#f0ede8;">
          <th style="padding:8px 16px;text-align:left;font-size:11px;color:#aaa;font-weight:600;">STORE</th>
          <th style="padding:8px 8px;text-align:center;font-size:11px;color:#aaa;font-weight:600;">OPEN</th>
          <th style="padding:8px 8px;text-align:center;font-size:11px;color:#aaa;font-weight:600;">OVERDUE</th>
          <th style="padding:8px 8px;text-align:center;font-size:11px;color:#aaa;font-weight:600;">GRADE</th>
        </tr>
        ${rows}
      </table>
    </td></tr>`;
}

// Shared by buildEmail() and the send loop -- one source of truth for
// whether a person has anything worth reporting today.
function getDigestBreakdown(person, tasks) {
  const myTasks = person.isAdmin ? tasks : tasks.filter(t => t.assigneeName === person.name || t.storeName === person.store);
  const overdue  = myTasks.filter(t => !t.done && isOverdue(t.due));
  const today    = myTasks.filter(t => !t.done && isDueToday(t.due) && !isOverdue(t.due));
  const upcoming = myTasks.filter(t => !t.done && isDueSoon(t.due) && !isDueToday(t.due));
  const doneYest = myTasks.filter(t => {
    if (!t.done || !t.completedAt) return false;
    return new Date() - new Date(t.completedAt) < 86400000;
  });
  const hasContent = overdue.length + today.length + upcoming.length + doneYest.length > 0;
  return { myTasks, overdue, today, upcoming, doneYest, hasContent };
}

function buildEmail(person, tasks) {
  const { overdue, today, upcoming, doneYest, hasContent } = getDigestBreakdown(person, tasks);
  const todayStr = fmtDay(new Date().toISOString());
  const storeSection = person.isAdmin ? storeSummaryTable(tasks) : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0ea;font-family:Helvetica Neue,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#1a1a1a;border-radius:16px 16px 0 0;padding:28px 24px;text-align:center;">
      <div style="font-size:10px;letter-spacing:.3em;color:#666;text-transform:uppercase;margin-bottom:4px;">YOUR BAY AREA FLOORING AUTHORITY</div>
      <div style="font-size:32px;font-weight:800;color:#fff;letter-spacing:.05em;line-height:1;">THE FLOOR STORE</div>
      <div style="font-size:13px;color:#888;margin-top:8px;">Daily Digest - ${todayStr}</div>
    </div>

    <div style="background:#fff;padding:20px 24px;border-left:4px solid #1a1a1a;">
      <div style="font-size:18px;font-weight:600;color:#1a1a1a;">Good morning, ${person.name.split(" ")[0]}!</div>
      <div style="font-size:13px;color:#888;margin-top:4px;">
        ${person.isAdmin
          ? `Full company overview - ${tasks.filter(t=>!t.done).length} open tasks across all stores.`
          : hasContent
            ? `Here is what needs your attention today at ${person.store}.`
            : `All caught up at ${person.store}! No open tasks today.`
        }
      </div>
    </div>

    ${hasContent ? `
    <div style="background:#fff;">
      <table style="width:100%;border-collapse:collapse;">
        ${section("!", "Overdue - Action Required", "#dc2626", overdue)}
        ${section("Today", "Due Today", "#d97706", today)}
        ${section("Soon", "Coming Up This Week", "#3b82f6", upcoming)}
        ${section("Done", "Completed Yesterday", "#16a34a", doneYest, person.isAdmin ? completedTaskRow : taskRow)}
        ${storeSection}
      </table>
    </div>` : storeSection ? `<div style="background:#fff;"><table style="width:100%;border-collapse:collapse;">${storeSection}</table></div>` : ""}

    <div style="background:#1a1a1a;border-radius:0 0 16px 16px;padding:16px 24px;text-align:center;">
      <a href="${APP_URL}" style="display:inline-block;background:#fff;color:#1a1a1a;text-decoration:none;font-weight:700;font-size:13px;padding:10px 24px;border-radius:8px;margin-bottom:12px;">Open The Floor Store App</a>
      <div style="font-size:11px;color:#555;">The Floor Store - Bay Area - Daily digest at 8:00 AM</div>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "The Floor Store <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

const handler = async () => {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return { statusCode: 500, body: "Missing RESEND_API_KEY" };

  // Load tasks from Netlify Blobs
  let tasks = [];
  try {
    const { getStore } = require("@netlify/blobs");
    const store = getStore({
      name: "floorstore",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });
    const raw = await store.get("todos");
    if (raw) tasks = JSON.parse(raw);
  } catch(e) {
    console.log("No tasks in blob store yet");
  }

  const today = new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" });
  const results = [];

  for (const person of PEOPLE) {
    if (!person.email) continue;

    const { overdue, today: todayList, hasContent } = getDigestBreakdown(person, tasks);

    // Skip the send entirely for non-admins with nothing to report --
    // previously this still sent a near-empty "All caught up!" email.
    // Jessica still always gets hers since it includes the full company
    // scorecard regardless of her own personal task count.
    if (!person.isAdmin && !hasContent) {
      console.log(`Skipped digest for ${person.name} -- nothing to report`);
      results.push({ name: person.name, sent: false, skipped: true });
      continue;
    }

    // Build subject line
    const subject = overdue.length > 0
      ? `! ${overdue.length} overdue task${overdue.length>1?"s":""} - Floor Store Daily Digest`
      : todayList.length > 0
        ? `${todayList.length} task${todayList.length>1?"s":""} due today - Floor Store Daily Digest`
        : `Floor Store Daily Digest - ${today}`;

    const html = buildEmail(person, tasks);
    const sent = await sendEmail(person.email, subject, html);
    results.push({ name: person.name, sent });
    console.log(`${sent ? "Sent" : "Failed"} digest to ${person.name}`);
  }

  return { statusCode: 200, body: JSON.stringify({ results }) };
};

exports.handler = handler;
