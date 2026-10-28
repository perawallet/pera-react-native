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

import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsFocused } from '@react-navigation/native'
import {
    canAttemptAutomaticLogin,
    hasLoginAttemptsLeft,
    msUntilNextLoginAttempt,
    useCardStore,
    useFinalizeRegistrationMutation,
    VerificationState,
    type FinalizeRegistrationOutcome,
} from '@perawallet/wallet-core-card'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useAppNavigation } from '@hooks/useAppNavigation'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'

/** How long "being set up" may last before the copy says it is slow. */
export const FINISH_REGISTRATION_SLOW_AFTER_MS = 10 * 60_000

/**
 * - `none`: nothing is waiting on Baanx.
 * - `preparing`: KYC is verified and Baanx is still creating the account.
 * - `slow`: the same, for longer than Baanx normally takes.
 * - `stalled`: the same, with this session's logins spent, so only support
 *   can finish it.
 * - `sign-in`: KYC is verified and only the user's own sign-in can finish it.
 */
export type AccountPreparation =
    | 'none'
    | 'preparing'
    | 'slow'
    | 'stalled'
    | 'sign-in'

export type UseFinishRegistrationOnVerifiedParams = {
    verificationState: Nullable<VerificationState>
    /** A record verified under the old order can still owe forms; no login runs until they're in. */
    areDetailsSubmitted: boolean
    isRegistrationComplete: boolean
    isAuthenticated: boolean
    /** The login is keyed on it; from the onboarding record or this device. */
    email: Nullable<string>
    /** The onboarding record says the account exists (see useOnboardingKycPoll). */
    hasAccountSignal: boolean
}

export type UseFinishRegistrationOnVerifiedResult = {
    accountPreparation: AccountPreparation
    /** Baanx locked the account after repeated failed logins. */
    isLoginLocked: boolean
    /**
     * A tap may run one login now: none in flight, the spacing has passed and
     * the session has logins left.
     */
    canTryAgain: boolean
    handleTryAgain: () => void
    /** Reopens the sign-in the user was sent to, if they backed out of it. */
    handleSignIn: () => void
}

/**
 * Baanx creates the account once KYC verifies, and counts every login that
 * yields no session as a failed attempt, locking the account after repeated
 * ones. So this runs one automatic login on the verdict, a second only once
 * the onboarding record says the account exists, and otherwise waits for the
 * user's "Try again". Every login, tapped or not, spends the same session
 * budget in the card store.
 */
