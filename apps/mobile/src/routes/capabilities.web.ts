/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import type { RouteCapabilities } from './capabilities-types'

export type { RouteCapabilities } from './capabilities-types'

export const routeCapabilities: RouteCapabilities = {
    // Off pending a Discover-side fix. Discover gates its UI tier on
    // compareVersions(version, DISCOVER_V3[platform], '>=') with
    // DISCOVER_V3 = { ios, android } — our honest clientType 'web' makes that
    // lookup undefined, compare-versions throws mid-render, and React unmounts
    // the whole Discover root (renders, then blanks). The iframe/bridge layer
    // itself is verified working. See routes/capabilities.web.ts's discoverTab comment.
    discoverTab: false,
    swapTab: true, // native RN screen graph
    fundTab: true, // native RN screen graph (Meld checkout via window.open)
    staking: true, // native RN screen graph
    peraCard: true, // Baanx card, additionally gated by useIsPeraCardEnabled() remote flag
    giftCards: true,
    inAppWebView: false, // stays false — help/terms open browser tabs
    // Off in the Menu and the home header: replaced by deepLinkPaste below.
    // The QRScannerView camera+paste sheet itself stays reachable from the
    // in-field scan buttons (AddressEntryField, ContactForm, Connections
    // settings, Passkeys settings) and the ScanQR expanded tab — this flag
    // only gates those two icon bars.
    qrScanner: false,
    deepLinkPaste: true, // paste a WC URI / perawallet:// link instead
    pushNotificationSettings: false, // permanently off: no push on web
    walletConnectSettings: true, // WC v1 pairing + sessions on web
    passkeysAutofillSettings: true, // WebAuthn-interception credential provider + settings toggle
    storeRating: false, // permanently off: no store review flow
    developerSettings: true, // internal builds need network/debug toggles
    vaultSecuritySettings: true,
    dappConnections: true,
    // Off: the WASM Falcon-1024 signer is Node/test-only (see
    // getPQProvider/wasmFalconProvider) and its Emscripten build fails to
    // parse under Metro's web bundler, so quantum accounts have no working
    // signer path in the browser extension yet.
    quantum: false,
    rekeyFlows: false, // RescanRekeyed/RekeyToStandard/RekeyToShared stacks aren't registered in WebMainRoutes
    // The Multisig stack is deliberately omitted from WebMainRoutes (see its
    // header comment). Without this flag the SHARED_ACCOUNT_IMPORT deeplink
    // navigated to an unregistered route — a complete no-op that also left
    // the QR scanner locked, since it waits for one of its callbacks.
    sharedAccounts: false,
    connectionsSettings: true, // unified WalletConnect + dapp connections settings screen
}
