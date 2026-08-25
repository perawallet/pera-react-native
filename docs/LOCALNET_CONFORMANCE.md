# LocalNet Conformance Suite

`conformance/` is a Vitest suite — 30 files, 118 tests — that runs the app's
own builders, keystore, signing, transformers, and error-classification code
against a **real** Algorand node (LocalNet) instead of a mock. See
`conformance/README.md` for the package layout and the `dist/` build
prerequisite (repeated below because it is also this doc's CI-relevant
section).

## Why mocks cannot prove this

A mock returns whatever the test tells it to. It cannot catch the app
disagreeing with a real node about what a real node does — and that gap has
shipped bugs twice:

- **PERA-4643**: the quantum signing preimage was
  `sha512_256(bytesToSign())` instead of `bytesToSign()`. Every unit test
  passed, because every unit test's "node" was a mock that verified whatever
  the app happened to sign. Only a real `pqsig`-capable node — which hashes
  the message itself and rejects a double-hashed one with `falcon verify
failed` — could catch it. `conformance/src/suites/signing/quantum.spec.ts`
  now pins the exact preimage contract and proves byte-parity against an
  independent Falcon implementation (`algokey`) before ever touching the
  node.
- **PERA-4972**: quantum address derivation fed Falcon the raw seed instead
  of the canonical PQK1-hashed value for newly minted accounts, and legacy
  accounts derived before the fix had to keep resolving to their original
  (pre-fix) address. A mock has no chain-derived address to disagree with;
  `conformance/src/suites/derivation/quantum.spec.ts` funds the
  independently-derived address and asserts the chain credits the
  app-derived one.

This same suite additionally **found and this PR fixes two real production
bugs**, not simulated ones — see "Bugs this suite found" below.

## Running it

```sh
pnpm localnet          # start LocalNet if it isn't already running (needs Docker)
pnpm test:conformance   # from the repo root
```

`src/harness/localnet.ts` fails fast with a clear message if LocalNet isn't
reachable at `http://localhost:4001` — the suite never silently falls back to
a mock.

## Prerequisites

- **Docker**, running.
- `pnpm localnet` (wraps `algokit localnet start`) — boots algod, indexer,
  and kmd containers.
- A built `dist/` for the workspace packages the suite's import graph (and,
  for `pnpm --filter @perawallet/conformance typecheck`, its `tsconfig.json`
  `paths`) reach transitively but do not alias to source. See
  `conformance/README.md`'s "`dist/` dependency (CI-relevant)" section for
  the full explanation of why. The closure is wider than it looks — four
  packages pull in their own further dependencies (shared, config, the
  ledger extension packages, `wallet-core-multisig`, `wallet-core-assets`,
  and more) — so don't hand-build a list; build everything and let turbo's
  own dependency graph (`dependsOn: ["^build"]`) order it correctly, same as
  the rest of the repo:

    ```sh
    pnpm run build
    ```

    Without this, the suite doesn't fail one test — it fails to **collect**
    any of the 28 files, because the first file loaded transitively imports a
    barrel that needs an unbuilt package. `pnpm --filter <one-package> build`
    looks like the cheaper option but is not reliable here: the true closure
    has cross-package build-order dependencies (building
    `wallet-core-database` before `wallet-extension-platform`, for instance,
    fails with `Cannot find module '@perawallet/wallet-extension-platform'`),
    and it is easy to miss a package the way this doc's own first draft did.

**CI note**: `localnet-conformance.yml` runs `pnpm run build` uncached —
no `node_modules`/dist restore step, unlike `pre-merge.yml`'s `build` job,
which saves/restores both across its multi-job pipeline. That's a
deliberate simplicity choice, not an oversight: this workflow is a single
job with nothing downstream to share a cache with, and `pre-merge.yml`'s
`build-artifacts-${{ github.sha }}` cache key only helps job-to-job within
one run for exactly that reason — it would buy this workflow nothing
without restructuring into multiple jobs. `timeout-minutes: 30` is
comfortable today because LocalNet's Docker image pulls dominate the wall
clock, not the uncached build; if that stops being true, adding the same
`actions/cache` pattern `pre-merge.yml` uses is the first lever to pull,
not a rewrite.

## What runs is app code

The point of this suite is to put Pera's own functions in front of a real
node. Where a third-party library appears, it is on the _other_ side of the
comparison — an independent oracle — never on both.

