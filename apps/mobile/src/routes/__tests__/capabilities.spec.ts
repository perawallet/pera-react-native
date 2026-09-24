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

import { describe, expect, it, vi } from 'vitest'
import { routeCapabilities } from '../capabilities'
import { routeCapabilities as webCapabilities } from '../capabilities.web'

describe('route capabilities', () => {
    it('native map keeps every current-behavior capability on', () => {
        // vaultSecuritySettings and connectionsSettings are web-only
        // capabilities with no native equivalent (native lists WalletConnect
        // sessions under its own menu entry instead of the unified screen) —
        // both are deliberately off for native, not a current-behavior
        // regression. deepLinkPaste is web-only (native keeps the qrScanner
        // camera instead — the two flags are mutually exclusive per platform).
        // ledgerUsb follows the native OS (Android only); the specs run as iOS.
        const {
            vaultSecuritySettings,
            connectionsSettings,
            deepLinkPaste,
            ledgerUsb,
            ...rest
        } = routeCapabilities
        expect(vaultSecuritySettings).toBe(false)
        expect(connectionsSettings).toBe(false)
        expect(deepLinkPaste).toBe(false)
        expect(ledgerUsb).toBe(false)
        expect(Object.values(rest).every(Boolean)).toBe(true)
    })

    it('native map offers Ledger USB on Android only', async () => {
        const { Platform } = await import('react-native')
        const originalOS = Platform.OS
        try {
            Platform.OS = 'android'
            vi.resetModules()
            const android = await import('../capabilities')
            expect(android.routeCapabilities.ledgerUsb).toBe(true)
        } finally {
            Platform.OS = originalOS
            vi.resetModules()
        }
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
            // M10 (shipped): Pera Card on web. Still off: inAppWebView, storeRating.
            peraCard: true,
            inAppWebView: false, // M8 decision: stays false — help/terms open browser tabs
            // FCM web push: token via the DOM realm, receive in the background SW.
            pushNotificationSettings: true,
            storeRating: false,
            vaultSecuritySettings: true,
            // The vault password is the extension's lock; no app PIN.
            pin: false,
            // Menu icon bar swaps the camera for paste-a-deeplink on
            // web (Pera Connect covers the pairing path scanning existed for).
            qrScanner: false,
            deepLinkPaste: true,
            // Rekey + Multisig stacks are now registered in WebMainRoutes, so
            // the account-options rows and the SHARED_ACCOUNT_IMPORT deeplink
            // reach real screens instead of no-oping on an unregistered route.
            rekeyFlows: true,
            sharedAccounts: true,
            // The unified Connections settings screen supersedes the
            // separate WalletConnect menu entry on web.
            connectionsSettings: true,
            // A sheet can't fill the popup; collectible media opens in a tab.
            fullScreenMediaViewer: false,
            ledgerUsb: true,
        })
    })

    it('both maps declare exactly the same capability keys', () => {
        expect(Object.keys(webCapabilities).sort()).toEqual(
            Object.keys(routeCapabilities).sort(),
        )
    })
})
