# Technical Debt Registry

This document tracks known technical debt in the codebase. Items are categorized by severity and type.

**Last Updated:** 2026-01-13

---

## Severity Levels

- 🔴 **Critical** - Security risk or major functionality gap
- 🟠 **High** - Significant impact on maintainability or user experience
- 🟡 **Medium** - Should be addressed in normal development
- 🟢 **Low** - Nice to have, minor improvements

---

## Summary

| Category            | Critical | High | Medium | Low |
| ------------------- | -------- | ---- | ------ | --- |
| Incomplete Features | 0        | 8    | 15     | 5   |
| Type Safety         | 1        | 3    | 5      | 0   |
| Code Quality        | 0        | 2    | 4      | 3   |
| Testing             | 0        | 1    | 2      | 1   |
| Logging             | 0        | 1    | 3      | 0   |
| Architecture        | 0        | 2    | 2      | 1   |

---

## 1. Incomplete Features

### 🟠 High Priority

#### 1.1 Deep Link Handlers Not Fully Implemented

**Location:** `apps/mobile/src/hooks/deeplink.ts`

Multiple deep link types are marked as TODO with placeholder implementations:

| Line    | Feature                          | Status          |
| ------- | -------------------------------- | --------------- |
| 111     | Watch Account Addition           | Not implemented |
| 119     | Receiver Account Selection       | Not implemented |
| 127     | Address Actions Modal            | Not implemented |
| 135-146 | ALGO/Asset Transfer Construction | Empty tx array  |
| 157     | Key Registration                 | Not implemented |
| 169     | Account Recovery                 | Not implemented |
| 186     | Asset Opt-In                     | Empty tx array  |
| 205     | Asset Inbox                      | Not implemented |
| 225     | Cards Screen                     | Not implemented |
| 259     | Sell Flow                        | Not implemented |

**Impact:** Users cannot use deep links for these features.

**Recommendation:** Prioritize based on user needs; implement proper transaction construction.

---

#### 1.2 Account Screen Features Missing

**Location:** `apps/mobile/src/modules/accounts/screens/AccountScreen.tsx`

```
Line 37-42:
//TODO hook up all the button panel buttons correctly
//TODO implement more menu
//TODO figure out and implement banners/spot banners
//TODO implement nft and history tabs
//TODO implement account info screen somewhere
//TODO implement rekey information && multisig information
```

**Impact:** Core account functionality is incomplete.

---

#### 1.3 Transaction Signing Not Complete

**Location:** `apps/mobile/src/modules/transactions/components/signing/signing-view/TransactionSigningView.tsx`

```
Line 41-43:
//TODO: we need to support all tx types here
//TODO: use real data from the TXs
//TODO: convert usd amounts to preferred currency
```

**Impact:** Transaction signing may not work for all transaction types.

---

#### 1.4 Send Funds Missing Features

**Location:** `apps/mobile/src/modules/transactions/components/send-funds/`

| File                             | Issue                                                     |
| -------------------------------- | --------------------------------------------------------- |
| `SendFundsBottomSheet.tsx:54-55` | ASA Inbox sends not supported; `canSelectAsset` broken    |
| `SendFundsInputView.tsx:39-40`   | Max precision not enforced; max amount validation missing |
| `use-input-view.ts:122`          | Max amount popup not implemented                          |

---

#### 1.5 Notification Actions Not Connected

**Location:** `apps/mobile/src/modules/notifications/components/notification-item/NotificationItem.tsx:82`

```typescript
//TODO: we need to invoke relevant deeplinks here as we implement them
```

---

#### 1.6 Swap Module is Mock

**Location:** `apps/mobile/src/modules/swap/components/`

| File                        | Issue                                |
| --------------------------- | ------------------------------------ |
| `PairSelectionPanel.tsx:28` | "TODO this iz a mock implementation" |
| `TopPairsPanel.tsx:35`      | "TODO this iz a mock implementation" |

---

#### 1.7 Arc60 Signing Not Implemented

**Location:** `apps/mobile/src/modules/transactions/components/signing/signing-view/Arc60SigningView.tsx:28`

```typescript
//TODO implement me
```

---

#### 1.8 WalletConnect Project Validation

**Location:** `apps/mobile/src/modules/walletconnect/components/connection-view/ConnectionView.tsx:42`

```typescript
//TODO implement project validation using our backend to show a "verified" badge somewhere
```

---

### 🟡 Medium Priority

#### 1.9 Asset Transaction List Incomplete

**Location:** `apps/mobile/src/modules/assets/components/holdings/asset-transaction-list/AssetTransactionList.tsx`

```
Line 29: //TODO implement fully
Line 34: // TODO: Replace with actual infinite query hook when added.
```

---

#### 1.10 Account NFTs Not Implemented

**Location:** `apps/mobile/src/modules/accounts/components/account-nfts/AccountNfts.tsx:16`

```typescript
//TODO implement
```

---

#### 1.11 Account History Not Implemented

**Location:** `apps/mobile/src/modules/accounts/components/account-history/AccountHistory.tsx:16`

```typescript
//TODO implement
```

---

#### 1.12 Inbox Tab Not Implemented

