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
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { acquireCardSessionTokens, loginRequest } from '../api/auth'
import { fetchOnboardingDetails } from '../api/onboarding'
import { getCardApiError, isAccountLockedError } from '../api/errors'
import {
    OnboardingStep,
    type CardSessionTokens,
    type LoginResult,
} from '../models'
import { setCardSession } from '../session'
import { useCardStore } from '../store'
import { linkStashedOnboardingConsent } from './finalizeCardRegistration'
import { toCardMutationResult, type CardMutationResult } from './types'

export type CardLoginParams = {
    email: string
    password: string
    otpCode?: string
    /**
     * This sign-in finishes this device's registration, so the consent set
     * stashed during onboarding is linked if this is the user who onboarded.
     */
    linkConsent?: boolean
    /** The email this device onboarded with, when the screen knows it. */
    onboardingEmail?: string
}

const isSameEmail = (a: string, b: string): boolean =>
    a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Login outcome plus the durable OAuth token pair. `tokens` is set only when
 * credentials (and OTP, if required) were accepted AND the OAuth exchange
 * completed; it is null while OTP or onboarding is still pending.
 */
export type CardLoginData = LoginResult & {
    tokens: Nullable<CardSessionTokens>
    /** ISO 3166-1 alpha-2 from the onboarding record, mid-onboarding only. */
    countryOfResidence: Nullable<string>
}

export type UseCardLoginMutationResult = CardMutationResult<
    CardLoginParams,
    CardLoginData
>

export const useCardLoginMutation = (
    scope: ChainScope,
): UseCardLoginMutationResult => {
    const mutation = useMutation<CardLoginData, Error, CardLoginParams>({
        mutationFn: async ({ email, password, otpCode }) => {
            const result = await loginRequest({
                email,
                password,
                otpCode,
                scope,
            })
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
                    scope,
                })
                return { ...result, tokens, countryOfResidence: null }
            }
            // A mid-onboarding login issues no access token and an unreliable
            // (often null) verificationState, so the record supplies the KYC
            // state and the residence (which this device may not hold).
            // TODO(card): Baanx has not confirmed that userId works as the onboardingId.
            if (result.phase !== null && result.userId !== null) {
                try {
                    const record = await fetchOnboardingDetails({
                        onboardingId: result.userId,
                        scope,
                    })
                    return {
                        ...result,
                        verificationState:
                            result.verificationState ??
                            record.verificationState,
                        countryOfResidence: record.countryOfResidence,
                        tokens: null,
                    }
                } catch (error) {
                    // Best-effort: keep the login result so the caller can still
                    // resume onboarding (a null state is treated as unverified).
                    // Log it so a wrong userId->onboardingId assumption surfaces
                    // instead of silently mis-routing.
                    logger.warn('Card login KYC-state lookup failed', { error })
                    return { ...result, tokens: null, countryOfResidence: null }
                }
            }
            return { ...result, tokens: null, countryOfResidence: null }
        },
        throwOnError: false,
        onError: async error => {
            if (isAccountLockedError(await getCardApiError(error))) {
                useCardStore.getState().markLoginLocked()
            }
        },
        onSuccess: async (
            result,
            { email, password, linkConsent, onboardingEmail },
        ) => {
            const store = useCardStore.getState()
            // Persist only the durable OAuth pair — never the ephemeral login
            // token. Null tokens mean OTP is still required or registration is
            // unfinished.
            if (result.tokens) {
                await setCardSession(result.tokens)
                // Baanx only issues an access token once registration is done,
                // so onboarding is complete even if this device never finished it.
                store.setOnboardingStep(OnboardingStep.Completed)
                store.clearLoginSecrets()
                if (result.userId !== null) {
                    store.adoptCardUser(result.userId)
                    // A stash left by an abandoned sign-up must never be bound
                    // to whoever signs in next, and the email stays editable.
                    // Baanx hasn't confirmed the account keeps the onboarding
                    // id, so that fallback can only skip a link, never misbind.
                    const isOnboardingUser =
                        onboardingEmail !== undefined
                            ? isSameEmail(onboardingEmail, email)
                            : result.userId === store.onboardingId
                    if (linkConsent && isOnboardingUser) {
                        await linkStashedOnboardingConsent({
                            userId: result.userId,
                            scope,
                        })
                    } else if (linkConsent) {
                        logger.warn(
                            'Card consent stash kept: signed in as another user',
                        )
                    }
                }
                return
            }
            // Mid-onboarding: bridge userId -> onboardingId so the resumed
            // onboarding/KYC screens (keyed on onboardingId) can read state and
            // start KYC. The password is held, memory only, for the login that
            // creates the session once KYC verifies.
            if (result.phase !== null && result.userId !== null) {
                store.setOnboardingId(result.userId)
                store.setPassword(password)
                // Baanx counts it as a failed login; the post-KYC logins space
                // themselves from it.
                store.recordLoginAttempt({ isAutomatic: false, at: Date.now() })
                if (store.countryIso === null && result.countryOfResidence) {
                    store.setCountryIso(result.countryOfResidence)
                }
            }
        },
    })

    return toCardMutationResult(mutation)
}
