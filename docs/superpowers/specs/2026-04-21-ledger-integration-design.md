# Ledger Integration Finalization — Design Spec

**Date:** 2026-04-21  
**Scope:** React Native Pera Wallet (`pera-react-native`)  
**Priority:** Finish signing pipeline, then UI/UX parity. Rekeying deferred to follow-up.

---

## 1. Problem Statement

The Ledger hardware wallet integration in the React Native app is structurally complete but has functional signing bugs and UI/UX gaps when compared to the native iOS and Android codebases.

- **Functional bugs:** Signing can fail due to missing address re-fetch, no connection timeout, weak user-cancel handling, multi-transaction progress not surfaced, and rekeyed account resolution not fully tested.
- **UI/UX gaps:** Icons, copy, selected-account styling, signing overlay animations, and device-row design differ from native implementations.

This spec defines fixes for the signing pipeline and a subsequent parity pass for UI/UX.

---

## 2. Root Cause Analysis

### 2.1 Signing Pipeline

| Weakness | Native Behavior | RN Behavior |
|---|---|---|
| Address re-fetch before sign | iOS re-fetches all addresses to confirm the index matches the expected address before signing | Signs directly with the stored index |
| Connection timeout | iOS enforces a 10s timeout on BLE connect | No timeout — can hang indefinitely |
| User cancel handling | Native apps catch APDU `0x6985` / `0x6986` and emit clean `OperationCancelledResult` | Error classification exists but may not surface through XState correctly |
| Multi-tx progress | Android/iOS show progress ("1/3", "2/3") with a Lottie animation | Overlay is static — no progress indicator |
| Bonding check | Android checks if bonding is required and shows pairing instructions | May skip bonding step |
| Transport lifecycle | iOS reconnects to saved device by UUID; Android caches connection | RN connects, signs, disconnects per session — no reconnection |

### 2.2 UI/UX Parity

| Element | Native | RN |
|---|---|---|
| Ledger icon | Custom vector/PDF (`ic_ledger`, `icon-ledger-account`) | Generic wallet icon |
| Selected account highlight | Green stroke (`@color/success`), 12dp radius | Different styling |
| Signing overlay | Lottie animation + progress bar + cancel button | Static bottom sheet |
| Device item row | Signal strength dot + Ledger icon + arrow | Minimal styling |
| Copy | Platform-specific localized strings | Some inconsistency (e.g., "Only Nano X supported" but code supports Flex/Stax/Gen5) |
| Troubleshooting | Bluetooth, app open, Ledger Live install, unlocked | Steps may not match native |

---

## 3. Proposed Fixes

### 3.1 Signing Pipeline Fixes

#### Fix 1: Address Re-fetch Before Sign
- **Target:** `packages/signing/src/pipeline/signing/createHardwareStrategy.ts`, `extensions/ledger-react-native/src/RNLedgerService.ts`
- **Change:** Before signing each transaction, call `transport.getAddress(accountIndex)` and compare the returned address to the expected sender/auth address. If mismatch, abort with a typed `LedgerAddressMismatchError`.
- **Rationale:** Prevents index mismatch attacks and handles device reordering.

#### Fix 2: Connection Timeout Guard
- **Target:** `packages/signing/src/pipeline/signing/createHardwareStrategy.ts`, `packages/signing/src/machine/actors/signers/hardwareSignerActor.ts`
- **Change:** Wrap `transport.connect(deviceId)` in a `Promise.race` with a 10-second timeout. On expiry, emit `LedgerTimeoutError` and transition the XState machine to an error terminal state.
- **Rationale:** Matches iOS behavior; prevents indefinite hangs.

#### Fix 3: User Cancel Handling
- **Target:** `extensions/ledger-react-native/src/RNLedgerService.ts`, `packages/signing/src/machine/signingMachine.ts`
- **Change:** In `RNLedgerService.signTransaction`, catch Ledger APDU response codes `0x6985` and `0x6986` and throw `LedgerUserRejectedError`. In `signingMachine.ts`, ensure the `hardware` state transitions to `rejected` on this error type, surfacing a clean user-facing message.
- **Rationale:** Clean error propagation for the most common user action.

