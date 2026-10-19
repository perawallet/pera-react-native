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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Ensure i18n is initialised so t() resolves real strings in this unit env.
import '../../../i18n'
import {
    INTEGRITY_PENDING_GRACE_MS,
    type IntegrityAccessState,
    type IntegritySnapshot,
} from '@perawallet/wallet-core-browser-runtime'
import {
    OFFLINE_BANNER_EXPANDED_MS,
    OFFLINE_RECONNECT_DISPLAY_MS,
} from '@constants/ui'
import { useIntegrityAccessStore } from '@hooks/useIntegrityAccessStore.web'
import { useIntegrityFeedbackStore } from '@hooks/useIntegrityFeedbackStore'
import { useIntegrityBanner } from '../useIntegrityBanner.web'

const access = vi.hoisted(() => ({
    state: { status: 'ready', expiresAt: 0 } as IntegrityAccessState,
    retry: vi.fn(),
    verify: vi.fn(),
    surface: 'popup',
}))

vi.mock('@hooks/useIntegrityAccessState.web', () => ({
    useIntegrityAccessState: () => access,
}))

vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    getSurface: () => access.surface,
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

const degraded = (
    reason: 'service' | 'verification' | 'blocked',
): IntegrityAccessState => ({
    status: 'degraded',
    reason,
    cause: 'mint-5xx',
    nextAttemptAt: null,
})

describe('useIntegrityBanner', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        access.state = { status: 'ready', expiresAt: NOW + 60_000 }
        access.surface = 'popup'
        access.retry.mockClear()
        access.verify.mockClear()
        useIntegrityAccessStore.getState().resetState()
        useIntegrityFeedbackStore.getState().resetState()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('stays hidden while a token lives or one is on its way', () => {
        const { result, rerender } = renderHook(() => useIntegrityBanner())
        expect(result.current.isVisible).toBe(false)

        access.state = { status: 'pending' }
        rerender()

        expect(result.current.isVisible).toBe(false)
    })

    it('offers Retry for a service outage', () => {
        access.state = degraded('service')
        const { result } = renderHook(() => useIntegrityBanner())

        expect(result.current).toMatchObject({
            isVisible: true,
            mode: 'service',
            label: 'Pera services unavailable',
            actionLabel: 'Retry',
        })
        expect(result.current.description).toContain("can't reach its services")
        act(() => result.current.onAction?.())
        expect(access.retry).toHaveBeenCalledTimes(1)
    })

    it('offers Verify when verification is needed', () => {
        access.state = degraded('verification')
        const { result } = renderHook(() => useIntegrityBanner())

        expect(result.current).toMatchObject({
            mode: 'verification',
            label: 'Verification needed',
            actionLabel: 'Verify',
        })
        act(() => result.current.onAction?.())
        expect(access.verify).toHaveBeenCalledTimes(1)
    })

    it('offers nothing to press for a blocked install', () => {
        access.state = degraded('blocked')
        const { result } = renderHook(() => useIntegrityBanner())

        expect(result.current).toMatchObject({
            mode: 'blocked',
            label: 'Pera services unavailable',
            actionLabel: null,
            onAction: null,
        })
        expect(result.current.description).toContain('Contact Pera support')
    })

    it('shows a check only once it outlasts its own grace, timed from its start', () => {
        const checking = (startedAt: number): IntegritySnapshot => ({
            ...EMPTY,
            attempt: {
                surface: 'frame',
                phase: 'checking',
                startedAt,
                deadlineAt: startedAt + 240_000,
            },
        })
        // The page opened long before the check started.
        act(() => useIntegrityAccessStore.getState().applySnapshot(EMPTY, NOW - 60_000))
        act(() =>
            useIntegrityAccessStore.getState().applySnapshot(checking(NOW), NOW),
        )
        access.state = { status: 'checking', surface: 'frame' }
        const { result } = renderHook(() => useIntegrityBanner())
        expect(result.current.isVisible).toBe(false)

        act(() =>
            useIntegrityAccessStore
                .getState()
                .tick(NOW + INTEGRITY_PENDING_GRACE_MS),
        )

        expect(result.current).toMatchObject({
            isVisible: true,
            label: 'Verifying this extension',
            actionLabel: null,
        })
    })

    it('confirms a recovery only after an outage, not after a check', () => {
        act(() =>
            useIntegrityAccessStore.getState().applySnapshot(
                {
                    ...EMPTY,
                    attempt: {
                        surface: 'frame',
                        phase: 'checking',
                        startedAt: NOW - INTEGRITY_PENDING_GRACE_MS,
                        deadlineAt: NOW + 240_000,
                    },
                },
                NOW,
            ),
        )
        access.state = { status: 'checking', surface: 'frame' }
        const { result, rerender } = renderHook(() => useIntegrityBanner())
        expect(result.current.mode).toBe('checking')

        access.state = { status: 'ready', expiresAt: NOW + 60_000 }
        rerender()

        expect(result.current.isVisible).toBe(false)
    })

    it('never shows in a dApp approval window', () => {
        access.surface = 'approval'
        access.state = degraded('service')

        const { result } = renderHook(() => useIntegrityBanner())

        expect(result.current.isVisible).toBe(false)
    })

    it('leaves the offline banner alone while offline', () => {
        access.state = { status: 'offline' }

        const { result } = renderHook(() => useIntegrityBanner())

        expect(result.current.isVisible).toBe(false)
    })

    it('confirms the recovery for three seconds', () => {
        access.state = degraded('service')
        const { result, rerender } = renderHook(() => useIntegrityBanner())

        access.state = { status: 'ready', expiresAt: NOW + 60_000 }
        rerender()
        expect(result.current).toMatchObject({
            isVisible: true,
            mode: 'restored',
            label: 'Pera services restored',
        })

        act(() => {
            vi.advanceTimersByTime(OFFLINE_RECONNECT_DISPLAY_MS)
        })
        expect(result.current.isVisible).toBe(false)
    })

    it('explains itself on first show and again when a refusal is emphasized', () => {
        access.state = degraded('service')
        const { result } = renderHook(() => useIntegrityBanner())
        expect(result.current.isExpanded).toBe(true)

        act(() => {
            vi.advanceTimersByTime(OFFLINE_BANNER_EXPANDED_MS)
        })
        expect(result.current.isExpanded).toBe(false)

        act(() =>
            useIntegrityFeedbackStore.getState().emphasizeIntegrityStatus(),
        )
        expect(result.current.isExpanded).toBe(true)
    })

    it('swaps the action for a spinner while a retry is in flight', () => {
        access.state = degraded('service')
        const { result, rerender } = renderHook(() => useIntegrityBanner())

        act(() => result.current.onAction?.())
        expect(result.current.isActionPending).toBe(true)

        access.state = degraded('verification')
        rerender()
        expect(result.current.isActionPending).toBe(false)
    })

    it('gives up the spinner after ten seconds', () => {
        access.state = degraded('service')
        const { result } = renderHook(() => useIntegrityBanner())

        act(() => result.current.onAction?.())
        act(() => {
            vi.advanceTimersByTime(10_000)
        })

        expect(result.current.isActionPending).toBe(false)
    })
})
