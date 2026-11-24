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
import { signInSiteMismatchOf } from '../signInSite'

describe('signInSiteMismatchOf', () => {
    it('accepts the domain the page was loaded from', () => {
        expect(
            signInSiteMismatchOf('opensea.io', undefined, 'https://opensea.io'),
        ).toBeUndefined()
    })

    it('compares the port as part of the domain', () => {
        expect(
            signInSiteMismatchOf(
                'localhost:3000',
                undefined,
                'http://localhost:3000',
            ),
        ).toBeUndefined()
        expect(
            signInSiteMismatchOf(
                'localhost:4000',
                undefined,
                'http://localhost:3000',
            ),
        ).toBe('localhost:3000')
    })

    it('names the requesting site when the message is for another domain', () => {
        expect(
            signInSiteMismatchOf(
                'opensea.io',
                undefined,
                'https://opensea-claim.xyz',
            ),
        ).toBe('opensea-claim.xyz')
    })

    it('does not treat a subdomain as the same site', () => {
        expect(
            signInSiteMismatchOf(
                'opensea.io',
                undefined,
                'https://login.opensea.io',
            ),
        ).toBe('login.opensea.io')
    })

    it('prefers the observed origin over the URL the dApp claims', () => {
        expect(
            signInSiteMismatchOf(
                'opensea.io',
                { url: 'https://opensea.io' },
                'https://phish.example',
            ),
        ).toBe('phish.example')
    })

    it('reports nothing against a claimed URL no origin attests', () => {
        expect(
            signInSiteMismatchOf('opensea.io', {
                url: 'https://app.uniswap.org',
                verification: { status: 'unknown' },
            }),
        ).toBeUndefined()
    })

    it('does not read a domain with userinfo as the host after it', () => {
        expect(
            signInSiteMismatchOf(
                'app.com@evil.com',
                undefined,
                'https://evil.com',
            ),
        ).toBe('evil.com')
    })

    it('reports nothing when the request names no site at all', () => {
        expect(signInSiteMismatchOf('opensea.io')).toBeUndefined()
    })
})
