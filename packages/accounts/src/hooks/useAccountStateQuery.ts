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
import { Decimal } from 'decimal.js'
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
import { accountsChainAdapters } from '../chain-adapter'
import { addressOn } from '../credentials'
import { getAccountChainStateRow } from '../db'
import type { WalletAccount } from '../models'
import { MODULE_PREFIX } from './querykeys'

const getAccountStateQueryKey = (address: string, scope: ChainScope) => [
    MODULE_PREFIX,
    'account-state',
    { address, scope },
]

export type UseAccountStateQueryResult = {
    /** `undefined` until loaded; callers gate on it, so no default. */
    data: Optional<AccountState>
    isPending: boolean
    isLoading: boolean
    isSuccess: boolean
}

/**
 * The account's state on `scope` as the last sync stored it; an account never
 * synced reads as empty. `nativeBalance` is in display units, `reserveBalance`
 * in base units.
 */
export const useAccountStateQuery = (
    account: Nullable<WalletAccount> | undefined,
    scope: ChainScope,
): UseAccountStateQueryResult => {
    const address = (account && addressOn(account, scope)) ?? ''

    const query = useQuery({
        queryKey: getAccountStateQueryKey(address, scope),
        enabled: !!address,
        queryFn: async (): Promise<AccountState> => {
            const row = await getAccountChainStateRow({
                accountAddress: address,
                scope,
            })
            const adapter = accountsChainAdapters.get(scope.chainId)
            const chainState =
                row?.chainData ??
                adapter.toChainState({ authorityAddress: null })
            return {
                address,
                scope,
                nativeBalance: row
                    ? baseUnitsToDisplayUnits(
                          row.nativeBalance,
                          getChainDescriptor(scope.chainId).nativeAsset
                              .decimals,
                      )
                    : new Decimal(0),
                ...adapter.summarizeChainState(chainState),
                chainState,
            }
        },
        staleTime: Infinity,
    })

    return {
        data: query.data,
        isPending: !!address && query.isPending,
        isLoading: query.isLoading,
        isSuccess: query.isSuccess,
    }
}
