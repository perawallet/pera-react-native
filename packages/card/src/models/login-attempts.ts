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

import type { Nullable } from '@perawallet/wallet-core-shared'

/**
 * Baanx counts every login that does not yield a session as a failed attempt
 * and locks the account after repeated ones, so the onboarding logins are
 * budgeted. Memory only, like the password they use.
 */
export type LoginAttempts = {
    /** Logins the app started on its own this onboarding session. */
    automatic: number
    /** Logins of any kind (automatic, retry or sign-in) this session. */
    total: number
    /** Epoch ms of the last login of any kind (automatic, retry or sign-in). */
    lastAt: Nullable<number>
    /** Baanx answered that the account is locked; nothing retries after that. */
    isLocked: boolean
}

export const INITIAL_LOGIN_ATTEMPTS: LoginAttempts = {
    automatic: 0,
    total: 0,
    lastAt: null,
    isLocked: false,
}

export const MAX_AUTOMATIC_LOGIN_ATTEMPTS = 2
// Kept under the lockout threshold common to login APIs; Baanx hasn't
// published its own.
export const MAX_LOGIN_ATTEMPTS = 3
export const LOGIN_ATTEMPT_SPACING_MS = 2 * 60_000

/** False once the session's logins are spent or Baanx locked the account. */
export const hasLoginAttemptsLeft = (attempts: LoginAttempts): boolean =>
    !attempts.isLocked && attempts.total < MAX_LOGIN_ATTEMPTS

/** Milliseconds until another login may run; 0 when one may run now. */
export const msUntilNextLoginAttempt = (
    attempts: LoginAttempts,
    now: number,
): number =>
    attempts.lastAt === null
        ? 0
        : Math.max(0, attempts.lastAt + LOGIN_ATTEMPT_SPACING_MS - now)

/**
 * The first automatic login runs only when no login has run yet this
 * session; the second only once the onboarding record says the account
 * exists. Both respect the spacing, the session total and the lock.
 */
export const canAttemptAutomaticLogin = (
    attempts: LoginAttempts,
    { now, hasAccountSignal }: { now: number; hasAccountSignal: boolean },
): boolean =>
    hasLoginAttemptsLeft(attempts) &&
    attempts.automatic < MAX_AUTOMATIC_LOGIN_ATTEMPTS &&
    msUntilNextLoginAttempt(attempts, now) === 0 &&
    (attempts.lastAt === null || hasAccountSignal)
