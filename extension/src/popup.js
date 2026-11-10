// RaceTale Pace Tools: pop-up logic. The maths is src/lib/run-tools.ts (bundled in by
// scripts/build-extension.mjs). No network calls, no analytics; the only thing stored is the unit.
import {
  DISTANCES,
  distanceFromPace,
  formatClock,
  formatDuration,
  fromKm,
  paceFromTime,
  paceInUnit,
  parseSpots,
  passingTimes,
  riegel,
  speed,
  timeFromPace,
  toKm,
  toSeconds,
} from "../../packages/pace/src/index.ts";

const $ = (id) => document.getElementById(id);
const num = (id) => {
  const v = $(id).value.trim();
  return v === "" ? null : Number(v);
};
let unit = "km";

const el = (tag, text, cls) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (cls) node.className = cls;
  return node;
};
const show = (out, ...nodes) => out.replaceChildren(...nodes);
const err = (out, text) => show(out, el("p", text, "err"));
const table = (head, rows) => {
  const t = el("table");
  const h = el("tr");
  for (const c of head) h.append(el("th", c));
  t.append(h);
  for (const r of rows) {
    const tr = el("tr");
    for (const c of r) tr.append(el("td", c));
    t.append(tr);
  }
  return t;
};
const timeInput = (prefix) => {
  const h = num(`${prefix}-h`);
  const m = num(`${prefix}-m`);
  const s = num(`${prefix}-s`);
  if (h === null && m === null && s === null) return null;
  return toSeconds(h ?? 0, m ?? 0, s ?? 0);
};
const paceLabel = (secondsPerKm) => `${formatDuration(paceInUnit(secondsPerKm, unit))} /${unit}`;

// Distance dropdowns: a preset fills the box, typing in the box switches the preset to Custom.
function wireDistance(presetId, inputId) {
  const select = $(presetId);
  select.append(new Option("Custom", ""));
  for (const d of DISTANCES) select.append(new Option(d.label, String(d.km)));
  select.addEventListener("change", () => {
    if (select.value)
      $(inputId).value = String(Math.round(fromKm(Number(select.value), unit) * 1000) / 1000);
  });
  $(inputId).addEventListener("input", () => (select.value = ""));
}
const syncPresets = () => {
  for (const [p, i] of [
    ["pace-preset", "pace-distance"],
    ["pr-preset", "pr-distance"],
    ["sp-preset", "sp-distance"],
  ])
    if ($(p).value) $(i).value = String(Math.round(fromKm(Number($(p).value), unit) * 1000) / 1000);
};
for (const [p, i] of [
  ["pace-preset", "pace-distance"],
  ["pr-preset", "pr-distance"],
  ["sp-preset", "sp-distance"],
])
  wireDistance(p, i);

// Tabs.
const tabs = [...document.querySelectorAll('[role="tab"]')];
for (const tab of tabs)
  tab.addEventListener("click", () => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      $(t.getAttribute("aria-controls")).hidden = !on;
    }
  });

// Units (the one thing we remember).
const setUnit = (value) => {
  unit = value === "mi" ? "mi" : "km";
  for (const r of document.querySelectorAll('input[name="unit"]')) r.checked = r.value === unit;
  for (const n of document.querySelectorAll("[data-unit]")) n.textContent = unit;
  syncPresets();
};
for (const r of document.querySelectorAll('input[name="unit"]'))
  r.addEventListener("change", () => {
    setUnit(r.value);
    try {
      chrome.storage?.local.set({ unit });
    } catch {
      /* storage is optional */
    }
  });
try {
  chrome.storage?.local.get("unit", (v) => v && v.unit && setUnit(v.unit));
} catch {
  /* storage is optional */
}

// Pace tab: whichever of distance, time and pace is empty is worked out.
$("pace-go").addEventListener("click", () => {
  const out = $("pace-out");
  const d = num("pace-distance");
  const t = timeInput("pace");
  const pm = num("pace-pm");
  const ps = num("pace-ps");
  const hasPace = pm !== null || ps !== null;
  const paceSec = hasPace ? (pm ?? 0) * 60 + (ps ?? 0) : null;
  const known = [d !== null && d > 0, t !== null && t > 0, paceSec !== null && paceSec > 0].filter(
    Boolean,
  ).length;
  if (known !== 2) return err(out, "Fill in exactly two of distance, time and pace.");
  const perKm = (secondsPerUnit) => secondsPerUnit / toKm(1, unit);
  if (d && t) {
    const km = toKm(d, unit);
    const p = paceFromTime(t, km);
    show(
      out,
      el("p", paceLabel(p), "big"),
      el("p", `${speed(p, unit).toFixed(2)} ${unit === "km" ? "km/h" : "mph"}`),
    );
  } else if (d && paceSec) {
    const km = toKm(d, unit);
    show(
      out,
      el("p", formatDuration(timeFromPace(perKm(paceSec), km)), "big"),
      el("p", "finish time"),
    );
  } else if (t && paceSec) {
    const km = distanceFromPace(t, perKm(paceSec));
    show(
      out,
      el("p", `${(Math.round(fromKm(km, unit) * 100) / 100).toString()} ${unit}`, "big"),
      el("p", "distance"),
    );
  }
});

// Predict tab.
$("pr-go").addEventListener("click", () => {
  const out = $("pr-out");
  const d = num("pr-distance");
  const t = timeInput("pr");
  if (!d || d <= 0 || !t || t <= 0) return err(out, "Enter a distance and a time.");
  const km = toKm(d, unit);
  const rows = DISTANCES.map((x) => {
    const secs = riegel(t, km, x.km);
    return [x.label, formatDuration(secs), paceLabel(paceFromTime(secs, x.km))];
  });
  show(
    out,
    table(["Distance", "Time", "Pace"], rows),
    el("p", "An estimate. It runs optimistic for a first marathon.", "hint"),
  );
});

// Spectator tab.
$("sp-go").addEventListener("click", () => {
  const out = $("sp-out");
  const d = num("sp-distance");
  const goal = timeInput("sp");
  const start = $("sp-start").value;
  const spots = parseSpots($("sp-spots").value).map((s) => toKm(s, unit));
  if (!d || d <= 0 || !goal || goal <= 0 || !start)
    return err(out, "Enter a distance, a goal time and a start time.");
  if (!spots.length) return err(out, "Enter at least one spot.");
  const [hh, mm] = start.split(":").map(Number);
  const rows = passingTimes({
    spotsKm: spots,
    distanceKm: toKm(d, unit),
    goalSeconds: goal,
    startMinutes: hh * 60 + mm,
    delayMinutes: 0,
    marginMinutes: num("sp-margin") ?? 10,
  }).map((r) => [
    `${Math.round(fromKm(r.km, unit) * 100) / 100} ${unit}`,
    formatClock(r.passMinutes).text,
    formatClock(r.arriveMinutes).text,
  ]);
  if (!rows.length) return err(out, "Every spot is outside the race distance.");
  show(
    out,
    table(["Spot", "Runner passes", "Arrive by"], rows),
    el("p", "For an even pace on a perfect course.", "hint"),
  );
});
