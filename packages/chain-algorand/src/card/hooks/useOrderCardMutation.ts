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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { orderCard, CardOrderNotVerifiedError } from '../api/card'
import {
    getCardApiError,
    isDuplicateError,
    isNotVerifiedError,
} from '../api/errors'
import { cardMutationKeys, cardQueryKeys } from './querykeys'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseOrderCardMutationResult = CardMutationResult<void>

/**
 * Orders the Baanx card record (`POST /v1/card/order`, always VIRTUAL).
 * Failure classification:
 * - "already has a card" (CARD_EXISTS/duplicate) resolves as success, since
 *   the goal state is reached; the status invalidation picks the card up.
 * - "not verified" rethrows as {@link CardOrderNotVerifiedError} so callers
 *   can treat it as "keep waiting for KYC" rather than a failed order.
 * Registered under `cardMutationKeys.order` so concurrent mounted callers
 * (dashboard shell + details tab) can observe one shared in-flight attempt.
 */
export const useOrderCardMutation = (): UseOrderCardMutationResult => {
    const { network } = useNetwork()
    const queryClient = useQueryClient()

    const mutation = useMutation<void, Error, void>({
        mutationKey: cardMutationKeys.order,
        mutationFn: async () => {
            try {
                await orderCard({ network })
            } catch (error) {
                const apiError = await getCardApiError(error)
                if (
                    apiError.code === 'CARD_EXISTS' ||
                    isDuplicateError(apiError)
                ) {
                    return
                }
                if (isNotVerifiedError(apiError)) {
                    throw new CardOrderNotVerifiedError()
                }
                throw error
            }
        },
        throwOnError: false,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: cardQueryKeys.status(network),
            })
        },
        onError: error => {
            // The order endpoint disagreed with our cached VERIFIED state, so
            // that cache is stale: refresh it and let the issuance flow fall
            // back to the verification-pending view.
            if (error instanceof CardOrderNotVerifiedError) {
                void queryClient.invalidateQueries({
                    queryKey: cardQueryKeys.user(network),
                })
            }
        },
    })

    return toCardMutationResult(mutation)
}
