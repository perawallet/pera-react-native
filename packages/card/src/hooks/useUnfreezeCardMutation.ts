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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { unfreezeCard } from '../api/card'
import { CardStatus, type Card } from '../models/card'
import { cardMutationKeys, cardQueryKeys } from './querykeys'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseUnfreezeCardMutationResult = CardMutationResult<void>

export const useUnfreezeCardMutation = (): UseUnfreezeCardMutationResult => {
    const { network } = useNetwork()
    const queryClient = useQueryClient()

    const mutation = useMutation<void, Error, void>({
        mutationKey: cardMutationKeys.unfreeze,
        mutationFn: () => unfreezeCard({ network }),
        throwOnError: false,
        onSuccess: () => {
            // On success, clear the frozen state in the cache so the Card Frozen
            // banner hides immediately; the invalidation then reconciles with
            // the server.
            queryClient.setQueryData<Card | null>(
                cardQueryKeys.status(network),
                prev => (prev ? { ...prev, status: CardStatus.Active } : prev),
            )
            void queryClient.invalidateQueries({
                queryKey: cardQueryKeys.status(network),
            })
        },
    })

    return toCardMutationResult(mutation)
}
