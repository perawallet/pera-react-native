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
import { submitAddress, type SubmitAddressResult } from '../api/onboarding'
import {
    getCardApiError,
    isNotVerifiedError,
    OnboardingNotVerifiedError,
} from '../api/errors'
import { OnboardingStep, type AddressInput } from '../models'
import { useCardStore } from '../store'
import { completeCardRegistration } from './completeCardRegistration'
import { cardQueryKeys } from './querykeys'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseSubmitAddressMutationResult = CardMutationResult<
    AddressInput,
    SubmitAddressResult
>

export const useSubmitAddressMutation = (): UseSubmitAddressMutationResult => {
    const { network } = useNetwork()
    const queryClient = useQueryClient()

    const mutation = useMutation<SubmitAddressResult, Error, AddressInput>({
        mutationFn: async address => {
            try {
                return await submitAddress({ address, network })
            } catch (error) {
                // Typed so the screen can show the "finish verifying" state
                // instead of Baanx's raw refusal string.
                if (isNotVerifiedError(await getCardApiError(error))) {
                    throw new OnboardingNotVerifiedError()
                }
                throw error
            }
        },
        onSuccess: async result => {
            // A US resident shipping the card elsewhere still owes the mailing
            // address; Baanx withholds the token until that step, which then
            // completes registration instead of this one.
            if (result.accessToken === null) {
                useCardStore
                    .getState()
                    .setOnboardingStep(OnboardingStep.MailingAddress)
                return
            }
            await completeCardRegistration({ result, network })
        },
        // Surface Baanx's real (often nested-stringified) error for diagnosis —
        // the screen only shows a generic toast, so this is where the actual
        // status/message lands.
        onError: async (error, variables) => {
            // The refusal proves our cached KYC state is optimistic, so
            // refetch the record the screen gates on.
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
            logger.warn('Card address submission failed', { error: apiError })
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
