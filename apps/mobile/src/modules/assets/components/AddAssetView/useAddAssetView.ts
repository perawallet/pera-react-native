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
import type { AssetSearchItem } from '@perawallet/wallet-core-assets'
import { useGlobalSearch } from '@perawallet/wallet-core-search'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import type { AddAssetBottomSheetVariant } from '@modules/assets/components/AddAssetBottomSheet'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseAddAssetViewOptions = {
    variant?: AddAssetBottomSheetVariant
}

type UseAddAssetViewResult = {
    searchQuery: string
    handleSearchChange: (text: string) => void
    results: AssetSearchItem[]
    isLoading: boolean
    isError: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: Nullable<() => void>
    optedInAssetIds: Set<string>
    optingInAssetIds: Set<string>
    handleRequestAdd: (assetId: string) => void
    handleConfirmAdd: () => void
    handleCancelAdd: () => void
    pendingAssetId: Nullable<string>
    selectedAccountAddress: Nullable<string>
    selectedAccountName: string
    t: (key: string, params?: Record<string, string | number>) => string
}

export const useAddAssetView = (
    options?: UseAddAssetViewOptions,
): UseAddAssetViewResult => {
    const { t } = useLanguage()
    const hasCollectible = options?.variant === 'collectible'
    const [optingInAssetIds, setOptingInAssetIds] = useState<Set<string>>(
        new Set(),
    )
    const [pendingAssetId, setPendingAssetId] = useState<Nullable<string>>(null)
    const [recentlyOptedIn, setRecentlyOptedIn] = useState<Set<string>>(
        new Set(),
    )

    const selectedAccount = useAccountsStore(state =>
        state.getSelectedAccount(),
    )
    const { accountBalances } = useAccountBalancesQuery(
        selectedAccount ? [selectedAccount] : [],
    )
    const { optIn } = useAssetOptInMutation()
    const { showToast } = useToast()
    const { showError } = useErrorToast()

    const {
        value: searchQuery,
        setValue: setSearchQuery,
        results: searchResults,
        isLoading,
        hasNextRemotePage: hasNextPage,
        isFetchingNextRemotePage: isFetchingNextPage,
        fetchNextRemotePage: fetchNextPage,
    } = useGlobalSearch({
        debounceMs: SEARCH_DEBOUNCE_TIME,
        scopes: ['assets'],
        remoteAssets: { hasCollectible, showOnEmptyQuery: true },
    })
    const results = searchResults.remoteAssets
    const isError = false

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

    const handleSearchChange = useCallback(
        (text: string) => {
            setSearchQuery(text)
        },
        [setSearchQuery],
    )

    const handleRequestAdd = useCallback(
        (assetId: string) => {
            if (!selectedAccount || optingInAssetIds.has(assetId)) {
                return
            }
            setPendingAssetId(assetId)
        },
        [selectedAccount, optingInAssetIds],
    )

    const handleCancelAdd = useCallback(() => {
        setPendingAssetId(null)
    }, [])

    const handleConfirmAdd = useCallback(async () => {
        if (
            !selectedAccount ||
            !pendingAssetId ||
            optingInAssetIds.has(pendingAssetId)
        ) {
            return
        }

        const assetId = pendingAssetId
        const pendingAsset = results.find(r => r.assetId === assetId)
        const assetDisplayName =
            pendingAsset?.unitName ?? pendingAsset?.name ?? null
        setOptingInAssetIds(prev => {
            const next = new Set(prev)
            next.add(assetId)
            return next
        })
        setPendingAssetId(null)

        try {
            await optIn({
                sender: selectedAccount.address,
                assetId: BigInt(assetId),
            })
            setRecentlyOptedIn(prev => new Set([...prev, assetId]))
            showToast({
                title: t('add_asset.opt_in.success_title'),
                body: assetDisplayName
                    ? t('add_asset.opt_in.success_body', {
                          assetName: assetDisplayName,
                      })
                    : t('add_asset.opt_in.success_body_generic'),
                type: 'success',
            })
        } catch (err) {
            if (err instanceof UserRejectedSigningError) {
                // User dismissed the LedgerSigningOverlay — overlay already went away; no toast.
                return
            }
            showError(err, t('add_asset.opt_in.failed_title'))
        } finally {
            setOptingInAssetIds(prev => {
                const next = new Set(prev)
                next.delete(assetId)
                return next
            })
        }
    }, [
        selectedAccount,
        pendingAssetId,
        results,
        optIn,
        optingInAssetIds,
        showToast,
        t,
        showError,
    ])

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
        optingInAssetIds,
        handleRequestAdd,
        handleConfirmAdd,
        handleCancelAdd,
        pendingAssetId,
        selectedAccountAddress: selectedAccount?.address ?? null,
        selectedAccountName:
            selectedAccount?.name ?? selectedAccount?.address ?? '',
        t,
    }
}

export type { UseAddAssetViewResult }
