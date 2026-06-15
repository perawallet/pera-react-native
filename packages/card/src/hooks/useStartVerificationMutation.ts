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
import { startRegisterVerification } from '../api/onboarding'
import type { VeriffSession } from '../models'
import { toCardMutationResult, type CardMutationResult } from './types'

export type StartVerificationParams = {
    /** From email/verify — the pre-auth onboarding KYC start only needs this. */
    onboardingId: string
}

export type UseStartVerificationMutationResult = CardMutationResult<
    StartVerificationParams,
    VeriffSession
>

/** Starts onboarding KYC and returns the Veriff session URL for the caller to open. */
export const useStartVerificationMutation =
    (): UseStartVerificationMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            VeriffSession,
            Error,
            StartVerificationParams
        >({
            mutationFn: ({ onboardingId }) =>
                startRegisterVerification({ onboardingId, network }),
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