#### Fix 4: Multi-transaction Progress
- **Target:** `apps/mobile/src/modules/signing/components/LedgerSigningOverlay/`, `packages/signing/src/machine/signingMachine.ts`
- **Change:** Pass `currentIndex` and `totalCount` from the signing machine context to the overlay component. Render a progress bar and text: "Signing transaction X of Y". Update the overlay title from static "Approve on Ledger" to dynamic progress.
- **Rationale:** Matches Android/iOS behavior for swaps and WalletConnect multi-tx sessions.

#### Fix 5: Bonding / Pairing Check
- **Target:** `apps/mobile/src/modules/ledger/hooks/useLedgerConnection.ts`, `apps/mobile/src/modules/ledger/screens/LedgerScanScreen/`
- **Change:** Before connecting to a discovered device, check the BLE bonding state. If unbonded, navigate to `LedgerTroubleshootingScreen` (or a new pairing instruction step) instead of auto-connecting.
- **Rationale:** Matches Android's `LedgerBleOperationManager.isBondingRequired(...)` behavior.

#### Fix 6: Error Classification Parity
- **Target:** `packages/ledger/src/errors.ts`
- **Change:** Map all known APDU error codes and BLE disconnect reasons to typed errors. Ensure each error maps to a user-friendly `PWResultView` preset in `apps/mobile/src/modules/ledger/utils/ledgerErrorPresets.ts`.
- **Rationale:** Consistent error UX across all failure modes.

#### Fix 7: Rekeyed Account Signing
- **Target:** `packages/signing/src/pipeline/signing/getSigningStrategy.ts`, `packages/signing/src/pipeline/signing/createHardwareStrategy.ts`
- **Change:** Verify that the auth address resolution chain works end-to-end for hardware wallet accounts. Add unit tests in `hardwareSignerActor.spec.ts` covering a rekeyed account that authorizes a Ledger account.
- **Rationale:** QA reports all signing paths are broken; rekeyed accounts are a critical edge case.

### 3.2 UI/UX Parity Changes

#### Change 1: Ledger-Specific Icons
- **Target:** `apps/mobile/src/modules/ledger/components/LedgerDeviceItem/`, `apps/mobile/src/modules/ledger/screens/LedgerInstructionsScreen/`, `apps/mobile/src/components/`
- **Change:** Add a Ledger-specific icon asset (port `ic_ledger.xml` from Android or `icon-ledger-account` PDF from iOS into the RN asset pipeline). Replace generic wallet icons in the device list, instructions, and account type info.

#### Change 2: Selected Account Styling
- **Target:** `apps/mobile/src/modules/ledger/screens/LedgerSelectAccountsScreen/styles.ts`
- **Change:** Apply a green stroke border (`theme.colors.success`, 2px width, 12px radius) to selected ledger account rows, matching Android's `bg_selected_ledger_account.xml`.

#### Change 3: Signing Overlay with Lottie + Progress
- **Target:** `apps/mobile/src/modules/signing/components/LedgerSigningOverlay/`
- **Change:** Add a Lottie animation component using `bluetooth_loading_animation.json` (from Android) or `dark-ledger.json`/`light-ledger.json` (from iOS). Include a progress bar and a secondary cancel button. The overlay should update its title dynamically during multi-transaction signing.

#### Change 4: Copy Parity
- **Target:** `apps/mobile/src/i18n/en.json` (ledger namespace)
- **Change:** Audit all ledger strings against iOS `Localizable.xcstrings` and Android `strings.xml`. Fix "Only Ledger Nano X is supported" to list all supported models (Nano X, Flex, Stax, Nano Gen5). Ensure error titles and descriptions match native copy.

#### Change 5: Troubleshooting Screen Parity
- **Target:** `apps/mobile/src/modules/ledger/screens/LedgerTroubleshootingScreen/`
- **Change:** Ensure steps match native: (1) Enable Bluetooth, (2) Open Algorand app on Ledger, (3) Install from Ledger Live, (4) Ensure device is unlocked. Add missing steps if any.

