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

import { useMemo } from 'react'
import {
    chainAccountOf,
    isSameAddress,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { chainDisplayNameOf } from '@perawallet/wallet-core-chain-shared'
import type { Optional } from '@perawallet/wallet-core-shared'
import { useHomeChainScope } from '@hooks/useHomeChainScope'
import {
    addressMatchSegments,
    type AddressSegment,
} from '../../utils/addressMatchSegments'

export type UseSearchAccountRowProps = {
    account: WalletAccount
    chainId: Optional<ChainId>
    query: string
}

export type UseSearchAccountRowResult = {
    /** The chain the row names; undefined for the home chain, whose row reads as a plain account. */
    searchedChainId: Optional<ChainId>
    segments: AddressSegment[]
    /** Every network the matched address is on, the matched one first. */
    chainName: string
}

export const useSearchAccountRow = ({
    account,
    chainId,
    query,
}: UseSearchAccountRowProps): UseSearchAccountRowResult => {
    const { chainId: homeChainId } = useHomeChainScope()
    const searchedChainId =
        chainId !== undefined && chainId !== homeChainId ? chainId : undefined

    return useMemo(() => {
        if (searchedChainId === undefined) {
            return { searchedChainId, segments: [], chainName: '' }
        }
        const address = chainAccountOf(account, searchedChainId)?.address ?? ''
        const truncated = addressCodecs.has(searchedChainId)
            ? addressCodecs.get(searchedChainId).truncate(address)
            : address
        // An EVM address is the same on every EVM chain the account is on, so
        // the hit is named on all of them rather than the first that matched.
        const sharingChainIds = (Object.keys(account.chains) as ChainId[])
            .filter(id => id !== searchedChainId)
            .filter(id => {
                const other = chainAccountOf(account, id)?.address
                return other !== undefined && isSameAddress(id, other, address)
            })
        return {
            searchedChainId,
            segments: addressMatchSegments(address, truncated, query),
            chainName: [searchedChainId, ...sharingChainIds]
                .map(id => chainDisplayNameOf(id) ?? id)
                .join(', '),
        }
    }, [account, searchedChainId, query])
}