export const useFinishRegistrationOnVerified = (
    scope: ChainScope,
    {
        verificationState,
        areDetailsSubmitted,
        isRegistrationComplete,
        isAuthenticated,
        email,
        hasAccountSignal,
    }: UseFinishRegistrationOnVerifiedParams,
): UseFinishRegistrationOnVerifiedResult => {
    const navigation = useAppNavigation()
    const { t } = useLanguage()
    const { infoToast } = useToast()
    const isFocused = useIsFocused()
    const loginAttempts = useCardStore(state => state.loginAttempts)
    const hasPassword = useCardStore(state => state.hasPassword)
    const { mutateAsync: finalize, isPending } =
        useFinalizeRegistrationMutation(scope)
    // Re-renders when a time-based rule (spacing, slow copy) changes.
    const [now, setNow] = useState(() => Date.now())
    const isInFlightRef = useRef(false)
    const hasSentToSignInRef = useRef(false)
    const [hasSentToSignIn, setHasSentToSignIn] = useState(false)
    const [preparingSince, setPreparingSince] = useState<Nullable<number>>(null)

    const isWaitingOnBaanx =
        verificationState === VerificationState.Verified &&
        areDetailsSubmitted &&
        !isRegistrationComplete &&
        !isAuthenticated
    const isLoginLocked = loginAttempts.isLocked && !isRegistrationComplete
    const hasAttemptsLeft = hasLoginAttemptsLeft(loginAttempts)
    // A sign-in that came back mid-onboarding holds the password again, so the
    // automatic login takes over from there.
    const isSignInRequired =
        isWaitingOnBaanx &&
        !isLoginLocked &&
        hasSentToSignIn &&
        (!hasPassword || email === null)

    const handleSignIn = useCallback(() => {
        navigation.navigate('CardSignIn', {
            email: email ?? undefined,
            finishesRegistration: true,
        })
    }, [email, navigation])

    const sendToSignIn = useCallback(() => {
        if (hasSentToSignInRef.current) return
        hasSentToSignInRef.current = true
        setHasSentToSignIn(true)
        infoToast(
            t('peraCard.setup_status.sign_in_to_finish_title'),
            t('peraCard.setup_status.sign_in_to_finish_body'),
        )
        handleSignIn()
    }, [handleSignIn, infoToast, t])

    const runLogin = useCallback(
        (isAutomatic: boolean) => {
            if (isInFlightRef.current) return
            if (email === null) {
                sendToSignIn()
                return
            }
            isInFlightRef.current = true
            finalize({ email, isAutomatic })
                .then((outcome: FinalizeRegistrationOutcome) => {
                    // not-ready waits for the record or a tap; locked shows its
                    // own copy from the store; completed needs nothing more.
                    if (
                        outcome === 'otp-required' ||
                        outcome === 'password-required'
                    ) {
                        sendToSignIn()
                    }
                })
                .catch(sendToSignIn)
                .finally(() => {
                    isInFlightRef.current = false
                    setNow(Date.now())
                })
        },
        [email, finalize, sendToSignIn],
    )

    useEffect(() => {
        if (!isWaitingOnBaanx || !isFocused || isInFlightRef.current) return
        if (loginAttempts.isLocked) return
        // Without a password finalize returns before recording an attempt, so
        // the budget would never stop it; only a sign-in can finish here.
        if (!hasPassword) {
            sendToSignIn()
            return
        }
        if (
            !canAttemptAutomaticLogin(loginAttempts, {
                now: Date.now(),
                hasAccountSignal,
            })
        ) {
            return
        }
        runLogin(true)
    }, [
        isWaitingOnBaanx,
        isFocused,
        loginAttempts,
        hasAccountSignal,
        hasPassword,
        now,
        runLogin,
        sendToSignIn,
    ])

    const msUntilNext = msUntilNextLoginAttempt(loginAttempts, now)
    useEffect(() => {
        if (!isWaitingOnBaanx) return
        const wait = msUntilNextLoginAttempt(loginAttempts, Date.now())
        if (wait === 0) return
        const timer = setTimeout(() => setNow(Date.now()), wait)
        return () => clearTimeout(timer)
    }, [isWaitingOnBaanx, loginAttempts, now])

    const isPreparing =
        isWaitingOnBaanx && !isLoginLocked && loginAttempts.lastAt !== null
    useEffect(() => {
        if (!isPreparing) return
        const startedAt = Date.now()
        setPreparingSince(since => since ?? startedAt)
        setNow(startedAt)
    }, [isPreparing])
    const msUntilSlow =
        preparingSince === null
            ? null
            : Math.max(
                  0,
                  preparingSince + FINISH_REGISTRATION_SLOW_AFTER_MS - now,
              )
    useEffect(() => {
        if (!isPreparing || preparingSince === null) return
        const wait =
            preparingSince + FINISH_REGISTRATION_SLOW_AFTER_MS - Date.now()
        if (wait <= 0) return
        const timer = setTimeout(() => setNow(Date.now()), wait)
        return () => clearTimeout(timer)
    }, [isPreparing, preparingSince, now])

    const handleTryAgain = useCallback(() => {
        if (
            !isWaitingOnBaanx ||
            !hasLoginAttemptsLeft(loginAttempts) ||
            msUntilNextLoginAttempt(loginAttempts, Date.now()) > 0
        ) {
            return
        }
        runLogin(false)
    }, [isWaitingOnBaanx, loginAttempts, runLogin])

    const resolveAccountPreparation = (): AccountPreparation => {
        if (isSignInRequired) return 'sign-in'
        if (!isPreparing) return 'none'
        if (!hasAttemptsLeft && !isPending) return 'stalled'
        return msUntilSlow === 0 ? 'slow' : 'preparing'
    }

    return {
        accountPreparation: resolveAccountPreparation(),
        isLoginLocked,
        canTryAgain:
            isPreparing &&
            !isSignInRequired &&
            !isPending &&
            msUntilNext === 0 &&
            hasAttemptsLeft,
        handleTryAgain,
        handleSignIn,
    }
}
