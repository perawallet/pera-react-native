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

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

type MockQuery = {
    state: { data?: { verificationState: string | null } }
}
type MockQueryOptions = {
    onboardingId: string | null
    enabled?: boolean
    refetchInterval?: number | false | ((query: MockQuery) => number | false)
}

const mockRefetch = vi.fn()
let mockVerificationState: string | null | undefined
let mockIsLoading = false
let mockDataUpdatedAt = 0
let mockErrorUpdatedAt = 0
let mockQueryOptions: MockQueryOptions | undefined
let mockOnboardingStep = 'VERIFICATION'

const queryData = () =>
    mockVerificationState === undefined
        ? undefined
        : { verificationState: mockVerificationState }

// Stub the wrapped query and the store directly (the two sibling modules the
// hook composes) so the poll/give-up mechanics are exercised in isolation.
// `VerificationState` from ../models stays real, so the hook's state
// comparisons match the strings driven below.
vi.mock('../useOnboardingDetailsQuery', () => ({
    useOnboardingDetailsQuery: (options: MockQueryOptions) => {
        mockQueryOptions = options
        return {
            data: queryData(),
            isLoading: mockIsLoading,
            refetch: mockRefetch,
            dataUpdatedAt: mockDataUpdatedAt,
            errorUpdatedAt: mockErrorUpdatedAt,
        }
    },
}))

vi.mock('../../store', () => ({
    useCardStore: (
        selector: (state: {
            onboardingId: string | null
            onboardingStep: string
        }) => unknown,
    ) =>
        selector({
            onboardingId: 'mock-onboarding-id',
            onboardingStep: mockOnboardingStep,
        }),
}))

import { useOnboardingKycPoll } from '../useOnboardingKycPoll'

/** Evaluates the interval the hook would schedule for the current data. */
const scheduledInterval = () => {
    const interval = mockQueryOptions?.refetchInterval
    return typeof interval === 'function'
        ? interval({ state: { data: queryData() } })
        : interval
}

beforeEach(() => {
    vi.clearAllMocks()
    mockVerificationState = undefined
    mockIsLoading = false
    mockDataUpdatedAt = 0
    mockErrorUpdatedAt = 0
    mockQueryOptions = undefined
    mockOnboardingStep = 'VERIFICATION'
})

