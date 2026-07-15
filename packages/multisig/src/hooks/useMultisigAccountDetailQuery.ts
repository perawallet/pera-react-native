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

import { useCallback } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import type { MultiSigAccount } from '../models'
import { getMultisigAccountDetail } from '../api/endpoints'
import { mapMultiSigAccount } from '../mappers'
import { getMultisigAccountDetailQueryKey } from './querykeys'

type UseMultisigAccountDetailQueryParams = {
    network: Network
    address: string
    enabled?: boolean
}

export const useMultisigAccountDetailQuery = ({
    network,
    address,
    enabled = true,
}: UseMultisigAccountDetailQueryParams): UseQueryResult<
    MultiSigAccount,
    Error
> => {
    return useQuery({
        queryKey: getMultisigAccountDetailQueryKey(network, address),
        queryFn: () => getMultisigAccountDetail(network, address),
        enabled: enabled && !!address,
        select: useCallback(mapMultiSigAccount, []),
    })
}
