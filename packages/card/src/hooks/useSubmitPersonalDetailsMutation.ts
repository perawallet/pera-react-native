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

import { useMutation } from '@tanstack/react-query'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { submitPersonalDetails } from '../api/onboarding'
import { OnboardingStep, type PersonalDetailsInput } from '../models'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseSubmitPersonalDetailsMutationResult =
    CardMutationResult<PersonalDetailsInput>

export const useSubmitPersonalDetailsMutation =
    (): UseSubmitPersonalDetailsMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<void, Error, PersonalDetailsInput>({
            mutationFn: details => submitPersonalDetails({ details, network }),
            // Personal details saved: advance to the address step.
            onSuccess: () => {
                useCardStore
                    .getState()
                    .setOnboardingStep(OnboardingStep.Address)
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
