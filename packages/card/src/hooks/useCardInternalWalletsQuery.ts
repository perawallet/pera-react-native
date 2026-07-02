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

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchInternalWallets } from '../api/wallet'
import { CardCurrency, type CardInternalWallet } from '../models'
import { cardQueryKeys } from './querykeys'
import { useCardSession } from './useCardSession'

type UseCardInternalWalletsQueryResult = {
    /**
     * The USDC wallet — its balance is the spendable card balance and its
     * address/memo are the withdraw source. Null until wallets load or when
     * the user has no USDC wallet yet.
     */
    usdcWallet: Nullable<CardInternalWallet>
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    refetch: () => void
}

/**
 * Freshness after a withdrawal comes from explicit invalidation in
 * `useWithdrawFromCardMutation`.
 *
 * TODO(card): when the deposit funding provider ships, its success path must
 * invalidate `cardQueryKeys.internalWallets` too.
 */
export const useCardInternalWalletsQuery =
    (): UseCardInternalWalletsQueryResult => {
        const { network } = useNetwork()
        const { isAuthenticated } = useCardSession()

        const query = useQuery({
            queryKey: cardQueryKeys.internalWallets(network),
            queryFn: ({ signal }) => fetchInternalWallets({ network, signal }),
            staleTime: config.reactQueryShortLivedStaleTime,
            // The wallet routes require a Baanx session — stay idle otherwise.
            enabled: isAuthenticated,
        })

        // Baanx sends currency codes lowercase ("usdc") — compare case-insensitively.
        const usdcWallet = useMemo(
            () =>
                query.data?.find(
                    wallet =>
                        wallet.currency.toUpperCase() === CardCurrency.USDC,
                ) ?? null,
            [query.data],
        )

        return {
            usdcWallet,
            isLoading: query.isLoading,
            isError: query.isError,
            error: query.error,
            refetch: () => void query.refetch(),
        }
    }
