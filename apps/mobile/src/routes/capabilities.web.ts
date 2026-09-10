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
    // Off: Discover gates its UI tier on compareVersions(version, DISCOVER_V3[platform])
    // with DISCOVER_V3 = { ios, android }, so clientType 'web' makes the lookup
    // undefined, compare-versions throws mid-render and React unmounts the Discover root.
    discoverTab: false,
    swapTab: true, // native RN screen graph
    fundTab: true, // native RN screen graph (Meld checkout via window.open)
    staking: true, // native RN screen graph
    peraCard: true, // Baanx card, additionally gated by useIsPeraCardEnabled() remote flag
    giftCards: true,
    inAppWebView: false, // stays false — help/terms open browser tabs
    // Off in the Menu and home header, replaced by deepLinkPaste. The scanner
    // sheet itself stays reachable from in-field scan buttons and the ScanQR
    // expanded tab; this flag only gates those two icon bars.
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
    // Off: the keystore's Falcon shim is backed by the WASM `falcon-1024` build,
    // whose Emscripten bundle fails to parse under Metro's web bundler, so
    // quantum accounts have no signer path in the extension.
    quantum: false,
    rekeyFlows: true,
    // Also gates the SHARED_ACCOUNT_IMPORT deeplink: without the Multisig stack
    // registered it navigates nowhere and leaves the QR scanner locked awaiting a callback.
    sharedAccounts: true,
    connectionsSettings: true, // unified WalletConnect + dapp connections settings screen
    // Off: the browser extension has no OS credential provider to fill into,
    // so the enable_password_manager remote flag must not surface it here.
    passwordManager: false,
}
