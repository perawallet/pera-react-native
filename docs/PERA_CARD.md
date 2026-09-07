# Pera Card

A Visa card issued by Baanx and funded from a Pera account. Most of the state
that matters is owned by Baanx rather than by us, so this file records the
contract to stop behaviour being re-derived from the screens.

## Where the code lives

| Path                            | Holds                                   |
| ------------------------------- | --------------------------------------- |
| `packages/card/`                | API clients, session, stores, models    |
| `apps/mobile/src/modules/card/` | Screens, onboarding routes, dashboard   |
| `modules/gift-card/`            | Gift cards: separate flow, same backend |

## Ownership

| Concern                               | Owner  |
| ------------------------------------- | ------ |
| Card issuance, status, PAN, balances  | Baanx  |
| KYC identity verification             | Veriff |
| Onboarding form state, funding intent | App    |
| AutoDraw authorization (LogicSig)     | App    |

Only `panLast4` is retained from the PAN. Full card details are fetched
on demand and never persisted.

## Card lifecycle

`GET /v1/card/status` returns one of:

| Status    | Meaning                                              |
| --------- | ---------------------------------------------------- |
| `ACTIVE`  | Usable.                                              |
| `FROZEN`  | User-initiated pause; reversible.                    |
| `BLOCKED` | Terminal for that card.                              |
| `PENDING` | Transient, up to ~2 min after `POST /v1/card/order`. |

`PENDING` is not in the backend's status enum and is documented only in prose.
It is modelled explicitly because the transformer's fail-safe would
otherwise render a provisioning card as permanently `BLOCKED`.

Types are `VIRTUAL`, `PHYSICAL` and `METAL`.

## Onboarding

The app drives eight steps: `EMAIL_SEND`, `EMAIL_VERIFY`, `PHONE_SEND`,
`PHONE_VERIFY`, `VERIFICATION`, `PERSONAL_DETAILS`, `ADDRESS`, `COMPLETED`.

Baanx separately reports a coarser resume point (`ACCOUNT`, `PHONE_NUMBER`,
`PERSONAL_INFORMATION`, `PHYSICAL_ADDRESS`, `MAILING_ADDRESS`) returned by login
when a user is mid-signup. The two vocabularies are not 1:1; the server phase
decides where a returning user resumes.

Eligible countries and US states come from `GET /v1/auth/settings`, so
eligibility changes without a release.

## Funding

Chosen on the setup checklist, and switchable afterwards:

- `MANUAL`: the user tops the card up themselves.
- `AUTO` (AutoDraw): a delegated LogicSig lets Baanx draw from the connected
  account, capped at $400 per transaction. Delegation tokens from
  `GET /v1/delegation/token` are single-use and valid ~10 minutes.

Registered wallets come from `GET /v1/wallet/external`. An allowance of 0 means
the delegation is inactive, which is how a revoked AutoDraw presents.
A killswitch app (ARC-56) can disable AutoDraw independently of the delegation.

> [!WARNING]
> The AutoDraw TEAL template is pinned by an ed25519 signature, but the pinned
> public key and signature are still empty pre-launch placeholders. Until they
> are populated, verification is dormant and only logs. It does not guard the
> compile path. This must be filled in before AutoDraw ships.

## Session and secrets

- `POST /v1/auth/login` returns a 6-hour access token used _only_ to complete
  the OAuth authorize step. It is never persisted.
- The durable pair comes from the token exchange; the 7-day refresh token is
  exchanged on a 401 to keep the user signed in.
- Both durable tokens live only in the encrypted KMS keystore. They are
  read on demand, never cached in app memory, and the decoded byte buffers are
  zeroed after use.

## Feature gate

Card entry points are gated on remote config (`useIsPeraCardEnabled`) _and_
route capabilities. A card deeplink reaching a build with the flag off is a deliberate no-op; see
`useDeepLink`.

## Add to Wallet (push provisioning)

The native Add to Apple/Google Wallet flow (`useAddCardToWallet`, via
`@expensify/react-native-wallet`) is scaffolded but dormant: it needs the
`enable_card_push_provisioning` flag _and_ a device-level availability check
that stays false until Pera holds the Apple In-App Provisioning entitlement
and the Google TapAndPay allowlisting. Until then, and whenever the native flow
can't complete, every entry point falls back to the manual
`WalletInstructionsSheet`.

- The native calls live behind `getProvider().walletProvisioning`
  (implemented in `extensions/platform-react-native`, permanently unavailable
  on `platform-chrome`); the availability/status queries are package hooks
  (`useWalletProvisioningAvailabilityQuery` / `useWalletProvisioningStatusQuery`
  in `packages/card`).
- The Baanx provisioning-payload endpoints don't exist yet;
  `modules/card/utils/provisioningPayload.ts` rejects, which routes to the
  fallback. Implement it (plus the backend proxy) once accreditation lands.
- The RN service loads the library lazily: it constructs a NativeEventEmitter
  at import time, which crashes iOS at boot on any binary without the RNWallet
  TurboModule, such as a dev client built before this dependency. Old dev
  clients therefore still boot and simply report unavailable; rebuild
  (pod install) only when you need the native flow.
- Do not add the library's Expo config plugin to `app.config.js`: its
  default injects the Apple Pay provisioning entitlement on prebuild, which
  breaks code signing until Apple grants the entitlement.
- The library is excluded from Android autolinking
  (`expo.autolinking.android.exclude` in `apps/mobile/package.json`). Its
  `android/build.gradle` declares `com.google.android.gms:play-services-tapandpay:+`,
  which Google publishes only in the private Maven repo it opens to allowlisted
  push-provisioning issuers, so every Android build (debug included) fails to
  resolve `releaseRuntimeClasspath` while the module is linked. Excluding it is
  what keeps the feature dormant rather than build-breaking; the JS side already
  degrades, since the library's `TurboModuleRegistry.getEnforcing` failure makes
  every call reject and `RNWalletProvisioningService` reports unavailable.
  Drop the exclusion once TapAndPay allowlisting lands and the private repo
  (with credentials) is added to the generated Gradle config via a config plugin.

## Tests

Seventeen integration specs in `apps/mobile/src/__integration__/` cover the
flow end to end (`card-onboarding-*`, `card-frozen`, `card-withdraw`,
`card-funding-type-switch`, `gift-card`). Start there before changing a flow.
