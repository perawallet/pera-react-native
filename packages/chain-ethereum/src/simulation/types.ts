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

import type { Decimal } from 'decimal.js'
import type { Address, Hex } from 'viem'
import type { KnownSpender } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'

/** An unsigned call as the backend simulates it. */
export type EvmSimulationRequest = {
    from: Address
    to: Address
    /** Wei. */
    value: Decimal
    data: Hex
    gas: bigint
    /** Wei. */
    maxFeePerGas: Decimal
    /** Wei. */
    maxPriorityFeePerGas: Decimal
}

export type EvmAssetChange = {
    /** The app's asset id: the native id, a checksummed token, or `{contract}/{tokenId}`. */
    assetId: string
    standard: 'native' | 'erc20' | 'erc721' | 'erc1155'
    /** Signed base units of the asset; negative leaves the account. */
    amount: Decimal
}

export type EvmApprovalChange = {
    contract: Address
    spender: Address
    knownSpender?: KnownSpender
    /** Set for one ERC-721 token's approval. */
    tokenId?: string
    isCollectionWide: boolean
    /** Base units of the token; absent when unlimited, zero when revoked. */
    amount?: Decimal
}

export type EvmTransactionSimulation =
    | {
          status: 'success'
          blockNumber: number
          assetChanges: EvmAssetChange[]
          approvalChanges: EvmApprovalChange[]
      }
    | { status: 'reverted'; revertReason: Nullable<string> }
    | { status: 'unavailable' }
