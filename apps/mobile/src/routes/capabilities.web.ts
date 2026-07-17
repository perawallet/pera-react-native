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
    discoverTab: true, // M6: iframe webview layer + discover bridge
    swapTab: true, // M5: native RN screen graph
    fundTab: true, // M5: native RN screen graph (Meld checkout via window.open)
    staking: true, // M5: native RN screen graph
    peraCard: false, // M10
    giftCards: false, // M8: rides the M6 iframe layer
    inAppWebView: false, // revisit after M6 lands — decision deferred to M8 planning
    qrScanner: true, // Task 15 (stretch): BarcodeDetector camera scan + paste fallback
    pushNotificationSettings: false, // permanently off: no push on web
    walletConnectSettings: false, // M7
    passkeysAutofillSettings: false, // M9: WebAuthn-interception credential provider
    storeRating: false, // permanently off: no store review flow
    developerSettings: true, // M5: internal builds need network/debug toggles
    vaultSecuritySettings: true,
    dappConnections: true,
    networkSettings: true,
}
