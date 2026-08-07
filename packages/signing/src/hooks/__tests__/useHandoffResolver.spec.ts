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

import { describe, expect, test } from 'vitest'
import { resolveHandoffDeadline } from '../useHandoffResolver'

const FALLBACK = 60 * 60_000

describe('resolveHandoffDeadline', () => {
    test('uses the authoritative expiry when it is sooner than the fallback', () => {
        const registeredAt = 1_000
        const expiresAt = registeredAt + 5 * 60_000

        expect(resolveHandoffDeadline({ expiresAt, registeredAt })).toBe(
            expiresAt,
        )
    })

    test('caps at the fallback when the authoritative expiry is further out', () => {
        // A pathologically long backend expiry must not defeat the client cap.
        const registeredAt = 1_000
        const expiresAt = registeredAt + 10 * 60 * 60_000

        expect(resolveHandoffDeadline({ expiresAt, registeredAt })).toBe(
            registeredAt + FALLBACK,
        )
    })

    test('falls back to registration + cap when the expiry is unknown', () => {
        // The backend never returned a body, so there is no authoritative expiry.
        const registeredAt = 1_000

        expect(resolveHandoffDeadline({ expiresAt: null, registeredAt })).toBe(
            registeredAt + FALLBACK,
        )
    })

    test('uses the authoritative expiry when no registration anchor exists', () => {
        const expiresAt = 5 * 60_000

        expect(resolveHandoffDeadline({ expiresAt, registeredAt: null })).toBe(
            expiresAt,
        )
    })

    test('returns null when neither bound is available (enforcement is opt-in)', () => {
        expect(
            resolveHandoffDeadline({ expiresAt: null, registeredAt: null }),
        ).toBeNull()
    })

    test('honours a custom fallback window', () => {
        const registeredAt = 1_000
        const fallbackMs = 90_000

        expect(
            resolveHandoffDeadline({
                expiresAt: null,
                registeredAt,
                fallbackMs,
            }),
        ).toBe(registeredAt + fallbackMs)
    })
})
