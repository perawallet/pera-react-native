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
    discoverTab: true, // iframe webview layer + discover bridge
    swapTab: true, // native RN screen graph
    fundTab: true, // native RN screen graph (Meld checkout via window.open)
    staking: true, // native RN screen graph
    peraCard: true, // Baanx card, additionally gated by useIsPeraCardEnabled() remote flag
    giftCards: true,
    inAppWebView: false, // stays false — help/terms open browser tabs
    qrScanner: true, // BarcodeDetector camera scan + paste fallback
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
    connectionsSettings: true, // unified WalletConnect + dapp connections settings screen
}
