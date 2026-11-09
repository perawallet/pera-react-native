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
    assetFromHoldingLiteRow,
    chainAccountOf,
    useAccountAssetsQuery,
    useAllAccounts,
    useRegisteredChainIds,
    useWalletHoldingSources,
    type AccountHoldingSource,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    toScopeKey,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import {
    chainDisplayNameOf,
    getChainDescriptor,
} from '@perawallet/wallet-core-chain-shared'
import { useContacts } from '@perawallet/wallet-core-contacts'
import { useDebouncedValue } from '@perawallet/wallet-core-shared'
import {
    EMPTY_GLOBAL_SEARCH_RESULTS,
    SEARCH_SCOPES,
    type AccountSearchResult,
    type AssetSearchResult,
    type GlobalSearchResults,
    type SearchScope,
} from '../models'
import { matchAccount, type SearchableChain } from '../utils/matchAccount'

const DEFAULT_DEBOUNCE_MS = 300

// The sort key falls back to the first address, whichever chain it is on.
const addressesOf = (account: WalletAccount): string[] =>
    Object.values(account.chains).flatMap(entry => entry?.address ?? [])

const sortKeyOf = (account: WalletAccount): string =>
    account.name ?? addressesOf(account)[0] ?? ''

const compare = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })

export type UseGlobalSearchOptions = {
    debounceMs?: number
    /** Which result types to search. Defaults to all three scopes. */
    scopes?: readonly SearchScope[]
    /** Narrows every result type to this network. */
    chainId?: ChainId
}

export type UseGlobalSearchResult = {
    value: string
    setValue: (text: string) => void
    /** The debounced term the results matched. */
    query: string
    results: GlobalSearchResults
    hasResults: boolean
    isLoading: boolean
    /** The registered chains any account has an entry on, in registry order. */
    chainIds: ChainId[]
}

export const useGlobalSearch = (
    options?: UseGlobalSearchOptions,
): UseGlobalSearchResult => {
    const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS
    const scopes = options?.scopes ?? SEARCH_SCOPES
    const filterChainId = options?.chainId

    const includesAccounts = scopes.includes('accounts')
    const includesContacts = scopes.includes('contacts')
    const includesAssets = scopes.includes('assets')

    const [value, setValue] = useState('')
    const debouncedValue = useDebouncedValue(value, debounceMs)
    const hasQuery = debouncedValue.length > 0

    const accounts = useAllAccounts()
    const { findContacts } = useContacts()
    const registeredChainIds = useRegisteredChainIds()

    const chains = useMemo<SearchableChain[]>(
        () =>
            registeredChainIds.map(id => ({
                id,
                displayName: chainDisplayNameOf(id) ?? id,
            })),
        [registeredChainIds],
    )

    const chainIds = useMemo(
        () =>
            registeredChainIds.filter(chainId =>
                accounts.some(
                    account => chainAccountOf(account, chainId) !== undefined,
                ),
            ),
        [registeredChainIds, accounts],
    )

    const walletSources = useWalletHoldingSources()
    const sources = useMemo(() => {
        if (!filterChainId) return walletSources
        const byChain = new Map<ChainId, AccountHoldingSource[]>()
        for (const source of walletSources) {
            const { chainId } = source.scope
            byChain.set(chainId, [...(byChain.get(chainId) ?? []), source])
        }
        return byChain.get(filterChainId) ?? []
    }, [walletSources, filterChainId])
    const {
        holdings,
        isPending: isHoldingsPending,
        isPlaceholderData: isHoldingsPlaceholder,
    } = useAccountAssetsQuery(sources, {
        search: debouncedValue,
        enabled: includesAssets && hasQuery,
    })
    // The read keeps the previous term's rows while the new one loads, and they
    // would pass for results of this term.
    const isHoldingsStale = includesAssets && hasQuery && isHoldingsPlaceholder

    const results = useMemo<GlobalSearchResults>(() => {
        if (!hasQuery) return EMPTY_GLOBAL_SEARCH_RESULTS

        const lowered = debouncedValue.toLowerCase()

        const matchingAccounts: AccountSearchResult[] = includesAccounts
            ? accounts
                  .flatMap(
                      account =>
                          matchAccount(
                              account,
                              lowered,
                              chains,
                              filterChainId,
                          ) ?? [],
                  )
                  .sort((a, b) =>
                      compare(sortKeyOf(a.account), sortKeyOf(b.account)),
                  )
            : []

        const matchingContacts = includesContacts
            ? findContacts({
                  keyword: debouncedValue,
                  family: filterChainId
                      ? getChainDescriptor(filterChainId).family
                      : undefined,
              })
                  .slice()
                  .sort((a, b) => compare(a.name, b.name))
            : []

        const seen = new Set<string>()
        const matchingAssets: AssetSearchResult[] = []
        if (includesAssets && !isHoldingsStale) {
            for (const row of holdings) {
                const key = `${toScopeKey(row.scope)}:${row.assetId}`
                if (seen.has(key)) continue
                seen.add(key)
                const asset = assetFromHoldingLiteRow(row, row.scope.chainId)
                if (asset) matchingAssets.push({ asset, scope: row.scope })
            }
            matchingAssets.sort((a, b) =>
                compare(
                    a.asset.name ?? a.asset.unitName ?? a.asset.assetId,
                    b.asset.name ?? b.asset.unitName ?? b.asset.assetId,
                ),
            )
        }

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
        chains,
        filterChainId,
        findContacts,
        holdings,
        isHoldingsStale,
    ])

    const hasResults =
        results.accounts.length > 0 ||
        results.contacts.length > 0 ||
        results.assets.length > 0

    // Accounts and contacts filter in memory, so the debounce window isn't
    // loading: counting it would flash the skeleton on every keystroke.
    return {
        value,
        setValue,
        query: debouncedValue,
        results,
        hasResults,
        isLoading: value.length > 0 && (isHoldingsPending || isHoldingsStale),
        chainIds,
    }
}
