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

import { useCallback, useEffect, useRef } from 'react'
import {
    useMutationState,
    useQueryClient,
    type Mutation,
} from '@tanstack/react-query'
import type { Nullable, Optional } from '@perawallet/wallet-core-shared'
import { CardOrderNotVerifiedError } from '../api/card'
import { CardStatus, VerificationState, isKycVerified } from '../models'
import type { Card } from '../models'
import { cardMutationKeys } from './querykeys'
import { useCardStatusQuery } from './useCardStatusQuery'
import { useCardUserQuery } from './useCardUserQuery'
import { useOrderCardMutation } from './useOrderCardMutation'

/**
 * Poll cadence for a just-ordered card until it turns ACTIVE. Baanx documents
 * provisioning as "typically instant", worst case ~2 minutes.
 */
const STATUS_POLL_MS = 5000

/**
 * Poll cadence for the KYC decision while the dashboard waits with no card.
 * Deliberately slower than onboarding's 4s active-wait: this is an idle
 * background watch, not a "user just finished Veriff" moment.
 */
const USER_POLL_MS = 15_000

export const CardIssuanceState = {
    /** Card/user state not known yet (first fetch, or a cold fetch error). */
    Loading: 'LOADING',
    /** No card, and KYC is not decided yet (or not fetched): wait. */
    VerificationPending: 'VERIFICATION_PENDING',
    /** KYC REJECTED: terminal, a card can never be issued for this user. */
    VerificationRejected: 'VERIFICATION_REJECTED',
    /** Order in flight or accepted, or the card is provisioning (PENDING). */
    Issuing: 'ISSUING',
    /** The order attempt failed for a non-KYC reason: offer a retry. */
    OrderFailed: 'ORDER_FAILED',
    /** The Baanx card exists: the dashboard can show real card affordances. */
    Ready: 'READY',
} as const
export type CardIssuanceState =
    (typeof CardIssuanceState)[keyof typeof CardIssuanceState]

export type UseCardIssuanceResult = {
    state: CardIssuanceState
    /** Fires a fresh order after a failed attempt (OrderFailed only). */
    retryOrder: () => void
    /** The Baanx card, once the status query has one. `null` when there is no
     *  card yet, `undefined` while the first fetch is in flight. */
    card: Optional<Nullable<Card>>
    /** True when the status query is paused waiting for connectivity. */
    isStatusPaused: boolean
}

type OrderAttempt = {
    status: 'idle' | 'pending' | 'success' | 'error'
    error: unknown
    /** `Date.now()` when the attempt started; 0 for a never-submitted entry. */
    submittedAt: number
}

/**
 * A "blocking" attempt disarms auto-ordering: an attempt that is running,
 * has succeeded (issuance is now the status query's job), or failed for a
 * real reason (surfaced as OrderFailed with an explicit retry). A refusal
 * because KYC isn't VERIFIED yet is NOT blocking: the user cache gets
 * invalidated and the flow legitimately returns to the pending wait.
 */
const isBlockingAttempt = (attempt: OrderAttempt): boolean => {
    if (attempt.status === 'pending' || attempt.status === 'success') {
        return true
    }
    return (
        attempt.status === 'error' &&
        !(attempt.error instanceof CardOrderNotVerifiedError)
    )
}

const isBlockingMutation = (mutation: Mutation): boolean =>
    isBlockingAttempt({
        status: mutation.state.status,
        error: mutation.state.error,
        submittedAt: mutation.state.submittedAt,
    })

/**
 * Owns getting the user from "onboarding finished" to "Baanx card exists".
 *
 * Baanx card issuance is client-initiated only (`POST /v1/card/order`) and
 * requires KYC VERIFIED, while onboarding deliberately completes with KYC
 * still PENDING. So the dashboard: watches the KYC state while there is no
 * card (15s poll, stops on a decision), auto-orders once per mount per
 * verified window when VERIFIED with no card on file (re-entering the
 * dashboard re-arms it), then polls the card status (5s) until the card
 * leaves its transient provisioning state.
 *
 * Safe to mount from several components at once: coordination runs through
 * the shared query cache and the `cardMutationKeys.order` mutation cache
 * entry (the same cross-caller pattern as freeze/unfreeze), so concurrent
 * instances observe one shared attempt instead of firing their own.
 *
 * Fail-neutral by design: a cold status-query error reports `Loading` (no
 * wrong affordances, refetch-on-reconnect recovers), and after a failed
 * order the explicit `retryOrder` is the recovery path; auto-fire stays
 * disarmed so a broken backend is never hammered.
 */