describe('useOnboardingKycPoll', () => {
    it('exposes the polled state and keeps polling while a decision is pending', () => {
        mockVerificationState = 'PENDING'
        const { result } = renderHook(() => useOnboardingKycPoll())

        expect(result.current.verificationState).toBe('PENDING')
        expect(result.current.hasPollTimedOut).toBe(false)
        expect(result.current.isStateUnknown).toBe(false)
        expect(scheduledInterval()).not.toBe(false)
    })

    it('stops polling once the decision lands', () => {
        mockVerificationState = 'VERIFIED'
        renderHook(() => useOnboardingKycPoll())

        expect(scheduledInterval()).toBe(false)
    })

    it('passes the enabled gate through to the query', () => {
        renderHook(() => useOnboardingKycPoll({ enabled: false }))

        expect(mockQueryOptions?.enabled).toBe(false)
    })

    // The final address step consumes the onboarding session server-side, so
    // GET register only answers "Invalid onboarding ID" afterwards. Keeping
    // the poll running would burn 3 failing calls and flip a PENDING row into
    // a bogus timed-out error.
    it('self-disables once registration completes, even when the caller enables it', () => {
        mockOnboardingStep = 'COMPLETED'
        renderHook(() => useOnboardingKycPoll({ enabled: true }))

        expect(mockQueryOptions?.enabled).toBe(false)
    })

    it('gives up after consecutive poll failures', () => {
        const { result, rerender } = renderHook(() => useOnboardingKycPoll())

        // Three consecutive failed polls (retry: 0 surfaces each error).
        for (const timestamp of [1, 2, 3]) {
            mockErrorUpdatedAt = timestamp
            act(() => rerender())
        }

        expect(result.current.hasPollTimedOut).toBe(true)
        expect(scheduledInterval()).toBe(false)
    })

    it('resets the failure streak when a poll succeeds in between', () => {
        mockVerificationState = 'PENDING'
        const { result, rerender } = renderHook(() => useOnboardingKycPoll())

        for (const timestamp of [1, 2]) {
            mockErrorUpdatedAt = timestamp
            act(() => rerender())
        }
        // A successful poll clears the streak…
        mockDataUpdatedAt = 10
        act(() => rerender())
        // …so a third failure is a fresh streak of one, not the limit.
        mockErrorUpdatedAt = 11
        act(() => rerender())

        expect(result.current.hasPollTimedOut).toBe(false)
    })

    it('gives up after the record stays UNVERIFIED for the whole poll budget', () => {
        mockVerificationState = 'UNVERIFIED'
        const { result, rerender } = renderHook(() => useOnboardingKycPoll())

        for (let poll = 1; poll <= 15; poll += 1) {
            mockDataUpdatedAt = poll
            act(() => rerender())
        }

        expect(result.current.hasPollTimedOut).toBe(true)
    })

    it('gives up after the record stays unmodelled (unknown) for the poll budget', () => {
        // The endpoint maps unknown server states to null (data present). An
        // unknown state is "not reported back", so it must give up like
        // UNVERIFIED rather than poll forever.
        mockVerificationState = null
        const { result, rerender } = renderHook(() => useOnboardingKycPoll())

        for (let poll = 1; poll <= 15; poll += 1) {
            mockDataUpdatedAt = poll
            act(() => rerender())
        }

        expect(result.current.isStateUnknown).toBe(true)
        expect(result.current.hasPollTimedOut).toBe(true)
        expect(scheduledInterval()).toBe(false)
    })

    it('clears a stale give-up when the state transitions to a reported-back one', () => {
        mockVerificationState = 'UNVERIFIED'
        const { result, rerender } = renderHook(() => useOnboardingKycPoll())
        for (let poll = 1; poll <= 15; poll += 1) {
            mockDataUpdatedAt = poll
            act(() => rerender())
        }
        expect(result.current.hasPollTimedOut).toBe(true)

        // Baanx later reports PENDING (e.g. via the shared query cache) — the
        // stale UNVERIFIED give-up must clear so the row shows pending and the
        // poll resumes toward the decision.
        mockVerificationState = 'PENDING'
        mockDataUpdatedAt = 16
        act(() => rerender())

        expect(result.current.hasPollTimedOut).toBe(false)
        expect(scheduledInterval()).not.toBe(false)
    })

    it('mirrors the query loading flag (not a disabled/errored query)', () => {
        // Sourced from React Query's `isLoading`, so a disabled or errored query
        // (no data, but not fetching) reports false — consumers then fall
        // through to an actionable row instead of a stuck neutral one.
        mockIsLoading = true
        const { result, rerender } = renderHook(() => useOnboardingKycPoll())
        expect(result.current.isLoading).toBe(true)

        mockIsLoading = false
        mockVerificationState = 'PENDING'
        mockDataUpdatedAt = 1
        act(() => rerender())

        expect(result.current.isLoading).toBe(false)
    })

    it('does not report an unknown state before any data arrives', () => {
        const { result } = renderHook(() => useOnboardingKycPoll())

        expect(result.current.verificationState).toBeNull()
        expect(result.current.isStateUnknown).toBe(false)
    })

    it('restartPolling clears the give-up state and refetches', () => {
        const { result, rerender } = renderHook(() => useOnboardingKycPoll())
        for (const timestamp of [1, 2, 3]) {
            mockErrorUpdatedAt = timestamp
            act(() => rerender())
        }
        expect(result.current.hasPollTimedOut).toBe(true)

        act(() => {
            result.current.restartPolling()
        })

        expect(result.current.hasPollTimedOut).toBe(false)
        expect(mockRefetch).toHaveBeenCalled()
        expect(scheduledInterval()).not.toBe(false)
    })
})
