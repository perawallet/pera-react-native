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

import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import { setupServer } from 'msw/node'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { transferContractTests } from '@perawallet/wallet-core-transactions/testing'
import { toHex } from 'viem'
import { evmRpcHandlers } from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'
import { EVM_TEST_CHAINS, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmTransferAdapter } from '../builder'

const mocks = vi.hoisted(() => ({ getAccountChainStateRow: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    getAccountChainStateRow: mocks.getAccountChainStateRow,
}))

// The empty pool: the ledger is not under test here.
vi.mock('@perawallet/wallet-core-signing', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-signing')
    >()),
    getOpenSubmissionAttempts: vi.fn(async () => []),
}))

const SENDER = '0x00000000000000000000000000000000000000aa'
const RECEIVER = '0x00000000000000000000000000000000000000bb'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

for (const chain of EVM_TEST_CHAINS) {
    const SENDER_ACCOUNT: WalletAccount = {
        id: 'sender',
        custody: { kind: 'watch' },
        chains: { [chain.row.id]: { address: SENDER } },
    }
    const NATIVE_BALANCE = new Decimal('2000000000000000000')

    const adapter = createEvmTransferAdapter(testChainContext({ chain }), chain)

    transferContractTests(() => adapter, {
        context: { scope: evmScopeOf(chain) },
        nativeTransfer: {
            kind: 'transfer',
            from: SENDER,
            to: RECEIVER,
            assetRef: { chainId: chain.row.id, assetId: 'native' },
            amount: new Decimal('1000000000000000000'),
        },
        tokenTransfer: {
            kind: 'transfer',
            from: SENDER,
            to: RECEIVER,
            assetRef: { chainId: chain.row.id, assetId: USDC },
            amount: new Decimal(250),
        },
        spendable: {
            account: SENDER_ACCOUNT,
            nativeBalance: NATIVE_BALANCE,
            fee: new Decimal('21000000000000'),
            hasReserve: false,
        },
        supportsReplacement: chain.descriptor.protocol.supportsReplacement,
        arrange: () => {
            server.use(
                ...evmRpcHandlers({
                    rpcUrl: TEST_RPC_URL,
                    // An OP-stack chain's gas price oracle reads go through eth_call.
                    responses: { eth_call: toHex(1000n, { size: 32 }) },
                }),
            )
            mocks.getAccountChainStateRow.mockResolvedValue({
                accountAddress: SENDER,
                nativeBalance: NATIVE_BALANCE,
                chainData: {
                    family: 'evm',
                    nonce: { latest: 0, pending: 0 },
                },
            })
        },
    })
}
