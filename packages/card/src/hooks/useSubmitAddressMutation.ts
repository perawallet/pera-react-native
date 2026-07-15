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
import { submitAddress, type SubmitAddressResult } from '../api/onboarding'
import { getCardApiError } from '../api/errors'
import { OnboardingStep, type AddressInput } from '../models'
import { setCardSession } from '../session'
import { useCardStore } from '../store'
import { toCardMutationResult, type CardMutationResult } from './types'

export type UseSubmitAddressMutationResult = CardMutationResult<
    AddressInput,
    SubmitAddressResult
>

export const useSubmitAddressMutation = (): UseSubmitAddressMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<SubmitAddressResult, Error, AddressInput>({
        mutationFn: address => submitAddress({ address, network }),
        // The address step finalizes registration and issues the bearer token;
        // commit it (no refresh token at registration, like direct login) so
        // the post-onboarding user endpoints work, then mark onboarding done.
        onSuccess: async result => {
            // accessToken is null only on the US separate-mailing path, which we
            // don't yet collect (the address screen always sends
            // isSameMailingAddress:true).
            // TODO(card): the US mailing-address step will issue the token; until
            // then accessToken is always present here.
            if (result.accessToken) {
                await setCardSession({
                    accessToken: result.accessToken,
                    refreshToken: '',
                })
            }
            useCardStore.getState().setOnboardingStep(OnboardingStep.Completed)
        },
        // Surface Baanx's real (often nested-stringified) error for diagnosis —
        // the screen only shows a generic toast, so this is where the actual
        // status/message lands.
        onError: async error => {
            const apiError = await getCardApiError(error)
            logger.warn('Card address submission failed', { error: apiError })
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
