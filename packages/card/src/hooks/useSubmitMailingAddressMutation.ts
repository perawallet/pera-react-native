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
import { logger } from '@perawallet/wallet-core-shared'
import {
    submitMailingAddress,
    type SubmitAddressResult,
} from '../api/onboarding'
import {
    getCardApiError,
    isNotVerifiedError,
    OnboardingNotVerifiedError,
} from '../api/errors'
import type { MailingAddressInput } from '../models'
import { completeCardRegistration } from './completeCardRegistration'
import { cardQueryKeys } from './querykeys'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseSubmitMailingAddressMutationResult = CardMutationResult<
    MailingAddressInput,
    SubmitAddressResult
>

export const useSubmitMailingAddressMutation =
    (): UseSubmitMailingAddressMutationResult => {
        const { network } = useNetwork()
        const queryClient = useQueryClient()

        const mutation = useMutation<
            SubmitAddressResult,
            Error,
            MailingAddressInput
        >({
            mutationFn: async address => {
                try {
                    return await submitMailingAddress({ address, network })
                } catch (error) {
                    if (isNotVerifiedError(await getCardApiError(error))) {
                        throw new OnboardingNotVerifiedError()
                    }
                    throw error
                }
            },
            onSuccess: result => completeCardRegistration({ result, network }),
            onError: async (error, variables) => {
                if (error instanceof OnboardingNotVerifiedError) {
                    void queryClient.invalidateQueries({
                        queryKey: cardQueryKeys.onboardingDetails(
                            network,
                            variables.onboardingId,
                        ),
                    })
                    return
                }
                const apiError = await getCardApiError(error)
                logger.warn('Card mailing address submission failed', {
                    error: apiError,
                })
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
