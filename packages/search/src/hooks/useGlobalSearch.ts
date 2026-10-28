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
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import {
    EMPTY_GLOBAL_SEARCH_RESULTS,
    SEARCH_SCOPES,
    type GlobalSearchResults,
    type SearchScope,
} from '../models'

const DEFAULT_DEBOUNCE_MS = 300

// Search spans every chain the account is on, so a query matches any of its addresses.
const addressesOf = (account: WalletAccount): string[] =>
    Object.values(account.chains).flatMap(entry => entry?.address ?? [])

const sortKeyOf = (account: WalletAccount): string =>
    account.name ?? addressesOf(account)[0] ?? ''

// Search reaches chain scopes only through accounts, so it borrows that type.
type ChainScope = Parameters<typeof useOwnedAssets>[0]

export type UseGlobalSearchOptions = {
    debounceMs?: number
    /** Which result types to search. Defaults to all three scopes. */
    scopes?: readonly SearchScope[]
    /** Predicate applied to the local owned-assets set before substring
     *  matching. Useful to narrow to collectibles for NFT search. */
    assetFilter?: (asset: PeraAsset) => boolean
}

export type UseGlobalSearchResult = {
    value: string
    setValue: (text: string) => void
    results: GlobalSearchResults
    hasResults: boolean
    isLoading: boolean
}

export const useGlobalSearch = (
    chainScope: ChainScope,
    options?: UseGlobalSearchOptions,
): UseGlobalSearchResult => {
    const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS
    const scopes = options?.scopes ?? SEARCH_SCOPES
    const assetFilter = options?.assetFilter

    const includesAccounts = scopes.includes('accounts')
    const includesContacts = scopes.includes('contacts')
    const includesAssets = scopes.includes('assets')

    const [value, setValue] = useState('')
    const debouncedValue = useDebouncedValue(value, debounceMs)
    const hasQuery = debouncedValue.length > 0

    const accounts = useAllAccounts()
    const { findContacts } = useContacts()

    const { assets: allOwnedAssets, isLoading: isOwnedAssetsLoading } =
        useOwnedAssets(chainScope, { enabled: includesAssets })

    const ownedAssets = useMemo<PeraAsset[]>(() => {
        if (!includesAssets) return []
        if (!assetFilter) return allOwnedAssets
        return allOwnedAssets.filter(assetFilter)
    }, [includesAssets, allOwnedAssets, assetFilter])

    const results = useMemo<GlobalSearchResults>(() => {
        if (!hasQuery) return EMPTY_GLOBAL_SEARCH_RESULTS

        const lowered = debouncedValue.toLowerCase()
        const compare = (a: string, b: string) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })

        const matchingAccounts = includesAccounts
            ? accounts
                  .filter(
                      account =>
                          addressesOf(account).some(address =>
                              address.toLowerCase().includes(lowered),
                          ) || account.name?.toLowerCase().includes(lowered),
                  )
                  .slice()
                  .sort((a, b) => compare(sortKeyOf(a), sortKeyOf(b)))
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

        return {
            accounts: matchingAccounts,
            contacts: matchingContacts,
            assets: matchingAssets,
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
    ])

    const hasResults =
        results.accounts.length > 0 ||
        results.contacts.length > 0 ||
        results.assets.length > 0

    // Filtering is in memory, so the debounce window isn't loading: counting
    // it would flash the skeleton on every keystroke.
    return {
        value,
        setValue,
        results,
        hasResults,
        isLoading: value.length > 0 && isOwnedAssetsLoading,
    }
}
