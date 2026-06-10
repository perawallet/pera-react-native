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
    sendPhoneVerification,
    type SendPhoneVerificationParams,
} from '../api/onboarding'
import { OnboardingStep } from '../models'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type SendPhoneVerificationVariables = Omit<
    SendPhoneVerificationParams,
    'network' | 'signal'
>

export type UseSendPhoneVerificationMutationResult =
    CardMutationResult<SendPhoneVerificationVariables>

export const useSendPhoneVerificationMutation =
    (): UseSendPhoneVerificationMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            void,
            Error,
            SendPhoneVerificationVariables
        >({
            mutationFn: variables =>
                sendPhoneVerification({ ...variables, network }),
            // Code sent: advance the flow. Runs on every (re)send.
            onSuccess: () => {
                useCardStore
                    .getState()
                    .setOnboardingStep(OnboardingStep.PhoneVerify)
            },
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
