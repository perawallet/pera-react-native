# Architecture

Pera Wallet is a monorepo that keeps UI and business logic in separate layers.

## The big picture

```
┌──────────────────────────┐   ┌──────────────────────────┐
│       apps/mobile        │   │       apps/browser       │
│  (React Native UI, and   │   │  (MV3 extension shell)   │
│   the web UI via Metro)  │   │  manifest, service       │
│  composition root        │   │  worker, content         │
│                          │   │  scripts, offscreen      │
└───────────┬──────────────┘   └───────────┬──────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────┐
│                    packages/*                        │
│           (Headless Business Logic)                  │
│   Stores → Hooks → API Clients → Models              │
└────────────────────────┬────────────────────────────┘
                         │ getProvider()
                         ▼
┌─────────────────────────────────────────────────────┐
│                   extensions/*                       │
│   provider · drivers (platform-chrome,               │
│   platform-react-native, keystore-chrome) ·          │
│   Ledger transports → hardware-wallet                │
│                         ▼                            │
│   platform  (the PlatformServices contract)          │
└────────────────────────┬────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────┐
│    bottom tier: packages/config, packages/shared,    │
│             packages/chain-contract                  │
│             (usable from every tier)                 │
└─────────────────────────────────────────────────────┘
```

`apps/mobile` owns rendering, navigation, styling and gestures. `packages/*` owns everything else:
data fetching, stores, business rules, API clients, crypto. The split is what lets the logic be
tested without React Native, and what let the browser extension reuse it.

### Layer tiers

Dependencies point down the diagram and never up. `tools/check-layer-tiers.mjs` enforces this on
every workspace `package.json` (all dependency fields) in pre-push and CI:

| Tier                                                                          | May depend on                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `apps/*`                                                                      | anything                                                        |
| `packages/*` (business)                                                       | other packages, and extensions other than the Ledger transports |
| `extensions/*`                                                                | other extensions and the bottom tier                            |
| `extensions/platform` (the contract)                                          | the bottom tier only                                            |
| Ledger transports (`extensions/ledger-*` except `ledger-shared`)              | depended on only by apps and each other                         |
| bottom tier (`packages/config`, `packages/shared`, `packages/chain-contract`) | the bottom tier only                                            |

The bottom tier lives under `packages/` but is not business logic, so the directory alone does not
tell you the tier. `packages/devtools` is build and test tooling, allowed anywhere as a
devDependency.
`packages/chain-contract` is in the bottom tier because it depends on nothing, and `config` and
`shared` key their configuration and requests by its chain scope.

The app is the composition root. It picks the platform driver (a bundler alias, below) and registers
the concrete Ledger transports into `getProvider().hardwareWalletRegistry`
(`apps/mobile/src/bootstrap/hardware-wallet-transports.ts` and its `.web.ts` twin, called from
`App.tsx` and `App.web.tsx`). Keeping transports out of `extensions/provider` is what stops every
package that depends on the provider from inheriting the BLE/USB driver graph.

Hardware wallets are a provider extension (`extensions/hardware-wallet`, composed as
`WithHardwareWalletExtension`), not a platform service. Nothing about the registry differs per
platform; what differs is the transports, and the app already chooses those. Its types are wallet
domain (ARC-60 sign requests, Ledger device models), which the platform contract has no reason to
know. The extension supplies an empty registry, and `@perawallet/wallet-core-hardware-wallet`
re-exports its types beside the discovery logic.

The few edges that break a tier are listed in the check's `ALLOWLIST`, each with its reason; an
entry whose edge disappears fails the check, so it has to be deleted rather than left to permit the
edge's return. The check reads manifests, so it cannot see a bundler alias: `platform-driver`
declares only the contract, yet resolves to `platform-chrome` on web, which is why
`platform-chrome`'s own edges into business packages close a cycle no manifest shows.

### Two meanings of "extension"

These two directory names look related and are not.

