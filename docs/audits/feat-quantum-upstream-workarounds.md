# Upstream Issues for Discussion — provider-migrations canary

Active workarounds in Pera caused by upstream
defects in the Algorand / AF keystore / passkey / autofill ecosystem
packages. Each entry names the upstream package, the symptom, the root
cause, what we do in-repo to work around it, and the fix we need from
upstream so the workaround can be removed.

**Re-verified against the installed tree on the provider-migrations canary
upgrade.** Every workaround below is still load-bearing — the upgrade closed
none of them outright, though several changed shape. `**Status:**` on each
entry records what actually moved. Versions at the time of that pass:
`react-native-keystore@1.0.0-canary.19`,
`react-native-passkey-autofill@1.0.0-canary.24`,
`keystore@1.0.0-canary.17` (pinned), `keystore-core`/`keystore-web@1.0.0-canary.3`,
`provider-migrations@1.0.0-canary.1`. Entries below that name canary.14 or
canary.22 are describing when the defect was found, not where it lives now.

**Merge-time action:** an older, divergent copy of this file is sitting
untracked in the main checkout at the same path. This branch's version is a
superset — delete that copy when merging rather than resolving against it.

---

## algosdk (prerelease `feat/pq` branch, published as `@joe-p/algosdk`)

### A1. Tag ships no build output — git dependency is uninstallable

**Package:** `algosdk` prerelease tag `v3.7.0-beta.1`

**Symptom:** A `github:` / `git+https:` dependency on the tag installs a
package with no entry points (`dist/` holds only an ESM `type` marker;
`main`/`types` point at `dist/cjs` / `dist/types` which only `prepare`
produces).

