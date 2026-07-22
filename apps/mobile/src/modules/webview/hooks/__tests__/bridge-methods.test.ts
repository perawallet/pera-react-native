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

// @vitest-environment node

import { describe, expect, it } from 'vitest'
import {
    PERA_WEBVIEW_BRIDGE_METHODS,
    isSupportedBridgeMethod,
} from '../bridge-methods'

// The written v3 contract — keep in lockstep with the method table in
// docs/DISCOVER_BRIDGE_CONTRACT.md. A mismatch here means a method was added
// or removed without updating the documented contract.
const DOCUMENTED_V3_METHODS = [
    'canOpenURI',
    'closeWebView',
    'getAddresses',
    'getDeviceId',
    'getPublicSettings',
    'getSettings',
    'logAnalyticsEvent',
    'notifyUser',
    'onBackPressed',
    'openNativeURI',
    'openSystemBrowser',
    'pushWebView',
    'requestDataSigning',
    'requestTransactionSigning',
    'walletConnect',
]

describe('Discover bridge contract (protocol v3)', () => {
    it('supports exactly the method set documented in docs/DISCOVER_BRIDGE_CONTRACT.md', () => {
        expect([...PERA_WEBVIEW_BRIDGE_METHODS].sort()).toEqual(
            DOCUMENTED_V3_METHODS,
        )
    })

    it('rejects the legacy peraMobileInterface native-routing methods', () => {
        const legacyMethods = [
            'pushTokenDetailScreen',
            'handleTokenDetailActionButtonClick',
            'pushNewScreen',
            'openDappWebview',
            'closePeraCards',
        ]
        for (const method of legacyMethods) {
            expect(isSupportedBridgeMethod(method)).toBe(false)
        }
    })
})
