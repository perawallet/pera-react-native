/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { useCallback, useMemo, useState } from 'react'
import {
    useAccountBalancesQuery,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import {
    useAssetSearchQuery,
    type AssetSearchItem,
} from '@perawallet/wallet-core-assets'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { useDebouncedValue } from '@hooks/useDebouncedValue'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import type { AddAssetBottomSheetVariant } from '@modules/assets/components/AddAssetBottomSheet'

type UseAddAssetScreenOptions = {
    variant?: AddAssetBottomSheetVariant
}

type UseAddAssetScreenResult = {
    searchQuery: string
    handleSearchChange: (text: string) => void
    results: AssetSearchItem[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: () => void
    optedInAssetIds: Set<string>
    optingInAssetId: string | null
    handleAddAsset: (assetId: string) => void
    t: (key: string, params?: Record<string, string | number>) => string
}

export const useAddAssetScreen = (
    options?: UseAddAssetScreenOptions,
): UseAddAssetScreenResult => {
    const { t } = useLanguage()
    const hasCollectible = options?.variant === 'collectible'
    const [searchQuery, setSearchQuery] = useState('')
    const [optingInAssetId, setOptingInAssetId] = useState<string | null>(null)
    const [recentlyOptedIn, setRecentlyOptedIn] = useState<Set<string>>(
        new Set(),
    )
    const debouncedQuery = useDebouncedValue(
        searchQuery.trim(),
        SEARCH_DEBOUNCE_TIME,
    )

    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )
    const { optIn } = useAssetOptInMutation()
    const { showToast } = useToast()

    const {
        results,
        isLoading,
        isError,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
    } = useAssetSearchQuery(debouncedQuery, { hasCollectible })

    // Build set of already opted-in asset IDs
    const optedInAssetIds = useMemo(() => {
        const ids = new Set<string>()
        if (selectedAccount) {
            const balances = accountBalances.get(selectedAccount.address)
            if (balances) {
                for (const balance of balances.assetBalances) {
                    ids.add(balance.assetId)
                }
            }
        }
        // Include assets opted in during this session
        for (const id of recentlyOptedIn) {
            ids.add(id)
        }
        return ids
    }, [accountBalances, selectedAccount, recentlyOptedIn])

    const handleSearchChange = useCallback((text: string) => {
        setSearchQuery(text)
    }, [])

    const handleAddAsset = useCallback(
        async (assetId: string) => {
            if (!selectedAccount || optingInAssetId !== null) {
                return
            }

            setOptingInAssetId(assetId)

            try {
                await optIn({
                    sender: selectedAccount.address,
                    assetId: BigInt(assetId),
                })
                setRecentlyOptedIn(prev => new Set([...prev, assetId]))
            } catch (err) {
                showToast({
                    title: t('add_asset.opt_in_failed'),
                    body:
                        err instanceof Error
                            ? err.message
                            : t('add_asset.opt_in_failed'),
                    type: 'error',
                })
            } finally {
                setOptingInAssetId(null)
            }
        },
        [selectedAccount, optIn, optingInAssetId, showToast, t],
    )

    return {
        searchQuery,
        handleSearchChange,
        results,
        isLoading,
        isError,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        optedInAssetIds,
        optingInAssetId,
        handleAddAsset,
        t,
    }
}

export type { UseAddAssetScreenResult }
