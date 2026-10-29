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

import type { Address } from 'viem'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type {
    ChainDescriptor,
    ChainFinality,
    EvmChainId,
    NetworkId,
} from '@perawallet/wallet-core-chain-contract'

export type EvmFeeStrategy =
    | { kind: 'eip1559' }
    /** estimateGas leaves out the L1 data fee and the operator fee; both are read from the oracle. */
    | { kind: 'eip1559-op-stack'; gasPriceOracleAddress: Address }
    /** In wei per gas; nodes drop a transaction whose tip is below it. */
    | {
          kind: 'eip1559-min-tip'
          minPriorityFeePerGas: Readonly<Record<NetworkId, bigint>>
      }

/** The behaviour half of a chain; its networks come from `EVM_CHAIN_NETWORKS`. */
export type EvmChainRow = {
    id: EvmChainId
    displayName: string
    nativeAsset: {
        symbol: string
        name: string
        decimals: number
        /** SLIP-44 coin type, as the backend's native CAIP-19 id names it. */
        slip44: string
    }
    explorerName: string
    explorerBase: Readonly<Record<NetworkId, string>>
    fee: EvmFeeStrategy
    /** Milliseconds between blocks; prices a preset's expected wait. */
    blockTimeMs: number
    finality: ChainFinality
    enabledByDefault: boolean
}

export type EvmChain = {
    readonly row: EvmChainRow
    readonly descriptor: ChainDescriptor
    readonly nativeAsset: PeraAsset
}
