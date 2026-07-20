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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectBrowser, resetBrowserCache } from '../browser'

const stub = (userAgent: string, platform?: string) => {
    resetBrowserCache()
    vi.stubGlobal('navigator', {
        userAgent,
        userAgentData: platform ? { platform } : undefined,
    })
}

describe('detectBrowser', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        resetBrowserCache()
    })

    it('detects Chrome and its version', () => {
        stub(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        )
        expect(detectBrowser()).toMatchObject({
            name: 'Chrome',
            version: '125.0.0.0',
        })
    })

    it('detects Edge before Chrome', () => {
        stub(
            'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/125.0.0.0 Safari/537.36 Edg/125.0.2535.51',
        )
        expect(detectBrowser()).toMatchObject({
            name: 'Edge',
            version: '125.0.2535.51',
        })
    })

    it('detects Firefox', () => {
        stub('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0')
        expect(detectBrowser()).toMatchObject({
            name: 'Firefox',
            version: '127.0',
        })
    })

    it('prefers the userAgentData platform hint for the OS', () => {
        stub(
            'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/125.0.0.0 Safari/537.36',
            'Windows',
        )
        expect(detectBrowser().osVersion).toBe('Windows')
    })

    it('parses the OS from the user agent when no platform hint exists', () => {
        stub(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        )
        expect(detectBrowser().osVersion).toBe('macOS 10.15.7')
    })

    it('falls back to a generic name for an unrecognized agent', () => {
        stub('some-unknown-agent/1.0')
        expect(detectBrowser()).toEqual({
            name: 'Browser',
            version: '',
            osVersion: 'unknown',
        })
    })
})
