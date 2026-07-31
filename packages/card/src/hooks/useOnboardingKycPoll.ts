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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { OnboardingStep, VerificationState } from '../models'
import { useCardStore } from '../store'
import { useOnboardingDetailsQuery } from './useOnboardingDetailsQuery'

/** How often we re-check the KYC state while a decision is pending. */
const POLL_INTERVAL_MS = 4000

/** Consecutive poll failures (~12s) before giving up. */
const POLL_FAILURE_LIMIT = 3

/**
 * Consecutive "not reported back" polls (~60s) before giving up. A record that
 * stays UNVERIFIED (or on a state we don't model) means Veriff never reported a
 * result — polling it can't move it, so we stop and let the consumer act.
 */
const STUCK_POLL_LIMIT = 15

export type UseOnboardingKycPollOptions = {
    /** Gates polling (e.g. only once a Veriff session has been opened). */
    enabled?: boolean
}

export type UseOnboardingKycPollResult = {
    /** Modelled KYC state; null while unfetched or on an unmodelled state. */
    verificationState: Nullable<VerificationState>
    /** Server reported a state we don't model (data present, unrecognised). */
    isStateUnknown: boolean
    /** No KYC state has been fetched yet — consumers avoid rendering an
     * actionable row until the first result lands. */
    isLoading: boolean
    /** Polling gave up: repeated failures, or the record never reported a
     * result (UNVERIFIED/unknown) for the whole budget. */
    hasPollTimedOut: boolean
    /** Clears the give-up state and counters, then re-arms with a fresh fetch. */
    restartPolling: () => void
    refetch: () => void
}

/**
 * Polls the onboarding KYC state and knows when to give up. Shared by the
 * setup-status checklist and the verification entry screen so both stop
 * hammering a dead record and can surface an explicit error instead.
 * Self-disables once registration completes: the final address step consumes
 * the onboarding session server-side, so GET register only answers
 * "Invalid onboarding ID" from then on and the KYC decision must be tracked
 * via the authenticated user record instead.
 */
export const useOnboardingKycPoll = ({
    enabled = true,
}: UseOnboardingKycPollOptions = {}): UseOnboardingKycPollResult => {
    const onboardingId = useCardStore(state => state.onboardingId)
    const isRegistrationComplete = useCardStore(
        state => state.onboardingStep === OnboardingStep.Completed,
    )
    const [hasPollTimedOut, setHasPollTimedOut] = useState(false)

    const { data, isLoading, refetch, dataUpdatedAt, errorUpdatedAt } =
        useOnboardingDetailsQuery({
            onboardingId,
            enabled: enabled && !isRegistrationComplete,
            // Function form so polling stops on the very fetch that lands a
            // decision — no mirror state, no one-render lag.
            refetchInterval: query => {
                if (hasPollTimedOut) return false
                const state = query.state.data?.verificationState ?? null
                const isDecided =
                    state === VerificationState.Verified ||
                    state === VerificationState.Rejected
                return isDecided ? false : POLL_INTERVAL_MS
            },
        })

    const verificationState = data?.verificationState ?? null
    const isStateUnknown = data !== undefined && data.verificationState === null
    // React Query's own loading flag — true only while the first fetch is
    // actually in flight; false when the query is disabled (no onboardingId) or
    // has errored with no data. Using `data === undefined` here would pin a
    // disabled/failed query to a neutral "loading" row with no recovery action.
    // "Reported back" = a modelled decision/review state (PENDING/VERIFIED/
    // REJECTED). UNVERIFIED and unknown (null-with-data) are "not reported".
    const hasReportedBack =
        verificationState !== null &&
        verificationState !== VerificationState.Unverified

    const pollFailuresRef = useRef(0)
    const unresolvedPollsRef = useRef(0)
    useEffect(() => {
        if (!errorUpdatedAt) return
        pollFailuresRef.current += 1
        if (pollFailuresRef.current >= POLL_FAILURE_LIMIT) {
            setHasPollTimedOut(true)
        }
    }, [errorUpdatedAt])
    useEffect(() => {
        if (!dataUpdatedAt) return
        pollFailuresRef.current = 0
        if (hasReportedBack) {
            // A real result landed: clear the counter and any stale give-up
            // (e.g. one earned earlier while UNVERIFIED, now that a late PENDING
            // has arrived via the shared cache) so the row/poll recover.
            unresolvedPollsRef.current = 0
            setHasPollTimedOut(false)
        } else {
            unresolvedPollsRef.current += 1
            if (unresolvedPollsRef.current >= STUCK_POLL_LIMIT) {
                setHasPollTimedOut(true)
            }
        }
    }, [dataUpdatedAt, hasReportedBack])

    const restartPolling = useCallback(() => {
        pollFailuresRef.current = 0
        unresolvedPollsRef.current = 0
        setHasPollTimedOut(false)
        void refetch()
    }, [refetch])

    const stableRefetch = useCallback(() => {
        void refetch()
    }, [refetch])

    return {
        verificationState,
        isStateUnknown,
        isLoading,
        hasPollTimedOut,
        restartPolling,
        refetch: stableRefetch,
    }
}
