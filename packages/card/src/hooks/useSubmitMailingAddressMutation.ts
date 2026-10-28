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

import { useMutation } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger } from '@perawallet/wallet-core-shared'
import {
    submitMailingAddress,
    type SubmitAddressResult,
} from '../api/onboarding'
import { getCardApiError } from '../api/errors'
import type { MailingAddressInput } from '../models'
import { finalizeCardRegistration } from './finalizeCardRegistration'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseSubmitMailingAddressMutationResult = CardMutationResult<
    MailingAddressInput,
    SubmitAddressResult
>

export const useSubmitMailingAddressMutation = (
    scope: ChainScope,
): UseSubmitMailingAddressMutationResult => {
    const mutation = useMutation<
        SubmitAddressResult,
        Error,
        MailingAddressInput
    >({
        mutationFn: address => submitMailingAddress({ address, scope }),
        // Same tolerance as the address step: a token, if Baanx sends one.
        onSuccess: async ({ accessToken, userId }) => {
            if (accessToken === null) return
            await finalizeCardRegistration({ accessToken, userId, scope })
        },
        onError: async error => {
            const apiError = await getCardApiError(error)
            logger.warn('Card mailing address submission failed', {
                error: apiError,
            })
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
