# RaceTale runner tools

Free, open-source maths and tools for runners, by [RaceTale](https://racetale.com). MIT licence.

| Folder | What it is |
| --- | --- |
| [`packages/pace`](packages/pace) | `racetale-pace`: pace, finish time, Riegel predictions, split plans, heart rate zones, spectator passing times and GPX trimming. No dependencies. |
| [`packages/pace-py`](packages/pace-py) | `racetale-pace` on PyPI: the same functions in Python, same numbers. |
| [`extension`](extension) | RaceTale Pace Tools, a browser extension (Chrome, Edge, Firefox) with a pace calculator, race time predictor and spectator planner. Collects nothing. |

The same calculators run in the browser, with no sign-up, at **https://blog.racetale.com/tools/**:
pace calculator, race time predictor, pace chart, heart rate zones, spectator timing planner and a
route privacy trimmer that works on a GPX file without uploading it.

## Build

```sh
npm install
npm run build:extension   # extension/dist/*.zip
cd packages/pace && npm run build   # see packages/pace/README.md
```

## Contributing

Issues and pull requests are welcome. Keep functions pure and dependency-free, and add an example to
the README for anything you add.
