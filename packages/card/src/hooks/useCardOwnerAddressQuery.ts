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

import { useQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { config } from '@perawallet/wallet-core-config'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { fetchExternalWallets } from '../api/delegation'
import { cardAdapterFor } from '../chain-adapter'
import { useCardSession } from './useCardSession'
import { cardQueryKeys } from './querykeys'

export type UseCardOwnerAddressQueryOptions = {
    enabled?: boolean
}

export type UseCardOwnerAddressQueryResult = {
    /** Null until found, and when Baanx has no card on record for the chain. */
    ownerAddress: Nullable<string>
    isLoading: boolean
}

/**
 * The account that owns the signed-in user's card. Baanx has the card's
 * address on record and the chain says who owns it, so no Pera backend call
 * is needed and the Baanx token never leaves the Baanx calls it is made for.
 */
export const useCardOwnerAddressQuery = (
    scope: ChainScope,
    options?: UseCardOwnerAddressQueryOptions,
): UseCardOwnerAddressQueryResult => {
    const { isAuthenticated } = useCardSession()
    const query = useQuery({
        queryKey: cardQueryKeys.cardOwner(scope),
        queryFn: async ({ signal }) => {
            const wallets = await fetchExternalWallets({ scope, signal })
            return cardAdapterFor(scope).findCardOwner(scope, wallets)
        },
        staleTime: config.reactQueryShortLivedStaleTime,
        // The key is per scope, not per user, so an answer cached before a
        // logout could name someone else's account.
        refetchOnMount: 'always',
        enabled: isAuthenticated && (options?.enabled ?? true),
    })
    return {
        ownerAddress: query.isFetchedAfterMount ? (query.data ?? null) : null,
        isLoading: query.isLoading,
    }
}