**Root cause:** pnpm rewrites git specs to a codeload tarball and then
refuses to run lifecycle build scripts ("has to be built but the build
scripts were ignored"). Neither `onlyBuiltDependencies` nor
`dangerouslyAllowAllBuilds` lifts this.

**Workaround:** `tools/vendor-algosdk.sh` clones the tag, runs
`npm ci && npm run build`, and `npm pack`s the result into
`libs/algosdk-3.7.0-beta.1.tgz`; `pnpm-workspace.yaml` overrides `algosdk` to
the tarball. The script pins the commit the tag pointed at, so a silent
retag fails the build.

**Upstream fix:** Publish the beta to npm with prebuilt `dist/`. Reverting is
then a one-line config change (drop the override, delete the tarball).

**Status:** Open, unchanged. All three legs intact —
`tools/vendor-algosdk.sh`, `libs/algosdk-3.7.0-beta.1.tgz`, and the
`overrides` entry in `pnpm-workspace.yaml`.

### A2. Peer resolution ignores root override for packages without a direct algosdk dep

**Package:** `@algorandfoundation/algokit-utils` + pnpm peer resolution

**Symptom:** Four packages that depend on `algokit-utils` but never declare
`algosdk` directly resolved the transitive peer against stock `algosdk@3.6.0`
instead of the PQ-capable prerelease — two copies of algosdk in the tree,
`AlgoAmount` type mismatch, broken onramp build.

**Root cause:** pnpm's peer-dependency auto-install does not apply root-level
`overrides` to a package's transitive peer unless the importing package also
declares the dependency directly.

**Workaround:** Added `"algosdk": "catalog:"` to each of the four packages so
their own dependency graph constrains the peer resolution.

**Upstream fix:** None needed from algokit-utils — this is pnpm's documented
behaviour. Once `algosdk` publishes the PQ release to npm under the official
name, the alias/override becomes unnecessary and these explicit deps resolve
naturally. Noted here only because it surfaces as a gotcha for anyone else
consuming the prerelease alongside algokit-utils.

**Status:** Open, unchanged. The four peer-pinning declarations are
`apps/browser`, `packages/background`, `packages/onramp`, `packages/shared` —
the ones that declare `algosdk` but never import it. Other packages declare it
because they genuinely use it; those are not part of this workaround.

---

## `@algorandfoundation/react-native-keystore`

### K1. Lone layout-version stamp blocks master-key minting on fresh install

**Package:** `@algorandfoundation/react-native-keystore` canary.14

**Symptom:** A fresh install cannot create or import any account — the first
write fails with `MasterKeyNotFoundError`.

**Root cause:** canary.14 mints the Keychain master key only while the
keystore MMKV store is empty (`masterKeyForWrite`), on the reasoning that a
populated store with no master means one went missing and minting a
replacement would orphan every sealed record. Our layout migration stamps a
`pera/keystore-layout-version` marker on fresh install so later launches skip
the scan. That single key makes the store non-empty, so the master key is
never minted. Upgrades from canary.13 are unaffected (they already have a
master key and real records).

**Workaround:** `preflight/0003-remove-layout-version-stamp.ts` deletes the
stamp. Nothing writes it any more, so the surviving workaround is pure
recovery for devices that ran an affected build.

**Upstream fix:** `masterKeyForWrite` should not treat non-record marker keys
(e.g. a layout-version stamp) as "content" when deciding whether to mint.
Alternatively, expose a `stampLayoutVersion` API that handles the empty-store
case internally.

**Status:** Open — the upstream gate survived canary.14 → canary.19 verbatim
(`masterKeyForWrite` still throws when `getAllKeys()` is non-empty). Only the
Pera side changed: `migrateKeystoreLayout.ts` is gone, and the stamp is now
deleted rather than conditionally skipped.

This gate is also why the migrations ledger has its **own** MMKV instance
(`pera-provider-migrations`) and never the keystore's. A ledger blob in the
keystore store would be exactly the "lone marker key" this finding describes,
and would brick every fresh install. Upstream's own `adoptLegacyRecords`
excludes the ledger key from its scan for the same reason — so the constraint
is understood upstream, just not generalised to arbitrary marker keys.

### K2. Foreign records from the iOS credential provider strand the migration

**Package:** `@algorandfoundation/react-native-keystore` canary.14 +
`@algorandfoundation/react-native-passkey-autofill` (iOS credential provider)

**Symptom:** Every launch re-scans the keystore, re-reads the Keychain master
key, and fails on the same record forever, logging an error each time.

**Root cause:** The iOS credential provider shares the keystore MMKV instance
but encodes its record payloads differently. Its **envelope** fields (`iv`,
`tag`, `content`) are padded base64 and open fine; the **plaintext payload**
inside is written by `encodeKeyData` as unpadded base64url, and the keystore's
legacy `decode` path rejects it (`padding: invalid, string should have whole
number of bytes`). So the throw is in `decode`, not `openData` — the record
fails while being read, before `isPasskeyCredential` can identify and skip it
the way the Android provider's records are skipped. The throw counts as a
migration failure, the version stamp is withheld for retries, and since the
record never becomes readable, the stamp is withheld for good.

(The original write-up of this finding attributed the throw to `openData`
rejecting an unpadded envelope. That was wrong in mechanism, though not in
consequence; corrected here after re-reading both packages.)

**Workaround:** The preflight revisions read each record in its own step and
skip any that will not open (`0002-lift-nested-material.ts`,
`0004-adopt-material-less-records.ts`). The entry is left on disk so the owning
process is unaffected.

**Upstream fix:** The iOS credential provider should either match the
keystore's encoder, or use a separate MMKV namespace. Once the iOS provider's
records decode cleanly (or live elsewhere), the skip can be removed.

**Status:** Open — the encoder mismatch is unchanged in canary.24, and the
root cause above has been corrected in place. One regression to record.

_Regression, and a correction to the original workaround:_ the old code tried
to tell foreign envelopes from our own by base64 padding on `{iv, tag, content}`
(`isForeignEnvelope`, `migrateKeystoreLayout.ts` @ `31ccac075^:131-172`). Given
the corrected root cause above, that test could never have fired for the iOS
records it targeted — their envelope fields are padded
(`PasskeyCredentialStore.swift:737-739`); only the payload inside is not. What
it did do was rethrow on anything else, so a genuinely corrupt Pera record still
surfaced. The current revisions skip on any open-or-decode failure, which is
what actually handles K2, but a corrupt record of ours is now skipped silently
too. Nothing is deleted — the record is left flat on disk — and **M1 below makes
the rethrow impossible anyway**: a throw in `up` is a permanent boot block, not
a retry. A shape-based discriminator survives for a different consumer
(`isNativeProviderRecordPayload`,
`packages/passkeys/src/native/nativeProviderRecord.ts:201`) but does not guard
these revisions.

---

## `@algorandfoundation/keystore-web` / `keystore-chrome`

### W1. Web build has no engine — keystore-chrome is a partial port

**Package:** `@algorandfoundation/keystore-web` + `keystore-chrome` (Pera's
extension)

**Symptom:** After moving to canary.14, the web build had no keystore engine
at all — `keystore-chrome` has no engine factory.

**Root cause:** `keystore-chrome` is a partial port for the browser extension
(password vault, auto-lock, passkey unlock, WebAuthn signer). It was never a
full engine; when key storage required a real engine (canary.14), the Metro
alias to the port no longer covered it.

**Workaround:** `extensions/provider/src/keystore/createKeystore.web.ts`
composes the engine itself — `keystore-core`'s `createKeyStore` over
`keystore-web`'s IndexedDB driver, with `shims: () => createDefaultShims()` —
via Metro's `.web.ts` platform-extension resolution.

**Upstream fix:** `keystore-chrome` should either expose its own engine
factory built on `keystore-core` + a chrome-storage driver, or re-export
`keystore-web`'s engine so the Metro alias covers key storage. This is Pera's
own extension, so the fix is ours to make — flagged here because the
keystore-web / keystore-core split is what makes the partial-port gap
visible.

**Status:** Open. The composed engine in `createKeystore.web.ts` still carries
web key storage, and `keystore-chrome` still supplies no factory of its own.

The port is written against `@algorandfoundation/keystore@1.0.0-canary.17`,
which is why that dependency is pinned rather than tracked (rationale in
`pnpm-workspace.yaml`, beside the pin). Up to canary.17 the meta package is a
self-contained implementation exposing a flat function API —
`clearKeyData`/`encrypt`/`decrypt`/`sign`/`verify` and friends, which is
exactly what `extensions/keystore-chrome` imports. Later versions replace it
with a thin `export * from "@algorandfoundation/keystore-node"` re-export
where that API is gone, pulling in `keystore-core`/`-node`/`-web`;
`keystore-node` in turn reaches the native `@napi-rs/keyring` through
`optionalDependencies` + `createRequire`. Verified here against canary.23; the
pin note puts the boundary at canary.18. Either way, bumping the pin means
porting `keystore-chrome` off the flat API first — one piece of work, not two.

### W2. `createWebKeyStore` resolves shims eagerly — blocks startup

**Package:** `@algorandfoundation/keystore-web`

**Symptom:** Composing the engine at module scope in the provider singleton
blocks startup on three WASM loads (`falcon-1024`, XHD, dp256) before any
module using the provider can finish evaluating.

**Root cause:** `createWebKeyStore` types `shims` as a resolved `Shim[]`,
not a thunk, even though the core orchestrator it forwards to also accepts
`() => Shim[]` / `() => Promise<Shim[]>`.

**Workaround:** `createKeystore.web.ts` calls `createKeyStore` (the core
orchestrator) directly with `shims: () => createDefaultShims()` instead of
`createWebKeyStore`.

**Upstream fix:** `createWebKeyStore` should accept a `shims` thunk and
forward it to the core orchestrator, matching the core's existing contract.
Then `createKeystore.web.ts` can switch back to `createWebKeyStore`.

**Status:** Open, unchanged. `keystore-web@1.0.0-canary.3` still types `shims`
as a resolved array, and `createKeystore.web.ts` still bypasses
`createWebKeyStore` to pass a thunk.

---

## `@algorandfoundation/react-native-passkey-autofill`

### P1. "Rocca Wallet" hardcoded in all user-facing strings

**Package:** `@algorandfoundation/react-native-passkey-autofill` canary.22

**Symptom:** iOS shows "Rocca Wallet" (the package author's product) verbatim
in the Face ID / passcode sheet ("Create passkeys with Rocca Wallet") and in
the extension's failure path ("Open Rocca Wallet once, unlock it, then try
again"). No plugin option overrides these.

**Root cause:** Three Swift literals and one plist description string are
hardcoded to "Rocca Wallet".

**Workaround:** Extended the pnpm patch
(`patches/@algorandfoundation__react-native-passkey-autofill@1.0.0-canary.24.patch`)
to interpolate the `label` the plugin already receives into the plist
description, and replace the three Swift literals with "Pera Wallet".

**Upstream fix:** Accept a `label` / `displayName` plugin option and use it in
all user-facing strings. Drop the patch once exposed.

**Status:** Open. Still unfixed upstream as of canary.24 — every "Rocca"
string survives in the unpatched package. The patch was rebased onto
canary.24, not dropped, and must stay. It now carries two further unrelated
changes: the legacy Android service class name (so Credential Manager keeps
the user's enablement across the upgrade) and relying-party scoping, so the
provider does not hand every stored passkey to any caller (PERA-4714 — also
still unfixed upstream).

### P2. Native provider record format incompatible with canary.14 keystore

**Package:** `@algorandfoundation/react-native-passkey-autofill` (Android
credential provider) + `@algorandfoundation/react-native-keystore` canary.14

**Symptom:** A record written with the keystore's own `sealData`/`encode`
helpers is invisible to the Android credential provider — it silently
returns no key material. No error is thrown.

**Root cause:** Two independent format mismatches:

1. **GCM tag.** `sealData` emits `{iv, content}` with the GCM tag appended to
   the ciphertext. The provider's `decodeKeyData` only decrypts when the
   envelope has `iv` **and** `tag` **and** `content` as separate fields;
   otherwise it returns the envelope object itself (no key material).
2. **Byte arrays.** `encode` serialises `Uint8Array` as `{"$u8":
"<base64>"}`. The provider does `getJSONArray("privateKey")` /
   `optJSONArray("seed")` and expects a **JSON array of byte values**
   (numbers).

**Workaround:** `packages/passkeys/src/native/nativeProviderRecord.ts` is a
dedicated module expressing the provider's on-disk contract:
`sealNativeProviderRecord` splits the GCM tag back out into a separate `tag`
field, writes byte arrays as JSON arrays of numbers, and uses standard
base64. Its live production writer is
`packages/migrate/src/migrate/passkeys/writeNativePasskeyEntry.ts`, which
writes at the bare `credentialId`.

**Upstream fix:** Serve `privateKey` from `m/` and accept `{$u8}` byte fields,
so a credential can live in `k/`+`m/` like every other record. Only then can
`nativeProviderRecord.ts` and the un-adoption repair below be deleted. Note
there are **two** copies of this contract to remove: the module above, and a
deliberate restatement in
`extensions/provider/src/keystore/migrations/nativeCredentialRecord.ts`
(`sealNativeCredentialRecord`, `:71`), kept separate because importing back
from `packages/passkeys` would be a circular workspace dependency (its own doc
comment, `:19-24`).

**Status:** Partially closed for the parent, open — and larger — for
credentials. Do not read "phase 3 landed" as closing this.

_Closed:_ the HD-root bare-id dual-write is gone.
`bootstrapPasskeyAutofill.ts` performs no storage writes at all, and
`preflight/0001-retire-hd-root-shadow.ts` actively deletes leftover shadows.
canary.23/.24 genuinely scan `k/` for the **derivation parent** on both
platforms.

_Not closed:_ credential records never moved. canary.24's split path carries
no key material — Android's metadata path sets `privateKey = ""` and
re-derives, and iOS's only keystore-to-credential path guards on a JSON
number array for `privateKey`, which a split record does not have. The legacy
`iv`+`tag`+`content` envelope and number-array requirements are still in
force.

_Worse:_ because credentials stay flat, upstream's own `adopt-flat-records`
revision now consumes them — adopting a migrated credential into `k/`+`m/`
and deleting the flat original that neither provider can read. Pera therefore
carries `repairs/0002-rematerialize-passkey-credentials.ts`, which un-adopts
them again. That is a strictly larger workaround than the dual-write it
replaced. It cannot be a dual-write: Android's `getCredential` tries the
split layout first and returns on a hit, so a surviving `k/` record wins and
re-derives the wrong key. See `packages/passkeys/src/native/README.md`.

### P3. iOS credential provider uses a different base64 encoder (see K2)

The iOS provider's unpadded base64 records are the foreign-record strand
covered in **K2** above. The fix is the same: pad to match, or use a separate
namespace.

---

## Falcon PQ libraries (`@joe-p/react-native-falcon`, `falcon-1024`)

### F1. Module-scope side effects crash on import off-device

**Packages:** `@joe-p/react-native-falcon` (Nitro module) + `falcon-1024`
(WASM)

**Symptom:** Importing the Falcon provider barrel crashes:

- The native provider's entry instantiates a HybridObject at load time and
  throws off-device.
- The WASM provider's `falcon-1024` CJS entry is Emscripten glue that reads
  `__filename` at module scope, which Hermes/Metro never define, crashing
  the app at startup.

**Root cause:** Even after switching provider selection to build-time (Metro's
`.native.ts` resolution), the pq barrel re-exports both factories directly,
so merely importing the barrel pulls both files in on every platform.

**Workaround:** Both `createRNFalconProvider` and `createWasmFalconProvider`
use lazy `require` (not top-level `import`) inside the factory, so the native
module / WASM glue is only evaluated when the factory is actually called.
`import type` is used for type-only imports (erased at compile time).

**Upstream fix:** Guard module-scope side effects so they no-op
(lazy-initialise) when the host environment is absent. Once
`falcon-1024`'s Emscripten entry handles a missing `__filename` and the Nitro
HybridObject defers instantiation to first call, the lazy `require` can
become normal imports.

**Status:** Open, unchanged. Both `rnFalconProvider.ts` and
`wasmFalconProvider.ts` still lazy-`require` inside the factory, with
`import type` for the type-only imports. The rationale is not obsolete — it is
the only thing keeping the barrel importable off-device.

---

---

## `@algorandfoundation/provider-migrations`

### M1. A rejecting revision is a permanent boot block

**Package:** `@algorandfoundation/provider-migrations` canary.1

**Symptom:** A migration revision whose `up` rejects does not degrade — the
app fails to boot, and keeps failing on every subsequent launch.

**Root cause:** `apply.js` writes the ledger entry only _after_ `up` resolves;
on rejection it records the failure and breaks out, throwing
`MigrationFailedError`. That rejects `migrations.ready`, which
`extensions/provider/src/singleton.ts` propagates into the keystore's `before`
gate, and the engine chains the storage driver's `ready` behind it. So the
keystore never becomes usable, and because nothing was written to the ledger,
the same revision runs and fails again next launch. For any _deterministic_
failure there is no way out but reinstall. (A transient failure — I/O, a
cancelled biometric prompt — does clear on the next launch.)

**Workaround:** Every Pera revision treats `up` as infallible: storage reads
and writes are individually guarded, and anything unexpected is recorded and
skipped rather than thrown. This includes the error-reporting paths
themselves, which must not throw while reporting.

**Upstream fix:** Distinguish "this revision cannot apply" from "the whole
migration run failed" — a per-revision decline that still advances the ledger
would remove the need for total in-revision guarding.

**Status:** Open. This is a design property of the engine rather than a bug,
but it is the single sharpest edge in the migrations tree and the reason the
revisions look defensive.

## Summary by upstream package

| #   | Package                                           | Issue                                                  | Upstream fix needed                                         | Status                                                                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A1  | algosdk (fork)                                    | Tag has no build output                                | Publish beta to npm with `dist/`                            | Active                                                                                        |
| A2  | algokit-utils + pnpm                              | Peer ignores root override                             | — (pnpm behaviour; resolved by official npm release)        | Active until npm publish                                                                      |
| K1  | react-native-keystore c.19                        | Lone stamp blocks master-key mint                      | `masterKeyForWrite` should ignore non-record marker keys    | Active — gate unchanged since c.14; also why the ledger needs its own MMKV                    |
| K2  | react-native-keystore c.19 + passkey-autofill iOS | Unpadded base64 strands migration                      | iOS provider: match the encoder or use a separate namespace | Active — root cause was misattributed; corrupt-record rethrow traded for M1-mandated skipping |
| W1  | keystore-web / keystore-chrome                    | Web has no engine (partial port)                       | Port exposes engine or re-exports keystore-web              | Active (Pera's extension) — blocked behind the `keystore` canary.17 pin                       |
| W2  | keystore-web c.3                                  | `createWebKeyStore` resolves shims eagerly             | Accept `shims` thunk                                        | Active                                                                                        |
| P1  | react-native-passkey-autofill c.24                | "Rocca Wallet" hardcoded in UI strings                 | `label`/`displayName` plugin option                         | Active — patch rebased onto c.24; also carries PERA-4714 RP scoping                           |
| P2  | react-native-passkey-autofill c.24                | Provider credential format incompatible with `k/`+`m/` | Serve `privateKey` from `m/`, accept `{$u8}`                | Active — parent moved in c.23/.24, credentials did not; workaround grew                       |
| F1  | @joe-p/react-native-falcon + falcon-1024          | Module-scope side effects crash off-device             | Guard side effects for absent host env                      | Active                                                                                        |
| M1  | provider-migrations c.1                           | A rejecting `up` blocks boot permanently               | Per-revision decline that still advances the ledger         | Active                                                                                        |
