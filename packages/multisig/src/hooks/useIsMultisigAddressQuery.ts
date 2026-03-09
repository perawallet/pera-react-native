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

import { useQuery } from '@tanstack/react-query'
import type { Network } from '@perawallet/wallet-core-shared'
import { getMultisigAccountDetail } from '../api/endpoints'
import { getMultisigAccountDetailQueryKey } from './querykeys'

type UseIsMultisigAddressQueryParams = {
    network: Network
    address: string
    enabled?: boolean
}

type UseIsMultisigAddressQueryResult = {
    isMultisig: boolean
    isChecking: boolean
}

export const useIsMultisigAddressQuery = ({
    network,
    address,
    enabled = true,
}: UseIsMultisigAddressQueryParams): UseIsMultisigAddressQueryResult => {
    const query = useQuery({
        queryKey: getMultisigAccountDetailQueryKey(network, address),
        queryFn: () => getMultisigAccountDetail(network, address),
        enabled: enabled && !!address,
        retry: false,
    })

    return {
        isMultisig: query.isSuccess,
        isChecking: query.isFetching,
    }
}
