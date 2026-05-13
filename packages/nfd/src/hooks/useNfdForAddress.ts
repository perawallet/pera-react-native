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
import { useQuery } from '@tanstack/react-query'
import {
    useNetwork,
    isValidAlgorandAddress,
} from '@perawallet/wallet-core-blockchain'
import type { Optional } from '@perawallet/wallet-core-shared'
import { fetchNfdNamesForAddress } from '../api'
import { nfdQueryKeys } from './querykeys'

type UseNfdForAddressResult = {
    nfdName: Optional<string>
    isResolving: boolean
}

export const useNfdForAddress = (
    address: string,
    options?: { enabled?: boolean },
): UseNfdForAddressResult => {
    const { network } = useNetwork()
    const enabled =
        (options?.enabled ?? true) && isValidAlgorandAddress(address)

    if (!enabled) {
        return {
            nfdName: undefined,
            isResolving: false,
        }
    }

    const { data, isFetching } = useQuery({
        queryKey: nfdQueryKeys.forAddress(address, network),
        queryFn: ({ signal }) =>
            fetchNfdNamesForAddress({ address, network, signal }),
        enabled,
    })

    const nfdName = useMemo(() => data?.at(0)?.name, [data])

    return {
        nfdName,
        isResolving: isFetching,
    }
}
