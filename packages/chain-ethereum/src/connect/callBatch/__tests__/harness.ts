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

import { setupServer } from 'msw/node'
import {
    encodeFunctionData,
    erc20Abi,
    getAddress,
    hexToBytes,
    keccak256,
    parseTransaction,
    serializeTransaction,
    type Hex,
    type RpcTransaction,
} from 'viem'
import type {
    SignedTransaction,
    UnsignedTransaction,
} from '@perawallet/wallet-core-chain-contract'
import {
    evmRpcHandlers,
    evmTransactionReceipt,
    EvmRpcErrorFixture,
} from '../../../blockchain/msw-handlers'
import { TEST_RPC_URL } from '../../../__tests__/context'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import { readEvmTransaction } from '../../../signing/adapter'
import {
    SENDER,
    VIEM_TRANSFER_NONCE_0,
} from '../../../signing/__tests__/fixtures'
import type { EthereumSendTransactionRequest } from '../../sendTransaction'

export { SENDER }
export const TOKEN = getAddress('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')
export const ROUTER = getAddress('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45')

export const APPROVE: EthereumSendTransactionRequest = {
    from: SENDER,
    to: TOKEN,
    value: 0n,
    data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [ROUTER, 1_000_000n],
    }),
}

export const SWAP: EthereumSendTransactionRequest = {
    from: SENDER,
    to: ROUTER,
    value: 0n,
    data: '0x5ae401dc',
}

// Keys stay in the keystore, so tests sign with a real vector's signature: the
// bytes parse and recover (to some address), and each transaction hashes apart.
const { r, s: sValue, yParity } = parseTransaction(VIEM_TRANSFER_NONCE_0)

/** Bytes as the node and the ledger read them, unique per transaction. */
export const signAsSender = async (
    unsigned: UnsignedTransaction,
): Promise<SignedTransaction> => {
    const { transaction } = readEvmTransaction(unsigned, ETHEREUM)
    const serialized = serializeTransaction(
        { ...transaction, type: 'eip1559' },
        { r: r as Hex, s: sValue as Hex, yParity: yParity ?? 0 },
    )
    return {
        scope: unsigned.scope,
        id: keccak256(serialized),
        bytes: hexToBytes(serialized),
    }
}

export const server = setupServer()

const HELD_BY_NODE = { blockNumber: null } as unknown as RpcTransaction

type NodeOptions = {
    /** Receipt status by the call's `to`; `'0x1'` when absent. */
    statusFor?: (to: Hex) => '0x1' | '0x0'
    /** Calls to this address fail gas estimation, as a reverting call does. */
    unestimable?: Hex
    /** Mines each send at once; otherwise it stays pending. */
    isMining?: boolean
    /** The base fee per gas once a first call has been sent, as a spike. */
    baseFeeAfterFirstSend?: Hex
}

/**
 * A node that mines what it is sent. `events` records sends and served
 * receipts in order, so a test can prove a call went out only after the
 * receipt of the one before it.
 */
export const fakeNode = ({
    statusFor = () => '0x1',
    unestimable,
    isMining = true,
    baseFeeAfterFirstSend,
}: NodeOptions = {}) => {
    const events: string[] = []
    const sent = new Map<Hex, Hex>()
    const toOf = new Map<Hex, Hex>()
    server.use(
        ...evmRpcHandlers({
            rpcUrl: TEST_RPC_URL,
            responses: {
                eth_getTransactionCount: () => `0x${sent.size.toString(16)}`,
                eth_feeHistory: () => {
                    const base =
                        baseFeeAfterFirstSend && sent.size > 0
                            ? baseFeeAfterFirstSend
                            : '0x3b9aca00'
                    return {
                        oldestBlock: '0x1',
                        baseFeePerGas: [base, base],
                        gasUsedRatio: [0.5],
                        reward: [['0x3b9aca00', '0x3b9aca00', '0x3b9aca00']],
                    }
                },
                eth_estimateGas: params => {
                    const [call] = params as [{ to?: Hex }]
                    return unestimable &&
                        call.to?.toLowerCase() === unestimable.toLowerCase()
                        ? new EvmRpcErrorFixture(3, 'execution reverted')
                        : '0xfde8'
                },
                eth_sendRawTransaction: params => {
                    const raw = params[0] as Hex
                    const hash = keccak256(raw)
                    sent.set(hash, raw)
                    toOf.set(hash, parseTransaction(raw).to ?? '0x')
                    events.push(`send:${hash}`)
                    return hash
                },
                eth_getTransactionByHash: params =>
                    sent.has(params[0] as Hex) ? HELD_BY_NODE : null,
                eth_getTransactionReceipt: params => {
                    const hash = params[0] as Hex
                    if (!isMining || !sent.has(hash)) return null
                    const to = toOf.get(hash) ?? '0x'
                    const status = statusFor(to)
                    events.push(`receipt:${hash}:${status}`)
                    return evmTransactionReceipt({
                        transactionHash: hash,
                        status,
                    })
                },
            },
        }),
    )
    return {
        events,
        sent,
        sentCount: () => events.filter(e => e.startsWith('send:')).length,
    }
}
