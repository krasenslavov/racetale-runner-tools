/**
 * The maths behind the blog's runner tools (pace, predictor, pace chart, heart rate zones, spectator
 * planner, route trimmer). Pure functions with no imports, so the same file is tested here and
 * compiled for the browser by `npm run blog:build` (served at /tools/run-tools.js). Distances are in
 * kilometres and times in seconds inside; units only matter when showing results.
 */

export const KM_PER_MILE = 1.609344;

export type Unit = "km" | "mi";

/** Common race distances, in km. */
export const DISTANCES = [
  { id: "5k", label: "5K", km: 5 },
  { id: "10k", label: "10K", km: 10 },
  { id: "15k", label: "15K", km: 15 },
  { id: "10mi", label: "10 miles", km: 10 * KM_PER_MILE },
  { id: "half", label: "Half marathon", km: 21.0975 },
  { id: "30k", label: "30K", km: 30 },
  { id: "marathon", label: "Marathon", km: 42.195 },
  { id: "50k", label: "50K", km: 50 },
] as const;

export const toKm = (value: number, unit: Unit): number =>
  unit === "mi" ? value * KM_PER_MILE : value;

export const fromKm = (km: number, unit: Unit): number => (unit === "mi" ? km / KM_PER_MILE : km);

/** 3725 -> "1:02:05"; 312 -> "5:12". Rounds to the whole second. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}

/** Hours, minutes and seconds fields to seconds. Blank or invalid fields count as 0. */
export function toSeconds(h: number, m: number, s: number): number {
  const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  return n(h) * 3600 + n(m) * 60 + n(s);
}

/** Seconds per kilometre for a distance and a time. */
export const paceFromTime = (seconds: number, km: number): number => seconds / km;

export const timeFromPace = (secondsPerKm: number, km: number): number => secondsPerKm * km;

export const distanceFromPace = (seconds: number, secondsPerKm: number): number =>
  seconds / secondsPerKm;

/** A pace given per kilometre, shown per `unit`. */
export const paceInUnit = (secondsPerKm: number, unit: Unit): number =>
  unit === "mi" ? secondsPerKm * KM_PER_MILE : secondsPerKm;

/** Speed in km/h (or mph) for a pace in seconds per kilometre. */
export const speed = (secondsPerKm: number, unit: Unit): number =>
  3600 / paceInUnit(secondsPerKm, unit);

/**
 * Riegel's formula: T2 = T1 x (D2 / D1) ^ 1.06. A well-known estimate for a runner who has trained
 * for the longer distance; it runs optimistic for a first marathon.
 */
export function riegel(
  seconds: number,
  fromKmDistance: number,
  toKmDistance: number,
  exponent = 1.06,
) {
  return seconds * Math.pow(toKmDistance / fromKmDistance, exponent);
}

/**
 * Share of the total time spent by the time a runner has covered the fraction `x` (0 to 1) of the
 * distance. `skew` 0 is an even pace. A positive skew starts slower and finishes faster (a negative
 * split); a negative skew starts faster and slows down. The pace factor at x is 1 + skew x (1 - 2x),
 * which averages 1, so the curve always ends at exactly 1.
 */
export function timeShare(x: number, skew: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c + skew * (c - c * c);
}

export type SplitRow = {
  /** The marker, in `unit`: 1, 2, 3 ... and the exact finish distance for the last row. */
  mark: number;
  /** Length of this split, in `unit` (1, or less for the last part). */
  length: number;
  splitSeconds: number;
  cumulativeSeconds: number;
  /** Average pace over this split, in seconds per `unit`. */
  paceSeconds: number;
};

/** A split table for a goal time: one row per km or mile, plus a short last row when needed. */
export function splitPlan(options: {
  distanceKm: number;
  goalSeconds: number;
  unit: Unit;
  skew?: number;
}): SplitRow[] {
  const { distanceKm, goalSeconds, unit, skew = 0 } = options;
  const total = fromKm(distanceKm, unit);
  const rows: SplitRow[] = [];
  let start = 0;
  let previous = 0;
  while (start < total - 1e-9) {
    const end = Math.min(start + 1, total);
    const cumulative = goalSeconds * timeShare(end / total, skew);
    const length = end - start;
    const splitSeconds = cumulative - previous;
    rows.push({
      mark: Math.round(end * 1000) / 1000,
      length: Math.round(length * 1000) / 1000,
      splitSeconds,
      cumulativeSeconds: cumulative,
      paceSeconds: splitSeconds / length,
    });
    previous = cumulative;
    start = end;
  }
  return rows;
}

/** Seconds from the start of the run to the point `km` along a course. */
export const secondsAtDistance = (
  km: number,
  distanceKm: number,
  goalSeconds: number,
  skew = 0,
): number => goalSeconds * timeShare(km / distanceKm, skew);

