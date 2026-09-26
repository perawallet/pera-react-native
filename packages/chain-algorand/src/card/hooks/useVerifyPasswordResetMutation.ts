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
    verifyPasswordReset,
    type VerifyPasswordResetParams,
} from '../api/auth'
import { toCardMutationResult, type CardMutationResult } from './types'

export type VerifyPasswordResetVariables = Omit<
    VerifyPasswordResetParams,
    'network' | 'signal'
>

export type UseVerifyPasswordResetMutationResult = CardMutationResult<
    VerifyPasswordResetVariables,
    string
>

/**
 * Step 2 of the forgot-password flow: trades the emailed code for the
 * single-use reset token (the mutation's data). The token is short-lived and
 * must go straight to the confirm step via navigation params; it is never
 * written to the persisted card store.
 */
export const useVerifyPasswordResetMutation =
    (): UseVerifyPasswordResetMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            string,
            Error,
            VerifyPasswordResetVariables
        >({
            mutationFn: variables =>
                verifyPasswordReset({ ...variables, network }),
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
