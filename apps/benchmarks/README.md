# Benchmarks

An on-device benchmark app. It runs the wallet's own package code (startup work, database queries,
sync, account import, cloud backup, signing) against generated wallets at four sizes, with every
network response served from fixtures, and times each operation and its Hermes heap. Results can be
saved as a baseline and compared with a later run on the same device.

It measures operations on the real runtime (Hermes, `expo-sqlite`, quick-crypto, the native
keystore). It times operations the wallet's packages perform. It does not time app launch: cold and
warm start, time to first screen, time to interactive and time to settle are not measured here. The
`startup` scenarios time the startup work (database open, store rehydration, bootstrap) in
isolation, which is a different number from launch time. Rendering and scrolling are not measured
either.

## How it is built

`apps/mobile` builds it. With `BENCH=1`, Metro swaps the JS entry for `apps/mobile/entry.bench.js`
(the same polyfills and `initRuntime()` as the shipped entry, then `BenchApp`), and the app config
builds the `bench` variant: its own iOS bundle id, the Android package that the placeholder
`google-services.json` already lists, no entitlements and no passkey extension. It installs beside a
wallet and never shares storage or keychain with one. A production bundle refuses `BENCH=1`.

```sh
pnpm --filter mobile bench:ios      # a release build onto a connected device
pnpm --filter mobile bench:android
```

Both scripts run a full prebuild first: `prebuild --no-clean` leaves the other variant's identifiers
behind. Use a release build: a debug build adds dev-mode overhead, shows a banner, and its results
refuse to compare with a release baseline. Measure on a physical device; a simulator does not
reproduce the constraints that matter.

To include more chains, build with `CHAINS` and the per-chain RPC variables set as the staging jobs
in `ci/pipelines.yml` do. A scale's chain count is capped at the chains the build enables.

## Running

Pick scales (S, M, L, XL) with the chips, then run one scenario or all of them. A scenario only runs
at the scales it lists. Each run resets the app to an empty install, seeds its wallet through the
production stores and repositories, does untimed warm-up runs, then times each iteration with
`performance.now()` and reads the heap around them.

Results land in the app's Documents folder. From the results screen: save the latest run as the
baseline, export it through the share sheet, or import a baseline from the clipboard. With a
baseline present, each scenario shows better, same, worse, new or missing against it: a change counts
when the median moves by more than 20% and by more than 2 ms (5 MB for heap growth). A scenario that
threw in the current run shows as `error` with its message, and one that threw only in the baseline
as `fixed`; neither is ever scored as `same`. Runs compare only when platform, device model, OS
version, build type, chain set and scale table all match.

Heap is read as two figures: the peak above where the run began, and what the run kept (the heap
after it over the heap before). The heap verdict uses the peak for every group except `memory`,
where it uses what was kept, because that is the leak signal. GC runs before the two readings that
bracket a run where the runtime exposes `gc`; without it, a small
kept figure is noise.

A scenario that needs a chain the build does not enable (the Ethereum signing one) is not listed.

A scale asks for a number of chains (1, 3, 5, then every enabled chain) and covers as many as the
build enables, Algorand first; each result row says how many it covered. Only Algorand accounts get
holdings and history seeded, so the other chains add accounts and sync requests, not holdings.

On a runtime with no `performance.memory` the heap is not read at all, and results show `heap n/a`
rather than a flat heap.

## Scenarios

| Group     | What it times                                                                                                                                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `startup` | Database delete, reopen and migrate; accounts-store rehydrate; chain-state hydrate; parsing a cache-shaped payload; the bootstrap sequence from a closed database over a wallet already on the device                                       |
| `db`      | The holdings, collectibles, portfolio, held-asset, price-staleness, history and write queries on the large account                                                                                                                          |
| `sync`    | A first tick on an empty database, a tick with no change, a tick with a change, and a price pass                                                                                                                                            |
| `import`  | Discovery of every active account of a recovered HD wallet                                                                                                                                                                                  |
| `backup`  | Restoring a cloud backup that a real push wrote, and pushing a wallet to an empty backup                                                                                                                                                    |
| `signing` | One and sixteen Algorand payments, one Falcon payment, one secp256k1 signature                                                                                                                                                              |
| `memory`  | Thirty sync passes back to back, a run of seconds, read for how much heap they kept; and a long soak (`memory.long-soak`) of sync passes for ten minutes with the heap read every ten passes, shown as a series and its MB-per-minute slope |

A long scenario (`memory.long-soak`) runs from its own button and is left out of Run all, so a
normal run stays quick.

Things to know when reading a number:

- The sync fixtures answer account reads, assets and prices, and answer history empty; the history
  read is the `db` scenarios' job.
- The Ethereum signing scenario times the KMS secp256k1 signature that Ethereum transaction signing
  ends in, over a 32-byte digest, because Ethereum transactions sign through the chain's planner
  rather than the local-key signer. It needs a build that enables the ethereum chain.
- A scenario's resets (emptying tables before a first tick, clearing prices, wiping restored keys)
  run in untimed hooks before and after each iteration; only `run` is timed.
- `sync` awaits `SyncService`'s private `tick()` directly, without starting the service, so a sample
  is the tick itself and nothing is rounded to a poll. If `tick` is renamed those scenarios fail
  with an error rather than report a wrong number.
- The app never calls `provider.initialize()`, so nothing reaches Firebase or push, and
  remote-config-gated paths run on their defaults.
- Requests no fixture answers are recorded and refused. The sync scenarios fail if any occur, and
  fail if a tick makes fewer requests than it must (a tick that finds nothing to do returns at once
  and would otherwise time as a very fast pass).
- `startup.query-cache-restore` times `parseTypedJson` on a persisted-cache-shaped payload of a
  given size, not the app's own persister.

## Adding a scenario

Add it to a file under `src/scenarios/` and to that file's exported list. A scenario has a unique
`<group>.<kebab-name>` id, the scales it runs at, an untimed `setup` that seeds what it needs
(`seeded()` does the common case), a `run` that holds only the work being timed, and a `teardown`
that removes anything it minted in the keystore. Call production code through package exports and
hooks; never copy the logic being measured.
