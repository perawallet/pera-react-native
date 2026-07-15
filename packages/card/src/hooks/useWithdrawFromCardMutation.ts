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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Decimal } from 'decimal.js'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { withdrawFromCard } from '../api/wallet'
import type { CardInternalWallet } from '../models'
import { cardQueryKeys, MODULE_PREFIX } from './querykeys'
import { toCardMutationResult, type CardMutationResult } from './types'

export type WithdrawFromCardVariables = {
    /** Amount in display units (whole USDC). */
    amount: Decimal
    recipientAddress: string
    /** The internal wallet being withdrawn from (source address/memo/currency). */
    wallet: CardInternalWallet
}

export type UseWithdrawFromCardMutationResult =
    CardMutationResult<WithdrawFromCardVariables>

export const useWithdrawFromCardMutation =
    (): UseWithdrawFromCardMutationResult => {
        const { network } = useNetwork()
        const queryClient = useQueryClient()

        const mutation = useMutation<void, Error, WithdrawFromCardVariables>({
            mutationFn: ({ amount, recipientAddress, wallet }) =>
                withdrawFromCard({
                    network,
                    // toFixed() keeps full precision and never emits exponent
                    // notation (unlike toString()).
                    amount: amount.toFixed(),
                    recipientAddress,
                    sourceAddress: wallet.address,
                    sourceMemo: wallet.addressMemo ?? undefined,
                    currency: wallet.currency,
                }),
            throwOnError: false,
            onSuccess: () => {
                void queryClient.invalidateQueries({
                    queryKey: cardQueryKeys.internalWallets(network),
                })
                // Prefix match: every transactions filter variant refetches.
                void queryClient.invalidateQueries({
                    queryKey: [MODULE_PREFIX, 'transactions'],
                })
            },
        })

        return toCardMutationResult(mutation)
    }
