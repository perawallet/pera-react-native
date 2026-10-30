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
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { Decimal } from 'decimal.js'
import { getAddress } from 'viem'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { peraEvmHandlers } from '../../accounts/msw-handlers'
import { UnknownEvmNetworkError } from '../../blockchain/utils/caip19'
import {
    PERA_URL,
    TEST_API_KEY,
    TEST_INTEGRITY_TOKEN,
} from '../../__tests__/pera-backend'
import { evmCapabilityDefaults } from '../../capability-defaults'
import { createEvmHistoryAdapter, getEvmTransactionHistory } from '../adapter'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { evmHistoryItem } from '../api/msw-handlers'
import {
    evmRpcHandlers,
    evmRpcTransaction,
} from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const SEPOLIA: ChainScope = { chainId: 'ethereum', networkId: 'sepolia' }
const ME = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`

const send = evmHistoryItem({
    hash: hash(1),
    from: ME,
    to: PEER,
    value: '5',
    fee: '21000',
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const serve = (rows: (typeof send)[][]) =>
    server.use(
        ...peraEvmHandlers({ baseUrl: PERA_URL, history: { [ME]: rows } }),
    )

describe('getEvmTransactionHistory', () => {
    it('asks for the lowercased address on the EIP-155 route with the API key and integrity token', async () => {
        let request: Request | undefined
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                ({ request: received }) => {
                    request = received
                    return HttpResponse.json({
                        next: null,
                        previous: null,
                        results: [],
                    })
                },
            ),
        )

        await getEvmTransactionHistory(ETHEREUM, getAddress(ME), MAINNET)

        const url = new URL(request?.url ?? '')
        expect(url.pathname).toBe(`/api/v3/evm/1/accounts/${ME}/transactions/`)
        expect(url.search).toBe('')
        expect(request?.headers.get('x-api-key')).toBe(TEST_API_KEY)
        expect(request?.headers.get('x-app-integrity-token')).toBe(
            TEST_INTEGRITY_TOKEN,
        )
    })

    it('sends the cursor and a limit clamped to the backend maximum', async () => {
        let url: URL | undefined
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                ({ request }) => {
                    url = new URL(request.url)
                    return HttpResponse.json({
                        next: null,
                        previous: null,
                        results: [],
                    })
                },
            ),
        )

        await getEvmTransactionHistory(ETHEREUM, ME, MAINNET, {
            cursor: 'abc',
            limit: 80,
        })

        expect(url?.searchParams.get('cursor')).toBe('abc')
        expect(url?.searchParams.get('limit')).toBe('50')
    })

    it('reads the sepolia route for a sepolia scope', async () => {
        let pathname: string | undefined
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                ({ request }) => {
                    pathname = new URL(request.url).pathname
                    return HttpResponse.json({
                        next: null,
                        previous: null,
                        results: [],
                    })
                },
            ),
        )

        await getEvmTransactionHistory(ETHEREUM, ME, SEPOLIA)

        expect(pathname).toBe(
            `/api/v3/evm/11155111/accounts/${ME}/transactions/`,
        )
    })

    it('maps the endpoint status, time and fee onto the record', async () => {
        serve([
            [
                send,
                evmHistoryItem({
                    hash: hash(2),
                    status: 'failed',
                    block_time: '2026-03-04T05:06:07+00:00',
                    fee: null,
                }),
            ],
        ])

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items[0]).toMatchObject({
            id: hash(1),
            scope: MAINNET,
            status: 'confirmed',
            timestamp: Date.parse('2026-01-01T00:00:00Z'),
            initiator: ME,
            chainData: { family: 'evm' },
        })
        expect(items[0]?.fee).toEqual(new Decimal(21000))
        expect(items[1]).toMatchObject({
            id: hash(2),
            status: 'failed',
            timestamp: Date.parse('2026-03-04T05:06:07Z'),
        })
        expect(items[1]?.fee).toBeUndefined()
    })

    it('lowercases the hash so it matches the id the submission ledger records', async () => {
        serve([[evmHistoryItem({ hash: `0x${'AB'.repeat(32)}` })]])

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items[0]?.id).toBe(`0x${'ab'.repeat(32)}`)
    })

    it('hands back the next cursor, and none on the last page', async () => {
        serve([[send], [evmHistoryItem({ hash: hash(2) })]])

        const first = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)
        const second = await getEvmTransactionHistory(
            ETHEREUM,
            ME,
            MAINNET,
            first.next,
        )

        expect(first.next).toEqual({ cursor: 'page:1' })
        expect(second.items.map(item => item.id)).toEqual([hash(2)])
        expect(second.next).toBeUndefined()
    })

    it('skips a row of a kind it does not know and returns the rest of the page', async () => {
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                () =>
                    HttpResponse.json({
                        next: null,
                        previous: null,
                        results: [{ ...send, kind: 'blob' }, send],
                    }),
            ),
        )

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items.map(item => item.id)).toEqual([hash(1)])
    })

    it('identifies a withdrawal row by its withdrawal index and skips one with none', async () => {
        serve([
            [
                evmHistoryItem({
                    kind: 'withdrawal',
                    hash: null,
                    withdrawals: [
                        { index: 42, validator_index: 1, amount: '9' },
                    ],
                    balance_impacts: [
                        { asset_id: 'eip155:1/slip44:60', amount: '9' },
                    ],
                }),
                evmHistoryItem({ kind: 'withdrawal', hash: null }),
            ],
        ])

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items.map(item => item.id)).toEqual(['withdrawal:42'])
        expect(items[0]?.summary.amount?.value).toEqual(new Decimal(9))
    })

    it('keeps an empty page that still has a next cursor', async () => {
        serve([[], [send]])

        const page = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(page).toEqual({ items: [], next: { cursor: 'page:1' } })
    })

    it("refuses another chain's scope", async () => {
        await expect(
            getEvmTransactionHistory(ETHEREUM, ME, {
                chainId: 'algorand',
                networkId: 'mainnet',
            }),
        ).rejects.toBeInstanceOf(UnknownEvmNetworkError)
    })
})

describe('with contractDecoding', () => {
    const swap = evmHistoryItem({
        hash: hash(2),
        from: ME,
        to: PEER,
        value: '0',
        method: 'swapExactTokensForTokens',
    })

    // No RPC handler is registered, so a node read would fail the test.
    it.each([
        [true, 'transactions.list_item.interpreted_title'],
        [false, 'transactions.list_item.contract_call'],
    ])(
        'reads the history without touching the node (decoding %s)',
        async (isDecoding, titleKey) => {
            serve([[swap]])
            const adapter = createEvmHistoryAdapter(
                ETHEREUM,
                testChainContext(),
            )

            const { items } = await adapter.getTransactionHistory(
                ME,
                MAINNET,
                undefined,
                {
                    capabilities: {
                        ...evmCapabilityDefaults,
                        contractDecoding: isDecoding,
                    },
                },
            )

            expect(items[0]?.summary.title.key).toBe(titleKey)
        },
    )

    it('reads the capability fresh on every page', async () => {
        serve([[swap], [swap]])
        const adapter = createEvmHistoryAdapter(ETHEREUM, testChainContext())
        const read = (contractDecoding: boolean, cursor?: string) =>
            adapter.getTransactionHistory(
                ME,
                MAINNET,
                cursor ? { cursor } : undefined,
                {
                    capabilities: {
                        ...evmCapabilityDefaults,
                        contractDecoding,
                    },
                },
            )

        const first = await read(false)
        const second = await read(true, 'page:1')

        expect(first.items[0]?.summary.title.key).toBe(
            'transactions.list_item.contract_call',
        )
        expect(second.items[0]?.summary.title.key).toBe(
            'transactions.list_item.interpreted_title',
        )
    })

    it('reads a page without the capability as decoding off', async () => {
        serve([[swap]])
        const adapter = createEvmHistoryAdapter(ETHEREUM, testChainContext())

        const { items } = await adapter.getTransactionHistory(ME, MAINNET)

        expect(items[0]?.summary.title.key).toBe(
            'transactions.list_item.contract_call',
        )
    })

    it("reads a record's transaction from the node, with the fee the history gave", async () => {
        serve([[swap]])
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: {
                    eth_getTransactionByHash: evmRpcTransaction({
                        hash: hash(2) as `0x${string}`,
                        from: ME,
                        to: PEER,
                    }),
                },
            }),
        )
        const adapter = createEvmHistoryAdapter(ETHEREUM, testChainContext())
        const { items } = await adapter.getTransactionHistory(ME, MAINNET)

        const detail = await adapter.getTransactionDetail!(
            items[0]!.id,
            MAINNET,
            { ...items[0]!, fee: new Decimal('7') },
        )

        expect(detail).toMatchObject({
            family: 'evm',
            transaction: { isMined: true, feePaid: new Decimal('7') },
        })
    })
})
