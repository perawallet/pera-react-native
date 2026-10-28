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
import { listLookupCandidates, toSiteHost } from '../host'

describe('toSiteHost', () => {
    it('reads the host of a URL in both forms', () => {
        expect(toSiteHost('https://app.uniswap.org/swap?x=1')).toEqual({
            ascii: 'app.uniswap.org',
            unicode: 'app.uniswap.org',
        })
    })

    it('decodes a punycode host and encodes a Unicode one', () => {
        expect(toSiteHost('https://xn--uniswp-7nf.org')).toEqual({
            ascii: 'xn--uniswp-7nf.org',
            unicode: 'uniswаp.org',
        })
        expect(toSiteHost('https://uniswаp.org')?.ascii).toBe(
            'xn--uniswp-7nf.org',
        )
    })

    it('drops the port, userinfo, trailing dot and case', () => {
        expect(toSiteHost('https://user:pw@Evil.Example.:8443/x')?.ascii).toBe(
            'evil.example',
        )
    })

    it('accepts a bare host', () => {
        expect(toSiteHost('tinyman.org')?.ascii).toBe('tinyman.org')
    })

    it.each([
        undefined,
        null,
        '',
        'http://localhost:3000',
        'https://127.0.0.1',
        'https://[::1]:8080',
        'not a host',
    ])('gives nothing for %s', url => {
        expect(toSiteHost(url)).toBeUndefined()
    })
})

describe('listLookupCandidates', () => {
    it('lists the host and its parents down to two labels', () => {
        expect(listLookupCandidates('a.b.evil.com')).toEqual([
            'a.b.evil.com',
            'b.evil.com',
            'evil.com',
        ])
        expect(listLookupCandidates('evil.com')).toEqual(['evil.com'])
    })
})
