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

import {
    LONG_ADDRESS_LENGTH,
    truncateAlgorandAddress,
} from '@perawallet/wallet-core-shared'
import { useNfdForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useMemo } from 'react'

export type AddressFormat = 'short' | 'long' | 'full'

type UseResolvedAddressResult = {
    /** NFD name if resolved, otherwise truncated/full address */
    displayName: string
    /** Whether the display name is an NFD name */
    isNfd: boolean
    /** Whether an NFD lookup is in progress */
    isResolving: boolean
}

export const useResolvedAddress = (
    address: string,
    options?: { enabled?: boolean; format?: AddressFormat },
): UseResolvedAddressResult => {
    const { data: nfdNames, isPending } = useNfdForAddressQuery(address, {
        enabled: options?.enabled,
    })

    const nfdName = useMemo(() => nfdNames?.at(0)?.name, [nfdNames])

    const format = options?.format ?? 'short'

    const displayName =
        nfdName ??
        (format === 'full'
            ? address
            : truncateAlgorandAddress(
                  address,
                  format === 'long' ? LONG_ADDRESS_LENGTH : undefined,
              ))

    return {
        displayName,
        isNfd: !!nfdName,
        isResolving: isPending,
    }
}
