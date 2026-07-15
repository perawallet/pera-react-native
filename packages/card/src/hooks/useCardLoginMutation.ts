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
import { loginRequest } from '../api/auth'
import { fetchOnboardingDetails } from '../api/onboarding'
import { setCardSession } from '../session'
import { useCardStore } from '../store'
import type { LoginResult } from '../models'
import { toCardMutationResult, type CardMutationResult } from './types'

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
        mutationFn: async params => {
            const result = await loginRequest({ ...params, network })
            // A mid-onboarding login issues no access token and an unreliable
            // (often null) verificationState. Treat userId as the onboardingId
            // and read the real KYC state from the pre-auth onboarding endpoint
            // so the caller can route. Best-effort: keep the login result on
            // failure (the caller treats a null state as unverified).
            // TODO(card): confirm Baanx accepts userId as the onboardingId here.
            if (
                !result.accessToken &&
                result.phase !== null &&
                result.userId !== null &&
                result.verificationState === null
            ) {
                try {
                    const { verificationState } = await fetchOnboardingDetails({
                        onboardingId: result.userId,
                        network,
                    })
                    return { ...result, verificationState }
                } catch (error) {
                    // Best-effort: keep the login result so the caller can still
                    // resume onboarding (a null state is treated as unverified).
                    // Log it so a wrong userId->onboardingId assumption surfaces
                    // instead of silently mis-routing.
                    logger.warn('Card login KYC-state lookup failed', { error })
                    return result
                }
            }
            return result
        },
        throwOnError: false,
        onSuccess: async result => {
            // A null access token means OTP is still required or registration
            // is unfinished. Direct login has no refresh token (only the OAuth
            // flow issues one), so a 401 later can't be refreshed and the user
            // is routed back to login.
            if (result.accessToken) {
                await setCardSession({
                    accessToken: result.accessToken,
                    refreshToken: '',
                })
                return
            }
            // Mid-onboarding: bridge userId -> onboardingId so the resumed
            // onboarding/KYC screens (keyed on onboardingId) can read state and
            // start Veriff.
            if (result.phase !== null && result.userId !== null) {
                useCardStore.getState().setOnboardingId(result.userId)
            }
        },
    })

    return toCardMutationResult(mutation)
}
