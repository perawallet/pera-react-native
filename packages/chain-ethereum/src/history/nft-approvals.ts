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

import { getAddress, size } from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { areEvmAddressesEqual } from '../accounts/address-codec'
import {
    readNftApprovalIds,
    type EvmApproveCall,
} from '../signing/nft-approvals'
import { decodeEvmStandardCall } from '../signing/standard-calls'
import type { EvmHistoryItem } from './api/schema'

const approveCallOf = (
    item: EvmHistoryItem,
    address: string,
): EvmApproveCall[] => {
    const { from, to, input } = item
    if (
        from === null ||
        to === null ||
        input === null ||
        size(input) === 0 ||
        !areEvmAddressesEqual(from, address)
    ) {
        return []
    }
    const call = decodeEvmStandardCall({
        from: getAddress(from),
        to: getAddress(to),
        data: input,
        value: BigInt(item.value ?? '0'),
    })
    return call?.kind === 'approve' ? [call] : []
}

/** The NFT asset ids the `approve` calls `address` sent on a page grant; History still asks no network. */
export const readNftApprovals = (
    items: EvmHistoryItem[],
    address: string,
    scope: ChainScope,
): Promise<ReadonlySet<string>> =>
    readNftApprovalIds(
        items.flatMap(item => approveCallOf(item, address)),
        scope,
    )
