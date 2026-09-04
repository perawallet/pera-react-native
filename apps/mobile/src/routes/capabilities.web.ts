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
    pushNotificationSettings: true, // FCM web push via the background SW
    walletConnectSettings: true, // WC v1 pairing + sessions on web
    passkeysAutofillSettings: true, // WebAuthn-interception credential provider + settings toggle
    accountDrawer: false, // no edge-swipe in a popup; the bottom-sheet switcher stays
    storeRating: false, // permanently off: no store review flow
    // Off: ConfirmAction.web.tsx always renders tap-to-confirm (swipe is
    // awkward with a mouse), so the slide/tap choice would be a no-op here.
    confirmationModeSetting: false,
    developerSettings: true, // internal builds need network/debug toggles
    vaultSecuritySettings: true,
    dappConnections: true,
    // Off: the keystore signs Falcon-1024 from sealed material, and off
    // device its Falcon shim is backed by the WASM `falcon-1024` build —
    // whose Emscripten bundle fails to parse under Metro's web bundler. So
    // quantum accounts have no working signer path in the browser extension
    // yet.
    quantum: false,
    rekeyFlows: true,
    // Gates the SHARED_ACCOUNT_IMPORT deeplink as well as the UI entry points;
    // without the Multisig stack registered it navigated to an unregistered
    // route — a no-op that also left the QR scanner locked, since it waits for
    // one of its callbacks.
    sharedAccounts: true,
    connectionsSettings: true, // unified WalletConnect + dapp connections settings screen
    // Off: proof of concept only, and the browser extension has no OS
    // credential provider to integrate with.
    passwordManager: false,
}