**Location:** `apps/mobile/src/modules/accounts/components/account-menu/InboxTab.tsx:17`

```typescript
//TODO implement me
```

---

#### 1.13 Asset Action Buttons Missing

**Location:** `apps/mobile/src/modules/assets/components/holdings/asset-action-buttons/AssetActionButtons.tsx:30`

```typescript
//TODO hook up missing actions
```

---

#### 1.14 Layout Cleanup Needed

**Locations:**

- `apps/mobile/src/modules/accounts/components/account-overview/AccountOverview.tsx:42-43`
- `apps/mobile/src/modules/accounts/components/portfolio-view/PortfolioView.tsx:41`

```typescript
//TODO layout and spacing needs a bit of clean up
```

---

#### 1.15 Legacy 25-Word Mnemonics

**Location:** `apps/mobile/src/modules/onboarding/screens/ImportAccountScreen.tsx:31`

```typescript
const NUM_WORDS = 24 //TODO: we'll add legacy 25 word accounts later
```

**Impact:** Users with legacy 25-word accounts cannot import them.

---

#### 1.16 Secure Storage Authentication

**Location:** `apps/mobile/src/platform/secure-storage.ts:82`

```typescript
async authenticate(): Promise<boolean> {
    //TODO implement me
    return true
}
```

**Impact:** Security concern - always returns true.

---

#### 1.17 WebView Haptic/Sound Support

**Location:** `apps/mobile/src/hooks/webview.ts:217`

```typescript
//TODO add haptic (and maybe message.banner) support and maybe sound
```

---

#### 1.18 Firebase Notification Tap Handling

**Location:** `apps/mobile/src/platform/firebase.ts:162`

```typescript
// TODO: Handle taps or actions using deeplink parser when we have it
```

---

### 🟢 Low Priority

#### 1.19 Additional Asset Icons

**Location:** `apps/mobile/src/modules/assets/components/asset-icon/AssetIcon.tsx:26`

```typescript
//TODO: we may want a few more "local" asset icons for popular icons (e.g. USDC, DEFLY, etc)
```

---

#### 1.20 Governor Badges

**Location:** `apps/mobile/src/modules/accounts/components/account-icon/AccountIcon.tsx:31`

```typescript
// TODO: Add governor badges (if needed - see Figma)
```

---

#### 1.21 Pending Inbox Items

**Locations:**

- `apps/mobile/src/modules/accounts/screens/AccountScreen.tsx:88`
- `apps/mobile/src/modules/accounts/components/account-selection/AccountSelection.tsx:25`

```typescript
//TODO we may want to add support for pending inbox items here too
```

---

#### 1.22 Asset Market URL

**Location:** `apps/mobile/src/modules/assets/components/market/AssetMarkets.tsx:107`

```typescript
//TODO: pass relative URL to go straight to the asset
```

---

---

## 2. Type Safety Issues

### 🔴 Critical

#### 2.1 Deep Link Params Untyped

