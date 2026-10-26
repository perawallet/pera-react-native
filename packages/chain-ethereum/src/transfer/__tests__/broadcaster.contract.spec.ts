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

import { afterAll, afterEach, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { hexToBytes, keccak256 } from 'viem'
import { broadcasterContractTests } from '@perawallet/wallet-core-signing/testing'
import {
    EvmRpcErrorFixture,
    evmRpcHandlers,
    evmTransactionReceipt,
    type EvmRpcFixtures,
} from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import {
    VIEM_TRANSFER_NONCE_0,
    VIEM_TRANSFER_NONCE_0_SPED_UP,
} from '../../signing/__tests__/fixtures'
import { EVM_TEST_CHAINS, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmBroadcasterAdapter } from '../broadcaster'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const HASH = keccak256(VIEM_TRANSFER_NONCE_0)
const REPLACEMENT_HASH = keccak256(VIEM_TRANSFER_NONCE_0_SPED_UP)

const useRpc = (responses: EvmRpcFixtures['responses'] = {}) =>
    server.use(...evmRpcHandlers({ rpcUrl: TEST_RPC_URL, responses }))

for (const chain of EVM_TEST_CHAINS) {
    const adapter = createEvmBroadcasterAdapter(
        testChainContext({ chain }),
        chain,
        {
            confirmationTimeoutMs: 200,
        },
    )

    broadcasterContractTests(() => adapter, {
        scope: evmScopeOf(chain),
        signedTransactions: [hexToBytes(VIEM_TRANSFER_NONCE_0)],
        txIds: [HASH],
        arrangeAccepted: () => useRpc(),
        arrangeAlreadyKnown: () =>
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'already known',
                ),
            }),
        arrangeRejected: () =>
            useRpc({
                eth_sendRawTransaction: new EvmRpcErrorFixture(
                    -32000,
                    'insufficient funds for gas * price + value',
                ),
            }),
        arrangeUnreachable: () =>
            server.use(http.post(TEST_RPC_URL, () => HttpResponse.error())),
        arrangeConfirmed: () =>
            useRpc({
                eth_getTransactionReceipt: evmTransactionReceipt({
                    transactionHash: HASH,
                }),
            }),
        arrangeNeverConfirmed: () =>
            useRpc({ eth_getTransactionReceipt: null }),
        replacement: {
            signedTransactions: [hexToBytes(VIEM_TRANSFER_NONCE_0_SPED_UP)],
            txIds: [REPLACEMENT_HASH],
            arrangeUnderpriced: () =>
                useRpc({
                    eth_sendRawTransaction: new EvmRpcErrorFixture(
                        -32000,
                        'replacement transaction underpriced',
                    ),
                }),
            arrangeOriginalLanded: () =>
                useRpc({
                    eth_sendRawTransaction: new EvmRpcErrorFixture(
                        -32000,
                        'nonce too low',
                    ),
                    eth_getTransactionByHash: null,
                }),
        },
    })
}
