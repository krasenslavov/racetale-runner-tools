"""Running maths with no dependencies: pace, finish time, Riegel race predictions, split plans,
heart rate zones, spectator passing times and GPX start/finish trimming.

A Python port of the ``racetale-pace`` npm package; the same functions give the same numbers.
Distances are in kilometres and times in seconds inside; units only matter when you show a result.
Free tools in the browser: https://blog.racetale.com/tools/
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal, Optional, Sequence

__version__ = "1.0.0"

KM_PER_MILE = 1.609344

Unit = Literal["km", "mi"]

#: Common race distances: (id, label, km).
DISTANCES = (
    ("5k", "5K", 5.0),
    ("10k", "10K", 10.0),
    ("15k", "15K", 15.0),
    ("10mi", "10 miles", 10 * KM_PER_MILE),
    ("half", "Half marathon", 21.0975),
    ("30k", "30K", 30.0),
    ("marathon", "Marathon", 42.195),
    ("50k", "50K", 50.0),
)


def _round(x: float) -> int:
    """Round half up, like JavaScript's Math.round (Python's round() rounds half to even)."""
    return math.floor(x + 0.5)


def to_km(value: float, unit: Unit) -> float:
    return value * KM_PER_MILE if unit == "mi" else value


def from_km(km: float, unit: Unit) -> float:
    return km / KM_PER_MILE if unit == "mi" else km


def format_duration(total_seconds: float) -> str:
    """3725 -> "1:02:05"; 312 -> "5:12". Rounds to the whole second."""
    s = _round(total_seconds)
    h, m, sec = s // 3600, (s % 3600) // 60, s % 60
    return f"{h}:{m:02d}:{sec:02d}" if h > 0 else f"{m}:{sec:02d}"


def to_seconds(h: float, m: float, s: float) -> float:
    """Hours, minutes and seconds to seconds. Invalid or negative fields count as 0."""

    def n(v: float) -> float:
        return v if math.isfinite(v) and v > 0 else 0

    return n(h) * 3600 + n(m) * 60 + n(s)


def pace_from_time(seconds: float, km: float) -> float:
    """Seconds per kilometre for a distance and a time."""
    return seconds / km


def time_from_pace(seconds_per_km: float, km: float) -> float:
    return seconds_per_km * km


def distance_from_pace(seconds: float, seconds_per_km: float) -> float:
    return seconds / seconds_per_km


def pace_in_unit(seconds_per_km: float, unit: Unit) -> float:
    """A pace given per kilometre, shown per ``unit``."""
    return seconds_per_km * KM_PER_MILE if unit == "mi" else seconds_per_km


def speed(seconds_per_km: float, unit: Unit) -> float:
    """Speed in km/h (or mph) for a pace in seconds per kilometre."""
    return 3600 / pace_in_unit(seconds_per_km, unit)


def riegel(seconds: float, from_km_distance: float, to_km_distance: float, exponent: float = 1.06) -> float:
    """Riegel's formula: T2 = T1 x (D2 / D1) ^ 1.06. Optimistic for a first marathon."""
    return seconds * math.pow(to_km_distance / from_km_distance, exponent)


def time_share(x: float, skew: float) -> float:
    """Share of the total time spent by the time a runner has covered the fraction ``x`` of the
    distance. ``skew`` 0 is an even pace, positive is a negative split, negative starts fast."""
    c = min(1.0, max(0.0, x))
    return c + skew * (c - c * c)


@dataclass(frozen=True)
class SplitRow:
    mark: float
    length: float
    split_seconds: float
    cumulative_seconds: float
    pace_seconds: float


def split_plan(distance_km: float, goal_seconds: float, unit: Unit, skew: float = 0.0) -> list[SplitRow]:
    """A split table for a goal time: one row per km or mile, plus a short last row when needed."""
    total = from_km(distance_km, unit)
    rows: list[SplitRow] = []
    start = 0.0
    previous = 0.0
    while start < total - 1e-9:
        end = min(start + 1, total)
        cumulative = goal_seconds * time_share(end / total, skew)
        length = end - start
        split = cumulative - previous
        rows.append(
            SplitRow(
                mark=_round(end * 1000) / 1000,
                length=_round(length * 1000) / 1000,
                split_seconds=split,
                cumulative_seconds=cumulative,
                pace_seconds=split / length,
            )
        )
        previous = cumulative
        start = end
    return rows


def seconds_at_distance(km: float, distance_km: float, goal_seconds: float, skew: float = 0.0) -> float:
    """Seconds from the start of the run to the point ``km`` along a course."""
    return goal_seconds * time_share(km / distance_km, skew)