#### Change 6: Device Item Row Design
- **Target:** `apps/mobile/src/modules/ledger/components/LedgerDeviceItem/`
- **Change:** Add a signal strength indicator (colored dot) and a right-arrow chevron, matching Android's `item_scanned_ledger.xml` layout.

---

## 4. Architecture Principles

- **Hardware-wallet abstraction stays generic.** No Ledger-specific logic leaks into `packages/hardware-wallet` or `packages/signing` (beyond strategy selection).
- **Ledger-specific logic lives in `packages/ledger` and `extensions/ledger-react-native`.**
- **All errors are typed.** Every new or modified error must be defined in `packages/ledger/src/errors.ts` and mapped to a UI preset before surfacing to the user.
- **XState owns signing state.** The UI is a pure render of the machine's state and context. No UI component mutates signing state directly.
- **Native parity, not native copy-paste.** Adapt native patterns to RN's component system and theming tokens. Don't translate Kotlin/Swift UI verbatim.

---

## 5. Testing Strategy

### 5.1 Unit Tests
- Expand `packages/signing/src/machine/actors/signers/__tests__/hardwareSignerActor.spec.ts` to cover:
  - Timeout on BLE connect
  - User cancellation (`0x6985` / `0x6986`)
  - Address mismatch after re-fetch
  - Rekeyed account resolution
  - Multi-transaction sequential signing
- Expand `extensions/ledger-react-native/src/__tests__/RNLedgerService.spec.ts` to cover:
  - Bonding state checks
  - APDU error code classification
  - Disconnect mid-sign

### 5.2 Mock Transport Tests
- Create a mock `HardwareWalletTransport` that simulates connect failures, APDU errors, and mid-sign disconnects. Use it in `hardwareSignerActor.spec.ts` to test error transitions without a physical device.

### 5.3 Integration Tests
- Test the full XState `signingMachine` through the `hardware` state with mocked actors. Verify transitions: `idle` → `hardware` → `transporting` → `success` / `error`.

### 5.4 QA
- Physical device testing on Ledger Nano X, Stax, and Flex.
- Test scenarios: standard payment, group transaction, rekeyed account transaction, WalletConnect session, swap flow.
- Test error scenarios: user cancel, app not open, BLE disconnect mid-sign, timeout.

---

## 6. Out of Scope

- **Rekeying to Ledger** — deferred to a follow-up project.
- **Undo Rekey** — deferred to a follow-up project.
- **USB transport** — only BLE is in scope.
- **Firmware update prompts** — no firmware version checks.

---

## 7. Files to Modify (Summary)

### Signing Pipeline
- `packages/signing/src/pipeline/signing/createHardwareStrategy.ts`
- `packages/signing/src/pipeline/signing/getSigningStrategy.ts`
- `packages/signing/src/machine/actors/signers/hardwareSignerActor.ts`
- `packages/signing/src/machine/signingMachine.ts`
- `extensions/ledger-react-native/src/RNLedgerService.ts`
- `packages/ledger/src/errors.ts`
- `apps/mobile/src/modules/ledger/utils/ledgerErrorPresets.ts`

### UI/UX Parity
- `apps/mobile/src/modules/ledger/components/LedgerDeviceItem/`
- `apps/mobile/src/modules/ledger/screens/LedgerSelectAccountsScreen/styles.ts`
- `apps/mobile/src/modules/signing/components/LedgerSigningOverlay/`
- `apps/mobile/src/modules/ledger/screens/LedgerTroubleshootingScreen/`
- `apps/mobile/src/i18n/en.json`
- Asset pipeline (add Ledger icon/Lottie)

### Tests
- `packages/signing/src/machine/actors/signers/__tests__/hardwareSignerActor.spec.ts`
- `extensions/ledger-react-native/src/__tests__/RNLedgerService.spec.ts`

---

## 8. Spec Self-Review

| Check | Status |
|---|---|
| No TBD / TODO placeholders | Pass |
| Internal consistency | Pass |
| Single-plan scope | Pass — signing + UI parity is one cohesive unit |
| No ambiguous requirements | Pass — each fix has a target file and change description |

---

*Design approved by user on 2026-04-21.*
