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

import { describe, expect, it } from 'vitest'
import { ONE_DAY } from '@perawallet/wallet-core-config'
import { IDLE_SESSION_TIMEOUT_MS, isIdleSession } from '../idleSession'

const NOW = 1_800_000_000_000

describe('isIdleSession', () => {
    it('times out after 90 days', () => {
        expect(IDLE_SESSION_TIMEOUT_MS).toBe(90 * ONE_DAY)
    })

    it('keeps a session idle for exactly the timeout', () => {
        const lastActiveAt = NOW - IDLE_SESSION_TIMEOUT_MS

        expect(isIdleSession({ lastActiveAt }, NOW)).toBe(false)
    })

    it('ends a session idle for one millisecond longer', () => {
        const lastActiveAt = NOW - IDLE_SESSION_TIMEOUT_MS - 1

        expect(isIdleSession({ lastActiveAt }, NOW)).toBe(true)
    })

    it('keeps a session whose last activity is ahead of the clock', () => {
        expect(isIdleSession({ lastActiveAt: NOW + ONE_DAY }, NOW)).toBe(false)
    })
})
