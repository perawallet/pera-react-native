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
    linkOnboardingConsent,
    type LinkOnboardingConsentParams,
} from '../api/onboarding'
import { getCardApiError } from '../api/errors'
import { toCardMutationResult, type CardMutationResult } from './types'

export type LinkConsentVariables = Omit<
    LinkOnboardingConsentParams,
    'network' | 'signal'
>

export type UseLinkConsentMutationResult =
    CardMutationResult<LinkConsentVariables>

export const useLinkConsentMutation = (): UseLinkConsentMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<void, Error, LinkConsentVariables>({
        // Step 2 of consent: binds the consent set to the permanent user id the
        // address step issues. Best-effort — registration is already finalized,
        // so the screen does not block on a failure here.
        mutationFn: variables =>
            linkOnboardingConsent({ ...variables, network }),
        // An "already linked" 409 is swallowed in the endpoint; anything that
        // still throws is a real failure worth surfacing for diagnosis.
        onError: async error => {
            const apiError = await getCardApiError(error)
            logger.warn('Card consent link failed', { error: apiError })
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
