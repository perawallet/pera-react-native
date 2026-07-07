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
import { fetchCardDetailsToken } from '../api/card-sensitive'
import type { CardImageCustomCss, CardSecureView } from '../models'
import { toCardMutationResult, type CardMutationResult } from './types'

export type CardDetailsMutationVars = {
    /** Colors for the server-rendered image; Baanx defaults apply if omitted. */
    customCss?: CardImageCustomCss
}

export type UseCardDetailsMutationResult = CardMutationResult<
    CardDetailsMutationVars,
    CardSecureView
>

/**
 * Imperatively fetches a single-use secure view of the card details (a token +
 * image URL to render). A mutation, not a query — the result is never written
 * to the query cache and must be discarded by the caller after render.
 */
export const useCardDetailsMutation = (): UseCardDetailsMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<
        CardSecureView,
        Error,
        CardDetailsMutationVars
    >({
        mutationFn: vars =>
            fetchCardDetailsToken({ network, customCss: vars.customCss }),
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
