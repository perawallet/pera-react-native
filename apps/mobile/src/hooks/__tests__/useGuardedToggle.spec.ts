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

import { renderHook } from '@test-utils/render'
import { act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { assertOnline, NoConnectionError } from '@perawallet/wallet-core-shared'

const mocks = vi.hoisted(() => ({ showError: vi.fn() }))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mocks.showError }),
}))

vi.mock('@hooks/useLanguage')

import { useGuardedToggle } from '../useGuardedToggle'

const steps = () => ({
    write: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn(),
})

describe('useGuardedToggle', () => {
    let inFlight: Set<string>

    beforeEach(() => {
        vi.clearAllMocks()
        inFlight = new Set()
    })

    it('writes, then commits, and resolves true without rolling back', async () => {
        const { result } = renderHook(() => useGuardedToggle(inFlight))
        const toggle = steps()
        toggle.commit.mockImplementation(async () => {
            expect(toggle.write).toHaveBeenCalled()
        })

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.runToggle(['a'], toggle)
        })

        expect(outcome).toBe(true)
        expect(toggle.commit).toHaveBeenCalledTimes(1)
        expect(toggle.rollback).not.toHaveBeenCalled()
        expect(mocks.showError).not.toHaveBeenCalled()
        expect(inFlight.size).toBe(0)
    })

    it('rolls back and shows the error when the commit rejects', async () => {
        const { result } = renderHook(() => useGuardedToggle(inFlight))
        const toggle = steps()
        const error = new Error('boom')
        toggle.commit.mockRejectedValue(error)

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.runToggle(['a'], toggle)
        })

        expect(outcome).toBe(false)
        expect(toggle.rollback).toHaveBeenCalledTimes(1)
        expect(mocks.showError).toHaveBeenCalledWith(
            error,
            'common.error.title',
        )
        expect(inFlight.size).toBe(0)
    })

    it('rolls back offline without committing', async () => {
        vi.mocked(assertOnline).mockImplementationOnce(() => {
            throw new NoConnectionError()
        })
        const { result } = renderHook(() => useGuardedToggle(inFlight))
        const toggle = steps()

        let outcome: boolean | undefined
        await act(async () => {
            outcome = await result.current.runToggle(['a'], toggle)
        })

        expect(outcome).toBe(false)
        expect(toggle.commit).not.toHaveBeenCalled()
        expect(toggle.rollback).toHaveBeenCalledTimes(1)
    })

    it('refuses a toggle sharing a key with one in flight from any instance, and reports pending only to the starter', async () => {
        const first = renderHook(() => useGuardedToggle(inFlight))
        const second = renderHook(() => useGuardedToggle(inFlight))
        let settle: () => void = () => undefined
        const running = steps()
        running.commit.mockReturnValue(
            new Promise<void>(resolve => {
                settle = resolve
            }),
        )

        let firstRun: Promise<boolean> | undefined
        act(() => {
            firstRun = first.result.current.runToggle(['a', 'b'], running)
        })

        expect(first.result.current.isTogglePending('b')).toBe(true)
        expect(second.result.current.isTogglePending('b')).toBe(false)

        const refused = steps()
        let refusedOutcome: boolean | undefined
        await act(async () => {
            refusedOutcome = await second.result.current.runToggle(
                ['b', 'c'],
                refused,
            )
        })
        expect(refusedOutcome).toBe(false)
        expect(refused.write).not.toHaveBeenCalled()
        expect(refused.commit).not.toHaveBeenCalled()
        expect(refused.rollback).not.toHaveBeenCalled()

        await act(async () => {
            settle()
            await firstRun
        })

        expect(first.result.current.isTogglePending('b')).toBe(false)
        expect(inFlight.size).toBe(0)
    })
})
