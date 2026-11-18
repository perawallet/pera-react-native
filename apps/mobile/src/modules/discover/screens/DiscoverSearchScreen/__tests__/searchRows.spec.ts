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
import { toSearchRows } from '../searchRows'

type Input = Parameters<typeof toSearchRows>[0]

const typing = (overrides: Partial<Input>): Input => ({
    filter: 'all',
    isTyping: true,
    isDebouncing: false,
    typedUrl: null,
    isWebSearchRowVisible: false,
    dappResults: [],
    assetResults: [],
    isLoadingDapps: false,
    isDappSearchUnavailable: false,
    isLoadingAssets: false,
    isAssetSearchIncomplete: false,
    isAssetSearchUnavailable: false,
    recents: [],
    ...overrides,
})

const kinds = (input: Input) => toSearchRows(input).map(row => row.kind)

describe('toSearchRows', () => {
    it('shows only the typed-url row for a domain nothing matches', () => {
        expect(
            kinds(
                typing({
                    isWebSearchRowVisible: true,
                    typedUrl: 'https://aave.org',
                }),
            ),
        ).toEqual(['typedUrl'])
    })

    it('keeps No results under the web search row for a word nothing matches', () => {
        expect(kinds(typing({ isWebSearchRowVisible: true }))).toEqual([
            'webSearch',
            'noResults',
        ])
    })

    it('shows No results under the dApps tab, which has no typed-url row', () => {
        expect(kinds(typing({ filter: 'dapps' }))).toEqual(['noResults'])
    })

    // Deliberate for now: the typed-url row is All-only, so the filtered tabs
    // keep No results for a domain nothing lists.
    it.each(['dapps', 'markets'] as const)(
        'shows No results under %s for a domain nothing matches',
        filter => {
            expect(
                kinds(typing({ filter, typedUrl: 'https://aave.org' })),
            ).toEqual(['noResults'])
        },
    )

    it('shows the loading row, not No results, while a search runs', () => {
        expect(
            kinds(
                typing({
                    isWebSearchRowVisible: true,
                    typedUrl: 'https://aave.org',
                    isDebouncing: true,
                }),
            ),
        ).toEqual(['typedUrl', 'loading'])
    })
})
