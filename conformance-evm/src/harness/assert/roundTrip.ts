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
    keccak256,
    parseTransaction,
    recoverTransactionAddress,
    type Hex,
    type TransactionReceipt,
    type TransactionSerializedEIP1559,
} from 'viem'
import { formatFieldDiff } from '@perawallet/conformance/harness/assert/diff'
import { createEvmClient } from '@perawallet/wallet-core-chain-ethereum/blockchain/utils/createEvmClient'

import { nativeBalanceOf } from '../accounts'
import type { EvmConformanceEnv } from '../context'
import { anvilRpc } from '../evmnet'
import {
    compareEvmIntent,
    type ComparableEvmTransaction,
    type EvmTxnIntent,
} from './intent'

export type ExpectEvmConformantInput = {
    env: EvmConformanceEnv
    intent: EvmTxnIntent
    /** The exact bytes handed to the node, not a re-encoding of the builder's output. */
    raw: Hex
    hash: Hex
    /** The sender's wei, read before broadcasting. */
    senderBalanceBefore: bigint
}

type NodeTransaction = {
    hash: Hex
    type: Hex
    chainId: Hex
    from: string
    nonce: Hex
    to: string | null
    value: Hex
    input: Hex
    gas: Hex
    maxFeePerGas?: Hex
    maxPriorityFeePerGas?: Hex
    accessList?: unknown[]
}

type NodeReceipt = { l1Fee?: Hex }

const TRANSACTION_TYPES: Readonly<Record<string, string>> = {
    '0x0': 'legacy',
    '0x1': 'eip2930',
    '0x2': 'eip1559',
    '0x3': 'eip4844',
    '0x4': 'eip7702',
}

const fail = (summary: string, diff?: string): never => {
    throw new Error(diff ? `${summary}\n${diff}` : summary)
}

const assertMatchesIntent = (
    label: string,
    intent: EvmTxnIntent,
    transaction: ComparableEvmTransaction,
): void => {
    const { ok, expected, actual } = compareEvmIntent(intent, transaction)
    if (!ok) {
        fail(
            `${label} does not match the declared intent:`,
            formatFieldDiff(expected, actual),
        )
    }
}

const quantity = (value: Hex | undefined): bigint | undefined =>
    value === undefined ? undefined : BigInt(value)

// Read as JSON and decoded here rather than through viem's formatters, so the
// node's side of the comparison is the node's own answer.
const fromNode = (node: NodeTransaction): ComparableEvmTransaction => ({
    type: TRANSACTION_TYPES[node.type] ?? node.type,
    chainId: Number(BigInt(node.chainId)),
    from: node.from,
    nonce: Number(BigInt(node.nonce)),
    to: node.to,
    value: BigInt(node.value),
    input: node.input,
    gas: BigInt(node.gas),
    maxFeePerGas: quantity(node.maxFeePerGas),
    maxPriorityFeePerGas: quantity(node.maxPriorityFeePerGas),
    accessList: node.accessList,
})

const sameAddress = (a: string | null, b: string | null): boolean =>
    a?.toLowerCase() === b?.toLowerCase()

/**
 * Asserts that the bytes the app submitted, and the transaction the node
 * holds, both match `intent` field for field; that the signature recovers to
 * the declared sender; that the receipt succeeded; and that the sender's wei
 * moved by exactly what the receipt accounts for, OP-stack L1 fee included.
 */
export const expectEvmConformant = async ({
    env,
    intent,
    raw,
    hash,
    senderBalanceBefore,
}: ExpectEvmConformantInput): Promise<TransactionReceipt> => {
    // Without this the assertion could run against another transaction while
    // the submitted bytes went nowhere.
    const rawHash = keccak256(raw)
    if (rawHash !== hash) {
        fail(
            `submitted bytes are not the transaction being asserted: bytes hash to ${rawHash}, hash is ${hash}`,
        )
    }

    const serialized = raw as TransactionSerializedEIP1559
    const recovered = await recoverTransactionAddress({
        serializedTransaction: serialized,
    })
    if (!sameAddress(recovered, intent.from)) {
        fail(
            `the signature recovers to ${recovered}, not the declared sender ${intent.from}`,
        )
    }
    assertMatchesIntent('submitted transaction', intent, {
        ...parseTransaction(serialized),
        from: recovered,
    })

    const receipt = await createEvmClient(
        env.scope,
        env.ctx,
        env.evmChain,
    ).getTransactionReceipt({ hash })
    if (receipt.status !== 'success') {
        fail(`transaction ${hash} was mined with status ${receipt.status}`)
    }

    const node = await anvilRpc<NodeTransaction | null>(
        env.chain,
        'eth_getTransactionByHash',
        [hash],
    )
    if (!node) return fail(`the node has no transaction ${hash}`)
    if (node.hash.toLowerCase() !== hash.toLowerCase()) {
        fail(`the node returned ${node.hash} for ${hash}`)
    }
    assertMatchesIntent('node transaction', intent, fromNode(node))

    // viem's base receipt formatter does not know `l1Fee`, so it is read raw.
    const nodeReceipt = await anvilRpc<NodeReceipt>(
        env.chain,
        'eth_getTransactionReceipt',
        [hash],
    )
    const l1Fee = quantity(nodeReceipt.l1Fee) ?? 0n
    const value = intent.value ?? 0n
    const credited = sameAddress(intent.to, intent.from) ? value : 0n
    const spent =
        value - credited + receipt.gasUsed * receipt.effectiveGasPrice + l1Fee
    const expectedAfter = senderBalanceBefore - spent
    const actualAfter = await nativeBalanceOf(
        env,
        intent.from,
        receipt.blockNumber,
    )
    if (actualAfter !== expectedAfter) {
        fail(
            `sender balance moved by ${senderBalanceBefore - actualAfter} wei, expected ${spent} (value ${value - credited}, gas ${receipt.gasUsed} × ${receipt.effectiveGasPrice}, l1Fee ${l1Fee})`,
            formatFieldDiff(
                { balanceAfter: expectedAfter },
                { balanceAfter: actualAfter },
            ),
        )
    }
    return receipt
}
