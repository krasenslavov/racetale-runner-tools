# racetale-pace

Running maths with no dependencies, in TypeScript. The same code runs the free
[runner tools](https://blog.racetale.com/tools/) on the RaceTale blog: pace, finish time, race predictions,
split plans, heart rate zones, spectator passing times and GPX start/finish trimming.

- No dependencies, about 6 kB packed, tree-shakeable, ESM and CommonJS, types included.
- Pure functions. Nothing is sent anywhere and nothing is stored.
- Distances are kilometres and times are seconds inside; units only matter when you show a result.

```sh
npm install racetale-pace
```

## Examples

```ts
import { formatDuration, paceFromTime, riegel, splitPlan, hrZones, toSeconds } from "racetale-pace";

// Pace needed for a 3:45 marathon, in seconds per km
const pace = paceFromTime(toSeconds(3, 45, 0), 42.195);
formatDuration(pace); // "5:20"

// A 25:00 5K, predicted for the marathon (Riegel, exponent 1.06)
formatDuration(riegel(25 * 60, 5, 42.195)); // "3:59:47"

// Split table for a 25:00 5K, one row per km
splitPlan({ distanceKm: 5, goalSeconds: 1500, unit: "km" })[0];
// { mark: 1, length: 1, splitSeconds: 300, cumulativeSeconds: 300, paceSeconds: 300 }

// Five heart rate zones from a max heart rate of 185
hrZones(185)[0];
// { zone: 1, name: "Very easy", fromPercent: 50, toPercent: 60, fromBpm: 93, toBpm: 111 }
```

When will a runner pass a spot? A 4:00 marathon starting at 09:00, a spectator at km 10 and km 30:

```ts
import { passingTimes } from "racetale-pace";

passingTimes({
  spotsKm: [10, 30],
  distanceKm: 42.195,
  goalSeconds: 4 * 3600,
  startMinutes: 9 * 60, // race start, minutes since midnight
  delayMinutes: 0, // time to reach the start line
  marginMinutes: 10, // arrive this much earlier
});
// [{ km: 10, passMinutes: 596.9, arriveMinutes: 586.9 }, ...]
```

Hide the first and last 200 m of a GPX track before sharing it:

```ts
import { trimRange } from "racetale-pace";

const range = trimRange(points, 200); // points: { lat, lon }[]
if (range) share(points.slice(range.from, range.to + 1));
```

## What is in it

| Area          | Functions                                                                                                |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Pace and time | `paceFromTime`, `timeFromPace`, `distanceFromPace`, `paceInUnit`, `speed`, `toSeconds`, `formatDuration` |
| Units         | `KM_PER_MILE`, `toKm`, `fromKm`, `DISTANCES` (5K to 50K)                                                 |
| Predictions   | `riegel` (T2 = T1 x (D2 / D1)^1.06, optimistic for a first marathon)                                     |
| Splits        | `splitPlan` (even, positive or negative split), `timeShare`, `secondsAtDistance`                         |
| Spectators    | `passingTimes`, `formatClock`, `parseSpots`                                                              |
| Heart rate    | `estimateMaxHr` (208 - 0.7 x age), `hrZones` (percent of max, or Karvonen with a resting rate)           |
| GPX           | `distanceMeters`, `trackLength`, `trimRange`                                                             |

These are estimates for planning, not medical or coaching advice.

## Links

- Free tools in the browser: https://blog.racetale.com/tools/
- RaceTale, the shared race-story app: https://racetale.com/

MIT licence.
