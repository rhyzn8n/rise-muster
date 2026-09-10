import admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Socmed Tracker lives in a SEPARATE Firebase project from KAKAW, so a
// KAKAW-signed-in user's ID token means nothing to Socmed's own Firestore
// rules — a normal client-side query can't reach it. This bridge uses the
// exact same pattern Socmed Tracker's own check-v1-status.js already uses
// to reach INTO KAKAW, just running the opposite direction: firebase-admin
// with a base64-encoded service account, which bypasses Firestore rules
// entirely (server-to-server, not subject to browser auth).
//
// All of Socmed Tracker's real data lives as a handful of whole-document
// JSON blobs under one collection: riseSocMedData/{requests, channelStats,
// extraServices, events, ...} — confirmed against its real App.jsx (it
// loads everything into React state on load, then writes each doc back as
// a whole blob on change). There's no per-record querying possible in the
// source app either, so fetching these few docs and computing summaries
// server-side here mirrors exactly how Socmed Tracker itself works.
//
// ALL_SERVICES is hardcoded here because it's a code constant in Socmed
// Tracker's own App.jsx, not stored in Firestore — copied verbatim from
// source so Service Coverage's "total tracked" fallback matches exactly.
// ---------------------------------------------------------------------------

const MAJOR_SERVICES = [
  "NCLEX Australia", "NCLEX Canada", "NCLEX USA", "Middle East Exam",
  "Ireland (NMBI)", "UKNMC Nursing", "UKNMC Midwifery", "IPASS Online Review",
  "IPASS PNLE", "Visascreen", "VisaKey",
];
const MINOR_SERVICES = [
  "New Mexico", "NAI PH", "Australia Tourist Visa", "License Endorsement",
  "OPRA", "Australia Midwifery", "ASCPi", "US License Renewal",
  "Australia License Renewal", "Truemerit", "CPD", "CVS NZ/NCNZ", "Hopkins",
  "MedTec Middle East", "RadTech Middle East", "MET", "NNAS", "PRC",
  "Score Transfer", "UWORLD", "WES",
];
const ALL_SERVICES = [...MAJOR_SERVICES, ...MINOR_SERVICES];

let db;
function getSocmedDb() {
  if (!admin.apps.length) {
    const raw = process.env.SOCMED_FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error("SOCMED_FIREBASE_SERVICE_ACCOUNT is not set");
    let creds;
    try {
      const decoded = Buffer.from(raw, "base64").toString("utf-8");
      creds = JSON.parse(decoded);
    } catch (e) {
      throw new Error(
        "SOCMED_FIREBASE_SERVICE_ACCOUNT could not be decoded — make sure it's the base64-encoded version of the service account JSON"
      );
    }
    admin.initializeApp({ credential: admin.credential.cert(creds) }, "socmed");
  }
  if (!db) db = admin.app("socmed").firestore();
  return db;
}

function eventRating(ev) {
  if (!ev.registrations || !ev.attendance) return null;
  return (ev.attendance / ev.registrations) * 100;
}

