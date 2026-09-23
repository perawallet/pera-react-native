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
import { isDeveloperGalleryIncluded } from './developer-gallery'

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
    accountDrawer: true,
    storeRating: true,
    confirmationModeSetting: true,
    developerSettings: true,
    developerGallery: isDeveloperGalleryIncluded,
    vaultSecuritySettings: false,
    quantum: true,
    rekeyFlows: true,
    sharedAccounts: true,
    // Native lists WalletConnect sessions under its own menu entry instead.
    connectionsSettings: false,
}
