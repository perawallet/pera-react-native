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

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import type { PeraProject } from '@perawallet/wallet-core-projects'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import {
    chainIdsOfCaip2s,
    dappFromUrl,
    dappsByNormalizedUrl,
    toDiscoverDapp,
    verifiedDappUrls,
} from '../toDiscoverDapp'

const project = (overrides: Partial<PeraProject> = {}): PeraProject => ({
    chains: [],
    ...overrides,
})

describe('toDiscoverDapp utils', () => {
    beforeEach(() => {
        registerEthereumChain()
    })
    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    describe('chainIdsOfCaip2s', () => {
        it('maps every Algorand network to algorand once', () => {
            const caip2s = getChainDescriptor('algorand').networks.map(
                n => n.caip2 ?? '',
            )
            expect(chainIdsOfCaip2s(caip2s)).toEqual(['algorand'])
        })

        it('de-duplicates and keeps first-seen order', () => {
            expect(chainIdsOfCaip2s(['eip155:1', 'eip155:1'])).toEqual([
                'ethereum',
            ])
        })

        it('drops unknown and empty ids', () => {
            expect(chainIdsOfCaip2s(['eip155:999999', ''])).toEqual([])
            expect(chainIdsOfCaip2s([])).toEqual([])
        })
    })

    describe('toDiscoverDapp', () => {
        it('is null for a missing, http or javascript url', () => {
            expect(toDiscoverDapp(project())).toBeNull()
            expect(toDiscoverDapp(project({ url: 'http://a.io' }))).toBeNull()
            expect(
                toDiscoverDapp(project({ url: 'javascript:alert(1)' })),
            ).toBeNull()
        })

        it('falls back to the host for a missing name', () => {
            expect(
                toDiscoverDapp(project({ url: 'https://A.io/x', name: '  ' }))
                    ?.name,
            ).toBe('a.io')
        })

        it('skips a category without a title and maps the rest', () => {
            const dapp = toDiscoverDapp(
                project({
                    id: 'p1',
                    url: 'https://a.io',
                    name: 'A',
                    logoPng: 'https://a.io/l.png',
                    chains: ['eip155:1'],
                    categories: [{ id: '1', title: 'DeFi' }, { id: '2' }],
                }),
            )
            expect(dapp).toEqual({
                url: 'https://a.io',
                name: 'A',
                logo: 'https://a.io/l.png',
                categories: ['DeFi'],
                chains: ['ethereum'],
                projectId: 'p1',
            })
        })

        it('returns nothing besides the six DiscoverDapp fields', () => {
            const dapp = toDiscoverDapp(
                project({
                    url: 'https://a.io',
                    description: 'x',
                    verificationTier: 'verified',
                }),
            )
            expect(Object.keys(dapp ?? {}).sort()).toEqual(
                [
                    'categories',
                    'chains',
                    'logo',
                    'name',
                    'projectId',
                    'url',
                ].sort(),
            )
        })
    })

    describe('dappFromUrl', () => {
        it('builds a host-named dapp with no chains', () => {
            expect(dappFromUrl('https://uniswap.org')).toEqual({
                url: 'https://uniswap.org',
                name: 'uniswap.org',
                logo: null,
                categories: [],
                chains: [],
            })
        })

        it('is null for an invalid url', () => {
            expect(dappFromUrl('http://evil.com')).toBeNull()
        })
    })

    it('dappsByNormalizedUrl keys by the normalised url, first wins', () => {
        const result = dappsByNormalizedUrl([
            project({ url: 'https://A.io/', name: 'First' }),
            project({ url: 'https://a.io', name: 'Second' }),
        ])
        expect(Object.keys(result)).toEqual(['https://a.io'])
        expect(result['https://a.io']?.name).toBe('First')
    })

    it('verifiedDappUrls holds only verified projects with a url', () => {
        expect(
            verifiedDappUrls([
                project({ url: 'https://A.io/', verificationTier: 'verified' }),
                project({
                    url: 'https://b.io',
                    verificationTier: 'unverified',
                }),
                project({ verificationTier: 'verified' }),
            ]),
        ).toEqual(new Set(['https://a.io']))
    })
})
