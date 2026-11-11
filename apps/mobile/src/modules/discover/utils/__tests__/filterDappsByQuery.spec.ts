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
import type { PeraProject } from '@perawallet/wallet-core-projects'
import { filterDappsByQuery } from '../filterDappsByQuery'

const project = (over: Partial<PeraProject>): PeraProject => ({
    chains: [],
    ...over,
})

const projects: PeraProject[] = [
    project({
        name: 'Uniswap',
        url: 'https://app.uniswap.org',
        popularityScore: 5,
    }),
    project({
        name: 'Tinyman',
        url: 'https://tinyman.org',
        popularityScore: 9,
    }),
    project({
        name: 'Pact',
        url: 'https://pact.fi/uni-pools',
        popularityScore: 7,
    }),
    project({ name: 'Broken uni', url: 'http://insecure.example' }),
    project({ name: 'No url uni' }),
    project({ name: 'Unscored UNI', url: 'https://unscored.io' }),
]

describe('filterDappsByQuery', () => {
    it('matches on name and on url, case-insensitively', () => {
        expect(filterDappsByQuery(projects, 'UNI').map(d => d.name)).toEqual([
            'Pact',
            'Uniswap',
            'Unscored UNI',
        ])
        expect(
            filterDappsByQuery(projects, 'tinyman.ORG').map(d => d.name),
        ).toEqual(['Tinyman'])
    })

    it('orders by popularityScore descending, missing counting as 0', () => {
        const names = filterDappsByQuery(projects, 'o').map(d => d.name)
        expect(names.indexOf('Tinyman')).toBeLessThan(names.indexOf('Pact'))
        expect(names.indexOf('Pact')).toBeLessThan(names.indexOf('Uniswap'))
        expect(names.at(-1)).toBe('Unscored UNI')
    })

    it('drops a project without a valid url', () => {
        const names = filterDappsByQuery(projects, 'uni').map(d => d.name)
        expect(names).not.toContain('Broken uni')
        expect(names).not.toContain('No url uni')
    })

    it('returns [] for a blank query', () => {
        expect(filterDappsByQuery(projects, '')).toEqual([])
        expect(filterDappsByQuery(projects, '  ')).toEqual([])
    })

    it('trims the query', () => {
        expect(
            filterDappsByQuery(projects, '  tinyman ').map(d => d.name),
        ).toEqual(['Tinyman'])
    })
})
