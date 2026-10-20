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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    sendIntegrityControl,
    type IntegritySnapshot,
} from '@perawallet/wallet-core-browser-runtime'
import { useIntegrityCheckFrameStore } from '@components/IntegrityCheckFrameHost'
import { useNetworkStatusStore } from '../useNetworkStatusStore'
import { useIntegrityAccessStore } from '../useIntegrityAccessStore.web'
import { useIntegrityAccessState } from '../useIntegrityAccessState.web'

const flags = vi.hoisted(() => ({
    mint: true,
    bearer: true,
    isShowingOnboarding: false,
    hasCommittedToOnboarding: false,
}))

vi.mock('@hooks/useShowOnboarding', () => ({
    useShowOnboarding: () => flags.isShowingOnboarding,
}))

vi.mock('@modules/onboarding', () => ({
    useIsOnboarding: () => ({
        isOnboarding: flags.hasCommittedToOnboarding,
        setIsOnboarding: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        get webIntegrityMintEnabled() {
            return flags.mint
        },
        get webIntegrityBearerEnabled() {
            return flags.bearer
        },
    },
}))

vi.mock('@perawallet/wallet-core-browser-runtime', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-browser-runtime')
    >()),
    sendIntegrityControl: vi.fn(),
}))

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

const SERVICE_DOWN: IntegritySnapshot = {
    ...EMPTY,
    lastFailure: { phase: 'mint', status: 503, at: NOW, isTransport: false },
    mintBackoff: { failures: 1, nextAttemptAt: NOW + 300_000 },
}

const LIVE_ATTEMPT: IntegritySnapshot = {
    ...EMPTY,
    attempt: {
        surface: 'frame',
        phase: 'checking',
        startedAt: NOW - 1000,
        deadlineAt: NOW + 60_000,
    },
}

describe('useIntegrityAccessState (web)', () => {
    beforeEach(() => {
        flags.mint = true
        flags.bearer = true
        flags.isShowingOnboarding = false
        flags.hasCommittedToOnboarding = false
        useIntegrityAccessStore.getState().resetState()
        useIntegrityCheckFrameStore.getState().hide()
        useNetworkStatusStore.getState().setHasInternet(true)
    })

    const apply = (snapshot: IntegritySnapshot) =>
        act(() =>
            useIntegrityAccessStore.getState().applySnapshot(snapshot, NOW),
        )

    it('reads ready while the worker holds a live token', () => {
        apply({ ...EMPTY, tokenExpiresAt: NOW + 60_000 })

        const { result } = renderHook(() => useIntegrityAccessState())

        expect(result.current.state).toEqual({
            status: 'ready',
            expiresAt: NOW + 60_000,
        })
    })

    it('lets offline outrank a service outage', () => {
        apply(SERVICE_DOWN)
        act(() => useNetworkStatusStore.getState().setHasInternet(false))

        const { result } = renderHook(() => useIntegrityAccessState())

        expect(result.current.state).toEqual({ status: 'offline' })
    })

    it('reads a dismissed live check as needing verification', () => {
        apply(LIVE_ATTEMPT)
        act(() => {
            useIntegrityCheckFrameStore
                .getState()
                .show('https://c/check', NOW + 60_000)
            useIntegrityCheckFrameStore.getState().dismiss()
        })

        const { result } = renderHook(() => useIntegrityAccessState())

        expect(result.current.state).toMatchObject({
            status: 'degraded',
            reason: 'verification',
            cause: 'enrol-dismissed',
        })
    })

    it('reads a check asking for a click as needing interaction', () => {
        apply(LIVE_ATTEMPT)
        act(() => {
            useIntegrityCheckFrameStore
                .getState()
                .show('https://c/check', NOW + 60_000)
            useIntegrityCheckFrameStore.getState().setExpanded(true)
        })

        const { result } = renderHook(() => useIntegrityAccessState())

        expect(result.current.state).toEqual({ status: 'needs-interaction' })
    })

    it('reads a missing enrolment as pending until the user commits to onboarding', () => {
        apply({
            ...EMPTY,
            lastFailure: {
                phase: 'mint',
                status: 403,
                code: 'APP_INTEGRITY_ENROLMENT_REQUIRED',
                at: NOW - 60_000,
                isTransport: false,
            },
        })
        flags.isShowingOnboarding = true

        const { result, rerender } = renderHook(() => useIntegrityAccessState())
        expect(result.current.state).toEqual({ status: 'pending' })

        flags.hasCommittedToOnboarding = true
        rerender()
        expect(result.current.state).toMatchObject({ reason: 'verification' })
    })

    it('reads ready in a build that mints no token', () => {
        flags.bearer = false
        apply(SERVICE_DOWN)

        const { result } = renderHook(() => useIntegrityAccessState())

        expect(result.current.state.status).toBe('ready')
    })

    it('sends a retry to the worker', () => {
        const { result } = renderHook(() => useIntegrityAccessState())

        act(() => result.current.retry())

        expect(sendIntegrityControl).toHaveBeenCalledWith({ kind: 'retry' })
    })

    it('hands Verify to the check host', () => {
        const { result } = renderHook(() => useIntegrityAccessState())

        act(() => result.current.verify())

        expect(useIntegrityCheckFrameStore.getState().verifyNonce).toBe(1)
    })
})
