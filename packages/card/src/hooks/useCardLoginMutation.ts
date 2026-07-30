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
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { acquireCardSessionTokens, loginRequest } from '../api/auth'
import { fetchOnboardingDetails } from '../api/onboarding'
import { setCardSession } from '../session'
import { useCardStore } from '../store'
import type { CardSessionTokens, LoginResult } from '../models'
import { toCardMutationResult, type CardMutationResult } from './types'

export type CardLoginParams = {
    email: string
    password: string
    otpCode?: string
}

/**
 * Login outcome plus the durable OAuth token pair. `tokens` is set only when
 * credentials (and OTP, if required) were accepted AND the OAuth exchange
 * completed; it is null while OTP or onboarding is still pending.
 */
export type CardLoginData = LoginResult & {
    tokens: Nullable<CardSessionTokens>
}

export type UseCardLoginMutationResult = CardMutationResult<
    CardLoginParams,
    CardLoginData
>

export const useCardLoginMutation = (): UseCardLoginMutationResult => {
    const { network } = useNetwork()

    const mutation = useMutation<CardLoginData, Error, CardLoginParams>({
        mutationFn: async params => {
            const result = await loginRequest({ ...params, network })
            // Credentials accepted: the returned access token is the ephemeral
            // 6h OAuth-completion token. Trade it for the durable pair (6h
            // access + 7-day refresh) so the session can be silently refreshed
            // instead of forcing a re-login every 6 hours. On an exchange
            // failure this degrades to a refresh-less 6h session rather than
            // failing a login whose credentials (and OTP) were already
            // accepted — an OAuth-proxy outage must not become a login outage.
            if (result.accessToken) {
                const tokens = await acquireCardSessionTokens({
                    accessToken: result.accessToken,
                    network,
                })
                return { ...result, tokens }
            }
            // A mid-onboarding login issues no access token and an unreliable
            // (often null) verificationState. Treat userId as the onboardingId
            // and read the real KYC state from the pre-auth onboarding endpoint
            // so the caller can route. Best-effort: keep the login result on
            // failure (the caller treats a null state as unverified).
            // TODO(card): confirm Baanx accepts userId as the onboardingId here.
            if (
                result.phase !== null &&
                result.userId !== null &&
                result.verificationState === null
            ) {
                try {
                    const { verificationState } = await fetchOnboardingDetails({
                        onboardingId: result.userId,
                        network,
                    })
                    return { ...result, verificationState, tokens: null }
                } catch (error) {
                    // Best-effort: keep the login result so the caller can still
                    // resume onboarding (a null state is treated as unverified).
                    // Log it so a wrong userId->onboardingId assumption surfaces
                    // instead of silently mis-routing.
                    logger.warn('Card login KYC-state lookup failed', { error })
                    return { ...result, tokens: null }
                }
            }
            return { ...result, tokens: null }
        },
        throwOnError: false,
        onSuccess: async result => {
            // Persist only the durable OAuth pair — never the ephemeral login
            // token. Null tokens mean OTP is still required or registration is
            // unfinished.
            if (result.tokens) {
                await setCardSession(result.tokens)
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
