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
import { submitPersonalDetails } from '../api/onboarding'
import {
    getCardApiError,
    isNotVerifiedError,
    OnboardingNotVerifiedError,
} from '../api/errors'
import { OnboardingStep, type PersonalDetailsInput } from '../models'
import { useCardStore } from '../store'
import { cardQueryKeys } from './querykeys'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseSubmitPersonalDetailsMutationResult =
    CardMutationResult<PersonalDetailsInput>

export const useSubmitPersonalDetailsMutation =
    (): UseSubmitPersonalDetailsMutationResult => {
        const { network } = useNetwork()
        const queryClient = useQueryClient()

        const mutation = useMutation<void, Error, PersonalDetailsInput>({
            mutationFn: async details => {
                try {
                    await submitPersonalDetails({ details, network })
                } catch (error) {
                    // Typed so the screen can show the "finish verifying"
                    // state instead of Baanx's raw refusal string.
                    if (isNotVerifiedError(await getCardApiError(error))) {
                        throw new OnboardingNotVerifiedError()
                    }
                    throw error
                }
            },
            // Personal details saved: advance to the address step.
            onSuccess: () => {
                useCardStore
                    .getState()
                    .setOnboardingStep(OnboardingStep.Address)
            },
            onError: (error, variables) => {
                // The refusal proves our cached KYC state is optimistic, so
                // refetch the record the screen gates on.
                if (error instanceof OnboardingNotVerifiedError) {
                    void queryClient.invalidateQueries({
                        queryKey: cardQueryKeys.onboardingDetails(
                            network,
                            variables.onboardingId,
                        ),
                    })
                }
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
