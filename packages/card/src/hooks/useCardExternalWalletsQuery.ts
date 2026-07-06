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

import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchExternalWallets } from '../api/delegation'
import type { CardExternalWallet } from '../models'
import { cardQueryKeys } from './querykeys'
import { useCardSession } from './useCardSession'

export type UseCardExternalWalletsQueryParams = {
    /** Funding-source address to look up; pass null to skip matching. */
    address: Nullable<string>
}

export type UseCardExternalWalletsQueryResult = {
    /** Registered external wallet for `address`, null until loaded/registered. */
    delegatedWallet: Nullable<CardExternalWallet>
    /** True when `address` has a delegation with a non-zero allowance. */
    hasActiveDelegation: boolean
    isLoading: boolean
    isError: boolean
    error: Nullable<Error>
    refetch: () => void
}

/**
 * Delegation state is server-derived from GET /v1/wallet/external — never
 * persisted locally, so it survives re-installs and stays in sync with Baanx.
 */
export const useCardExternalWalletsQuery = (
    params: UseCardExternalWalletsQueryParams,
): UseCardExternalWalletsQueryResult => {
    const { address } = params
    const { network } = useNetwork()
    const { isAuthenticated } = useCardSession()

    const query = useQuery({
        queryKey: cardQueryKeys.externalWallets(network),
        queryFn: ({ signal }) => fetchExternalWallets({ network, signal }),
        staleTime: config.reactQueryShortLivedStaleTime,
        // The delegation routes require a Baanx session — stay idle otherwise.
        enabled: isAuthenticated,
    })

    const delegatedWallet = useMemo(
        () =>
            address == null
                ? null
                : (query.data?.find(wallet => wallet.address === address) ??
                  null),
        [query.data, address],
    )

    const refetch = useCallback(() => {
        void query.refetch()
    }, [query.refetch])

    return {
        delegatedWallet,
        hasActiveDelegation: delegatedWallet?.allowance.gt(0) ?? false,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch,
    }
}
