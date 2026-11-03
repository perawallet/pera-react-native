# Chains

How a chain plugs into the wallet, which knobs decide what a build ships, how a chain is switched
off in production, and what adding one touches.

## The model

A **chain** is one entry in `CHAIN_IDS`; a **family** is one entry in `CHAIN_FAMILIES`
(`packages/chain-contract/src/models/identity.ts`). Algorand is a family of one. Ethereum, Base, BSC,
Arbitrum, Avalanche and Polygon are chains of the `evm` family, all built from
`packages/chain-ethereum`.

Each chain ships a `ChainModule` (`packages/chain-contract/src/models/module.ts`):

| Field                    | Holds                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `descriptor`             | Id, family, networks and their CAIP-2 ids, signing schemes, URI schemes, `enabledByDefault` |
| `capabilityDefaults`     | A boolean for every capability: the build layer before env overrides                        |
| `capabilityRestrictions` | The developer modes a capability is off in                                                  |
| `register(ctx)`          | Adds the chain's adapter to every feature registry it implements                            |
| `remoteConfigDefaults`   | Chain-specific remote-config keys; the names are a wire contract and never change           |
| `pinnedHosts`            | Hosts to certificate-pin once their remote flag is `true`                                   |

`register` receives a `ChainContext`: the current scope, the chain's endpoints, its Pera backend and
services, request timeouts and the KMS. How endpoints and the Pera backend reach a chain is in
[Architecture: How a chain reaches its backends](ARCHITECTURE.md#how-a-chain-reaches-its-backends).

Every EVM chain is a row in `packages/chain-ethereum/src/chains/table.ts` (`EvmChainRow` in
`chains/types.ts`). `chains/create-evm-chain.ts` turns a row into a descriptor, and
`packages/chain-ethereum/src/module.ts` builds `evmChainModules` from the rows, so an EVM chain has
no registration code of its own. Every EVM chain shares CAIP-2 `eip155:<id>`, the coin-type-60
derivation path, the `ethereum` URI scheme, the Ledger Ethereum app and WalletConnect's `eip155`
namespace.

`enabledByDefault` decides whether a new account is enabled on the chain without being asked: on
create, and as the family's fallback when an import or watch finds no activity. A new EVM chain
starts at `false`.

## Registration

`apps/mobile/src/bootstrap/chain-adapters.ts` is the composition root. Generic packages define the
adapter registries and never import a chain package; the app picks which chains ship.

1. `buildChainSetup` (`packages/chain-contract/src/chain-registry.ts`) pairs `config.chains` with the
   modules the app supplies. A chain enabled in config without a module throws at startup.
2. `registerChainSetup` skips disabled entries, registers each enabled descriptor with its
   capabilities, then calls `module.register(ctx)`. The descriptor is registered here, not by the
   module, so no module can forget it.
3. `declareChainPlatformInputs` declares `chain_<id>_overrides` for every id in `CHAIN_IDS`, enabled or
   not, so a kill switch reaches a chain the build doesn't register. It must run before remote config
   initialises.

The browser extension's offscreen document runs the same `registerChainAdapters`.

## Capability layers

Capabilities (`CHAIN_CAPABILITIES` in `packages/chain-contract/src/models/capabilities.ts`) are
independent booleans: `send`, `receive`, `history`, `dappConnect`, `nft` and the rest. None implies
another. Each one resolves per chain in `resolveCapabilityWithSource`
(`packages/chain-contract/src/capabilities/resolve.ts`), first match wins:

1. **Kill switch.** `chain_<id>_overrides` with `enabled: false` turns every capability off, before
   any layer is read (`capabilities()` in `chain-registry.ts`).
2. **Developer.** The Feature Flags screen. Skipped wherever `areConfigOverridesIgnored()` is true.
3. **Chain mode.** Off when the chain's network is in a developer mode its module's
   `capabilityRestrictions` lists. It sits above remote because remote values are mostly `true` and
   would turn the feature back on in developer mode.
4. **Remote.** The `capabilities` object in `chain_<id>_overrides`.
5. **Build.** `capabilityDefaults`, replaced by `CHAIN_<ID>_CAPABILITIES` when that is set.

A layer whose value isn't a boolean falls through rather than being coerced. How a capability
combines with the platform gate and app flags is in
[Architecture: Turning features off per platform](ARCHITECTURE.md#turning-features-off-per-platform).

## The parity rule

A chain may enable a capability only if it registers an adapter in every registry that capability
needs. `CAPABILITY_ADAPTERS` (`packages/chain-contract/src/capabilities/adapters.ts`) is the map:
`send` needs `transfer`, `transactionPlanner` and `broadcaster`; `nft` needs `accounts` and `assets`.
A capability with no entry needs no chain adapter of its own.

`capabilityAdapterContractTests` (`packages/chain-contract/src/__tests__/capability-adapter-contract.ts`)
checks it, and also that every registered chain has a boolean default for every capability.
`apps/mobile/src/__integration__/capability-parity.spec.ts` runs it at the composition root with every
chain enabled.

The test reads the build layer only. A remote `capabilities` entry can turn on a capability whose
adapter the chain lacks, so use remote config to switch capabilities off, not on.

## Chain UI slots

App code never branches on a chain; it asks the chain's UI for a slot. `ChainUi`
(`apps/mobile/src/modules/chain-ui/types.ts`) is one family's set: `transactionDetails`,
`assetDetails`, `collectibleDetails`, `sendConfirmation`, `customNode`, `familyLabel`,
`accountOptions`, `watchAccountCopy`, `wrongNetworkAddress`, `passphraseCompatibilityKey` and
`addressSearchPlaceholder`. Each slot is optional, and a reader handles its absence.

A single chain may replace only the slots in `ChainUiOverride` (`assetDetails`, `collectibleDetails`,
`sendConfirmation`, `customNode`, `accountOptions`), since only their readers always hold a chain id.
`chainUiFor(family, chainId?)` in `apps/mobile/src/modules/chain-ui/registry.ts` layers a chain's
overrides over its family's slots. The families contribute from
`apps/mobile/src/modules/algorand/chain-ui.ts` and `apps/mobile/src/modules/ethereum/chain-ui.ts`.
Which files may import a chain package is in `apps/mobile/CLAUDE.md` ("Module Boundaries").

## Kill-switch contract

Each chain has a remote-config string `chain_<id>_overrides` (`chainOverridesKey` in
`packages/remote-config/src/utils/readCapabilityOverrides.ts`), holding JSON:

```json
{ "enabled": false, "capabilities": { "send": false } }
```

- Only an explicit `"enabled": false` switches a chain off. A missing `enabled` leaves it on.
- It works for every id in `CHAIN_IDS`, including a chain this build doesn't register.
- An empty string, invalid JSON or a schema mismatch means no overrides: one `warn` per distinct bad
  value, never a throw.
- Unknown capability names and non-boolean values are dropped one by one, so an older build still
  honours `enabled: false` next to a capability it doesn't know.
- A saved Feature Flags value for the same key beats the remote one, including `enabled`, wherever
  config overrides aren't ignored.

A switched-off chain keeps its accounts listed with `ChainUnavailableNotice`
(`apps/mobile/src/components/ChainNotice/`) instead of hiding them. `useChainAvailability` reports it
unavailable, background sync and submission reconciliation skip it
(`packages/background/src/service/sync-service.ts`), account sync and new-account eligibility leave it
out, and a deeplink to it resolves to `chain-unavailable`.

The switch is all or nothing, for every user on every build. Opening a chain in stages is a release
decision; see [Release](RELEASE.md).

## Build knobs

The build bakes these into `packages/config/src/generated-env.ts` through
`tools/dev/generate-config.sh`, which loads the root `.env` (gitignored) and an optional
`PERA_ENV_OVERLAY`. `turbo.json` lists them in `globalEnv` so a change invalidates the cache.

| Knob                          | Effect                                                                                                          | Fails when                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `CHAINS`                      | Comma list of chain ids the build registers. Unset means `algorand`.                                            | An unknown id (`packages/config/src/main.ts` parses it at import). |
| `CHAIN_<ID>_CAPABILITIES`     | Comma list replacing the chain's build layer: exactly these capabilities are on, every other one is off.        | An unknown capability name.                                        |
| `<CHAIN>_<NET>_RPC_URL`       | The one JSON-RPC URL for an EVM network. No default and no fallback; a network without one is left out.         | `CHAINS` lists the chain and any of its networks has no URL.       |
| `<CHAIN>_<NET>_PERA_SERVICES` | Comma list of the Pera services the backend serves for the network. Empty means no Pera backend for that scope. | A service outside `EVM_PERA_SERVICES`.                             |

The per-network variable names come from the chain package table, `tools/dev/chain-packages.cjs`,
whose EVM entry reads `packages/chain-contract/src/models/evm-networks.json`. The build script reads
the table, and `scopeConfigKeys` in `packages/config/src/main.ts` names the same keys for the app.
`packages/config/README.md` covers the schema and how each CI channel sets `CHAINS`;
`tools/__tests__/bitrise-chains.test.sh` pins the CI values.

`CHAINS` also decides what Metro bundles: unless it lists one of a chain package's chains, that
package's `mobileStubbedModules` in the table resolve to their `.stub.ts` twins, so for EVM viem stays
out of the build.
See [Architecture: Keeping code out of a build](ARCHITECTURE.md#keeping-code-out-of-a-build).

Chain ids must be one word. `chainCapabilitiesEnvKey` in `packages/config/src/main.ts` capitalises
only the first letter, while `chain-packages.cjs` PascalCases each hyphen-separated part, so a
hyphenated id would bake its capability list under a key the app never reads. The table's
`validateChainPackages` fails the build on one.

## Adding an EVM chain

Most EVM wiring reads `evm-networks.json` and the chain table, so the list is short.

- [ ] `packages/chain-contract/src/models/identity.ts`: append the id to `CHAIN_IDS`. Append only:
      device registration's refusal fallback drops the last chain first.
- [ ] `packages/chain-contract/src/models/evm-networks.json`: the mainnet and testnet networks, each
      with its `tier` and `eip155ChainId`.
- [ ] `packages/chain-ethereum/src/chains/table.ts`: an `EvmChainRow` with native asset and SLIP-44
      coin type, explorer per network, fee strategy, block time, finality, `enabledByDefault: false`,
      and any per-chain `capabilities` or `restrictions`. Update `src/chains/__tests__/table.spec.ts`
      and `src/__tests__/evm-chains.ts` where they enumerate rows.
- [ ] A fee strategy the existing kinds don't cover: `EvmFeeStrategy` in `src/chains/types.ts`,
      `src/transfer/fees.ts` and `src/transfer/submission.ts`, and [EVM fees](EVM_FEES.md).
- [ ] `lanekeep/rules/no-chain-identity-in-shared-packages.ts`: add the id to its copy of `CHAIN_IDS`;
      the rule's spec fails until the two match.
- [ ] `apps/mobile/assets/icons/chains/<id>.svg`, and `apps/mobile/src/modules/ethereum/chain-icons.ts`:
      `EVM_CHAIN_ICONS` is partial (a missing logo falls back to initials), `EVM_NATIVE_ASSET_ICONS` is
      total and won't compile without the new chain.
- [ ] `apps/mobile/src/modules/ethereum/chain-ui.ts`: an `evmChainUiOverrides` entry, only where the
      chain's UI differs from the family's.
- [ ] `turbo.json`: add `<ID>_*` to `globalEnv`.
- [ ] `.bitrise/bitrise.yml` and `ci/pipelines.yml`: the id in each staging `CHAINS`, and every
      network's `_RPC_URL` and `_PERA_SERVICES`. `tools/__tests__/bitrise-chains.test.sh` checks both.
- [ ] Local EVM network: the chain in `EvmnetChain`, `EVMNET_CHAINS` and `EVMNET`
      (`conformance-evm/src/harness/evmnet.ts`), an Anvil service in `tools/dev/evmnet.compose.yml`,
      `CONTAINERS` in `tools/dev/evmnet.sh`, the expected list in `tools/__tests__/evmnet.test.sh`,
      and the node count in the root `README.md`. An OP Stack chain may need its own fixture beside
      `conformance-evm/src/vectors/opStackPredeploys.ts` (captured by
      `tools/dev/capture-op-predeploys.sh`).
- [ ] Your `.env`: the id in `CHAINS` and an RPC URL per network, or `generate-config.sh` fails.
- [ ] Outside the repo: the Pera backend must accept the chain id for device registration and serve
      the services listed; the `chain_<id>_overrides` key needs no code.

No change: composition roots, translations (chain names come from the row's `displayName`), Ledger,
WalletConnect, derivation paths, `apps/mobile/package.json`.

## Adding a chain family

Model the package on `packages/chain-algorand`: `index.ts` exports only the chain id, `chainModule`
and `registerChain`, and everything else is a `package.json` subpath export.

**Contract**

- [ ] `packages/chain-contract/src/models/identity.ts`: append to `CHAIN_IDS` and `CHAIN_FAMILIES`
      (append only: a contact's backup record is keyed on its first family in this order), and add a
      `NativeNetworkRef` member.
- [ ] `packages/chain-contract/src/models/domain.ts`: a member for the family in every family-keyed
      union, and a `SigningScheme` if it signs on a new curve.

**The package**

- [ ] `packages/chain-<id>/`: `package.json` (`@perawallet/wallet-core-chain-<id>`), the tsconfigs,
      vite and vitest configs, `src/module.ts`, `src/register.ts`, `src/capability-defaults.ts` and
      `src/test-handlers.ts`. `pnpm-workspace.yaml` picks it up; `tools/check-layer-tiers.mjs` checks
      its dependencies.
- [ ] An adapter for every registry `CAPABILITY_ADAPTERS` lists against each capability it enables.
- [ ] A new curve: a keystore shim under `extensions/provider/src/keystore/shims/` and a library-seam
      rule like `lanekeep/rules/secp256k1-library-seam.ts`. See [Security](SECURITY.md#evm).

**Config and build**

- [ ] `packages/config/src/network-config.ts`: the family's chain config type, its
      `ChainConfigByChain` entry and its `CHAIN_ENDPOINTS` entry.
- [ ] `packages/config/src/main.ts`: a `chainRequestTimeouts` default and any family-specific fields.
- [ ] `tools/dev/chain-packages.cjs`: an entry with the package's chains and networks, its stubbed
      mobile entry modules (each with a `.stub.ts` beside it) and its per-network config fields.
      `generate-config.sh` bakes `CHAIN_<ID>_CAPABILITIES` and every field from it, and fails a build
      whose `CHAINS` lists the chain without a required one.
- [ ] `turbo.json`: the family's env prefix in `globalEnv`.

**App wiring**

- [ ] `apps/mobile/package.json` (and `apps/browser/package.json` if the extension ships it): the
      workspace dependency.
- [ ] `apps/mobile/tsconfig.json`: a path for the package's `test-handlers`.
- [ ] `apps/mobile/src/bootstrap/chain-adapters.ts`: the module in the `buildChainSetup` map. To keep
      it out of builds that don't list it, gate it like `evm-chain-modules.ts` and its `.stub.ts`,
      listed in the package's table entry.
- [ ] `apps/mobile/src/modules/<family>/chain-ui.ts` and `chain-icons.ts`, registered in
      `modules/chain-ui/registry.ts`, `modules/chain-ui/nativeAsset.ts` and
      `modules/chain-ui/components/ChainIcon/useChainIcon.ts`; the logo in
      `apps/mobile/assets/icons/chains/`.
- [ ] Translations in every locale bundle: `chain_families.<family>`,
      `view_passphrase.compatibility.<family>`, `address_entry.search_placeholder_<family>` and the
      `address_entry.wrong_network` copy.
- [ ] A URI scheme: `apps/mobile/app.config.builder.js` and
      `apps/mobile/scripts/verify-{android,ios}-identity.mjs`; see [Deeplinks](DEEPLINKS.md).

**Lint rules**

- [ ] `lanekeep/shared/chain-package-allowlist.ts`: `COMPOSITION_ROOTS` for a new bootstrap file and a
      `CHAIN_UI_MODULES` entry for the app module.
- [ ] `lanekeep/rules/no-chain-identity-in-shared-packages.ts` (`CHAIN_IDS`),
      `lanekeep/rules/submission-seam.ts` (`BROADCASTER_OWNERS`),
      `lanekeep/rules/no-deep-module-imports.ts` (`EXTRA_ENTRIES`) and
      `lanekeep/rules/no-algorand-terms-in-chain-neutral-packages.ts` (the family's terms).
- [ ] `.oxlintrc.json` and `packages/devtools/oxlint/rules/hd-derive-claimed.js`: the package's key
      derivation file.

**CI and tests**

- [ ] `.bitrise/bitrise.yml`, `ci/pipelines.yml` and `tools/__tests__/bitrise-chains.test.sh`: the id
      and its env in staging.
- [ ] `.github/workflows/ci-pre-merge.yml` only if the package needs its own shard, and
      `e2e/tools/affected_flows.py` if it is on a core path.
- [ ] `apps/mobile/src/test-utils/` fixtures and the package's MSW handlers, and integration specs in
      `apps/mobile/src/__integration__/` that enable the chain. `capability-parity.spec.ts` must pass
      with it enabled.
