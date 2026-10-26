# Stress testing

How to find out whether the app still feels and behaves correctly under extreme data: many accounts,
accounts with thousands of assets, a long history, hundreds of contacts, a large NFT gallery and a
long list of WalletConnect sessions.

The release app is driven from outside, through the device E2E suite in `e2e/`. Nothing in the app
measures itself, so a run exercises exactly the code users get. The price is coarse numbers: they say
which surface degrades and at what data size, not where the time goes. Where a deeper look is
needed, attach a profiler by hand (Instruments, Perfetto, the Hermes profiler).

## Data

Heavy per-account data (assets, transactions, NFTs) has to exist on chain, because the app fills its
database by syncing it. `pnpm stress:seed` builds all of it on TestNet from one wallet phrase, so a
run can be rebuilt from scratch:

| Dimension               | Source                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- |
| Many accounts           | The seeded wallet's HD accounts, imported by recovery phrase                  |
| 1,000+ assets           | Account 0 creates the tier's fungible assets, so it holds them                |
| Large NFT gallery       | Account 0 also creates the tier's NFTs (supply 1, no decimals)                |
| Large history           | Account 0 sends the tier's zero-amount self-payments; its creations count too |
| Hundreds of contacts    | The `contacts-<n>` E2E fixtures                                               |
| Long WalletConnect list | Real pairing through the WC harness, looped                                   |

Tier sizes and verdict limits are defined once, in `e2e/stress-tiers.json`. Quote a tier by name.

Import the wallet **by recovery phrase**, which is what the setup suite does. A watch account
exercises lists, search, history, sync and the database, but it is left out of the portfolio total,
so it cannot show what a large portfolio costs to add up.

Seeded holdings are synthetic: no prices, no verification, and NFT images are placeholders on a public
image service. To see real-world metadata and pricing, import a real large account as well, and to go
past a tier add a public MainNet account as a watch account. To bracket the size at which a surface
breaks, compare against a small funded account and one of intermediate size.

## Setting up a tier

1. Create a wallet phrase **for each tier** with `pnpm stress:seed --new`, and set `STRESS_MNEMONIC` to
   that tier's phrase for its seeding and its runs. A phrase belongs to one tier: the app imports
   every funded account, and account 0 holds everything ever made for it, so a smaller tier run on a
   bigger tier's phrase would measure the bigger tier's data under the smaller tier's name.
2. See what a tier costs, then seed it from a funded TestNet account (25-word phrase in
   `STRESS_FUNDER_MNEMONIC`):
    ```sh
    pnpm stress:seed --tier L --plan
    pnpm stress:seed --tier L
    ```
    The plan prints what exists, what is missing and what the funder must hold. The cost is mostly
    locked, not spent: each asset account 0 creates raises its minimum balance by 0.1 ALGO, and each
    transaction costs the fee. It is resumable: a rerun of the same tier makes only what is missing. It
    refuses a phrase already seeded beyond the tier (more assets, NFTs or payments, or a funded
    account past the tier), and it exits before sending if the funder cannot cover the run. A large tier takes a long time,
    since every group of transactions waits on chain confirmation. The indexer trails the chain by a
    few seconds, so a rerun straight after a run may send a few extra payments. `tools/stress/derive.ts`
    derives and signs as the app's import does, and its spec checks that against the published
    native-app vector and a verified signature.
3. Build an E2E release app as `e2e/README.md` describes. Release mode matters: dev-mode numbers
   are not representative, and the fixture hook only exists in an `E2E_FIXTURES=1` bundle.
4. Put the tier's wallet on the device. This replaces the wallet that is there:
    ```sh
    robot --variable PLATFORM:android --variable TIER:L --outputdir e2e/results/android-L \
      e2e/tests/stress_setup.robot
    ```
    Account discovery runs for real. The time from submitting the phrase to the first screen after
    it is kept as a reading, `import:discovery`, with no verdict, because it is slow by nature. It is
    written to `stress-setup-metrics.json`, separate from `stress-metrics.json`, so the measurement
    run that shares the output folder does not replace it. The suite then fails unless the wallet holds
    exactly the tier's number of accounts, which catches a phrase seeded for another tier. It needs
    `STRESS_MNEMONIC` set and
    skips itself without it; the phrase is read in Python and never reaches a log.
5. Set `STRESS_ACCOUNT` to the address the seeder prints for account 0, so the asset, NFT and
   history cases run on the account that holds the data. If you also import a real large account,
   use its address instead to measure that one, and set `STRESS_EXTRA_ACCOUNTS` to how many
   accounts you imported by hand: the switcher case expects the tier's accounts plus those, exactly.
