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
import { loginRequest } from '../api/auth'
import { setCardSession } from '../session'
import type { LoginResult } from '../models'
import { toCardMutationResult, type CardMutationResult } from './types'

// Direct login returns a 6-hour access token with no refresh token.
const ACCESS_TOKEN_LIFETIME_MS = 21_600 * 1000

export type CardLoginParams = {
    email: string
    password: string
    otpCode?: string
}

export type UseCardLoginMutationResult = CardMutationResult<
    CardLoginParams,
    LoginResult
>

export const useCardLoginMutation = (): UseCardLoginMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<LoginResult, Error, CardLoginParams>({
        mutationFn: params => loginRequest({ ...params, network }),
        throwOnError: false,
        onSuccess: async result => {
            // A null access token means OTP is still required; the caller
            // prompts for the code and logs in again. Direct login has no
            // refresh token, so the session lasts ~6h before re-login.
            if (result.accessToken) {
                await setCardSession({
                    accessToken: result.accessToken,
                    refreshToken: '',
                    expiresAt: Date.now() + ACCESS_TOKEN_LIFETIME_MS,
                })
            }
        },
    })

    return toCardMutationResult(mutation)
}
