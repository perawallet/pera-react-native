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

import { beforeEach, describe, expect, it } from 'vitest'
import {
    createChromeFake,
    type ChromeFake,
} from '@perawallet/wallet-extension-platform-chrome/test-utils'
import {
    INTEGRITY_PENDING_GRACE_MS,
    deriveIntegrityAccessState,
    readIntegritySnapshot,
    type IntegrityAccessInputs,
    type IntegritySnapshot,
} from '../access-state'
import {
    INTEGRITY_BACKOFF_SESSION_KEY,
    INTEGRITY_ENROL_ATTEMPT_SESSION_KEY,
    INTEGRITY_ENROL_BACKOFF_SESSION_KEY,
    INTEGRITY_ENROL_NEEDED_SESSION_KEY,
    INTEGRITY_LAST_FAILURE_SESSION_KEY,
    INTEGRITY_REVOCATIONS_SESSION_KEY,
    INTEGRITY_TOKEN_SESSION_KEY,
} from '../storage-keys'

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

const derive = (
    snapshot: Partial<IntegritySnapshot>,
    inputs: Partial<IntegrityAccessInputs> = {},
) =>
    deriveIntegrityAccessState(
        { ...EMPTY, ...snapshot },
        {
            now: NOW,
            pendingSince: NOW,
            isOnline: true,
            needsInteraction: false,
            isFrameDismissed: false,
            isEnrolmentDeferred: false,
            ...inputs,
        },
    )

const liveAttempt = {
    surface: 'frame' as const,
    phase: 'checking' as const,
    startedAt: NOW - 1000,
    deadlineAt: NOW + 60_000,
}

describe('deriveIntegrityAccessState', () => {
    it('lets offline outrank a valid token', () => {
        expect(
            derive({ tokenExpiresAt: NOW + 60_000 }, { isOnline: false }),
        ).toEqual({ status: 'offline' })
    })

    it('is ready while the token lives, even with a live enrolment', () => {
        expect(
            derive({ tokenExpiresAt: NOW + 60_000, attempt: liveAttempt }),
        ).toEqual({ status: 'ready', expiresAt: NOW + 60_000 })
    })

    it('is not ready once the token has expired', () => {
        expect(
            derive(
                { tokenExpiresAt: NOW - 1 },
                { pendingSince: NOW - INTEGRITY_PENDING_GRACE_MS },
            ).status,
        ).toBe('degraded')
    })

    it('lets a frame waiting for a click outrank a live check', () => {
        expect(
            derive({ attempt: liveAttempt }, { needsInteraction: true }),
        ).toEqual({ status: 'needs-interaction' })
    })

    it('is checking while an enrolment attempt is live', () => {
        expect(derive({ attempt: liveAttempt })).toEqual({
            status: 'checking',
            surface: 'frame',
        })
    })

    it('stops checking at the attempt deadline', () => {
        expect(
            derive(
                { attempt: { ...liveAttempt, deadlineAt: NOW } },
                { pendingSince: NOW - 1000 },
            ),
        ).toEqual({ status: 'pending' })
    })

    it('is pending inside the grace window with nothing failed', () => {
        expect(derive({}, { pendingSince: NOW - 5000 })).toEqual({
            status: 'pending',
        })
    })

    it('turns pending into a service outage after the grace window', () => {
        expect(
            derive({}, { pendingSince: NOW - INTEGRITY_PENDING_GRACE_MS }),
        ).toEqual({
            status: 'degraded',
            reason: 'service',
            cause: 'mint-pending',
            nextAttemptAt: null,
        })
    })

    it('reads a mint 5xx as a service outage with the backoff time', () => {
        expect(
            derive({
                lastFailure: {
                    phase: 'mint',
                    status: 503,
                    at: NOW - 1000,
                    isTransport: false,
                },
                mintBackoff: { failures: 1, nextAttemptAt: NOW + 300_000 },
            }),
        ).toEqual({
            status: 'degraded',
            reason: 'service',
            cause: 'mint-5xx',
            nextAttemptAt: NOW + 300_000,
        })
    })

    it('waits out the grace after a mint that never got an answer, then reads it as a timeout', () => {
        expect(
            derive({
                lastFailure: { phase: 'mint', at: NOW - 1000, isTransport: true },
            }),
        ).toEqual({ status: 'pending' })
        expect(
            derive({
                lastFailure: {
                    phase: 'mint',
                    at: NOW - INTEGRITY_PENDING_GRACE_MS,
                    isTransport: true,
                },
            }),
        ).toMatchObject({ reason: 'service', cause: 'mint-timeout' })
    })

    it.each([
        ['APP_INTEGRITY_ENROLMENT_REQUIRED', 'attest-enrolment-required'],
        ['APP_INTEGRITY_REVOKED', 'attest-revoked'],
    ])('reads an attest %s as needing verification', (code, cause) => {
        expect(
            derive({
                lastFailure: {
                    phase: 'mint',
                    status: 403,
                    code,
                    at: NOW - INTEGRITY_PENDING_GRACE_MS,
                    isTransport: false,
                },
                enrolBackoff: { failures: 1, nextAttemptAt: NOW + 300_000 },
            }),
        ).toEqual({
            status: 'degraded',
            reason: 'verification',
            cause,
            nextAttemptAt: NOW + 300_000,
        })
    })

    it('stays pending while a page has time to host the silent check', () => {
        expect(
            derive({
                lastFailure: {
                    phase: 'mint',
                    status: 403,
                    code: 'APP_INTEGRITY_ENROLMENT_REQUIRED',
                    at: NOW - 1000,
                    isTransport: false,
                },
                enrolNeededAt: NOW - 1000,
            }),
        ).toEqual({ status: 'pending' })
    })

    it.each([
        [{ code: 'TURNSTILE_ERROR' }, 'enrol-check-error:TURNSTILE_ERROR'],
        [{ detail: 'timeout' }, 'enrol-timeout'],
    ])(
        'reads a failed enrolment %j as needing verification',
        (failure, cause) => {
            expect(
                derive({
                    lastFailure: {
                        phase: 'enrol',
                        at: NOW,
                        isTransport: false,
                        ...failure,
                    },
                }),
            ).toMatchObject({
                status: 'degraded',
                reason: 'verification',
                cause,
            })
        },
    )

    it('reads a dismissed check frame as needing verification', () => {
        expect(
            derive({ attempt: liveAttempt }, { isFrameDismissed: true }),
        ).toMatchObject({
            status: 'degraded',
            reason: 'verification',
            cause: 'enrol-dismissed',
        })
    })

    it('waits out the grace before calling an unhosted enrolment no-host', () => {
        expect(
            derive({ enrolNeededAt: NOW - 1000 }, { pendingSince: NOW - 1000 }),
        ).toEqual({ status: 'pending' })
        expect(
            derive(
                { enrolNeededAt: NOW - 1000 },
                { pendingSince: NOW - INTEGRITY_PENDING_GRACE_MS },
            ),
        ).toMatchObject({ reason: 'verification', cause: 'no-host' })
    })

    it('waits for the user to commit to onboarding before asking them to verify', () => {
        const needsEnrolment = {
            lastFailure: {
                phase: 'mint' as const,
                status: 403,
                code: 'APP_INTEGRITY_ENROLMENT_REQUIRED',
                at: NOW - INTEGRITY_PENDING_GRACE_MS,
                isTransport: false,
            },
            enrolNeededAt: NOW - INTEGRITY_PENDING_GRACE_MS,
        }

        expect(derive(needsEnrolment, { isEnrolmentDeferred: true })).toEqual({
            status: 'pending',
        })
        expect(derive(needsEnrolment).status).toBe('degraded')
    })

    it('blocks after the second revocation in a session', () => {
        expect(
            derive({
                revocations: 2,
                enrolBackoff: { failures: 9, nextAttemptAt: NOW + 86_400_000 },
            }),
        ).toEqual({
            status: 'degraded',
            reason: 'blocked',
            cause: 'attest-revoked',
            nextAttemptAt: NOW + 86_400_000,
        })
    })
})

