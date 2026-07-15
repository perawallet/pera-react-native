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
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { logger } from '@perawallet/wallet-core-shared'
import {
    submitOnboardingConsent,
    type SubmitOnboardingConsentParams,
    type SubmitOnboardingConsentResult,
} from '../api/onboarding'
import { getCardApiError } from '../api/errors'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type SubmitConsentVariables = Omit<
    SubmitOnboardingConsentParams,
    'network' | 'signal'
>

export type UseSubmitConsentMutationResult = CardMutationResult<
    SubmitConsentVariables,
    SubmitOnboardingConsentResult
>

export const useSubmitConsentMutation = (): UseSubmitConsentMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<
        SubmitOnboardingConsentResult,
        Error,
        SubmitConsentVariables
    >({
        // Step 1 of consent: creates the consent set (T&Cs + marketing) on the
        // final address step. No step advance — the address mutation owns
        // completing onboarding.
        mutationFn: variables =>
            submitOnboardingConsent({ ...variables, network }),
        // Stash the new consent set id so the link step can bind it even on a
        // later duplicate retry (which returns no id). Never overwrite a stored
        // id with null.
        onSuccess: result => {
            if (result.consentSetId !== null) {
                useCardStore.getState().setConsentSetId(result.consentSetId)
            }
        },
        // Duplicate consents are swallowed in the endpoint; anything that still
        // throws here is a real failure worth surfacing for diagnosis.
        onError: async error => {
            const apiError = await getCardApiError(error)
            logger.warn('Card consent submission failed', { error: apiError })
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
