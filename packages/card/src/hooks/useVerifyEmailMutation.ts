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
import {
    verifyEmail,
    type VerifyEmailParams,
    type VerifyEmailResult,
} from '../api/onboarding'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type VerifyEmailVariables = Omit<VerifyEmailParams, 'scope' | 'signal'>

export type UseVerifyEmailMutationResult = CardMutationResult<
    VerifyEmailVariables,
    VerifyEmailResult
>

export const useVerifyEmailMutation = (
    scope: ChainScope,
): UseVerifyEmailMutationResult => {
    const mutation = useMutation<
        VerifyEmailResult,
        Error,
        VerifyEmailVariables
    >({
        mutationFn: variables => verifyEmail({ ...variables, scope }),
        // Guard on both: a contradictory { hasAccount, onboardingId } must not
        // persist an id while the caller routes to sign-in. The password is
        // held, memory only, for the login after KYC verifies.
        onSuccess: ({ onboardingId, hasAccount }, { password }) => {
            if (onboardingId && !hasAccount) {
                useCardStore.getState().setOnboardingId(onboardingId)
                useCardStore.getState().setPassword(password)
            }
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