| Area                                                                  | The app code under test                                                                                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Envelope construction (`sig`, `sgnr`, `pqsig`, batching)              | `signTransactionsWithLocalKey` — the pure pipeline function `useLocalKeyTransactionSigner` delegates to                                       |
| Signature-scheme decision                                             | `resolvePQSigningInfo` — the PERA-4653 guard, reading a live keystore snapshot                                                                |
| Strategy layer (capability gate, progress, backend signature payload) | `createLocalKeyStrategy`                                                                                                                      |
| Signer dispatch and rekey resolution                                  | `buildGroupSignerTypeMap`, `resolveSigningAccount`                                                                                            |
| Group fee assignment and re-grouping                                  | `assignMinimumFeesToGroup`, `groupHasQuantumSigner`                                                                                           |
| Fee arithmetic                                                        | `calculateMinTxnFee`, `calculatePQFeeSurcharge`                                                                                               |
| Address derivation                                                    | `algo25SeedToAddress`, `deriveQuantumAddress`, `derivePQKeygenSeed`, `generateMultisigAddress`, `encodeAlgorandAddress`, `prepareHDMasterKey` |
| In-memory PQ keygen (import probe, legacy-account notice)             | `getPQProvider().generateKeypairFromSeed`, `quantumAddressCandidates`                                                                         |
| Account state                                                         | `fetchOnChainAccountInformation` + `mapOnChainAccountInformation`, `fetchAccountAssetOptInRounds`                                             |
| Transaction history                                                   | `transformIndexerTransactions`, `collectAssetIds`, `computeBalanceImpacts`                                                                    |
| Multisig assembly                                                     | `assembleSignedMultisigTransactions`                                                                                                          |
| Submission                                                            | `submitAndAutoRefreshCore`                                                                                                                    |
| Error classification                                                  | `toAlgodError` / `parseAlgodMessage`                                                                                                          |

Two files are deliberate exceptions, and say so in their own headers:
`harness/__tests__/algokey.spec.ts` self-tests the oracle (so a broken oracle
cannot make every parity assertion vacuous), and
`harness/__tests__/keystore.spec.ts` self-tests the in-memory driver standing
in for the React Native Keychain. Neither asserts anything about Pera's code.

## The three-proof model

Most suites assert three independent things about a signed transaction, and
name them explicitly in the test body:

1. **Oracle parity** — the app-signed bytes match an independently-signed
   reference byte-for-byte. The reference is `algokey` (the Go SDK's
   reference CLI, shelled out to from `harness/algokey.ts`) for ed25519 and
   quantum signing, or a from-scratch reimplementation of the derivation math
   for HD/multisig/ALGO25 address derivation. This catches a wrong preimage
   or wrong derivation **offline**, before the transaction ever reaches a
   node — cheap and exact.
2. **Node acceptance** — the signed bytes are broadcast to a real LocalNet
   node and confirmed. This is the proof a mock cannot fake: it exercises
   the node's own verifier, its own fee floor, its own error strings. This
   is what caught PERA-4643 — oracle parity alone would not have, since the
   bug was in what the app signed _relative to what the node expected_, not
   relative to another client library making the same mistake.
3. **Round-trip decode** — the confirmed transaction is read back from the
   node and decoded, then compared field-by-field against the test's
   declared `TxnIntent` (`harness/assert/intent.ts`). This catches the class
   of bug where a transaction is accepted but doesn't mean what the test
   thinks it means — e.g. a close-out silently added, a fee the composer
   computed differently from what was declared, a rekey that didn't take.

Not every suite needs all three — a fee-pooling assertion has no oracle to
diff against, and a rejection-path test never reaches confirmation — but
where a suite claims "this transaction is exactly correct," it backs the
claim with the two proofs that don't share a mistake with the code under
test (an independent oracle, and the node itself).

## Reading a decoded-diff failure

`harness/assert/roundTrip.ts`'s `expectConformant` fails with a two-column
table from `harness/assert/diff.ts`'s `formatFieldDiff` — only the fields
that differ, one row each:

```
submitted transaction does not match the declared intent:
field      expected              actual
amount     300000n               300000
```

Read the row, not just the failure message. `formatFieldDiff` renders every
value type distinguishably on purpose — `bigint` prints with a trailing `n`,
`Uint8Array` prints as lowercase hex, an absent field prints `(unset)` — so
`300000n` vs `300000` in the example above is not a formatting quirk, it is
the diff telling you a `number` leaked in where a `bigint` was expected (see
CLAUDE.md's Numbers & Precision rules — this is exactly the class of bug
those rules exist to prevent). A hex vs `(unset)` row on `rekeyTo` means the
declared intent said "no rekey" and the chain disagrees, not a rendering
difference.

## Known gaps

Recorded here rather than silently — each is either a deliberate scope
boundary or an open follow-up, not an oversight this doc is hiding.