function shiftMonthKey(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function handler(req, res) {
  const { start, end } = req.query;
  if (!start || !end) {
    return res.status(400).json({ error: "Missing start/end query params (YYYY-MM-DD)" });
  }

  try {
    const db = getSocmedDb();
    const coll = db.collection("riseSocMedData");

    const [requestsDoc, channelStatsDoc, extraServicesDoc, eventsDoc] = await Promise.all([
      coll.doc("requests").get(),
      coll.doc("channelStats").get(),
      coll.doc("extraServices").get(),
      coll.doc("events").get(),
    ]);

    const requests = requestsDoc.exists ? requestsDoc.data().value || [] : [];
    const channelStats = channelStatsDoc.exists ? channelStatsDoc.data().value || {} : {};
    const extraServices = extraServicesDoc.exists ? extraServicesDoc.data().value || {} : {};
    const events = eventsDoc.exists ? eventsDoc.data().value || [] : [];

    // --- Request vs. Completion ---
    // Same exclusion as the source app: origin !== "scheduler", dateLogged
    // within range.
    const requestsInRange = requests.filter(
      (r) => r.origin !== "scheduler" && r.dateLogged >= start && r.dateLogged <= end
    );
    const completedCount = requestsInRange.filter((r) => r.status === "Completed").length;
    const totalRequests = requestsInRange.length;
    const completionRate = totalRequests ? Math.round((completedCount / totalRequests) * 100) : null;

    // --- Service Coverage ---
    // A service counts as covered only if something for it was actually
    // POSTED (via Scheduler) within range — matches the source exactly.
    const trackedServices = (
      extraServices.coverageTracked?.length ? extraServices.coverageTracked : ALL_SERVICES
    ).filter((s) => ALL_SERVICES.includes(s));
    const postedInRange = requests.filter(
      (r) => r.scheduledDate && r.scheduledDate >= start && r.scheduledDate <= end && r.postStatus === "Posted"
    );
    const coveredSet = new Set();
    postedInRange.forEach((r) => (r.services || []).forEach((s) => {
      if (trackedServices.includes(s)) coveredSet.add(s);
    }));
    const serviceCoverage = { covered: coveredSet.size, total: trackedServices.length };

    // --- Channel Growth ---
    // Anchored on whatever month is actually the MOST RECENTLY LOGGED across
    // all channels — not on today's calendar month. Channel stats are
    // logged manually, in batches, often near month-end, so "today's
    // month" frequently has zero entries yet even mid-month. Anchoring on
    // calendar-today produced a false "-100% growth" the first time this
    // ran (0 current vs. a real previous total looks like total collapse,
    // when it actually just meant "nobody's logged this month yet").
    // This mirrors the same "always shows latest logged stats" philosophy
    // the source app's own Channel Snapshot section already uses.
    const allLoggedMonths = new Set()
    Object.values(channelStats).forEach((rows) => {
      ;(rows || []).forEach((r) => { if (r.month) allLoggedMonths.add(r.month) })
    })
    const sortedMonths = [...allLoggedMonths].sort()
    const currentMonthKey = sortedMonths.length ? sortedMonths[sortedMonths.length - 1] : null
    const previousMonthKey = currentMonthKey ? shiftMonthKey(currentMonthKey, -1) : null

    let currentTotal = 0
    let previousTotal = 0
    let channelsWithCurrentData = 0
    if (currentMonthKey) {
      Object.values(channelStats).forEach((rows) => {
        const currentRow = (rows || []).find((r) => r.month === currentMonthKey)
        const previousRow = (rows || []).find((r) => r.month === previousMonthKey)
        if (currentRow) {
          currentTotal += Number(currentRow.followers) || 0
          channelsWithCurrentData += 1
        }
        if (previousRow) previousTotal += Number(previousRow.followers) || 0
      })
    }
    const channelGrowth = {
      currentMonthKey,
      previousMonthKey,
      currentTotal,
      previousTotal,
      growthPct: currentMonthKey && previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : null,
      channelsWithCurrentData,
    }

    // --- Events ---
    const eventsInRange = events.filter((e) => e.eventDate >= start && e.eventDate <= end);
    const rated = eventsInRange.map(eventRating).filter((r) => r !== null);
    const avgAttendanceRating = rated.length ? rated.reduce((s, r) => s + r, 0) / rated.length : null;
    const topEvent = [...eventsInRange]
      .map((e) => ({ ...e, rating: eventRating(e) }))
      .filter((e) => e.rating !== null)
      .sort((a, b) => b.rating - a.rating)[0] || null;

    return res.status(200).json({
      requestCompletion: { totalRequests, completedCount, completionRate },
      serviceCoverage,
      channelGrowth,
      events: {
        countInRange: eventsInRange.length,
        avgAttendanceRating,
        mostSuccessfulEvent: topEvent ? { title: topEvent.title, rating: topEvent.rating } : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Socmed summary fetch failed", detail: String(err) });
  }
}
