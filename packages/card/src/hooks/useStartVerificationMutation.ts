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
import type { Nullable } from '@perawallet/wallet-core-shared'
import { startRegisterVerification } from '../api/onboarding'
import { fetchVerificationSession } from '../api/user'
import type { VeriffSession } from '../models'
import { hasCardSession } from '../session'
import { toCardMutationResult, type CardMutationResult } from './types'

export type StartVerificationParams = {
    /** From email/verify; only the pre-auth start needs it. */
    onboardingId: Nullable<string>
}

export type UseStartVerificationMutationResult = CardMutationResult<
    StartVerificationParams,
    VeriffSession
>

/**
 * Starts KYC and returns the hosted session URL for the caller to open. A user
 * who already has a card session (Baanx issued a token early) starts it through
 * the authenticated endpoint instead of the pre-auth one.
 */
export const useStartVerificationMutation = (
    scope: ChainScope,
): UseStartVerificationMutationResult => {
    const mutation = useMutation<VeriffSession, Error, StartVerificationParams>(
        {
            mutationFn: ({ onboardingId }) => {
                if (hasCardSession()) return fetchVerificationSession({ scope })
                if (onboardingId === null) {
                    throw new Error('Starting KYC needs an onboarding id')
                }
                return startRegisterVerification({ onboardingId, scope })
            },
            throwOnError: false,
        },
    )

    return toCardMutationResult(mutation)
}
