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
    type IntegrityAccessState,
    type IntegritySnapshot,
} from '@perawallet/wallet-core-browser-runtime'
import { useIntegrityCheckFrameStore } from '@components/IntegrityCheckFrameHost'
import { useIntegrityAccessStore } from '@hooks/useIntegrityAccessStore.web'
import { useIntegrityAccessDiagnostics } from '../useIntegrityAccessDiagnostics.web'

const access = vi.hoisted(() => ({
    state: { status: 'ready', expiresAt: 0 } as IntegrityAccessState,
}))

vi.mock('@hooks/useIntegrityAccessState.web', () => ({
    useIntegrityAccessState: () => ({
        state: access.state,
        retry: vi.fn(),
        verify: vi.fn(),
    }),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-browser-runtime')
    >()),
    sendIntegrityControl: vi.fn(),
}))

const NOW = Date.parse('2026-10-19T12:00:00.000Z')

const SNAPSHOT: IntegritySnapshot = {
    tokenExpiresAt: null,
    mintBackoff: { failures: 2, nextAttemptAt: NOW + 600_000 },
    enrolBackoff: { failures: 1, nextAttemptAt: NOW + 300_000 },
    attempt: null,
    enrolNeededAt: null,
    lastFailure: null,
    revocations: 0,
}

describe('useIntegrityAccessDiagnostics', () => {
    beforeEach(() => {
        useIntegrityAccessStore.getState().resetState()
        useIntegrityCheckFrameStore.getState().hide()
        vi.mocked(sendIntegrityControl).mockClear()
    })

    it('names the state, its cause and both backoffs', () => {
        access.state = {
            status: 'degraded',
            reason: 'service',
            cause: 'mint-5xx',
            nextAttemptAt: NOW + 600_000,
        }
        act(() =>
            useIntegrityAccessStore.getState().applySnapshot(SNAPSHOT, NOW),
        )

        const { result } = renderHook(() => useIntegrityAccessDiagnostics())

        expect(result.current.accessState).toBe('degraded/service')
        expect(result.current.cause).toBe('mint-5xx')
        expect(result.current.nextAttempt).toBe(
            'mint 2026-10-19T12:10:00.000Z (2) · enrol 2026-10-19T12:05:00.000Z (1)',
        )
    })

    it('reads a live check with its surface and no cause', () => {
        access.state = { status: 'checking', surface: 'tab' }

        const { result } = renderHook(() => useIntegrityAccessDiagnostics())

        expect(result.current.accessState).toBe('checking/tab')
        expect(result.current.cause).toBeNull()
        expect(result.current.nextAttempt).toBeNull()
    })

    it('forces an enrolment through the check host', () => {
        const { result } = renderHook(() => useIntegrityAccessDiagnostics())

        act(() => result.current.onForceEnrol())

        expect(useIntegrityCheckFrameStore.getState().verifyNonce).toBe(1)
    })

    it('clears the backoffs by asking the worker to mint now', () => {
        const { result } = renderHook(() => useIntegrityAccessDiagnostics())

        act(() => result.current.onClearBackoff())

        expect(sendIntegrityControl).toHaveBeenCalledWith({ kind: 'retry' })
    })
})
