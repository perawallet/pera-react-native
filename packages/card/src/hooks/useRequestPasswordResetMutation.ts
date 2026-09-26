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
import {
    requestPasswordReset,
    type RequestPasswordResetParams,
} from '../api/auth'
import { toCardMutationResult, type CardMutationResult } from './types'

export type RequestPasswordResetVariables = Omit<
    RequestPasswordResetParams,
    'network' | 'signal'
>

export type UseRequestPasswordResetMutationResult =
    CardMutationResult<RequestPasswordResetVariables>

/**
 * Step 1 of the forgot-password flow: asks Baanx to email a reset code.
 * Resolves even for unregistered emails (Baanx never reveals which emails
 * exist), so callers can always advance to the code screen.
 */
export const useRequestPasswordResetMutation =
    (): UseRequestPasswordResetMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            void,
            Error,
            RequestPasswordResetVariables
        >({
            mutationFn: variables =>
                requestPasswordReset({ ...variables, network }),
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
