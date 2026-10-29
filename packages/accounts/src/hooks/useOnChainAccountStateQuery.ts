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

import { useQuery, type RefetchOptions } from '@tanstack/react-query'
import {
    type AccountState,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { getChainDescriptor } from '@perawallet/wallet-core-chain-shared'
import {
    baseUnitsToDisplayUnits,
    type Nullable,
    type Optional,
} from '@perawallet/wallet-core-shared'
import {
    accountsChainAdapters,
    type AccountStateSnapshot,
} from '../chain-adapter'
import { authorityAddressOf } from '../store/accountChainState'
import { getOnChainAccountStateQueryKey } from './querykeys'

// Short freshness window instead of refetch-on-every-mount: send-flow
// navigation remounts consumers several times back-to-back, and each remount
// was a guaranteed node hit.
const ON_CHAIN_ACCOUNT_STATE_STALE_TIME_MS = 15_000

/** A chain read with the summary `AccountState` carries: `nativeBalance` in display units, `reserveBalance` in base units. */
export type OnChainAccountState = AccountStateSnapshot &
    Pick<
        AccountState,
        'nativeBalance' | 'reserveBalance' | 'heldTokenCount'
    > & {
        /** The account's signer when it isn't the account's own key. */
        authorityAddress: Nullable<string>
    }

export type UseOnChainAccountStateQueryResult = {
    /** `undefined` until loaded; callers gate on it, so no default. */
    data: Optional<OnChainAccountState>
    isPending: boolean
    isLoading: boolean
    isFetching: boolean
    isSuccess: boolean
    isError: boolean
    refetch: (options?: RefetchOptions) => unknown
}

/** Reads `address`'s state on `scope` from the chain itself, bypassing the synced store. */
export const fetchOnChainAccountState = async (
    address: string,
    scope: ChainScope,
): Promise<OnChainAccountState> => {
    const adapter = accountsChainAdapters.get(scope.chainId)
    const snapshot = await adapter.fetchAccountState(address, scope, {
        priorChainState: undefined,
    })
    return {
        ...snapshot,
        nativeBalance: baseUnitsToDisplayUnits(
            snapshot.nativeBalanceBaseUnits,
            getChainDescriptor(scope.chainId).nativeAsset.decimals,
        ),
        ...adapter.summarizeChainState(snapshot.chainState),
        authorityAddress: authorityAddressOf(snapshot.chainState),
    }
}

export const useOnChainAccountStateQuery = (
    address: string,
    scope: ChainScope,
): UseOnChainAccountStateQueryResult => {
    const query = useQuery({
        queryKey: getOnChainAccountStateQueryKey(address, scope),
        queryFn: () => fetchOnChainAccountState(address, scope),
        enabled: !!address,
        staleTime: ON_CHAIN_ACCOUNT_STATE_STALE_TIME_MS,
    })

    return {
        data: query.data,
        isPending: !!address && query.isPending,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        isSuccess: query.isSuccess,
        isError: query.isError,
        refetch: query.refetch,
    }
}
