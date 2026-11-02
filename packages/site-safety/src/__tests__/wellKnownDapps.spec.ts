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
import { isSiteOfDapp } from '../wellKnownDapps'

describe('isSiteOfDapp', () => {
    it.each([
        'https://app.uniswap.org',
        'https://app.uniswap.org/swap?chain=mainnet',
        'https://uniswap.org',
        'uniswap.org',
    ])('accepts the project domain and its subdomains (%s)', url => {
        expect(isSiteOfDapp(url, 'uniswap.org')).toBe(true)
    })

    it.each([
        'https://uniswap.org.evil.example',
        'https://app-uniswap.org',
        'https://notuniswap.org',
        'https://uniswap.org@evil.example',
        'https://evil.example/uniswap.org',
    ])('rejects a look-alike host (%s)', url => {
        expect(isSiteOfDapp(url, 'uniswap.org')).toBe(false)
    })

    it('accepts a well-known project’s other domains', () => {
        expect(isSiteOfDapp('https://app.curve.finance', 'curve.fi')).toBe(true)
        expect(isSiteOfDapp('https://curve.fi', 'curve.fi')).toBe(true)
    })

    it('does not extend another domain’s others to an unlisted one', () => {
        expect(isSiteOfDapp('https://curve.finance', 'example.com')).toBe(false)
        expect(isSiteOfDapp('https://example.com', 'example.com')).toBe(true)
    })

    it.each([undefined, null, '', 'localhost', 'http://192.168.0.1'])(
        'rejects an unusable url (%s)',
        url => {
            expect(isSiteOfDapp(url, 'uniswap.org')).toBe(false)
        },
    )
})
