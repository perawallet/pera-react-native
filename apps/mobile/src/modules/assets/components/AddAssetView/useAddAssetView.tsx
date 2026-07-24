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

import { useCallback, useMemo, useState } from 'react'
import {
    useAccountBalancesQuery,
    useAccountsStore,
} from '@perawallet/wallet-core-accounts'
import type { DisplayableAsset } from '@perawallet/wallet-core-assets'
import { useGlobalSearch } from '@perawallet/wallet-core-search'
import { UserRejectedSigningError } from '@perawallet/wallet-core-signing'
import { useAssetOptInMutation } from '@perawallet/wallet-core-transactions'
import { useBottomSheet } from '@modules/bottom-sheet'
import { useNetworkStatus } from '@modules/network'
import { useErrorToast } from '@hooks/useErrorToast'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { SEARCH_DEBOUNCE_TIME } from '@constants/ui'
import type { AddAssetContentVariant } from '@modules/assets/components/AddAssetContent'
import type { Nullable } from '@perawallet/wallet-core-shared'

type UseAddAssetViewOptions = {
    variant?: AddAssetContentVariant
}

type UseAddAssetViewResult = {
    searchQuery: string
    handleSearchChange: (text: string) => void
    results: DisplayableAsset[]
    isLoading: boolean
    isError: boolean
    isOffline: boolean
    isFetchingNextPage: boolean
    hasNextPage: boolean
    fetchNextPage: Nullable<() => void>
    optedInAssetIds: Set<string>
    optingInAssetIds: Set<string>
    handleRequestAdd: (assetId: string) => void
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
    const { requestByType } = useBottomSheet()

    const {
        value: searchQuery,
        setValue: setSearchQuery,
        results: searchResults,
        isLoading,
        isRemoteError,
        isRemotePaused,
        hasNextRemotePage: hasNextPage,
        isFetchingNextRemotePage: isFetchingNextPage,
        fetchNextRemotePage: fetchNextPage,
    } = useGlobalSearch({
        debounceMs: SEARCH_DEBOUNCE_TIME,
        scopes: ['assets'],
        remoteAssets: { hasCollectible, showOnEmptyQuery: true },
    })
    const results = searchResults.remoteAssets
    const { hasInternet } = useNetworkStatus()
    const isError = isRemoteError
    const isOffline = isRemotePaused || (isRemoteError && !hasInternet)

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
        async (assetId: string) => {
            if (!selectedAccount || optingInAssetIds.has(assetId)) {
                return
            }

            const result = await requestByType<'asset-opt-in', 'confirm'>(
                'asset-opt-in',
                { assetId, accountAddress: selectedAccount.address },
                {
                    size: 'auto',
                    enablePanDownToClose: true,
                    autoCreateContainer: false,
                },
            )
            if (result !== 'confirm') return

            const pendingAsset = results.find(r => r.assetId === assetId)
            const assetDisplayName =
                pendingAsset?.unitName ?? pendingAsset?.name ?? null
            setOptingInAssetIds(prev => {
                const next = new Set(prev)
                next.add(assetId)
                return next
            })

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
        },
        [
            selectedAccount,
            optingInAssetIds,
            requestByType,
            results,
            optIn,
            showToast,
            t,
            showError,
        ],
    )

    return {
        searchQuery,
        handleSearchChange,
        results,
        isLoading,
        isError,
        isOffline,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        optedInAssetIds,
        optingInAssetIds,
        handleRequestAdd: (assetId: string) => void handleRequestAdd(assetId),
        t,
    }
}

export type { UseAddAssetViewResult }
