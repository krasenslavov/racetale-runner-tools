"""Checked against the numbers the JavaScript package (racetale-pace) gives for the same inputs."""

import math
import unittest

from racetale_pace import (
    LatLon, estimate_max_hr, format_clock, format_duration, hr_zones, pace_from_time, pace_in_unit,
    parse_spots, passing_times, riegel, seconds_at_distance, speed, split_plan, time_share, to_seconds,
    track_length, trim_range,
)


class PaceTests(unittest.TestCase):
    def test_readme_examples(self):
        self.assertEqual(format_duration(pace_from_time(to_seconds(3, 45, 0), 42.195)), "5:20")
        self.assertEqual(format_duration(riegel(25 * 60, 5, 42.195)), "3:59:47")

    def test_format_duration_rounds_half_up(self):
        self.assertEqual([format_duration(3725), format_duration(312), format_duration(59.5)], ["1:02:05", "5:12", "1:00"])

    def test_split_plan(self):
        rows = split_plan(10.5, 3000, "km", 0.1)
        self.assertAlmostEqual(rows[-1].split_seconds, 129.25170068027228, places=9)
        self.assertEqual((rows[-1].mark, rows[-1].length), (10.5, 0.5))
        self.assertAlmostEqual(rows[-2].cumulative_seconds, 2870.7482993197277, places=9)
        self.assertEqual(len(split_plan(5, 1500, "mi")), 4)

    def test_hr_zones(self):
        z = hr_zones(185, 55)[2]
        self.assertEqual((z.zone, z.name, z.from_bpm, z.to_bpm), (3, "Steady", 146, 159))
        self.assertEqual(hr_zones(185)[0].from_bpm, 93)
        self.assertEqual(estimate_max_hr(40), 180)

    def test_clock(self):
        self.assertEqual(format_clock(1500), ("01:00", 1))
        self.assertEqual(format_clock(1500, True), ("1:00 am", 1))
        self.assertEqual(format_clock(13 * 60 + 5, True), ("1:05 pm", 0))

    def test_parse_spots_and_misc(self):
        self.assertEqual(parse_spots("10, 21,1 and 32;x -3"), [10, 21, 1, 32])
        self.assertEqual(to_seconds(1, math.nan, 30), 3630)
        self.assertAlmostEqual(time_share(0.5, 0.2), 0.55)
        self.assertAlmostEqual(seconds_at_distance(10, 42.195, 14400, 0.1), 3673.1194068876043, places=9)
        self.assertEqual(speed(300, "km"), 12)
        self.assertAlmostEqual(speed(300, "mi"), 7.4564543068480065, places=12)
        self.assertAlmostEqual(pace_in_unit(300, "mi"), 482.8032, places=9)

    def test_passing_times(self):
        first = passing_times([30, 10], 42.195, 4 * 3600, 540, 0, 10)[0]
        self.assertEqual(first.km, 10)
        self.assertAlmostEqual(first.pass_minutes, 596.8787771062922, places=9)
        self.assertAlmostEqual(first.arrive_minutes, 586.8787771062922, places=9)

    def test_gpx_trim(self):
        pts = [LatLon(47 + i * 0.0003, 8 + math.sin(i / 9) * 0.003) for i in range(41)]
        self.assertAlmostEqual(track_length(pts), 1518.8592171806026, places=6)
        self.assertEqual(trim_range(pts, 100), (3, 37))
        self.assertIsNone(trim_range(pts, 1000))


if __name__ == "__main__":
    unittest.main()
