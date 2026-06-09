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
import {
    verifyEmail,
    type VerifyEmailParams,
    type VerifyEmailResult,
} from '../api/onboarding'
import { OnboardingStep } from '../models'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type VerifyEmailVariables = Omit<VerifyEmailParams, 'network' | 'signal'>

export type UseVerifyEmailMutationResult = CardMutationResult<
    VerifyEmailVariables,
    VerifyEmailResult
>

export const useVerifyEmailMutation = (): UseVerifyEmailMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<
        VerifyEmailResult,
        Error,
        VerifyEmailVariables
    >({
        mutationFn: variables => verifyEmail({ ...variables, network }),
        // Verification completed: store the onboarding id and advance the flow.
        onSuccess: ({ onboardingId }) => {
            const { setOnboardingId, setOnboardingStep } =
                useCardStore.getState()
            setOnboardingId(onboardingId)
            setOnboardingStep(OnboardingStep.PhoneSend)
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
