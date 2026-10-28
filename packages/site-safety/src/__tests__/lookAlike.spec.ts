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
import { toSiteHost } from '../host'
import { findImpersonatedTarget } from '../lookAlike'
import type { SiteHost } from '../models'
import { WELL_KNOWN_DAPPS } from '../wellKnownDapps'

const host = (url: string): SiteHost => {
    const parsed = toSiteHost(url)
    if (!parsed) throw new Error(`unparseable ${url}`)
    return parsed
}

const imitated = (url: string, allow: string[] = []) =>
    findImpersonatedTarget(host(url), WELL_KNOWN_DAPPS, allow)?.name

describe('findImpersonatedTarget', () => {
    it.each([
        ['an extra word after', 'uniswap-app.org'],
        ['an extra word before', 'app-uniswap.com'],
        ['a joined extra word', 'uniswapapp.org'],
        ['a Cyrillic lookalike', 'uniswаp.org'],
        ['the punycode of a lookalike', 'xn--uniswp-7nf.org'],
        ['a digit for a letter', 'un1swap.org'],
        ['another TLD', 'uniswap.app'],
        ['a one-letter typo', 'uniswep.org'],
        ['a subdomain of another site', 'uniswap.evil.com'],
    ])('flags %s and names the site', (_case, url) => {
        expect(imitated(url)).toBe('Uniswap')
    })

    it.each(['uniswap.org', 'app.uniswap.org', 'www.uniswap.org'])(
        'never flags the real site %s',
        url => {
            expect(imitated(url)).toBeUndefined()
        },
    )

    it('never flags one well-known site as imitating another', () => {
        expect(imitated('algorand.co')).toBeUndefined()
        expect(imitated('algorand.foundation')).toBeUndefined()
        expect(imitated('tinyman.org')).toBeUndefined()
    })

    it.each([
        'developer.algorand.org',
        'app.algorandtechnologies.com',
        'curve.finance',
        'algorand-wc2.vercel.app',
    ])('never flags the ecosystem site %s', url => {
        expect(imitated(url)).toBeUndefined()
    })

    it.each([
        ['uniswap-claim.vercel.app', 'Uniswap'],
        ['tinyman-app.netlify.app', 'Tinyman'],
        ['perawallet-app.github.io', 'Pera Wallet'],
        ['uniswap-app.co.uk', 'Uniswap'],
        ['uniswep.pages.dev', 'Uniswap'],
    ])('flags %s on shared hosting or a two-label suffix', (url, name) => {
        expect(imitated(url)).toBe(name)
    })

    it('never flags a list-allowed domain', () => {
        expect(imitated('uniswap-fan.example', ['uniswap-fan.example'])).toBe(
            undefined,
        )
    })

    it('keeps short names to exact matches', () => {
        expect(imitated('impact.org')).toBeUndefined()
        expect(imitated('pact.app')).toBe('Pact')
    })

    it('leaves unrelated sites alone', () => {
        expect(imitated('example.org')).toBeUndefined()
        expect(imitated('my-dapp.xyz')).toBeUndefined()
    })
})
