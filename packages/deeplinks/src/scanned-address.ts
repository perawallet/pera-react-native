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
    addressCodecs,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { DeeplinkType, linkTargetOf } from './links'
import { parseDeeplink } from './parser'

export type ScannedAddress =
    | { status: 'found'; address: string }
    | { status: 'other-chain'; chainId: ChainId }
    | { status: 'none' }

/**
 * What an address field on one of `chainIds` takes from scanned or pasted text:
 * a bare address one of those chains' codecs accepts, or a link that names an
 * address on one of them. An address for any other chain is reported as such.
 */
export const readScannedAddress = (
    input: string,
    chainIds: readonly ChainId[],
): ScannedAddress => {
    const text = input.trim()

    const isBareAddress = chainIds.some(
        chainId =>
            addressCodecs.has(chainId) &&
            addressCodecs.get(chainId).isValid(text),
    )
    if (isBareAddress) return { status: 'found', address: text }

    const link = parseDeeplink(text)
    const target = link && linkTargetOf(link)
    if (!link || !target) return { status: 'none' }

    // A keyreg link carries its account as the sender; without this a QR that
    // does hold an address would be reported as holding none.
    const address =
        ('receiverAddress' in link && link.receiverAddress) ||
        ('address' in link && link.address) ||
        (link.type === DeeplinkType.CHAIN_ACTION && link.chainData.sender) ||
        undefined
    if (!address) return { status: 'none' }

    return chainIds.includes(target.chainId)
        ? { status: 'found', address }
        : { status: 'other-chain', chainId: target.chainId }
}
