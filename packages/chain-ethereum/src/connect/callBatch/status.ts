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

import { getAddress, isAddress, numberToHex } from 'viem'
import type { Address, Hex, TransactionReceipt } from 'viem'
import type {
    ChainContext,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import { DappRequestCodedError } from '@perawallet/wallet-core-connections'
import {
    findTransactionBatch,
    type TransactionBatch,
} from '@perawallet/wallet-core-signing'
import { eip155ChainIdOf } from '../../blockchain/utils/caip19'
import { createEvmClient } from '../../blockchain/utils/createEvmClient'
import type { EvmChain } from '../../chains/types'
import { EIP5792_ERROR_CODE } from './codes'

/** EIP-5792 batch status: pending, confirmed, failed off-chain, reverted, partly reverted. */
export type CallsStatusCode = 100 | 200 | 400 | 500 | 600

export type EthereumCallReceipt = {
    logs: { address: Address; data: Hex; topics: Hex[] }[]
    status: '0x1' | '0x0'
    blockHash: Hex
    blockNumber: Hex
    gasUsed: Hex
    transactionHash: Hex
}

export type EthereumCallsStatus = {
    version: '2.0.0'
    id: string
    chainId: Hex
    atomic: false
    status: CallsStatusCode
    receipts: EthereumCallReceipt[]
}

/** Calls run one by one, so a stop past the first leaves the earlier ones landed. */
export const callsStatusCodeOf = ({
    outcome,
    position,
}: Pick<TransactionBatch, 'outcome' | 'position'>): CallsStatusCode => {
    if (outcome === 'running') return 100
    if (outcome === 'confirmed') return 200
    if (position > 0) return 600
    return outcome === 'reverted' ? 500 : 400
}

/**
 * Every network of the chain, or the ones asked about. Atomic execution would
 * need an EIP-7702 delegation to a smart account, which the wallet never signs.
 */
export const ethereumWalletCapabilities = (
    chain: EvmChain,
    requested?: readonly Hex[],
): Record<Hex, { atomic: { status: 'unsupported' } }> => {
    const asked = requested?.map(chainId => BigInt(chainId))
    const capabilities: Record<Hex, { atomic: { status: 'unsupported' } }> = {}
    for (const network of chain.descriptor.networks) {
        const scope: ChainScope = {
            chainId: chain.row.id,
            networkId: network.id,
        }
        const eip155ChainId = BigInt(eip155ChainIdOf(scope, chain))
        if (asked && !asked.includes(eip155ChainId)) continue
        capabilities[numberToHex(eip155ChainId)] = {
            atomic: { status: 'unsupported' },
        }
    }
    return capabilities
}

/**
 * The batch one of the session's accounts sent under this id. Refused in
 * EIP-5792's own code otherwise, so another session's ids stay unknown.
 */
export const findEthereumCallBatch = async (
    chain: EvmChain,
    batchId: string,
    addresses: readonly string[],
): Promise<TransactionBatch> => {
    const batch = await findTransactionBatch({
        chainId: chain.row.id,
        batchId,
        senders: addresses
            .filter(address => isAddress(address))
            .map(address => getAddress(address)),
    })
    if (!batch) {
        throw new DappRequestCodedError(
            EIP5792_ERROR_CODE.unknownBundleId,
            'Unknown bundle id',
        )
    }
    return batch
}

const toCallReceipt = (receipt: TransactionReceipt): EthereumCallReceipt => ({
    logs: receipt.logs.map(({ address, data, topics }) => ({
        address,
        data,
        topics: [...topics],
    })),
    status: receipt.status === 'success' ? '0x1' : '0x0',
    blockHash: receipt.blockHash,
    blockNumber: numberToHex(receipt.blockNumber),
    gasUsed: numberToHex(receipt.gasUsed),
    transactionHash: receipt.transactionHash,
})

/** Receipts are read from the node at query time, for every call that has one so far. */
export const readEthereumCallsStatus = async (
    ctx: ChainContext,
    chain: EvmChain,
    batch: TransactionBatch,
): Promise<EthereumCallsStatus> => {
    const client = createEvmClient(batch.scope, ctx, chain)
    const receipts = await Promise.all(
        batch.txIds.map(hash =>
            client
                .getTransactionReceipt({ hash: hash as Hex })
                .catch(() => null),
        ),
    )
    return {
        version: '2.0.0',
        id: batch.batchId,
        chainId: numberToHex(eip155ChainIdOf(batch.scope, chain)),
        atomic: false,
        status: callsStatusCodeOf(batch),
        receipts: receipts
            .filter(receipt => receipt !== null)
            .map(toCallReceipt),
    }
}