export const useCardIssuance = (): UseCardIssuanceResult => {
    const queryClient = useQueryClient()

    // Every order attempt under the shared key, whichever mounted instance
    // fired it. Cache order isn't part of TanStack's contract, so pick the
    // newest by `submittedAt` rather than trusting position.
    const orderAttempts = useMutationState({
        filters: { mutationKey: cardMutationKeys.order },
        select: (mutation): OrderAttempt => ({
            status: mutation.state.status,
            error: mutation.state.error,
            submittedAt: mutation.state.submittedAt,
        }),
    })
    const latestAttempt = orderAttempts.reduce<OrderAttempt | undefined>(
        (newest, attempt) =>
            newest === undefined || attempt.submittedAt >= newest.submittedAt
                ? attempt
                : newest,
        undefined,
    )
    const isOrderInFlight = latestAttempt?.status === 'pending'
    const hasOrderSucceeded = latestAttempt?.status === 'success'

    const statusQuery = useCardStatusQuery({
        // Poll while issuance is in motion: order accepted (or still in
        // flight) but the card not visible yet, or the card is visible but
        // still provisioning. This is the docs' "poll until ACTIVE".
        refetchInterval: query => {
            const card = query.state.data
            const shouldPoll =
                card == null
                    ? isOrderInFlight || hasOrderSucceeded
                    : card.status === CardStatus.Pending
            return shouldPoll ? STATUS_POLL_MS : false
        },
    })
    // Strict null: `undefined` means "not fetched yet" and must not count as
    // "has no card", or loading would briefly claim the card is missing.
    const hasNoCard = statusQuery.data === null

    const userQuery = useCardUserQuery({
        // The KYC watch only exists while there is no card: card-holders
        // never trigger dashboard /v1/user traffic.
        enabled: hasNoCard,
        refetchInterval: query => {
            if (query.state.status === 'error') return false
            const state = query.state.data?.verificationState
            const isDecided =
                state === VerificationState.Verified ||
                state === VerificationState.Rejected
            return isDecided ? false : USER_POLL_MS
        },
    })
    const verificationState = userQuery.data?.verificationState
    const isVerified = isKycVerified(verificationState ?? null)

    const orderMutation = useOrderCardMutation()
    const { mutate: mutateOrder } = orderMutation

    const hasBlockingAttempt =
        latestAttempt !== undefined && isBlockingAttempt(latestAttempt)
    const shouldAutoOrder = hasNoCard && isVerified && !hasBlockingAttempt

    // One auto-attempt per verified window. The ref latch resets only when
    // the user leaves VERIFIED, which breaks the pathological loop where
    // /v1/user says VERIFIED but the order endpoint keeps refusing (fire,
    // refusal, user invalidated, still VERIFIED, fire again, forever).
    const hasFiredThisWindowRef = useRef(false)
    useEffect(() => {
        if (!isVerified) {
            hasFiredThisWindowRef.current = false
            return
        }
        if (!shouldAutoOrder || hasFiredThisWindowRef.current) return
        // Live re-check against the mutation cache: two instances mounting in
        // the same commit (dashboard shell + details tab) both pass the
        // render-time check, but only the first one finds the cache empty.
        // Also covers StrictMode's double-invoked effects.
        const hasSharedAttempt = queryClient
            .getMutationCache()
            .findAll({ mutationKey: cardMutationKeys.order })
            .some(isBlockingMutation)
        if (hasSharedAttempt) return
        hasFiredThisWindowRef.current = true
        mutateOrder()
    }, [isVerified, shouldAutoOrder, queryClient, mutateOrder])

    const retryOrder = useCallback(() => {
        if (queryClient.isMutating({ mutationKey: cardMutationKeys.order })) {
            return
        }
        mutateOrder()
    }, [queryClient, mutateOrder])

    const card = statusQuery.data
    let state: CardIssuanceState
    if (card) {
        state =
            card.status === CardStatus.Pending
                ? CardIssuanceState.Issuing
                : CardIssuanceState.Ready
    } else if (card === undefined) {
        // First fetch, or a cold fetch error: fail neutral.
        state = CardIssuanceState.Loading
    } else if (isOrderInFlight || hasOrderSucceeded) {
        // Succeeded-but-still-404 bridges the gap until the invalidated
        // status query sees the provisioning card.
        state = CardIssuanceState.Issuing
    } else if (hasBlockingAttempt) {
        // Only a settled non-KYC failure can reach here.
        state = CardIssuanceState.OrderFailed
    } else if (userQuery.data === undefined && !userQuery.isError) {
        state = CardIssuanceState.Loading
    } else if (verificationState === VerificationState.Rejected) {
        state = CardIssuanceState.VerificationRejected
    } else if (isVerified && latestAttempt?.status !== 'error') {
        // The effect above fires the order for this state in the same commit.
        // A lingering not-verified refusal (the only error that can reach
        // here) shows the pending view instead: that window's attempt is
        // spent and the invalidated user cache is being refreshed.
        state = CardIssuanceState.Issuing
    } else {
        state = CardIssuanceState.VerificationPending
    }

    return {
        state,
        retryOrder,
        // Re-exposed so consumers don't mount a second observer of the same
        // status query just to read the card.
        card,
        isStatusPaused: statusQuery.fetchStatus === 'paused',
    }
}
