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
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import type { MultisigSignRequest } from '../models'
import { getSignRequestDetail } from '../api/endpoints'
import { mapSignRequest } from '../mappers'
import { getSignRequestDetailQueryKey } from './querykeys'

type UseSignRequestDetailQueryParams = {
    network: Network
    signRequestId: string
    enabled?: boolean
    pollWhilePending?: boolean
}

const PENDING_POLL_INTERVAL = 5000

export const useSignRequestDetailQuery = ({
    network,
    signRequestId,
    enabled = true,
    pollWhilePending = false,
}: UseSignRequestDetailQueryParams): UseQueryResult<
    MultisigSignRequest,
    Error
> => {
    return useQuery({
        queryKey: getSignRequestDetailQueryKey(network, signRequestId),
        queryFn: () => getSignRequestDetail(network, signRequestId),
        enabled: enabled && !!signRequestId,
        select: useCallback(mapSignRequest, []),
        refetchInterval: pollWhilePending
            ? data => {
                  if (
                      data.state.data?.status === 'pending' ||
                      data.state.data?.status === 'ready'
                  ) {
                      return PENDING_POLL_INTERVAL
                  }
                  return false
              }
            : undefined,
    })
}
