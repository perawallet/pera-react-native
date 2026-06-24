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

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
    getSignRequestsWithSignatures,
    getSignRequestsWithSignaturesQueryKey,
    type SignRequestResponse,
} from '@perawallet/wallet-core-multisig'
import type { SwapHandoffRecord } from '../models'

/** Poll cadence while the backend is responding. */
const BASE_POLL_INTERVAL_MS = 3000
/** Slower cadence right after a failed poll, so a down backend isn't hammered. */
const ERROR_POLL_INTERVAL_MS = 30_000

/** A handoff paired with the latest `with-signatures` poll result for it. */
export type SwapHandoffPoll = {
    handoff: SwapHandoffRecord
    detail: SignRequestResponse | undefined
}

export type UseSwapHandoffPollsArgs = {
    /** Handoffs to poll (caller filters to the active network). */
    handoffs: SwapHandoffRecord[]
    /** Device id for the `with-signatures` request; polling is off until set. */
    deviceId: string | null
    /** Polling pauses when false (e.g. app backgrounded — iOS suspends timers). */
    isAppActive: boolean
}

/**
 * Polls `POST /sign-requests/with-signatures/` for each pending swap handoff
 * and returns each handoff paired with its latest poll result.
 *
 * `useQueries` handles the dynamic handoff count; the cadence backs off after a
 * failed poll so a down backend isn't hammered. Pure data layer — classifying
 * and acting on a result is the resolver's job ({@link useSwapCosignResolver}).
 */
export const useSwapHandoffPolls = ({
    handoffs,
    deviceId,
    isAppActive,
}: UseSwapHandoffPollsArgs): SwapHandoffPoll[] => {
    const queries = useMemo(
        () =>
            handoffs.map(handoff => ({
                queryKey: getSignRequestsWithSignaturesQueryKey(
                    handoff.network,
                    handoff.signRequestId,
                ),
                queryFn: () =>
                    getSignRequestsWithSignatures(handoff.network, {
                        device_id: deviceId ?? '',
                        proposed_sign_request_ids: [handoff.signRequestId],
                    }),
                select: (data: SignRequestResponse[]) =>
                    data.find(item => item.id === handoff.signRequestId),
                enabled: isAppActive && !!deviceId,
                staleTime: 0,
                gcTime: 0,
                refetchInterval: (query: { state: { status: string } }) =>
                    query.state.status === 'error'
                        ? ERROR_POLL_INTERVAL_MS
                        : BASE_POLL_INTERVAL_MS,
            })),
        [handoffs, isAppActive, deviceId],
    )

    const results = useQueries({ queries })

    return useMemo(
        () =>
            results.map((result, index) => ({
                handoff: handoffs[index],
                detail: result.data,
            })),
        [results, handoffs],
    )
}
