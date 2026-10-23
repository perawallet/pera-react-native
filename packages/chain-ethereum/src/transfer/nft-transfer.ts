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
    encodeFunctionData,
    erc1155Abi,
    erc721Abi,
    type Address,
    type Hex,
} from 'viem'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getAssetById } from '@perawallet/wallet-core-assets'
import type { Nullable } from '@perawallet/wallet-core-shared'
import {
    parseEvmNftAssetId,
    type EvmNftStandard,
} from '../blockchain/utils/caip19'

export type EvmNftTransferAsset = {
    contract: Address
    /** Decimal uint256. */
    tokenId: string
    standard: EvmNftStandard
    collectionName?: string
}

const isNftStandard = (value: unknown): value is EvmNftStandard =>
    value === 'erc721' || value === 'erc1155'

// The id doesn't carry the standard; the stored asset does. Reads only the
// store, so an NFT the account hasn't synced yet can't be sent.
export const readEvmNftTransferAsset = async (
    scope: ChainScope,
    assetId: string,
): Promise<Nullable<EvmNftTransferAsset>> => {
    const nft = parseEvmNftAssetId(assetId)
    if (!nft) return null
    const asset = await getAssetById({ assetId, scope })
    const collectible = asset?.peraMetadata?.collectible
    if (!isNftStandard(collectible?.standard)) return null
    const collectionName = collectible.collection?.name
    return {
        ...nft,
        standard: collectible.standard,
        ...(collectionName && { collectionName }),
    }
}

/** An ERC-721 transfer ignores `amount`: callers send exactly 1. */
export const encodeEvmNftTransfer = ({
    standard,
    from,
    to,
    tokenId,
    amount,
}: {
    standard: EvmNftStandard
    from: Address
    to: Address
    tokenId: string
    amount: bigint
}): Hex =>
    standard === 'erc721'
        ? encodeFunctionData({
              abi: erc721Abi,
              functionName: 'safeTransferFrom',
              args: [from, to, BigInt(tokenId)],
          })
        : encodeFunctionData({
              abi: erc1155Abi,
              functionName: 'safeTransferFrom',
              args: [from, to, BigInt(tokenId), amount, '0x'],
          })
