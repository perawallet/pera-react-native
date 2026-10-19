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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    INTEGRITY_PENDING_GRACE_MS,
    type IntegritySnapshot,
} from '@perawallet/wallet-core-browser-runtime'
import {
    nextIntegrityDerivationAt,
    subscribeToIntegrityReady,
    useIntegrityAccessStore,
} from '../useIntegrityAccessStore.web'

const NOW = 1_800_000_000_000

const EMPTY: IntegritySnapshot = {
    tokenExpiresAt: null,
    mintBackoff: null,
    enrolBackoff: null,
    attempt: null,
    enrolNeededAt: null,
    lastFailure: null,
    revocations: 0,
}

const withToken = (expiresAt: number): IntegritySnapshot => ({
    ...EMPTY,
    tokenExpiresAt: expiresAt,
})

describe('useIntegrityAccessStore', () => {
    beforeEach(() => {
        useIntegrityAccessStore.getState().resetState()
    })

    it('starts the grace window when this realm first sees no token', () => {
        useIntegrityAccessStore.getState().applySnapshot(EMPTY, NOW)

        expect(useIntegrityAccessStore.getState().pendingSince).toBe(NOW)
    })

    it('keeps the grace window running across snapshots without a token', () => {
        const { applySnapshot } = useIntegrityAccessStore.getState()
        applySnapshot(EMPTY, NOW)
        applySnapshot(EMPTY, NOW + 5000)

        expect(useIntegrityAccessStore.getState().pendingSince).toBe(NOW)
    })

    it('counts a ready edge once, when a token lands after none', () => {
        const { applySnapshot } = useIntegrityAccessStore.getState()
        applySnapshot(EMPTY, NOW)
        applySnapshot(withToken(NOW + 60_000), NOW + 1000)
        applySnapshot(withToken(NOW + 90_000), NOW + 2000)

        const state = useIntegrityAccessStore.getState()
        expect(state.readyEpoch).toBe(1)
        expect(state.pendingSince).toBeNull()
    })

    it('does not count the first snapshot as a ready edge', () => {
        useIntegrityAccessStore
            .getState()
            .applySnapshot(withToken(NOW + 60_000), NOW)

        expect(useIntegrityAccessStore.getState().readyEpoch).toBe(0)
    })

    it('starts a new grace window when the token expires on the clock', () => {
        const { applySnapshot, tick } = useIntegrityAccessStore.getState()
        applySnapshot(withToken(NOW + 60_000), NOW)

        tick(NOW + 60_000)

        expect(useIntegrityAccessStore.getState()).toMatchObject({
            now: NOW + 60_000,
            pendingSince: NOW + 60_000,
        })
    })
})

describe('subscribeToIntegrityReady', () => {
    beforeEach(() => {
        useIntegrityAccessStore.getState().resetState()
    })

    it('calls back on each edge where a token lands after none, until unsubscribed', () => {
        const onReady = vi.fn()
        const { applySnapshot } = useIntegrityAccessStore.getState()
        const unsubscribe = subscribeToIntegrityReady(onReady)

        applySnapshot(EMPTY, NOW)
        applySnapshot(withToken(NOW + 60_000), NOW + 1000)
        applySnapshot(withToken(NOW + 90_000), NOW + 2000)
        unsubscribe()
        applySnapshot(EMPTY, NOW + 100_000)
        applySnapshot(withToken(NOW + 200_000), NOW + 101_000)

        expect(onReady).toHaveBeenCalledTimes(1)
    })
})

describe('nextIntegrityDerivationAt', () => {
    it('picks the earliest moment the derived state can change on its own', () => {
        expect(
            nextIntegrityDerivationAt(
                {
                    ...withToken(NOW + 60_000),
                    attempt: {
                        surface: 'frame',
                        phase: 'checking',
                        startedAt: NOW - 20_000,
                        deadlineAt: NOW + 30_000,
                    },
                },
                null,
                NOW,
            ),
        ).toBe(NOW + 30_000)
    })

    it("includes the moment a check outlasts its own grace, when the pill shows it", () => {
        expect(
            nextIntegrityDerivationAt(
                {
                    ...EMPTY,
                    attempt: {
                        surface: 'frame',
                        phase: 'checking',
                        startedAt: NOW - 5000,
                        deadlineAt: NOW + 60_000,
                    },
                },
                null,
                NOW,
            ),
        ).toBe(NOW - 5000 + INTEGRITY_PENDING_GRACE_MS)
    })

    it('includes the end of the grace windows', () => {
        expect(
            nextIntegrityDerivationAt(
                {
                    ...EMPTY,
                    lastFailure: {
                        phase: 'mint',
                        code: 'APP_INTEGRITY_ENROLMENT_REQUIRED',
                        at: NOW - 10_000,
                        isTransport: false,
                    },
                },
                NOW - 2000,
                NOW,
            ),
        ).toBe(NOW - 10_000 + INTEGRITY_PENDING_GRACE_MS)
    })

    it('is null when nothing is due', () => {
        expect(nextIntegrityDerivationAt(EMPTY, null, NOW)).toBeNull()
    })
})
