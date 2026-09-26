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

import { useCallback, useMemo } from 'react'
import type { ImageSourcePropType } from 'react-native'
import {
    type CardWalletHistoryEntry,
    CardWalletKind,
    useCardWalletBalanceQuery,
    useCardWalletHistoryQuery,
} from '@perawallet/wallet-core-chain-algorand/card'
import { ZERO_DECIMAL } from '@perawallet/wallet-core-shared'
import { useRoute, type RouteProp } from '@react-navigation/native'
import { useAppNavigation } from '@hooks/useAppNavigation'
import type { PeraCardFlowParamList } from '../../routes/types'
import {
    groupCardTransactionsByMonth,
    type CardTransactionSection,
} from '../../utils/cardTransactions'
import {
    CARD_WALLET_PRESENTATION,
    type CardWalletCopy,
} from '../../utils/cardWalletPresentation'
import { USDC_DISPLAY_PRECISION } from '../../utils/usdc'

type UseCardWalletBalanceScreenResult = {
    kind: CardWalletKind
    copy: CardWalletCopy
    hero: ImageSourcePropType
    /** Balance formatted for display. Null only while it loads. */
    balanceDisplay: string | null
    /** Currency code, uppercased for display (e.g. "USDC"). */
    currencyDisplay: string
    isLoading: boolean
    isError: boolean
    hasBalance: boolean
    /** Claim gate: wallet flag AND a positive balance. */
    canWithdraw: boolean
    handleWithdraw: () => void
    refetch: () => void
    /** Wallet movements grouped by month, newest first. */
    historySections: CardTransactionSection<CardWalletHistoryEntry>[]
    hasHistory: boolean
    isFetchingHistory: boolean
    handleLoadMore: () => void
}

export const useCardWalletBalanceScreen =
    (): UseCardWalletBalanceScreenResult => {
        const navigation = useAppNavigation()
        const { params } =
            useRoute<RouteProp<PeraCardFlowParamList, 'CardWalletBalance'>>()
        const kind = params?.kind ?? CardWalletKind.Reward
        const { copy, hero } = CARD_WALLET_PRESENTATION[kind]
        const { wallet, isLoading, isError, refetch } =
            useCardWalletBalanceQuery(kind)
        const { entries, isFetchingNextPage, hasNextPage, fetchNextPage } =
            useCardWalletHistoryQuery(kind, wallet?.id ?? null)

        const hasBalance = wallet?.balance.gt(0) ?? false
        const canWithdraw =
            !isLoading &&
            !isError &&
            (wallet?.isWithdrawable ?? false) &&
            hasBalance

        const historySections = useMemo(
            () => groupCardTransactionsByMonth(entries),
            [entries],
        )

        const handleWithdraw = useCallback(() => {
            navigation.navigate('CardWalletBalanceWithdraw', { kind })
        }, [navigation, kind])

        const handleLoadMore = useCallback(() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage()
        }, [hasNextPage, isFetchingNextPage, fetchNextPage])

        return {
            kind,
            copy,
            hero,
            // Baanx has no wallet until the first credit lands, so a settled
            // query with no wallet is a zero balance, not a pending one.
            balanceDisplay: isLoading
                ? null
                : (wallet?.balance ?? ZERO_DECIMAL).toFixed(
                      USDC_DISPLAY_PRECISION,
                  ),
            currencyDisplay: (wallet?.currency ?? 'usdc').toUpperCase(),
            isLoading,
            isError,
            hasBalance,
            canWithdraw,
            handleWithdraw,
            refetch,
            historySections,
            hasHistory: entries.length > 0,
            isFetchingHistory: isFetchingNextPage,
            handleLoadMore,
        }
    }
