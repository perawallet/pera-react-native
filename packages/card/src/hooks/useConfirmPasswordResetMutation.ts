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
    confirmPasswordReset,
    type ConfirmPasswordResetParams,
} from '../api/auth'
import { toCardMutationResult, type CardMutationResult } from './types'

export type ConfirmPasswordResetVariables = Omit<
    ConfirmPasswordResetParams,
    'network' | 'signal'
>

export type UseConfirmPasswordResetMutationResult =
    CardMutationResult<ConfirmPasswordResetVariables>

/** Step 3 of the forgot-password flow: sets the new password. */
export const useConfirmPasswordResetMutation =
    (): UseConfirmPasswordResetMutationResult => {
        const { network } = useNetwork()

        const mutation = useMutation<
            void,
            Error,
            ConfirmPasswordResetVariables
        >({
            mutationFn: variables =>
                confirmPasswordReset({ ...variables, network }),
            throwOnError: false,
        })

        return toCardMutationResult(mutation)
    }
