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
    discoverTab: true,
    swapTab: true,
    fundTab: true,
    staking: true,
    peraCard: true,
    giftCards: true,
    inAppWebView: true,
    qrScanner: true,
    // Native keeps the camera; paste has no reason to exist there.
    deepLinkPaste: false,
    pushNotificationSettings: true,
    walletConnectSettings: true,
    passkeysAutofillSettings: true,
    storeRating: true,
    developerSettings: true,
    vaultSecuritySettings: false,
    // Native's WalletConnect covers dapp connections; the ARC-0027 injected
    // provider is browser-extension only.
    dappConnections: false,
    quantum: true,
    rekeyFlows: true,
    sharedAccounts: true,
    // Native keeps the two separate WalletConnect/Connected Sites menu
    // entries (dappConnections is off there anyway).
    connectionsSettings: false,
}
