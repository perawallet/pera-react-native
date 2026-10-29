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

import { useQuery } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { checkIsMultisigAddress } from '../api/endpoints'
import { getIsMultisigAddressQueryKey } from './querykeys'

type UseIsMultisigAddressQueryParams = {
    scope: ChainScope
    address: string
    enabled?: boolean
}

export type MultisigAddressCheckResult = {
    isMultisig: boolean
}

export type UseIsMultisigAddressQueryResult = {
    data: MultisigAddressCheckResult | undefined
    isFetching: boolean
}

export const useIsMultisigAddressQuery = ({
    scope,
    address,
    enabled = true,
}: UseIsMultisigAddressQueryParams): UseIsMultisigAddressQueryResult => {
    const query = useQuery({
        queryKey: getIsMultisigAddressQueryKey(scope, address),
        queryFn: async (): Promise<MultisigAddressCheckResult> => {
            const isMultisig = await checkIsMultisigAddress(scope, address)
            return { isMultisig }
        },
        enabled: enabled && !!address,
        retry: false,
    })

    return {
        data: query.data,
        isFetching: query.isFetching,
    }
}
