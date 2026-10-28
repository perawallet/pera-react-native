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
import { logger } from '@perawallet/wallet-core-shared'
import { loginRequest } from '../api/auth'
import {
    getCardApiError,
    isAccountLockedError,
    isInvalidCredentialsError,
    isInvalidInputError,
} from '../api/errors'
import type { LoginResult } from '../models'
import { useCardStore } from '../store'
import { getLoginPassword } from '../store/login-password'
import { finalizeCardRegistration } from './finalizeCardRegistration'
import { toCardMutationResult, type CardMutationResult } from './types'

/**
 * - `completed`: the session exists and onboarding is done.
 * - `not-ready`: Baanx has not created the account yet, or the login failed
 *   for a reason that is not the user's (network, 5xx); try again later.
 * - `otp-required` / `password-required`: the user has to sign in to finish,
 *   because Baanx wants a 2FA code or the in-memory password is gone or wrong.
 * - `locked`: Baanx locked the account after repeated failed logins; only
 *   support can unlock it, so nothing retries.
 */
export type FinalizeRegistrationOutcome =
    | 'completed'
    | 'not-ready'
    | 'otp-required'
    | 'password-required'
    | 'locked'

export type FinalizeRegistrationParams = {
    /** From the onboarding record; login is keyed on it. */
    email: string
    /** Started by the app rather than a tap; counts against the automatic budget. */
    isAutomatic: boolean
}

export type UseFinalizeRegistrationMutationResult = CardMutationResult<
    FinalizeRegistrationParams,
    FinalizeRegistrationOutcome
>

const outcomeOfRefusal = async (
    error: unknown,
): Promise<FinalizeRegistrationOutcome> => {
    const apiError = await getCardApiError(error)
    if (isAccountLockedError(apiError)) return 'locked'
    if (apiError.isOtpRequired) return 'otp-required'
    if (isInvalidCredentialsError(apiError) || isInvalidInputError(apiError)) {
        return 'password-required'
    }
    logger.warn('Card post-KYC login failed', { error: apiError })
    return 'not-ready'
}

const outcomeWithoutToken = (
    login: LoginResult,
): FinalizeRegistrationOutcome => {
    if (login.isOtpRequired) return 'otp-required'
    // A phase means Baanx is still finishing the account behind the verdict.
    return login.phase !== null ? 'not-ready' : 'password-required'
}

/**
 * Baanx creates the account only once KYC verifies, and only a verified user
 * can log in, so the session is minted here with the password held in memory
 * since email/verify. One call is exactly one login: the caller owns the
 * budget, and every call is recorded against it.
 */
export const useFinalizeRegistrationMutation = (
    scope: ChainScope,
): UseFinalizeRegistrationMutationResult => {
    const mutation = useMutation<
        FinalizeRegistrationOutcome,
        Error,
        FinalizeRegistrationParams
    >({
        mutationFn: async ({ email, isAutomatic }) => {
            const password = getLoginPassword()
            if (password === null) return 'password-required'
            const { recordLoginAttempt } = useCardStore.getState()
            recordLoginAttempt({ isAutomatic, at: Date.now() })

            let login: LoginResult
            try {
                login = await loginRequest({ email, password, scope })
            } catch (error) {
                return outcomeOfRefusal(error)
            }
            if (login.accessToken === null) return outcomeWithoutToken(login)
            await finalizeCardRegistration({
                accessToken: login.accessToken,
                userId: login.userId,
                scope,
            })
            return 'completed'
        },
        // The password is kept only for a retry; the sign-in fallback asks
        // for it again.
        onSuccess: outcome => {
            if (outcome === 'locked') useCardStore.getState().markLoginLocked()
            else if (outcome !== 'not-ready') {
                useCardStore.getState().setPassword(null)
            }
        },
        onError: () => {
            useCardStore.getState().setPassword(null)
        },
        throwOnError: false,
    })

    return toCardMutationResult(mutation)
}