**Location:** `apps/mobile/src/hooks/deeplink.ts:58-59`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
params?: any,
```

**Impact:** Navigation params are not type-safe, could cause runtime errors.

**Recommendation:** Define proper types for all screen params.

---

### 🟠 High Priority

#### 2.2 Test Files Use Excessive `any`

**Locations:**

- `apps/mobile/jest.setup.ts` (file-level disable)
- `apps/mobile/src/platform/__tests__/firebase.test.ts` (file-level disable)
- `apps/mobile/src/routes/__tests__/listeners.test.ts` (file-level disable)
- Multiple test files with `as any` casts

**Impact:** Mocks don't match actual types, tests may not catch type errors.

---

#### 2.3 Theme Extension Uses `any`

**Location:** `apps/mobile/src/test-utils/render.tsx:43-50`

```typescript
;(testTheme.lightColors as any).textMain = '#000000'
;(testTheme.lightColors as any).textGray = '#8E8E93'
// ... more any casts
```

**Recommendation:** Extend theme types properly instead of casting.

---

#### 2.4 Store Migration Uses `any`

**Locations:**

- `packages/platform-integration/src/device/store/store.ts:40`
- `packages/kmd/src/store/store.ts:43`

```typescript
persistedState: any,
```

**Recommendation:** Define proper migration types.

---

### 🟡 Medium Priority

#### 2.5 Push Notification Metadata Untyped

**Location:** `packages/platform-integration/src/push-notifications/models/index.ts:35,44`

```typescript
metadata: any
```

---

#### 2.6 WalletConnect Handler Uses `any`

**Location:** `packages/walletconnect/src/hooks/useWalletConnectHandlers.ts:160,218`

Several eslint-disable comments for `any` usage.

---

#### 2.7 Empty Object Types

**Location:** `packages/assets/src/models/assets.ts:33,38`

```typescript
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
```

---

---

## 3. Code Quality Issues

### 🟠 High Priority

#### 3.1 Large Files Exceed Line Limits

**Locations:**

- `apps/mobile/src/theme/theme.ts` - 347 lines (max-lines disabled)
- `apps/mobile/src/hooks/webview.ts` - 505 lines (max-lines disabled)

**Recommendation:** Split into smaller, focused modules.

---

#### 3.2 WebView Navigation Hack

**Location:** `apps/mobile/src/components/webview/WebViewFooterBar.tsx:44`

```typescript
//HACK: this is a little messy - there's no way seemingly to navigate directly to a URL, so we just
```

---

### 🟡 Medium Priority

#### 3.3 Font Selection Issue

**Location:** `apps/mobile/src/theme/theme.ts:319`

```typescript
//TODO: It seems to be selecting the wrong font at larger sizes - we may need additional font files
```

---

#### 3.4 Hardcoded Settings

**Location:** `apps/mobile/src/hooks/webview.ts:253-254`

```typescript
region: 'en-US', //TODO pull from state eventually (or device location or something)
language: 'en-US', //TODO pull from app locale
```

---

#### 3.5 Secure Storage Key Strategy

**Location:** `apps/mobile/src/platform/secure-storage.ts:25-27`

```typescript
//TODO currently we're storing data in the keychain with a different "service" per key
//Is that right or should we be storing it differently?
```

**Impact:** May need data migration if strategy changes.

---

---

## 4. Logging Issues

### 🟠 High Priority

#### 4.1 Raw `console.log` in Production Code

**Locations:**
| File | Issue |
|------|-------|
| `packages/shared/src/api/query-client.ts:111` | `console.log('Query error', error)` |
| `packages/config/src/main.ts:72,78,82` | Console logs for config mode |
| `packages/polling/src/hooks/usePolling.ts:36-37` | Console logs for polling errors |
| `packages/xhdwallet/src/bip32-ed25519-impl.ts:160` | Debug console.log |
| `packages/xhdwallet/src/x.hd.wallet.api.crypto.ts:333` | Validation error logging |

**Recommendation:** Use the project's `logger` utility instead.

---

### 🟡 Medium Priority

#### 4.2 Asset Price Error Uses Console

**Location:** `packages/assets/src/hooks/useInvalidateAssetPrices.ts:45`

```typescript
console.error('Error invalidating asset prices:', error)
```

---

---

## 5. Testing Issues

### 🟠 High Priority

#### 5.1 XHD Wallet Tests Have ts-expect-error

**Locations:**

- `packages/xhdwallet/src/__tests__/x.hd.wallet.api.crypto.test.ts:48`
- `packages/xhdwallet/src/__tests__/x.hd.wallet.api.crypto.test.js:74`

```typescript
//@ts-expect-error, no types found
```

---

### 🟡 Medium Priority

#### 5.2 Test Console.log Present

**Location:** `packages/xhdwallet/src/__tests__/x.hd.wallet.api.crypto.test.ts:993`

```typescript
console.log('cipherText', cipherText)
```

---

#### 5.3 SendFundsProvider ESLint Disable

**Location:** `apps/mobile/src/modules/transactions/providers/SendFundsProvider.tsx:13`

```typescript
/* eslint-disable @typescript-eslint/no-unused-vars */
```

Context default functions intentionally unused but ESLint rule should be more targeted.

---

---

## 6. Architecture Issues

### 🟠 High Priority

#### 6.1 XHD Wallet is Temporary Fork

**Location:** `packages/xhdwallet/`

The README and package.json indicate this is a temporary fork of `@algorandfoundation/xhd-wallet-ts` until React Native is supported upstream.

**Action Required:** Monitor upstream for React Native support, then migrate back.

---

#### 6.2 Transaction Type Support

**Location:** `apps/mobile/src/modules/transactions/components/transaction-icon/TransactionIcon.tsx:19`

```typescript
//TODO support all tx types
```

Combined with `TransactionSigningView.tsx:41`, indicates transaction handling is incomplete.

---

### 🟡 Medium Priority

#### 6.3 Arc60 Handling Incomplete

**Location:** `apps/mobile/src/hooks/webview.ts:323`

```typescript
//TODO handle arc60 here
```

---

#### 6.4 Asset Details Press Event

**Location:** `apps/mobile/src/modules/assets/screens/AssetDetailsScreen.tsx:61`

```typescript
//TODO implement press event
```

---

---

## 7. Documentation Issues

### 🟢 Low Priority

#### 7.1 Asset Metadata Missing

**Location:** `apps/mobile/src/modules/assets/components/market/AssetMarkets.tsx:239`

```typescript
{
    /* TODO: Add this in when we have the metadata on the asset */
}
```

---

---

## How to Address Tech Debt

### When Working on a Feature

1. If you encounter a TODO in code you're modifying, consider fixing it
2. If fixing would significantly expand scope, document it here
3. Remove TODOs when they're addressed

### Regular Maintenance

1. Review this document during sprint planning
2. Allocate ~20% of each sprint to tech debt reduction
3. Prioritize based on severity and frequency of code changes in that area

### Adding New Items

When adding tech debt (sometimes necessary for shipping):

1. Add a TODO comment in code with clear description
2. Add entry to this document with severity level
3. Include ticket number if available

---

## Resolved Items

_Track resolved tech debt items here with date and PR number._

| Date | Description | PR  |
| ---- | ----------- | --- |
| -    | -           | -   |
