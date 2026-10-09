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

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { scopeForLegacyNetwork } from '@perawallet/wallet-core-chain-contract'
import { useNetwork } from '@perawallet/wallet-core-chain-shared'
import { getAccountBalance } from '@perawallet/wallet-core-accounts'

import type { Decimal } from 'decimal.js'
import { transactionQueryKeys } from './querykeys'

export type UseRekeyFeePreflightResult = {
    /**
     * True when the source's spendable balance (balance − min-balance
     * reserve) cannot cover the rekey fee. Stays false while the fee or the
     * balance row is still loading — missing data never blocks the flow;
     * algod remains the final authority.
     */
    isUnderfunded: boolean
}

/**
 * Preflight for the rekey confirm screens: the source account pays the rekey
 * fee, and after paying it its balance must stay at or above the min-balance
 * reserve. Reads the per-network balance row account sync keeps fresh and
 * compares against the fee the screen already displays
 * (`useRekeyTransactionFeeQuery`'s ALGO `Decimal`), so the gate and the
 * displayed fee can never diverge.
 */
export const useRekeyFeePreflight = (
    sourceAddress: string,
    feeAlgos: Decimal | undefined,
): UseRekeyFeePreflightResult => {
    const { network } = useNetwork()
    const scope = scopeForLegacyNetwork(network)

    const { data: balance } = useQuery({
        queryKey: transactionQueryKeys.sourceBalance(sourceAddress, scope),
        queryFn: async () =>
            (await getAccountBalance({
                accountAddress: sourceAddress,
                scope,
            })) ?? null,
        enabled: !!sourceAddress,
        staleTime: Infinity,
    })

    const isUnderfunded = useMemo(() => {
        if (!feeAlgos || !balance) return false
        return balance.algoBalance.minus(balance.minBalance).lessThan(feeAlgos)
    }, [feeAlgos, balance])

    return { isUnderfunded }
}
