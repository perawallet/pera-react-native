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
import { setupServer } from 'msw/node'
import { historyContractTests } from '@perawallet/wallet-core-transactions/testing'
import { peraEvmHandlers } from '../../accounts/msw-handlers'
import { ethereumDescriptor } from '../../descriptor'
import { TEST_PERA_URL } from '../../__tests__/context'
import { ethereumHistoryAdapter } from '../adapter'
import { evmHistoryItem } from '../api/msw-handlers'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const ADDRESS = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`

const ethSend = evmHistoryItem({
    hash: hash(3),
    from: ADDRESS,
    to: PEER,
    value: '1000000000000000000',
    fee: '21000000000000',
})
const erc20Receive = evmHistoryItem({
    hash: hash(2),
    token_transfers: [
        {
            asset_id: `eip155:1/erc20:${USDC}`,
            contract: USDC,
            from: PEER,
            to: ADDRESS,
            value: '250',
            token_name: null,
            token_symbol: null,
            token_decimals: null,
        },
    ],
})
const approve = evmHistoryItem({
    hash: hash(1),
    from: ADDRESS,
    to: USDC,
    value: '0',
    method: 'approve',
    fee: '46000000000000',
    balance_impacts: [
        { asset_id: 'eip155:1/slip44:60', amount: '-46000000000000' },
    ],
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

historyContractTests(() => ethereumHistoryAdapter, {
    scope: { chainId: 'ethereum', networkId: 'mainnet' },
    address: ADDRESS,
    nativeAsset: ethereumDescriptor.nativeAsset.ref,
    arrangeTwoPages: () => {
        server.use(
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                history: { [ADDRESS]: [[ethSend, erc20Receive], [approve]] },
            }),
        )
    },
    arrangeEmpty: () => {
        server.use(...peraEvmHandlers({ baseUrl: TEST_PERA_URL }))
    },
})
