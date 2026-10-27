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

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { keccak256, type Hex } from 'viem'
import type { TransactionBatch } from '@perawallet/wallet-core-signing'
import {
    evmRpcHandlers,
    evmTransactionReceipt,
} from '../../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../../__tests__/context'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import {
    callsStatusCodeOf,
    reachedCallTxIdOf,
    readEthereumCallsStatus,
} from '../status'
import { SENDER, server } from './harness'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('callsStatusCodeOf', () => {
    it.each([
        ['running', 0, 100],
        ['running', 1, 100],
        ['confirmed', 1, 200],
        ['failed', 0, 400],
        ['reverted', 0, 500],
        ['reverted', 1, 600],
        ['failed', 1, 600],
    ] as const)('reads %s at position %i as %i', (outcome, position, code) => {
        expect(callsStatusCodeOf({ outcome, position })).toBe(code)
    })
})

describe('reachedCallTxIdOf', () => {
    it.each([
        [
            'a batch that reverted at its third call',
            ['0x1', '0x2', '0x3'],
            2,
            '0x3',
        ],
        [
            'a batch that failed before signing its third call',
            ['0x1', '0x2'],
            2,
            '0x2',
        ],
        ['a batch with nothing sent', [], 0, undefined],
    ])('shows the reached call of %s', (_, txIds, position, txId) => {
        expect(reachedCallTxIdOf({ txIds, position })).toBe(txId)
    })
})

describe('readEthereumCallsStatus', () => {
    const APPROVAL = keccak256('0x01')
    const SWAP = keccak256('0x02')
    const batch: TransactionBatch = {
        id: 'row',
        batchId: 'batch-1',
        scope: { chainId: 'ethereum', networkId: 'mainnet' },
        sender: SENDER,
        approvalToken: 'approval-1',
        payload: { calls: [], maxFeePerGasCeiling: '0' },
        txIds: [APPROVAL, SWAP],
        signedRaw: null,
        position: 1,
        outcome: 'running',
        createdAt: 1,
        updatedAt: 1,
    }

    it('Given a call landed and the next is pending, when read, then only the landed receipt is reported, never atomic', async () => {
        const LOG = {
            address: `0x${'cd'.repeat(20)}` as Hex,
            data: '0x' as Hex,
            topics: [`0x${'ef'.repeat(32)}` as Hex],
            blockHash: `0x${'11'.repeat(32)}` as Hex,
            blockNumber: '0x1' as Hex,
            transactionHash: APPROVAL,
            transactionIndex: '0x0' as Hex,
            logIndex: '0x0' as Hex,
            removed: false,
        }
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_getTransactionReceipt: params =>
                        params[0] === APPROVAL
                            ? evmTransactionReceipt({
                                  transactionHash: APPROVAL,
                                  logs: [LOG],
                              })
                            : null,
                },
            }),
        )

        const status = await readEthereumCallsStatus(
            testChainContext(),
            ETHEREUM,
            batch,
        )

        expect(status).toEqual({
            version: '2.0.0',
            id: 'batch-1',
            chainId: '0x1',
            atomic: false,
            status: 100,
            receipts: [
                {
                    logs: [
                        {
                            address: LOG.address,
                            data: '0x',
                            topics: LOG.topics,
                        },
                    ],
                    status: '0x1',
                    blockHash: `0x${'11'.repeat(32)}`,
                    blockNumber: '0x1',
                    gasUsed: '0x5208',
                    transactionHash: APPROVAL,
                },
            ],
        })
    })
})