export type PassingTime = {
  km: number;
  /** Minutes since midnight on the race day, when the runner is expected (can pass 1440). */
  passMinutes: number;
  /** When to be there: the pass time minus the margin. */
  arriveMinutes: number;
};

/**
 * When a runner reaches each spot where a spectator stands. `startMinutes` is the race start as
 * minutes since midnight, `delayMinutes` the time the runner takes to reach the start line.
 */
export function passingTimes(options: {
  spotsKm: number[];
  distanceKm: number;
  goalSeconds: number;
  startMinutes: number;
  delayMinutes: number;
  marginMinutes: number;
  skew?: number;
}): PassingTime[] {
  const { spotsKm, distanceKm, goalSeconds, startMinutes, delayMinutes, marginMinutes, skew } =
    options;
  return spotsKm
    .filter((km) => km > 0 && km <= distanceKm)
    .sort((a, b) => a - b)
    .map((km) => {
      const pass =
        startMinutes + delayMinutes + secondsAtDistance(km, distanceKm, goalSeconds, skew) / 60;
      return { km, passMinutes: pass, arriveMinutes: pass - marginMinutes };
    });
}

/** A clock time such as "9:42 am" or "14:05" from minutes since midnight, with a day offset note. */
export function formatClock(minutes: number, hour12 = false): { text: string; dayShift: number } {
  const whole = Math.round(minutes);
  const dayShift = Math.floor(whole / 1440);
  const inDay = ((whole % 1440) + 1440) % 1440;
  const h = Math.floor(inDay / 60);
  const m = inDay % 60;
  const mm = String(m).padStart(2, "0");
  if (!hour12) return { text: `${String(h).padStart(2, "0")}:${mm}`, dayShift };
  const suffix = h < 12 ? "am" : "pm";
  return { text: `${h % 12 === 0 ? 12 : h % 12}:${mm} ${suffix}`, dayShift };
}

/** Spots typed as "10, 21.1 and 32" to numbers; anything that is not a positive number is dropped. */
export function parseSpots(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map((part) => Number(part.replace(",", ".")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** A common estimate of maximum heart rate from age (Tanaka: 208 - 0.7 x age). Individuals vary a lot. */
export const estimateMaxHr = (age: number): number => Math.round(208 - 0.7 * age);

export type HrZone = {
  zone: number;
  name: string;
  fromPercent: number;
  toPercent: number;
  fromBpm: number;
  toBpm: number;
};

const ZONE_BANDS = [
  { name: "Very easy", from: 50, to: 60 },
  { name: "Easy", from: 60, to: 70 },
  { name: "Steady", from: 70, to: 80 },
  { name: "Hard", from: 80, to: 90 },
  { name: "Maximum", from: 90, to: 100 },
] as const;

/**
 * Five heart rate zones. With a resting heart rate the bands use the heart rate reserve (Karvonen:
 * rest + percent x (max - rest)); without one they are plain percentages of the maximum.
 */
export function hrZones(maxHr: number, restingHr?: number): HrZone[] {
  const useReserve = restingHr !== undefined && restingHr > 0 && restingHr < maxHr;
  const at = (percent: number) =>
    Math.round(
      useReserve ? restingHr + (percent / 100) * (maxHr - restingHr) : (percent / 100) * maxHr,
    );
  return ZONE_BANDS.map((band, i) => ({
    zone: i + 1,
    name: band.name,
    fromPercent: band.from,
    toPercent: band.to,
    fromBpm: at(band.from),
    toBpm: at(band.to),
  }));
}

export type LatLon = { lat: number; lon: number };

/** Distance in metres between two coordinates (haversine). */
export function distanceMeters(a: LatLon, b: LatLon): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Length of a track in metres. */
export function trackLength(points: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1]!, points[i]!);
  return total;
}

/**
 * The points to keep when hiding the first and last `meters` of a track: indices `from` to `to`,
 * inclusive. Returns null when the track is too short to keep anything after trimming both ends.
 */
export function trimRange(points: LatLon[], meters: number): { from: number; to: number } | null {
  if (points.length < 2 || !(meters >= 0)) return null;
  const along: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(along[i - 1]! + distanceMeters(points[i - 1]!, points[i]!));
  }
  const total = along[along.length - 1]!;
  if (total <= meters * 2) return null;
  let from = along.findIndex((d) => d >= meters);
  let to = -1;
  for (let i = along.length - 1; i >= 0; i--) {
    if (along[i]! <= total - meters) {
      to = i;
      break;
    }
  }
  if (from < 0) from = 0;
  if (to < from + 1) return null;
  return { from, to };
}
