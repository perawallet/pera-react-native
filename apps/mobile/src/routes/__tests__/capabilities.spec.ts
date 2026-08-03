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
        // vaultSecuritySettings, dappConnections, and connectionsSettings
        // are new, web-only capabilities with no native equivalent (native
        // has its own WalletConnect-based dapp connections, not the
        // ARC-0027 injected provider; native keeps the two separate
        // WalletConnect/Connected Sites menu entries instead of the unified
        // screen) — all are deliberately off for native, not a
        // current-behavior regression. deepLinkPaste is
        // web-only (native keeps the qrScanner camera instead — the two
        // flags are mutually exclusive per platform).
        const {
            vaultSecuritySettings,
            dappConnections,
            connectionsSettings,
            deepLinkPaste,
            ...rest
        } = routeCapabilities
        expect(vaultSecuritySettings).toBe(false)
        expect(dappConnections).toBe(false)
        expect(connectionsSettings).toBe(false)
        expect(deepLinkPaste).toBe(false)
        expect(Object.values(rest).every(Boolean)).toBe(true)
    })

    it('web map: M6 discover off (feature-gate crash), webview-dependent leftovers/card features still off (spec)', () => {
        expect(webCapabilities).toMatchObject({
            // M5 (2026-07-16 feature-completion spec): native RN screen graphs.
            swapTab: true,
            fundTab: true,
            staking: true,
            developerSettings: true,
            // M6: iframe/bridge layer works, but Discover's own feature-gate
            // map only has ios/android keys, so it throws mid-render on our
            // honest clientType 'web' and React unmounts the whole root. Off
            // until Discover fixes its gate. See
            // routes/capabilities.web.ts's discoverTab comment.
            discoverTab: false,
            // M7 (2026-07-17 shipped): WalletConnect v1 pairing + sessions on web.
            walletConnectSettings: true,
            // M8: Bidali stack complete.
            giftCards: true,
            // M9 (shipped): WebAuthn-interception credential provider + settings toggle.
            passkeysAutofillSettings: true,
            // M10 (shipped): Pera Card on web. Still off: inAppWebView, pushNotificationSettings, storeRating.
            peraCard: true,
            inAppWebView: false, // M8 decision: stays false — help/terms open browser tabs
            pushNotificationSettings: false,
            storeRating: false,
            vaultSecuritySettings: true,
            dappConnections: true,
            // Task 6: Menu icon bar swaps the camera for paste-a-deeplink on
            // web (Pera Connect covers the pairing path scanning existed for).
            qrScanner: false,
            deepLinkPaste: true,
            // Rekey + Multisig stacks are now registered in WebMainRoutes, so
            // the account-options rows and the SHARED_ACCOUNT_IMPORT deeplink
            // reach real screens instead of no-oping on an unregistered route.
            rekeyFlows: true,
            sharedAccounts: true,
            // Task 11: unified Connections settings screen supersedes the
            // separate WalletConnect/Connected Sites menu entries on web.
            connectionsSettings: true,
        })
    })

    it('both maps declare exactly the same capability keys', () => {
        expect(Object.keys(webCapabilities).sort()).toEqual(
            Object.keys(routeCapabilities).sort(),
        )
    })
})