1. **ARC-59 / application calls are not covered.** The checked-in
   `APP_SPEC` has `source: { approval: '', clear: '' }` and no `byteCode`;
   deploying via the repo's own `ARC59Factory` fails with algod
   `400: Cannot assemble empty program text`. Needs the upstream TEAL
   vendored in. Tracked as a follow-up ticket, not fixed here.
2. **Swaps are not covered.** Swap transaction groups are composed
   server-side; the client only validates and finishes an already-built
   group, so there is no client-side construction path for this suite to
   pin against a node.
3. **Native Falcon parity is unprovable here.** The harness signs quantum
   transactions with the WASM `falcon-1024` shim (works under Node). The
   shipped app loads the **native** `@joe-p/react-native-falcon` module,
   which is a Nitro/React-Native binding and cannot load outside a React
   Native runtime. Byte parity between the WASM shim and the native module
   is an assumption this suite rests on, not something it proves — it
   remains a manual on-device check (see
   `docs/QUANTUM_PQ_INTEGRATION.md` for that verification).
4. **Key custody is the one thing the suite substitutes.** Every signing
   decision — which payload to sign, which envelope field to fill, when to
   set `sgnr` — is the app's own
   (`signTransactionsWithLocalKey` + `resolvePQSigningInfo`). What differs is
   where the sealed bytes live: the app's `useKMS` reaches
   `getProvider().key.store`, a React Native Keychain/MMKV driver that cannot
   load under Node, so the harness supplies the same `keyStore.sign` call
   backed by an in-memory driver (`harness/keystore.ts`). The React bindings
   themselves (`useKMS`, `useLocalKeyTransactionSigner`) are not exercised;
   they hold no logic beyond wiring, which is why the logic was moved out of
   them.
5. **A corrupted group id has no typed `AlgodErrorCode`.** It falls through
   `parseAlgodMessage.ts` to `unknown_node_error`, which is one of
   `classifySubmitFailure.ts`'s `NO_NODE_VERDICT_CODES` — so a definitive
   node rejection gets misclassified as an indeterminate outcome and burns a
   pointless `verifyLandedWithRetries` cycle before surfacing. This is an
   open finding (`conformance/src/suites/submission/rejections.spec.ts`,
   the "submit a group with a corrupted group id" case), deliberately left
   unfixed here rather than inventing a new `AlgodErrorCode` enum member
   under this PR's scope. In practice it needs a hand-corrupted group id to
   trigger, which no normal signing flow produces.
6. **Per-byte fee pricing is unprovable on LocalNet.** LocalNet's suggested
   params are `fee: 0, minFee: 1000`; stepping the declared fee down on a
   1-byte and a 900-byte note rejects identically at every value below the
   floor — the floor LocalNet enforces is flat and size-independent, so
   there is no node-observable signal to pin a true per-byte rate against.
   `suites/fees/perByte.spec.ts` asserts the composer's computed fee against
   the node for both sizes and documents the rest rather than asserting
   something LocalNet cannot demonstrate.
7. **MBR conformance pins the constants and the delta, not every call
   site.** `suites/mbr/optIn.spec.ts` and
   `suites/accounts/accountState.spec.ts` prove the constants are right and
   that an opt-in moves the node-reported `minBalance` by exactly
   `FALLBACK_ASSET_MBR` — the arithmetic `useTransactionSendFlow.ts:148`
   performs. The call sites themselves are still hook-bound, so _that they
   apply it_ remains unproven here.
8. **Ledger hardware signing is not covered.** It needs a physical
   transport; there is no way to simulate a hardware device from CI.

## Bugs this suite found

The strongest argument for this suite existing: it is not hypothetical
insurance, it already caught three live regressions that every existing unit
test missed, all three in
`packages/blockchain/src/errors/parseAlgodMessage.ts`.

Algod 5.0.0-stable changed how it renders certain rejection messages.
`parseAlgodMessage.ts`'s regexes were written against an older format and
never updated, so real, common rejections silently fell through to the
catch-all `unknown_node_error` code instead of their intended typed code:

- **Overspend** (`OVERSPEND_RE`) — expected the legacy
  `MicroAlgos:{Raw:300000}` debug format; algod 5.0.0-stable renders it as a
  unit-suffixed figure instead (`MicroAlgos:300mA`). The regex never
  matched. Overspend is the single most common rejection a wallet produces
  — a user fat-fingering an amount. Fixed in this PR by matching on message
  shape instead of the numeric rendering. The new format's `balance`/`spent`
  figures are losslessly parseable numbers, but semantically wrong: the
  rendered balance is the account's balance MINUS the rejected transaction's
  own fee (confirmed empirically, e.g. 300_777 funded, fee 1000 -> rendered
  "299.777mA" = 299_777). `AlgodErrorParamsByCode.overspend` therefore
  carries only `address` — no `balance`, `spent`, or `missing` field, because
  nothing in this codebase can populate them correctly.
