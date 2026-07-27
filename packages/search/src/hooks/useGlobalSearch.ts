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

import { useMemo, useState } from 'react'
import {
    useAllAccounts,
    useOwnedAssets,
} from '@perawallet/wallet-core-accounts'
import { useAssetSearchQuery } from '@perawallet/wallet-core-assets'
import type {
    DisplayableAsset,
    PeraAsset,
} from '@perawallet/wallet-core-assets'
import { useContacts } from '@perawallet/wallet-core-contacts'
import {
    type Nullable,
    useDebouncedValue,
} from '@perawallet/wallet-core-shared'
import {
    EMPTY_GLOBAL_SEARCH_RESULTS,
    SEARCH_SCOPES,
    type GlobalSearchResults,
    type SearchScope,
} from '../models'

const DEFAULT_DEBOUNCE_MS = 300

export type RemoteAssetsOptions = {
    /** Restrict remote asset results to collectibles (NFTs). */
    hasCollectible?: boolean
    /** When true, run the remote asset search even with an empty query so
     *  the backend returns a default suggestion list. Local sections
     *  (accounts, contacts, owned assets) remain empty until the user types. */
    showOnEmptyQuery?: boolean
}

export type UseGlobalSearchOptions = {
    debounceMs?: number
    /** Which result types to search. Defaults to all three scopes. */
    scopes?: readonly SearchScope[]
    /** Predicate applied to the local owned-assets set before substring
     *  matching. Useful to narrow to collectibles for NFT search. */
    assetFilter?: (asset: PeraAsset) => boolean
    /** When provided, also runs a remote asset catalogue search and exposes
     *  the results via `results.remoteAssets` (with paging controls).
     *  Only meaningful when `'assets'` is in `scopes`. */
    remoteAssets?: RemoteAssetsOptions
}

export type UseGlobalSearchResult = {
    value: string
    setValue: (text: string) => void
    results: GlobalSearchResults
    hasResults: boolean
    isLoading: boolean
    hasNextRemotePage: boolean
    isFetchingNextRemotePage: boolean
    fetchNextRemotePage: Nullable<() => void>
    /** Remote asset search failed (device believed online). */
    isRemoteError: boolean
    /** Remote asset search is paused because the device is offline. */
    isRemotePaused: boolean
}

export const useGlobalSearch = (
    options?: UseGlobalSearchOptions,
): UseGlobalSearchResult => {
    const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS
    const scopes = options?.scopes ?? SEARCH_SCOPES
    const assetFilter = options?.assetFilter
    const remoteAssetsOptions = options?.remoteAssets
    const remoteAssetsEnabled = !!remoteAssetsOptions

    const includesAccounts = scopes.includes('accounts')
    const includesContacts = scopes.includes('contacts')
    const includesAssets = scopes.includes('assets')

    const [value, setValue] = useState('')
    const debouncedValue = useDebouncedValue(value, debounceMs)
    const hasQuery = debouncedValue.length > 0
    const isDebouncing = value !== debouncedValue

    const accounts = useAllAccounts()
    const { findContacts } = useContacts()

    const { assets: allOwnedAssets, isLoading: isOwnedAssetsLoading } =
        useOwnedAssets({ enabled: includesAssets })

    const ownedAssets = useMemo<PeraAsset[]>(() => {
        if (!includesAssets) return []
        if (!assetFilter) return allOwnedAssets
        return allOwnedAssets.filter(assetFilter)
    }, [includesAssets, allOwnedAssets, assetFilter])

    const showRemoteOnEmpty = remoteAssetsOptions?.showOnEmptyQuery ?? false
    const shouldRunRemoteAssets =
        remoteAssetsEnabled && includesAssets && (hasQuery || showRemoteOnEmpty)
    const remoteAssetQuery = useAssetSearchQuery(debouncedValue, {
        hasCollectible: remoteAssetsOptions?.hasCollectible,
        enabled: shouldRunRemoteAssets,
    })

    const results = useMemo<GlobalSearchResults>(() => {
        if (!hasQuery) {
            if (!shouldRunRemoteAssets) return EMPTY_GLOBAL_SEARCH_RESULTS
            return {
                ...EMPTY_GLOBAL_SEARCH_RESULTS,
                remoteAssets: remoteAssetQuery.results ?? [],
            }
        }

        const lowered = debouncedValue.toLowerCase()
        const compare = (a: string, b: string) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })

        const matchingAccounts = includesAccounts
            ? accounts
                  .filter(
                      account =>
                          account.address.toLowerCase().includes(lowered) ||
                          account.name?.toLowerCase().includes(lowered),
                  )
                  .slice()
                  .sort((a, b) =>
                      compare(a.name ?? a.address, b.name ?? b.address),
                  )
            : []

        const matchingContacts = includesContacts
            ? findContacts({ keyword: debouncedValue })
                  .slice()
                  .sort((a, b) => compare(a.name, b.name))
            : []

        const matchingAssets = includesAssets
            ? ownedAssets
                  .filter(
                      asset =>
                          asset.name?.toLowerCase().includes(lowered) ||
                          asset.unitName?.toLowerCase().includes(lowered) ||
                          asset.assetId.includes(debouncedValue),
                  )
                  .slice()
                  .sort((a, b) =>
                      compare(
                          a.name ?? a.unitName ?? a.assetId,
                          b.name ?? b.unitName ?? b.assetId,
                      ),
                  )
            : []

        const remoteAssets: DisplayableAsset[] = shouldRunRemoteAssets
            ? (remoteAssetQuery.results ?? [])
            : []

        return {
            accounts: matchingAccounts,
            contacts: matchingContacts,
            assets: matchingAssets,
            remoteAssets,
        }
    }, [
        hasQuery,
        debouncedValue,
        includesAccounts,
        includesContacts,
        includesAssets,
        accounts,
        findContacts,
        ownedAssets,
        shouldRunRemoteAssets,
        remoteAssetQuery.results,
    ])

    const hasResults =
        results.accounts.length > 0 ||
        results.contacts.length > 0 ||
        results.assets.length > 0 ||
        results.remoteAssets.length > 0

    const isRemoteLoading = shouldRunRemoteAssets && remoteAssetQuery.isLoading
    const hasUserQuery = value.length > 0
    // Debouncing only counts as loading when a remote fetch will follow.
    // For purely in-memory (client-side) filtering there is nothing to wait
    // for, so treating the debounce window as loading would flash the skeleton
    // on every keystroke.
    const isLoadingTypedQuery =
        hasUserQuery &&
        ((isDebouncing && shouldRunRemoteAssets) ||
            isOwnedAssetsLoading ||
            isRemoteLoading)
    const isLoadingEmptyQuerySuggestions =
        !hasUserQuery && showRemoteOnEmpty && isRemoteLoading

    return {
        value,
        setValue,
        results,
        hasResults,
        isLoading: isLoadingTypedQuery || isLoadingEmptyQuerySuggestions,
        hasNextRemotePage: shouldRunRemoteAssets
            ? remoteAssetQuery.hasNextPage
            : false,
        isFetchingNextRemotePage: shouldRunRemoteAssets
            ? remoteAssetQuery.isFetchingNextPage
            : false,
        fetchNextRemotePage: shouldRunRemoteAssets
            ? remoteAssetQuery.fetchNextPage
            : null,
        isRemoteError: remoteAssetQuery.isError,
        isRemotePaused: remoteAssetQuery.isPaused,
    }
}
