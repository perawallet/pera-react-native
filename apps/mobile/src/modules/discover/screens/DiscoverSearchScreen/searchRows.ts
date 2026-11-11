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

import type { ScopedAssetSearchResult } from '@perawallet/wallet-core-assets'
import {
    recentSearchKey,
    type RecentSearch,
} from '../../store/useDiscoverRecentSearchesStore'
import type { DiscoverDapp } from '../../types'
import type { UseDiscoverSearchScreenResult } from './useDiscoverSearchScreen'

export type SearchRow =
    | { key: string; kind: 'recentHeader' }
    | { key: string; kind: 'noRecent' }
    | { key: string; kind: 'recent'; recent: RecentSearch; recentKey: string }
    | { key: string; kind: 'typedUrl'; url: string }
    | { key: string; kind: 'webSearch' }
    | { key: string; kind: 'dapp'; dapp: DiscoverDapp }
    | { key: string; kind: 'asset'; result: ScopedAssetSearchResult }
    | { key: string; kind: 'incomplete' }
    | { key: string; kind: 'unavailable' }
    | { key: string; kind: 'dappsUnavailable' }
    | { key: string; kind: 'noResults' }
    | { key: string; kind: 'loading' }

type RowsInput = Pick<
    UseDiscoverSearchScreenResult,
    | 'filter'
    | 'isTyping'
    | 'isDebouncing'
    | 'typedUrl'
    | 'isWebSearchRowVisible'
    | 'dappResults'
    | 'assetResults'
    | 'isLoadingDapps'
    | 'isDappSearchUnavailable'
    | 'isLoadingAssets'
    | 'isAssetSearchIncomplete'
    | 'isAssetSearchUnavailable'
    | 'recents'
>

const recentRows = (recents: RecentSearch[]): SearchRow[] => {
    if (recents.length === 0) return [{ key: 'no-recent', kind: 'noRecent' }]
    return [
        { key: 'recent-header', kind: 'recentHeader' },
        ...recents.map((recent): SearchRow => {
            const recentKey = recentSearchKey(recent)
            return {
                key: `recent:${recentKey}`,
                kind: 'recent',
                recent,
                recentKey,
            }
        }),
    ]
}

const isLoadingTab = (input: RowsInput): boolean => {
    if (input.isDebouncing) return true
    if (input.filter === 'dapps') return input.isLoadingDapps
    if (input.filter === 'markets') return input.isLoadingAssets
    return input.isLoadingDapps || input.isLoadingAssets
}

/** The flat list the search screen renders: recents when empty, results when typing. */
export const toSearchRows = (input: RowsInput): SearchRow[] => {
    if (!input.isTyping) return recentRows(input.recents)

    const rows: SearchRow[] = []
    if (input.isWebSearchRowVisible) {
        rows.push(
            input.typedUrl === null
                ? { key: 'web-search', kind: 'webSearch' }
                : { key: 'typed-url', kind: 'typedUrl', url: input.typedUrl },
        )
    }
    // dApps are not searched under Markets.
    const isDappsUnavailable =
        input.filter !== 'markets' && input.isDappSearchUnavailable
    if (isDappsUnavailable) {
        rows.push({ key: 'dapps-unavailable', kind: 'dappsUnavailable' })
    }
    for (const dapp of input.dappResults) {
        rows.push({ key: `dapp:${dapp.url}`, kind: 'dapp', dapp })
    }

    // The asset notices never show under dApps, where assets are not searched.
    const showsAssets = input.filter !== 'dapps'
    const isUnavailable = showsAssets && input.isAssetSearchUnavailable
    if (isUnavailable) {
        rows.push({ key: 'unavailable', kind: 'unavailable' })
    } else if (showsAssets && input.isAssetSearchIncomplete) {
        rows.push({ key: 'incomplete', kind: 'incomplete' })
    }
    for (const result of input.assetResults) {
        rows.push({
            key: `asset:${result.scope.chainId}:${result.asset.assetId}`,
            kind: 'asset',
            result,
        })
    }

    if (isLoadingTab(input)) {
        rows.push({ key: 'loading', kind: 'loading' })
    } else if (
        !isUnavailable &&
        !isDappsUnavailable &&
        input.dappResults.length === 0 &&
        input.assetResults.length === 0
    ) {
        rows.push({ key: 'no-results', kind: 'noResults' })
    }
    return rows
}