- **Expired transaction** (`EXPIRED_TXN_RE`) — expected a single dash
  between the two round numbers (`"outside of A-B"`); algod 5.0.0-stable
  uses a double dash (`"outside of A--B"`). Fixed in this PR: the regex now
  accepts both renderings.
- **Pooled group fee too small** (`GROUP_FEE_RE`) — expected
  `"txgroup had 1999 in fees, which is less than the minimum 2000"`; algod
  5.0.0-stable renders it as
  `"txgroup with 5.999mA fees is less than 6mA (usage=6.000000 * base=1mA)"`.
  Found by `suites/fees/pooling.spec.ts` while checking that the group the
  app's own `assignMinimumFeesToGroup` produces is priced at the floor rather
  than above it — the one-microAlgo-under case has to be rejected, and the
  rejection turned out to be misclassified. Fixed the same way as overspend:
  the regex now matches on message shape and accepts both renderings, and
  `AlgodErrorParamsByCode.group_fee_too_small` no longer carries
  `paid`/`required`, because the new rendering scales both figures into a
  variable-suffix unit that cannot be parsed back into a microAlgo count.
  `errors.algod.group_fee_too_small.body` was rewritten in all six locale
  bundles for the same reason the overspend copy was; the key is unchanged,
  so bidirectional i18n parity holds.

Both misses had the same downstream cost, not just a wrong error code:
`unknown_node_error` is one of `classifySubmitFailure.ts`'s
`NO_NODE_VERDICT_CODES`, so a definitively-rejected transaction — algod said
no, clearly and immediately — was instead treated as an indeterminate
outcome. The user sat through `submitAndAutoRefreshCore`'s unknown-outcome
verification retry loop, then still got an "outcome unknown" error, for a
rejection algod had actually stated in plain terms on the first response.
No mock could have caught this class of bug: the regex was tested against
strings the test author wrote, and the test author made the same wrong
assumption about algod's format that the regex encoded. Only a real
algod 5.0.0-stable response could disagree.

See `conformance/src/suites/submission/rejections.spec.ts` for the overspend
and expired assertions (plus the corrupted-group-id case that remains open —
gap 5 above), and `conformance/src/suites/fees/pooling.spec.ts` for the
group-fee one.

All three are the same failure, three times over: a regex written against a
rendering the author had seen, never re-checked against the node, and
silently falling through to `unknown_node_error`. That code is one of
`classifySubmitFailure.ts`'s `NO_NODE_VERDICT_CODES`, so each one turned a
flat "no" from algod into an indeterminate outcome, a
`verifyLandedWithRetries` cycle, and finally an "outcome unknown" error for a
transaction the node had definitively rejected on the first response.

## Troubleshooting

- **`LocalNet is not reachable at http://localhost:4001`** — Docker isn't
  running, or the containers aren't up. `pnpm localnet:status`, then
  `pnpm localnet`.
- **The indexer sits at round 0 and `suites/history`/`suites/accounts`
  time out waiting for a transaction to appear** — a stale
  `algorandfoundation/conduit-localnet` image. Conduit logs
  (`docker logs algokit_sandbox_conduit`) show
  `unknown protocol ... this usually means you need to upgrade` and
  `error decoding block for round 1`: the pinned image predates the running
  algod's block format, so nothing is ever ingested and algod-only suites
  stay green while indexer-backed ones cannot pass.
  `docker pull algorandfoundation/conduit-localnet:latest` then
  `pnpm localnet:reset`. CI pulls fresh images, so this is a local-only
  trap.
- **Stale containers / weird chain state** — `pnpm localnet:reset` wipes and
  restarts LocalNet with a clean genesis. Note this **changes the genesis
  hash**; if you have the app pointed at a custom LocalNet network config
  (Settings → Developer → Node Settings), re-enter it afterwards, or
  **Fetch from node** to pick up the new hash.
- **An unresolvable-import crash on the very first test file, not a test
  failure** — the `dist/` prerequisite above wasn't met. Run `pnpm run
build` and re-run.
- **A single spec file crashes at collection with `Cannot find module
'.../react-native-mmkv/.../createMMKV'`** — `wallet-extension-provider`'s
  real build (not the `vitest.setup.ts` mock) got loaded. `vitest.config.ts`
  aliases it to `extensions/provider/src` for exactly this reason — confirm
  that alias is still present if this resurfaces after a `vitest.config.ts`
  edit.
- **A decoded-diff failure you don't understand** — see "Reading a
  decoded-diff failure" above; check the value types (`bigint` vs `number`,
  hex vs `(unset)`) before assuming the chain behavior changed.
