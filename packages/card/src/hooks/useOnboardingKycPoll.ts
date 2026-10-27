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
import { type ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { getCardApiError, isOnboardingNotFoundError } from '../api/errors'
import { OnboardingPhase, OnboardingStep, VerificationState } from '../models'
import { useCardStore } from '../store'
import { useCardSession } from './useCardSession'
import { useCardUserQuery } from './useCardUserQuery'
import { useOnboardingDetailsQuery } from './useOnboardingDetailsQuery'

/** Re-check cadence right after the user returns from the KYC session. */
const ACTIVE_POLL_INTERVAL_MS = 4000

/** A Sumsub review can take far longer than a minute, so the wait slows down. */
const BACKOFF_POLL_INTERVAL_MS = 15_000
const ACTIVE_POLL_WINDOW_MS = 60_000

/** Consecutive poll failures (~12s) before giving up. */
const POLL_FAILURE_LIMIT = 3

/**
 * Consecutive "not reported back" polls (~60s) before giving up. A record that
 * stays UNVERIFIED (or on a state we don't model) means the KYC provider never
 * reported a result; polling it can't move it, so we stop and let the consumer act.
 */
const STUCK_POLL_LIMIT = 15

const isDecided = (state: Nullable<VerificationState>): boolean =>
    state === VerificationState.Verified || state === VerificationState.Rejected

export type UseOnboardingKycPollOptions = {
    /** Gates polling (e.g. only once a KYC session has been opened). */
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
    /**
     * The onboarding record says Baanx has created the account: its phase is
     * ACCOUNT, or the record no longer resolves. Free to watch, unlike a login.
     */
    hasAccountSignal: boolean
    /** Clears the give-up state and counters, then re-arms with a fresh fetch. */
    restartPolling: () => void
    refetch: () => void
}

/**
 * Polls the onboarding KYC state and knows when to give up. Shared by the
 * setup-status checklist and the verification entry screen so both stop
 * hammering a dead record and can surface an explicit error instead.
 * Before the account exists it reads the pre-auth onboarding record; once a
 * card session exists it reads the authenticated user, since the onboarding
 * record is no longer the source of truth for a registered user.
 */
export const useOnboardingKycPoll = (
    scope: ChainScope,
    { enabled = true }: UseOnboardingKycPollOptions = {},
): UseOnboardingKycPollResult => {
    const onboardingId = useCardStore(state => state.onboardingId)
    const isRegistrationComplete = useCardStore(
        state => state.onboardingStep === OnboardingStep.Completed,
    )
    const { isAuthenticated } = useCardSession()
    const [hasPollTimedOut, setHasPollTimedOut] = useState(false)
    const pollStartedAtRef = useRef(Date.now())

    // Function form so polling stops on the very fetch that lands a decision,
    // with no mirror state and no one-render lag.
    const nextPollInterval = (
        state: Nullable<VerificationState>,
        isAccountCreated: boolean,
    ): number | false => {
        if (hasPollTimedOut || state === VerificationState.Rejected) {
            return false
        }
        // A verified record keeps being watched until Baanx turns it into an
        // account, which is what lets the post-KYC login run.
        if (isDecided(state) && isAccountCreated) return false
        return Date.now() - pollStartedAtRef.current < ACTIVE_POLL_WINDOW_MS
            ? ACTIVE_POLL_INTERVAL_MS
            : BACKOFF_POLL_INTERVAL_MS
    }

    const [isRecordGone, setIsRecordGone] = useState(false)
    const [classifiedRecordError, setClassifiedRecordError] =
        useState<unknown>(null)
    const onboardingQuery = useOnboardingDetailsQuery(scope, {
        onboardingId,
        enabled: enabled && !isAuthenticated && !isRegistrationComplete,
        refetchInterval: query =>
            isRecordGone
                ? false
                : nextPollInterval(
                      query.state.data?.verificationState ?? null,
                      query.state.data?.phase === OnboardingPhase.Account,
                  ),
    })
    const userQuery = useCardUserQuery(scope, {
        enabled: enabled && isAuthenticated,
        refetchInterval: query =>
            nextPollInterval(query.state.data?.verificationState ?? null, true),
    })
    const recordError = onboardingQuery.error
    useEffect(() => {
        if (!recordError) return
        let isCurrent = true
        void getCardApiError(recordError).then(apiError => {
            if (!isCurrent) return
            if (isOnboardingNotFoundError(apiError)) setIsRecordGone(true)
            setClassifiedRecordError(recordError)
        })
        return () => {
            isCurrent = false
        }
    }, [recordError])
    const hasAccountSignal =
        !isAuthenticated &&
        (onboardingQuery.data?.phase === OnboardingPhase.Account ||
            isRecordGone)
    const { data, isLoading, refetch, dataUpdatedAt, errorUpdatedAt } =
        isAuthenticated ? userQuery : onboardingQuery

    // Baanx only turns a record into an account once KYC verifies, and a cold
    // start after that finds no record to read the verdict from.
    const verificationState =
        !isAuthenticated && isRecordGone
            ? VerificationState.Verified
            : (data?.verificationState ?? null)
    // Until a record error is read, it may still turn out to mean verified.
    const isReadingRecordError =
        !isAuthenticated &&
        data === undefined &&
        recordError !== null &&
        recordError !== classifiedRecordError
    const isStateUnknown =
        data !== undefined && data !== null && verificationState === null
    // React Query's own loading flag — true only while the first fetch is
    // actually in flight; false when the query is disabled (no onboardingId) or
    // has errored with no data. Using `data === undefined` here would pin a
    // disabled/failed query to a neutral "loading" row with no recovery action.
    // "Reported back" = a modelled decision/review state (PENDING/VERIFIED/
    // REJECTED). UNVERIFIED and unknown (null-with-data) are "not reported".
    const hasReportedBack =
        verificationState !== null &&
        verificationState !== VerificationState.Unverified

    useEffect(() => {
        if (enabled) pollStartedAtRef.current = Date.now()
    }, [enabled])

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
        pollStartedAtRef.current = Date.now()
        setHasPollTimedOut(false)
        void refetch()
    }, [refetch])

    const stableRefetch = useCallback(() => {
        void refetch()
    }, [refetch])

    return {
        verificationState,
        isStateUnknown,
        isLoading: isLoading || isReadingRecordError,
        hasPollTimedOut,
        hasAccountSignal,
        restartPolling,
        refetch: stableRefetch,
    }
}
