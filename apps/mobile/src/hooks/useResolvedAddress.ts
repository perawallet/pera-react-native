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
import {
    addressCodecs,
    type ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { useNameForAddressQuery } from '@perawallet/wallet-core-nfd'
import { useMemo } from 'react'

export type AddressFormat = 'short' | 'long' | 'full'

type UseResolvedAddressResult = {
    /** The address's name if resolved, otherwise truncated/full address */
    displayName: string
    /** Whether the display name is the address's resolved name */
    isNamed: boolean
    /** Whether a name lookup is in progress */
    isResolving: boolean
}

export const useResolvedAddress = (
    address: string,
    scope: ChainScope,
    options?: {
        enabled?: boolean
        format?: AddressFormat
    },
): UseResolvedAddressResult => {
    const { data: addressNames, isPending } = useNameForAddressQuery(
        scope,
        address,
        {
            enabled: options?.enabled,
        },
    )

    const addressName = useMemo(() => addressNames?.at(0)?.name, [addressNames])

    const format = options?.format ?? 'short'

    const chainId = scope.chainId
    const truncate = (): string =>
        format === 'short' && chainId && addressCodecs.has(chainId)
            ? addressCodecs.get(chainId).truncate(address)
            : truncateAlgorandAddress(
                  address,
                  format === 'long' ? LONG_ADDRESS_LENGTH : undefined,
              )
    const displayName =
        addressName ?? (format === 'full' ? address : truncate())

    return {
        displayName,
        isNamed: !!addressName,
        isResolving: isPending,
    }
}
