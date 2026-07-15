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

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import { checkIsMultisigAddress } from '../api/endpoints'
import { getMultisigAccountDetailQueryKey } from './querykeys'

type UseIsMultisigAddressQueryParams = {
    network: Network
    address: string
    enabled?: boolean
}

export type MultisigAddressCheckResult = {
    isMultisig: boolean
}

export const useIsMultisigAddressQuery = ({
    network,
    address,
    enabled = true,
}: UseIsMultisigAddressQueryParams): UseQueryResult<
    MultisigAddressCheckResult,
    Error
> => {
    return useQuery({
        queryKey: getMultisigAccountDetailQueryKey(network, address),
        queryFn: async () => {
            const isMultisig = await checkIsMultisigAddress(network, address)
            return { isMultisig }
        },
        enabled: enabled && !!address,
        retry: false,
    })
}
