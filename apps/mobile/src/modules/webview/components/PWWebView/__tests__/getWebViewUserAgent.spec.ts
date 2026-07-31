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

import { describe, it, expect } from 'vitest'
import { getWebViewUserAgent } from '../getWebViewUserAgent'

import type { DeviceInfoService } from '@perawallet/wallet-extension-platform'

const FULL_USER_AGENT = 'Pera/6.4.1.123 (ios; iPhone 15,2; 17.4) pera_ios_6.4.1'

const deviceInfo = {
    getUserAgent: () => FULL_USER_AGENT,
    getDevicePlatform: () => 'ios',
    getAppVersion: () => '6.4.1',
} as DeviceInfoService

describe('getWebViewUserAgent', () => {
    it('returns the full device user agent for a trusted origin', () => {
        expect(getWebViewUserAgent(deviceInfo, true)).toBe(FULL_USER_AGENT)
    })

    it('returns only the app identifier and version — no device model or OS version — for an untrusted origin', () => {
        expect(getWebViewUserAgent(deviceInfo, false)).toBe('pera_ios_6.4.1')
    })
})