| Path           | What it is                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/browser` | The browser extension: manifest, service worker, content scripts, offscreen document, and the build that assembles them into a loadable zip.                        |
| `extensions/*` | Platform extensions (drivers/plugins) for the upstream `@algorandfoundation/wallet-provider`, whose own API uses the word "extension". Nothing to do with browsers. |

That is why mobile-only packages like `wallet-extension-platform-react-native` and
`wallet-extension-ledger-react-native-usb` live under `extensions/`: they are platform _drivers_, not
browser code. The directory cannot be renamed, because the upstream provider API uses the term and
the churn would reach deep into the mobile app, so the disambiguation lives here instead.

### How a driver gets selected

`extensions/platform` declares the `PlatformServices` interface. `extensions/platform-driver` is a
stub that throws if it is ever reached, and each app's bundler aliases it to a concrete driver:
`platform-chrome` on web, `platform-react-native` on native (see `apps/mobile/metro.config.js`).
Business logic in `packages/*` reaches the resolved services only through `getProvider()`
(`extensions/provider`), so it depends on the interface and never on a platform. That is what keeps
`chrome.*` out of `packages/`, with one deliberate exception: `packages/browser-runtime` is the
extension's MV3 runtime (message routing between realms, dApp, WalletConnect, passkey and integrity
plumbing), which lives under `packages/` only because it depends on business packages, and which
only web code imports (see [Browser architecture](BROWSER_ARCHITECTURE.md#driver-and-runtime)). The
provider is built when that module first loads; there is no initialisation call. In-memory test
doubles for the contract ship from `@perawallet/wallet-extension-platform/test-utils`, never the main
entry, so the contract carries no React or React Query.

Two platform concerns are swapped by module identity rather than through that interface, and are easy
to miss when tracing: the keystore engine and the Ledger transports (the `.web.ts` twin of the
app's `bootstrap/hardware-wallet-transports.ts`). On web
`@algorandfoundation/react-native-keystore` resolves to `extensions/keystore-chrome`, but only so
static imports of it resolve; the engine comes from `@algorandfoundation/keystore-web`.

### Where browser-specific code lives

`apps/browser/src/` holds everything that only exists because this is an extension: the service
worker, content scripts, and the offscreen document's headless hosts.

`apps/mobile/src/**/*.web.tsx` holds behavioural twins of a _named native sibling_, for example
`PWBottomSheet.web.tsx`. These stay colocated deliberately: their correctness depends on tracking the
file next to them, and colocation is what makes a drifting prop visible in review.

`apps/browser/web-shims/` holds same-shaped stand-ins for native-only modules, mapped in by Metro
when `platform === 'web'`.

A lint rule (`pera/no-chrome-imports-outside-web`, enforced by `pnpm lint:lanekeep`) checks the
boundary in the direction that actually matters: a file that is not `.web.*` may not import
`platform-chrome`, `keystore-chrome` or `browser-runtime`, because such a file is reachable from the native bundle and
would fail at runtime on the missing `chrome` global.

`pera/no-react-native-imports-in-packages` holds the other direction: `packages/*/src` may not
import `react-native`, `react-native-*` or `expo-*`. App lifecycle comes from
`getProvider().appLifecycle`, the OS from `getProvider().deviceInfo.getDevicePlatform()`. The few
native modules with no service equivalent (Falcon, the native keystore envelope) are listed with a
reason in the rule itself.

### Turning features off per platform

Neither platform hides a feature with scattered `Platform.OS` checks. `routeCapabilities`
(`apps/mobile/src/routes/capabilities.ts` and its `.web.ts` twin) is one typed object per platform,
read throughout the app, and a test asserts the two maps declare the same keys so a new capability
cannot be added to one and forgotten in the other.

The rule for adding an entry: the flag records a decision, the comment next to it records the reason.
Anything off on web is off for one of three reasons, and the comment says which.

- A permanent platform limit (no push notifications, no store review).
- A dependency that cannot build for the web bundle.
- An external blocker (the Discover tab: Discover's own `DISCOVER_V3` minimum-version map has no
  `web` key, so the lookup is `undefined`, `compareVersions` throws mid-render and unmounts the tab.
  Our iframe and content-script bridge are verified working, and reporting a dishonest client type to
  work around it would corrupt analytics and device registration).

Keeping the reason at the flag rather than in a separate document is deliberate: the next person to
consider flipping it is already reading that line.

A web difference that is not a product decision (a focus-ring reset, a browser API that needs a user
gesture) goes in a small `.web.ts` twin of a constant or function instead of a flag.
`pera/no-platform-os-web` (`packages/devtools/oxlint/rules/no-platform-os-web.js`) fails any
`Platform.OS === 'web'` comparison in `apps/mobile/src`, so one of the two is the only way to branch.
Native-only iOS/Android splits read `isIOS()`/`isAndroid()` from `@utils/platform`; a capability that
differs between them computes its native value there (`ledgerUsb` is `isAndroid()`).

A feature that only works in some wallet modes (a chain's backend serves its mainnet and default
test network only, say) declares the developer modes it is off in, in a chain module's
`capabilityRestrictions` or in `routeCapabilityRestrictions`, rather than comparing a network. The
restriction can only switch a capability off, and Feature Flags still overrides it. The UI gates through
`useCapability` or `<CapabilityGuard>`, which follow the mode and per-chain network override live.
A `routeCapabilityRestrictions` entry reads the mode of a `chain:` requirement's chain; any other
requirement is restricted only while every registered chain's mode is.

An entry point renders when three independent things hold: the platform gate (`routeCapabilities`),
the app flag if the feature has one (a remote `enable_*` boolean behind its `useIsXEnabled` hook), and
the chain capability. A flag hook ANDs its capability in so callers check one hook, but a capability
is never folded into a remote flag read or the reverse. A false capability removes the element from the
tree; nothing renders disabled because a capability is off.

`useCapabilityCheck` evaluates a list, or a requirement chosen at call time, from one subscription:
tab descriptors carry `requires`, and `DEEPLINK_CAPABILITY_REQUIREMENTS` classifies every deeplink
type. Routes, tabs and menu rows use `anyChain`; an element acting on an account uses the `chain:`
form. Signing never depends on a capability remote config can switch off: `rekey` gates the ways into
rekeying and rekey discovery, not `getSignerFor`, so an account that is already rekeyed keeps signing.
The same holds for anything that outlives its capability: WalletConnect sessions, registered pushes and
passkeys keep running, so their settings screens stay reachable and only the way to start a new one hides.

### Keeping code out of a build

A capability hides a feature but still ships its code. Code that must not be in a bundle at all is
dropped by Metro instead: `apps/mobile/metro.config.js` resolves the feature's entry modules to
sibling `.stub.ts` files, so nothing behind them enters the graph. Three features use this. The locale
tour exists only when `NODE_ENV` is `development`. The developer screen gallery (settings, developer
menu) is left out of production builds and kept in development and staging; the decision reads the
`appEnvironment` baked into `packages/config/src/generated-env.ts` (or `APP_ENV`), not `NODE_ENV`,
because a staging release bundles with `NODE_ENV=production` too. Its UI entry points read
`routeCapabilities.developerGallery`, and its screens must be imported only through
`modules/settings/routes/developer-gallery.ts`, which the oxlint rule
`pera/dev-gallery-entry-points` enforces. The Ethereum chain module ships only when the baked `CHAINS`
lists `ethereum`, and the extension build fails if viem reaches a bundle anyway. Metro logs each
decision at startup (`[metro] developer gallery: included|stubbed`).

## Networks without a Pera backend

There are two Pera deployments, one per `WalletMode`: `live` (the MainNet host) and `developer` (the
TestNet host). A deployment is a host, not a chain, so every chain of a tier shares it. A
chain-agnostic request (integrity, banners, notifications, fiat rates, Pera Web backups) names the
wallet mode's deployment with `queryClient({ backend: 'pera', deployment })` and reaches it whatever
network a chain is on. Device ids belong to a deployment too.

A request for a chain's data names its scope instead, and reaches the deployment holding that
chain's data (`peraDeploymentOf(scope)`). Each chain scope's configuration in `packages/config/src/network-config.ts` lists the Pera services
its deployment serves (`peraServicesFor(scope)`, `hasPeraService(scope, service)`): Algorand MainNet
and TestNet list every service, betanet and a custom node list none. A request declaring
`backend: 'pera'` throws `PeraServiceUnavailableError` in `packages/shared/src/api/query-client.ts`
before a socket opens when its scope has no Pera deployment, or when it names a `service` the
scope does not list, so the failure is structural and instant rather than a timeout.

Reads whose answer is obtainable from algod or the indexer must therefore branch on
`hasPeraBackend(scope)` and take the public path, rather than swallowing the error as an empty
result. Swallowing it is indistinguishable from a genuine empty result in the UI, which is how a
dead probe once reported "no addresses found" during account discovery. Pera-proprietary reads have
no fallback and should surface as unavailable.

## How a chain reaches its backends

Every chain calls the Pera backend through `queryClient({ backend: 'pera', scope })`, never a client
of its own: the Pera client in `packages/shared/src/api/query-client.ts` is the one place that adds
the credential and the device headers. It is built for every configured scope, on every chain. The
credential is the API key on native and the integrity token as a Bearer on web, where the extension
bakes no key; there a refused Pera call throws `IntegrityRequiredError` and a guarded call waits up
to the realm's bound for a token still on its way. A call to an integrity-guarded route (the
card, fee-delegation and EVM routes) also passes `headers: buildIntegrityHeaders()` from
`@perawallet/wallet-core-app-integrity`, which carries the native token and the staging bypass.

`queryClient` serves the Pera and backup backends only, never a chain's nodes, so a Pera credential
cannot reach a third-party node. Each chain builds its own node clients from the `ChainContext` it
registered with: its endpoints, and the request ceilings in `ctx.timeouts`, which come from the
chain's row in config's `chainRequestTimeouts`. Algorand is the exception for endpoints: its record
is empty, and its node URLs come from `getAlgorandChainConfig` on every request so a saved custom
node applies. Algorand keeps the context in
`packages/chain-algorand/src/chain-context.ts` and builds every algod and indexer client, for algosdk
and for raw JSON reads alike, through `createNodeHttpClient` (`blockchain/utils/nodeHttp.ts`).
Ethereum's JSON-RPC is a viem client built from `ctx.getEndpoints()`.
The app lays a developer's per-network endpoint override from the network store over that record,
and only over networks the chain's config already carries.

## Account types share one signing path

Algo25, HD-wallet and quantum (Falcon-1024) accounts all route through
`useLocalKeyTransactionSigner` and `createLocalKeyStrategy`. `resolveSignerCredential` returns a custody and a
scheme: the custody picks the signing actor, so a quantum account resolves to `local` custody like
the others, and only its scheme (`falcon-1024`, from `credentialScheme`) differs. The signer is
picked by the request's scope and reads the scheme off the key itself: it asks
`useKMS().getPQSigningInfo(keyPairId)` once per call and, when that returns non-null, signs
`pqSigningDigest(txn)` and assembles via `assemblePQSignedTransaction`.

Worth knowing because the absence is invisible: if you go looking for a quantum branch in signing,
routing or submission, there isn't one, and adding one is a regression. The Falcon libraries are
confined to `packages/kms/src/crypto/pq` and a test fails CI if they appear anywhere else.

## Each chain reviews its own requests

The signing machine reviews every group with the reviewer registered for the request's chain: its
decoder explains the group, its warning detector reads what was decoded, and `reviewGroup` derives
the risk level the same way on every chain. A chain with no reviewer refuses the request, so nothing
signs unreviewed. A request the app built itself has no review screen, so the chain's
`policy.autoApproveLocal` decides it, and one the policy turns down fails with `ReviewRequiredError`
rather than waiting for a screen that never opens.

A transaction request carries chain-neutral `UnsignedTransaction`s. It takes its chain from its
transactions' scope and its signers from the chain planner's `plan`, because only the chain can read
its payload. One built for a network other than its chain's selected one fails with
`ScopeChangedError`. What a source sends beside the transactions (the full group, signer overrides,
request bytes, fee adjustments) is the request's `chainData`, opaque to the signing package: a source
builds it with the planner adapter's `signRequestChainData`, and the pipeline reads it back through
`reviewGroupOf` and `handoffDeliveryOf`, so only the chain knows its shape. A request persisted in an
older shape can still rehydrate, so the machine refuses any whose transactions aren't chain-neutral.

An Algorand request is checked and grouped by the Algorand transactions it carries: group integrity
over the full group, and one group per account each transaction signs for, whose rekey is followed
once. The planner adapter's `signedForAddresses` decides that key, and refuses a signer override
that names neither the sender nor an account the payload signs with.
Every Algorand signer and guard reads the transaction from the payload through
`readAlgorandTransaction`, the trust boundary for a payload a dApp may have built.

A chain-neutral transaction is signed through its chain's `TransactionPlanner`, registered in
`transactionPlanners` in chain-contract so a chain package registers it without depending on
packages/signing. `plan` names each signature and its exact bytes, the wallet signs only those, each
with the key of the account the request names in the scheme it names, and `assemble` builds the
signed transaction. The key store never signs bytes a payload supplies, so a request can't have
arbitrary bytes signed, which is what `eth_sign` would allow.

The planner signs a local key only in the scheme it plans and assembles only a complete signature
set. An Algorand quantum key, a Ledger, a multisig proposal and a multisig cosignature therefore sign
through Algorand's own strategies, which sign the transaction they read from the payload, never its
bytes. Their result is the signed transactions alone, the planner's carries history entries beside
them, and one request can't be delivered as a mix of the two, so the machine refuses such a request
before anything signs.

A chain whose review reads only chain-neutral transactions registers a `TransactionReviewer` in
chain-contract's `transactionReviewers`, as with planners, and the signing pipeline bridges it into
the machine's reviewer. A transaction's `summary` is the request's own claim, so a reviewer consults
it only on a request the wallet built, and only once the chain proves it from the payload: Ethereum
honours a token or NFT transfer summary only when re-encoding it gives exactly the calldata, and every call
it can't prove stays an unrecognised contract call that the app can't sign without review.

A request's `signer` is the address whose key produces the signature, not the account it is for:
the planner reads it from the payload (Ethereum's `from`; Algorand's sender, rekey authority, or one
request per multisig participant). A group keyed by that signer (`isKeyedByPlanner`) never has its
rekey followed a second time. Only keys
the review lists as `signableAddresses` sign, so a payload can't add a signer the user never
approved: Algorand's reviewer lists every planned signer the wallet holds and refuses an authority a
wallet sender isn't rekeyed to. A listed key the wallet can't use locally is left to its holder.
Algorand's payload names its multisig parameters, and planning refuses ones that don't derive to the address
that signs; assembly needs the threshold, so co-signing below it stays with the multisig transports.

## State management

Zustand holds client state (user settings, wallet accounts). TanStack Query holds server state
(balances, transaction history).

Persisted stores resolve their storage lazily through the platform provider,
`createJSONStorage(() => getProvider().keyValueStorage)`, so a store can be imported before the host
app has registered its platform implementation.

Every store's state must include a `resetState()` method so it can be returned to its initial state
when the app reinitializes (see `BaseStoreState`).

## Key packages

| Package          | Purpose                                                      |
| ---------------- | ------------------------------------------------------------ |
| `accounts`       | Wallet account management                                    |
| `assets`         | Asset information and pricing                                |
| `chain-algorand` | Algorand chain: node/indexer access and per-package adapters |
| `chain-ethereum` | Ethereum chain: JSON-RPC client and per-package adapters     |
| `signing`        | Transaction signing and submission                           |
| `database`       | Local persistence                                            |
| `settings`       | User preferences                                             |
| `shared`         | Common utilities and models                                  |

Platform service abstractions live in `extensions/*`, not in a package.

## Learn more

- Where files go and what to call them: [Code Layout](CODE_LAYOUT.md)
- How dApp sessions reach the wallet on native and in the extension: [Connections](CONNECTIONS.md)
- How a web page talks to the extension without WalletConnect: [dApp bridge](DAPP_BRIDGE.md)
- How an EVM send is priced, what MAX holds back, and why a small balance remains: [EVM fees](EVM_FEES.md)