@dataclass(frozen=True)
class PassingTime:
    km: float
    pass_minutes: float
    arrive_minutes: float


def passing_times(
    spots_km: Sequence[float],
    distance_km: float,
    goal_seconds: float,
    start_minutes: float,
    delay_minutes: float = 0.0,
    margin_minutes: float = 0.0,
    skew: float = 0.0,
) -> list[PassingTime]:
    """When a runner reaches each spot where a spectator stands. ``start_minutes`` is the race start
    as minutes since midnight, ``delay_minutes`` the time the runner takes to reach the start line."""
    out = []
    for km in sorted(k for k in spots_km if 0 < k <= distance_km):
        pass_at = start_minutes + delay_minutes + seconds_at_distance(km, distance_km, goal_seconds, skew) / 60
        out.append(PassingTime(km=km, pass_minutes=pass_at, arrive_minutes=pass_at - margin_minutes))
    return out


def format_clock(minutes: float, hour12: bool = False) -> tuple[str, int]:
    """Minutes since midnight to ("HH:MM", day_shift). day_shift is 1 when it is past midnight."""
    whole = _round(minutes)
    day_shift = whole // 1440
    in_day = whole % 1440
    h, m = in_day // 60, in_day % 60
    if not hour12:
        return f"{h:02d}:{m:02d}", day_shift
    suffix = "am" if h < 12 else "pm"
    return f"{12 if h % 12 == 0 else h % 12}:{m:02d} {suffix}", day_shift


def parse_spots(text: str) -> list[float]:
    """Spots typed as "10, 21.1 and 32" to numbers; anything that is not a positive number is dropped."""
    import re

    out = []
    for part in re.split(r"[\s,;]+", text):
        try:
            n = float(part.replace(",", "."))
        except ValueError:
            continue
        if math.isfinite(n) and n > 0:
            out.append(n)
    return out


def estimate_max_hr(age: float) -> int:
    """A common estimate of maximum heart rate from age (Tanaka: 208 - 0.7 x age)."""
    return _round(208 - 0.7 * age)


_ZONE_BANDS = (
    ("Very easy", 50, 60),
    ("Easy", 60, 70),
    ("Steady", 70, 80),
    ("Hard", 80, 90),
    ("Maximum", 90, 100),
)


@dataclass(frozen=True)
class HrZone:
    zone: int
    name: str
    from_percent: int
    to_percent: int
    from_bpm: int
    to_bpm: int


def hr_zones(max_hr: float, resting_hr: Optional[float] = None) -> list[HrZone]:
    """Five heart rate zones. With a resting heart rate the bands use the heart rate reserve
    (Karvonen); without one they are plain percentages of the maximum."""
    use_reserve = resting_hr is not None and 0 < resting_hr < max_hr

    def at(percent: float) -> int:
        if use_reserve:
            return _round(resting_hr + (percent / 100) * (max_hr - resting_hr))  # type: ignore[operator]
        return _round((percent / 100) * max_hr)

    return [HrZone(i + 1, name, lo, hi, at(lo), at(hi)) for i, (name, lo, hi) in enumerate(_ZONE_BANDS)]


@dataclass(frozen=True)
class LatLon:
    lat: float
    lon: float


def distance_meters(a: LatLon, b: LatLon) -> float:
    """Distance in metres between two coordinates (haversine)."""
    rad = math.radians
    d_lat, d_lon = rad(b.lat - a.lat), rad(b.lon - a.lon)
    h = math.sin(d_lat / 2) ** 2 + math.cos(rad(a.lat)) * math.cos(rad(b.lat)) * math.sin(d_lon / 2) ** 2
    return 2 * 6371008.8 * math.asin(min(1.0, math.sqrt(h)))


def track_length(points: Sequence[LatLon]) -> float:
    """Length of a track in metres."""
    return sum(distance_meters(points[i - 1], points[i]) for i in range(1, len(points)))


def trim_range(points: Sequence[LatLon], meters: float) -> Optional[tuple[int, int]]:
    """The points to keep when hiding the first and last ``meters`` of a track: indices (from, to),
    inclusive. Returns None when the track is too short to keep anything after trimming both ends."""
    if len(points) < 2 or not meters >= 0:
        return None
    along = [0.0]
    for i in range(1, len(points)):
        along.append(along[i - 1] + distance_meters(points[i - 1], points[i]))
    total = along[-1]
    if total <= meters * 2:
        return None
    start = next((i for i, d in enumerate(along) if d >= meters), -1)
    end = -1
    for i in range(len(along) - 1, -1, -1):
        if along[i] <= total - meters:
            end = i
            break
    if start < 0:
        start = 0
    if end < start + 1:
        return None
    return start, end
