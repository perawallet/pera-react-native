/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import {
    useCardStore,
    useOnboardingDetailsQuery,
    VerificationState,
} from '@perawallet/wallet-core-card'
import type { Nullable } from '@perawallet/wallet-core-shared'

/** How often we re-check the KYC state while a decision is pending. */
const POLL_INTERVAL_MS = 4000

/** Consecutive poll failures (~12s) before giving up. */
const POLL_FAILURE_LIMIT = 3

/**
 * Consecutive UNVERIFIED polls (~60s) before giving up. A record that stays
 * UNVERIFIED means the Veriff session never completed — polling it forever
 * can't help; only a fresh session can move it.
 */
const STUCK_UNVERIFIED_POLL_LIMIT = 15

export type UseOnboardingKycPollOptions = {
    /** Gates polling (e.g. only once a Veriff session has been opened). */
    enabled?: boolean
}

export type UseOnboardingKycPollResult = {
    /** Modelled KYC state; null while unfetched or on an unmodelled state. */
    verificationState: Nullable<VerificationState>
    /** Server reported a state we don't model — treated as progress (polls like
     * PENDING), not counted toward the stuck-UNVERIFIED give-up budget. */
    isStateUnknown: boolean
    /** Polling gave up (repeated failures or a never-progressing UNVERIFIED
     * record); consumers surface an error instead of waiting forever. */
    hasPollTimedOut: boolean
    /** Clears the give-up state and counters, then re-arms with a fresh fetch. */
    restartPolling: () => void
    refetch: () => void
}

/**
 * Polls the onboarding KYC state and knows when to give up. Shared by the
 * setup-status checklist and the verification entry screen so both stop
 * hammering a dead record and can surface an explicit error instead.
 */
export const useOnboardingKycPoll = ({
    enabled = true,
}: UseOnboardingKycPollOptions = {}): UseOnboardingKycPollResult => {
    const onboardingId = useCardStore(state => state.onboardingId)
    const [hasPollTimedOut, setHasPollTimedOut] = useState(false)

    const { data, refetch, dataUpdatedAt, errorUpdatedAt } =
        useOnboardingDetailsQuery({
            onboardingId,
            enabled,
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

    const pollFailuresRef = useRef(0)
    const unverifiedPollsRef = useRef(0)
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
        if (verificationState === VerificationState.Unverified) {
            unverifiedPollsRef.current += 1
            if (unverifiedPollsRef.current >= STUCK_UNVERIFIED_POLL_LIMIT) {
                setHasPollTimedOut(true)
            }
        } else {
            unverifiedPollsRef.current = 0
        }
    }, [dataUpdatedAt, verificationState])

    const restartPolling = useCallback(() => {
        pollFailuresRef.current = 0
        unverifiedPollsRef.current = 0
        setHasPollTimedOut(false)
        void refetch()
    }, [refetch])

    const stableRefetch = useCallback(() => {
        void refetch()
    }, [refetch])

    return {
        verificationState,
        isStateUnknown,
        hasPollTimedOut,
        restartPolling,
        refetch: stableRefetch,
    }
}
