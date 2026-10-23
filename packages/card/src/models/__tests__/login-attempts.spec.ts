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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import {
    canAttemptAutomaticLogin,
    INITIAL_LOGIN_ATTEMPTS,
    LOGIN_ATTEMPT_SPACING_MS,
    msUntilNextLoginAttempt,
} from '../login-attempts'

const NOW = 1_000_000_000

describe('login attempt budget', () => {
    it('lets the first automatic login run when none has run yet', () => {
        expect(
            canAttemptAutomaticLogin(INITIAL_LOGIN_ATTEMPTS, {
                now: NOW,
                hasAccountSignal: false,
            }),
        ).toBe(true)
    })

    it('needs the account signal for any automatic login after a first one', () => {
        const attempts = {
            ...INITIAL_LOGIN_ATTEMPTS,
            automatic: 1,
            lastAt: NOW - LOGIN_ATTEMPT_SPACING_MS,
        }

        expect(
            canAttemptAutomaticLogin(attempts, {
                now: NOW,
                hasAccountSignal: false,
            }),
        ).toBe(false)
        expect(
            canAttemptAutomaticLogin(attempts, {
                now: NOW,
                hasAccountSignal: true,
            }),
        ).toBe(true)
    })

    it('treats a manual sign-in like any other login', () => {
        const afterSignIn = { ...INITIAL_LOGIN_ATTEMPTS, lastAt: NOW - 1000 }

        expect(
            canAttemptAutomaticLogin(afterSignIn, {
                now: NOW,
                hasAccountSignal: true,
            }),
        ).toBe(false)
        expect(msUntilNextLoginAttempt(afterSignIn, NOW)).toBe(
            LOGIN_ATTEMPT_SPACING_MS - 1000,
        )
    })

    it('never allows a third automatic login', () => {
        expect(
            canAttemptAutomaticLogin(
                { automatic: 2, lastAt: NOW - 10 * 60_000, isLocked: false },
                { now: NOW, hasAccountSignal: true },
            ),
        ).toBe(false)
    })

    it('never logs in automatically once locked', () => {
        expect(
            canAttemptAutomaticLogin(
                { ...INITIAL_LOGIN_ATTEMPTS, isLocked: true },
                { now: NOW, hasAccountSignal: true },
            ),
        ).toBe(false)
    })

    it('reports no wait when nothing has run, or the spacing has passed', () => {
        expect(msUntilNextLoginAttempt(INITIAL_LOGIN_ATTEMPTS, NOW)).toBe(0)
        expect(
            msUntilNextLoginAttempt(
                {
                    ...INITIAL_LOGIN_ATTEMPTS,
                    lastAt: NOW - LOGIN_ATTEMPT_SPACING_MS - 1,
                },
                NOW,
            ),
        ).toBe(0)
    })
})
