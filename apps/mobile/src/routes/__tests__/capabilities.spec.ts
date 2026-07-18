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

import { describe, expect, it } from 'vitest'
import { routeCapabilities } from '../capabilities'
import { routeCapabilities as webCapabilities } from '../capabilities.web'

describe('route capabilities', () => {
    it('native map keeps every current-behavior capability on', () => {
        // vaultSecuritySettings, dappConnections, and networkSettings are new,
        // web-only capabilities with no native equivalent (native has its own
        // WalletConnect-based dapp connections, not the ARC-0027 injected
        // provider; native uses Developer → Node Settings) — all are deliberately
        // off for native, not a current-behavior regression.
        const {
            vaultSecuritySettings,
            dappConnections,
            networkSettings,
            ...rest
        } = routeCapabilities
        expect(vaultSecuritySettings).toBe(false)
        expect(dappConnections).toBe(false)
        expect(networkSettings).toBe(false)
        expect(Object.values(rest).every(Boolean)).toBe(true)
    })

    it('web map: M6 discover on, webview-dependent leftovers/card features still off (spec)', () => {
        expect(webCapabilities).toMatchObject({
            // M5 (2026-07-16 feature-completion spec): native RN screen graphs.
            swapTab: true,
            fundTab: true,
            staking: true,
            developerSettings: true,
            // M6 (2026-07-16 feature-completion spec): iframe webview layer.
            discoverTab: true,
            // M7 (2026-07-17 shipped): WalletConnect v1 pairing + sessions on web.
            walletConnectSettings: true,
            // M8: Bidali stack complete.
            giftCards: true,
            // M9 (shipped): WebAuthn-interception credential provider + settings toggle.
            passkeysAutofillSettings: true,
            // Still off: Pera Card (M10), and permanently-off items.
            inAppWebView: false, // M8 decision: stays false — help/terms open browser tabs
            peraCard: false,
            pushNotificationSettings: false,
            storeRating: false,
            vaultSecuritySettings: true,
            dappConnections: true,
            networkSettings: true,
        })
    })

    it('both maps declare exactly the same capability keys', () => {
        expect(Object.keys(webCapabilities).sort()).toEqual(
            Object.keys(routeCapabilities).sort(),
        )
    })
})
