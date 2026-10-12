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
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import { transferContractTests } from '@perawallet/wallet-core-transactions/testing'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { createEthereumTransferAdapter } from '../builder'

const SENDER = '0x00000000000000000000000000000000000000aa'
const RECEIVER = '0x00000000000000000000000000000000000000bb'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const adapter = createEthereumTransferAdapter(testChainContext())

transferContractTests(() => adapter, {
    context: { scope: { chainId: 'ethereum', networkId: 'mainnet' } },
    nativeTransfer: {
        kind: 'transfer',
        from: SENDER,
        to: RECEIVER,
        assetRef: { chainId: 'ethereum', assetId: 'native' },
        amount: new Decimal('1000000000000000000'),
    },
    tokenTransfer: {
        kind: 'transfer',
        from: SENDER,
        to: RECEIVER,
        assetRef: { chainId: 'ethereum', assetId: USDC },
        amount: new Decimal(250),
    },
    arrange: () => {
        server.use(...evmRpcHandlers({ rpcUrl: TEST_RPC_URL }))
    },
})
