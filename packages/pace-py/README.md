# racetale-pace

Running maths with no dependencies, in Python. The same code as the
[`racetale-pace`](https://www.npmjs.com/package/racetale-pace) npm package, and the same numbers as the free
[runner tools](https://blog.racetale.com/tools/) on the RaceTale blog: pace, finish time, race predictions,
split plans, heart rate zones, spectator passing times and GPX start/finish trimming.

- No dependencies, typed, Python 3.9 or newer.
- Pure functions. Nothing is sent anywhere and nothing is stored.
- Distances are kilometres and times are seconds inside; units only matter when you show a result.

```sh
pip install racetale-pace
```

## Examples

```python
from racetale_pace import format_duration, pace_from_time, riegel, split_plan, hr_zones, to_seconds

# Pace needed for a 3:45 marathon, in seconds per km
pace = pace_from_time(to_seconds(3, 45, 0), 42.195)
format_duration(pace)  # "5:20"

# A 25:00 5K, predicted for the marathon (Riegel, exponent 1.06)
format_duration(riegel(25 * 60, 5, 42.195))  # "3:59:47"

# Split table for a 25:00 5K, one row per km
split_plan(5, 1500, "km")[0]
# SplitRow(mark=1.0, length=1.0, split_seconds=300.0, cumulative_seconds=300.0, pace_seconds=300.0)

# Five heart rate zones from a max heart rate of 185
hr_zones(185)[0]
# HrZone(zone=1, name='Very easy', from_percent=50, to_percent=60, from_bpm=93, to_bpm=111)
```

When will a runner pass a spot? A 4:00 marathon starting at 09:00, a spectator at km 10 and km 30:

```python
from racetale_pace import passing_times, format_clock

for p in passing_times([10, 30], 42.195, 4 * 3600, start_minutes=9 * 60, margin_minutes=10):
    print(p.km, format_clock(p.pass_minutes)[0], format_clock(p.arrive_minutes)[0])
# 10 09:57 09:47
# 30 11:51 11:41
```

Hide the first and last 200 m of a GPX track before sharing it:

```python
from racetale_pace import LatLon, trim_range

points = [LatLon(47.0, 8.0), ...]
rng = trim_range(points, 200)  # (first_index, last_index) or None if the track is too short
if rng:
    shareable = points[rng[0] : rng[1] + 1]
```

## What is in it

| Area          | Functions                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pace and time | `pace_from_time`, `time_from_pace`, `distance_from_pace`, `pace_in_unit`, `speed`, `to_seconds`, `format_duration` |
| Units         | `KM_PER_MILE`, `to_km`, `from_km`, `DISTANCES` (5K to 50K)                                                         |
| Predictions   | `riegel` (T2 = T1 x (D2 / D1)^1.06, optimistic for a first marathon)                                               |
| Splits        | `split_plan` (even, positive or negative split), `time_share`, `seconds_at_distance`                               |
| Spectators    | `passing_times`, `format_clock`, `parse_spots`                                                                     |
| Heart rate    | `estimate_max_hr` (208 - 0.7 x age), `hr_zones` (percent of max, or Karvonen with a resting rate)                  |
| GPX           | `distance_meters`, `track_length`, `trim_range`                                                                    |

These are estimates for planning, not medical or coaching advice.

## Links

- Free tools in the browser: https://blog.racetale.com/tools/
- RaceTale, the shared race-story app: https://racetale.com/
- Source: https://github.com/krasenslavov/racetale-runner-tools

MIT licence.