describe('readIntegritySnapshot', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('reads every fact the worker writes in one pass', async () => {
        await chrome.storage.session.set({
            [INTEGRITY_TOKEN_SESSION_KEY]: {
                integrityToken: 'jwt',
                expiresAt: new Date(NOW).toISOString(),
                mintedAt: new Date(NOW - 900_000).toISOString(),
                deviceInstallationId: 'install-1',
            },
            [INTEGRITY_BACKOFF_SESSION_KEY]: { failures: 2, nextAttemptAt: 5 },
            [INTEGRITY_ENROL_BACKOFF_SESSION_KEY]: {
                failures: 1,
                nextAttemptAt: 6,
            },
            [INTEGRITY_ENROL_ATTEMPT_SESSION_KEY]: {
                token: 'check-token',
                surface: 'tab',
                phase: 'enrolling',
                startedAt: 4,
                deadlineAt: 7,
            },
            [INTEGRITY_ENROL_NEEDED_SESSION_KEY]: 8,
            [INTEGRITY_LAST_FAILURE_SESSION_KEY]: {
                phase: 'enrol',
                code: 'TURNSTILE_EXPIRED',
                at: 9,
                isTransport: false,
            },
            [INTEGRITY_REVOCATIONS_SESSION_KEY]: 1,
        })

        expect(await readIntegritySnapshot()).toEqual({
            tokenExpiresAt: NOW,
            mintBackoff: { failures: 2, nextAttemptAt: 5 },
            enrolBackoff: { failures: 1, nextAttemptAt: 6 },
            attempt: {
                surface: 'tab',
                phase: 'enrolling',
                startedAt: 4,
                deadlineAt: 7,
            },
            enrolNeededAt: 8,
            lastFailure: {
                phase: 'enrol',
                code: 'TURNSTILE_EXPIRED',
                at: 9,
                isTransport: false,
            },
            revocations: 1,
        })
    })

    it('reads nothing stored, or anything malformed, as absent', async () => {
        await chrome.storage.session.set({
            [INTEGRITY_BACKOFF_SESSION_KEY]: 'nope',
            [INTEGRITY_LAST_FAILURE_SESSION_KEY]: { phase: 'mint' },
        })

        expect(await readIntegritySnapshot()).toEqual(EMPTY)
    })
})