6. For the WalletConnect case, start the dApp harness and set `WC_HARNESS_URL`; the case skips
   itself otherwise. Contacts need nothing: the case loads the fixture for the tier.

Use a mid-range Android device and an older iPhone, not a flagship or a simulator. The Android
readings below need `adb` on the machine that runs Robot; iOS crash collection needs a real device
and `idevicecrashreport`.

## Running

```sh
robot --variable PLATFORM:android --variable TIER:L --outputdir e2e/results/android-L e2e/tests/stress.robot
robot --variable PLATFORM:ios     --variable TIER:L --outputdir e2e/results/ios-L     e2e/tests/stress.robot
python e2e/tools/stress_report.py e2e/results/android-L/stress-setup-metrics.json e2e/results/android-L/stress-metrics.json \
  e2e/results/ios-L/stress-metrics.json
```

The stress cases carry the `slow` tag, so the default `--exclude slow` run never includes them. Run
one tier per platform, then repeat for each tier and compare. The report prints a surface-by-tier
table per platform, the device readings, and every hard failure.

## What a run measures

| Surface                 | How                                                                                                                                                                                                                                       |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Startup                 | Android `am start -W` cold launch; `startup:first-screen` (from just before the relaunch to the first screen, so it includes Appium's terminate and activate calls), then `startup:portfolio` (after any PIN entry, to the total showing) |
| Portfolio calculation   | `startup:portfolio` and `resume:portfolio`, on the tier's wallet; PIN entry is never inside a timer                                                                                                                                       |
| Account switcher        | Time to open; scroll to the last account, counting every account met                                                                                                                                                                      |
| List scrolling          | Android frame counters (janky share, percentiles) over a fixed swipe run; slowest swipe on both platforms                                                                                                                                 |
| Search and filter       | Contacts search, from before the typing until the list has filtered; asset sort until the visible rows reorder; `assets:filter-dismiss`, the filter sheet closing                                                                         |
| NFTs, history, contacts | Time to the first row (contacts: opening the list from the menu, not loading the fixture); scroll run                                                                                                                                     |
| WalletConnect           | Each pairing; opening, scrolling and clearing the session list                                                                                                                                                                            |
| Sync and refresh        | CPU share and memory 60 s after launch, while the first sync settles (Android)                                                                                                                                                            |
| Memory                  | Android total PSS after each scroll run and at the end of the session                                                                                                                                                                     |
| Crashes and hangs       | Android log (crash, ANR, native crash, low-memory kill); iOS crash, jetsam and `cpu_resource` reports                                                                                                                                     |

Every action goes through Appium, which adds a few hundred milliseconds of its own and can be slow
to read a long list. Compare tiers with each other, not with a stopwatch.

## Failure classes

The limits are in `e2e/stress-tiers.json`.

| Class            | Meaning                                                              | Action                                 |
| ---------------- | -------------------------------------------------------------------- | -------------------------------------- |
| ok               | Under the `slow` limit                                               | None                                   |
| slow             | At or over `slow`: soft degradation                                  | Record; file if it grows with the tier |
| unusable         | At or over `unusable`, or the target never appeared within `timeout` | File a bug                             |
| crash, ANR, kill | The device log or crash reports show one for the app                 | File a bug                             |

For each hard failure, find the **smallest scale that triggers it**: step down a tier, or use the
intermediate account, until it stops reproducing.

## State the cases leave behind

The asset case starts on the default sort and puts the sort and the filter back at the end, and the
WalletConnect case removes every session it paired, even when it fails, so each run starts from the
same list. The contacts case leaves the contact list empty. Hiding zero balances changes nothing on
screen when every holding has a balance, which is why the filter is timed as the sheet closing. The
sort is timed until the visible rows reorder; if the order cannot change, it times out and is flagged
rather than reported as fast.

## Not covered

- Per-query database times. Their cost shows up in the list, search and startup timings.
- Search of the local asset list, which has no automation locator.
- Backup and export duration, which no existing keyword reaches. Time them by hand with a screen
  recording: CSV export from an account's history, and the cloud-backup sync after enabling it.
- iOS memory, CPU and animation hitches. Record the Allocations, Time Profiler and Animation Hitches
  templates in Instruments on the same device while repeating the scroll cases.
- Contact backup: the fixture contacts have no address checksum, so a backup push may refuse them.
- Resume: whether the app locks on resume depends on the app's lock settings, so the run records it (`resume:lock-screen`).

## Filing a hard failure

A bug carries:

- the surface and the failure class
- the tier and the account that triggers it, and the smallest scale that does
- platform, device, OS version and build
- the repro steps from a clean install
- the report's rows for the surface, and the crash log (Android logcat or the iOS `.ips` file)

Results and bug links go on the tracking ticket for the run, not in the repo.
