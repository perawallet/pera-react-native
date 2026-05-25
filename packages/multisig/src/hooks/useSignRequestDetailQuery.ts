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

import { useCallback } from 'react'
import {
    useQuery,
    useQueryClient,
    type UseQueryResult,
} from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import type { MultisigSignRequest } from '../models'
import {
    getSignRequestDetail,
    type SignRequestDetailResponse,
} from '../api'
import { IN_FLIGHT_SIGN_REQUEST_STATUSES } from '../constants'
import { mapSignRequest } from '../mappers'
import { getSignRequestDetailQueryKey } from './querykeys'

type UseSignRequestDetailQueryParams = {
    network: Network
    deviceId: string
    signRequestId: string
    enabled?: boolean
    pollWhilePending?: boolean
}

const PENDING_POLL_INTERVAL = 5000

export const useSignRequestDetailQuery = ({
    network,
    deviceId,
    signRequestId,
    enabled = true,
    pollWhilePending = false,
}: UseSignRequestDetailQueryParams): UseQueryResult<
    MultisigSignRequest,
    Error
> => {
    const queryClient = useQueryClient()
    const queryKey = getSignRequestDetailQueryKey(network, signRequestId)

    return useQuery({
        queryKey,
        // Backfill `proposer_address` from the previous cached value when
        // the search endpoint that backs `getSignRequestDetail` omits it
        // (the field is `.nullable().optional()` in the response schema
        // and some backend deployments only include it on the propose /
        // cosign POST responses, not on subsequent reads). Losing it
        // mid-poll strips the proposer's Cancel button from the pending
        // signatures sheet — see `useMultisigSignRequestDecline`. This is
        // the read-path counterpart to the write-path preservation in
        // `useMultisigTransportAdapters`.
        queryFn: async () => {
            const fresh = await getSignRequestDetail(
                network,
                deviceId,
                signRequestId,
            )
            if (fresh.proposer_address != null) return fresh
            const previous =
                queryClient.getQueryData<SignRequestDetailResponse>(queryKey)
            if (!previous?.proposer_address) return fresh
            return { ...fresh, proposer_address: previous.proposer_address }
        },
        enabled: enabled && !!signRequestId && !!deviceId,
        select: useCallback(mapSignRequest, []),
        refetchInterval: pollWhilePending
            ? data => {
                  const status = data.state.data?.status
                  if (status && IN_FLIGHT_SIGN_REQUEST_STATUSES.has(status)) {
                      return PENDING_POLL_INTERVAL
                  }
                  return false
              }
            : undefined,
    })
}
