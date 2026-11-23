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
import { http, HttpResponse, type JsonBodyType } from 'msw'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { isRequestBudgetSpentError } from '@perawallet/wallet-core-shared'
import { peraEvmHandlers } from '../../accounts/msw-handlers'
import { UnknownEvmNetworkError } from '../../blockchain/utils/caip19'
import { readBackendRecording } from '../../__tests__/backend-recordings'
import {
    PERA_URL,
    TEST_API_KEY,
    TEST_INTEGRITY_TOKEN,
} from '../../__tests__/pera-backend'
import { evmCapabilityDefaults } from '../../capability-defaults'
import { createEvmHistoryAdapter, getEvmTransactionHistory } from '../adapter'
import { ETHEREUM, POLYGON } from '../../__tests__/evm-chains'
import { fetchHistoryPage } from '../api/endpoints'
import { evmHistoryItem, evmNftTransferLeg } from '../api/msw-handlers'
import {
    createHistoryPageBudget,
    type HistoryPageBudget,
} from '../api/page-budget'
import {
    evmRpcHandlers,
    evmSignedRpcTransaction,
} from '../../blockchain/msw-handlers'
import { TEST_RPC_URL, testChainContext } from '../../__tests__/context'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const supplementary = vi.hoisted(() => ({
    share: undefined as HistoryPageBudget | undefined,
}))
vi.mock('../api/page-budget', async importOriginal => {
    const actual = await importOriginal<typeof import('../api/page-budget')>()
    return {
        ...actual,
        sharedSupplementaryPageShare: () =>
            supplementary.share ?? actual.sharedSupplementaryPageShare(),
    }
})

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
afterEach(() => {
    server.resetHandlers()
    supplementary.share = undefined
})
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

    it('leaves the fee off a row known only from a transfer log, and keeps it on one another address signed', async () => {
        serve([
            [
                evmHistoryItem({
                    hash: hash(1),
                    fee: '21000',
                    nft_transfers: [evmNftTransferLeg({ from: PEER, to: ME })],
                }),
                evmHistoryItem({
                    hash: hash(2),
                    from: PEER,
                    to: ME,
                    value: '5',
                    fee: '21000',
                }),
            ],
        ])

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items[0]?.fee).toBeUndefined()
        expect(items[0]?.initiator).toBeUndefined()
        expect(items[1]?.fee).toEqual(new Decimal(21000))
        expect(items[1]?.initiator).toBe(PEER)
    })

    it("reads a plain POL transfer as a native receive, not as a token leg of Polygon's 0x…1010 mirror", async () => {
        const mirror = '0x0000000000000000000000000000000000001010'
        const scope: ChainScope = { chainId: 'polygon', networkId: 'mainnet' }
        serve([
            [
                evmHistoryItem({
                    hash: hash(1),
                    from: PEER,
                    to: ME,
                    value: '7',
                    token_transfers: [
                        {
                            asset_id: `eip155:137/erc20:${mirror}`,
                            contract: mirror,
                            from: PEER,
                            to: ME,
                            value: '7',
                            token_name: 'Polygon Ecosystem Token',
                            token_symbol: 'POL',
                            token_decimals: 18,
                        },
                    ],
                    balance_impacts: [
                        { asset_id: 'eip155:137/slip44:966', amount: '7' },
                        { asset_id: `eip155:137/erc20:${mirror}`, amount: '7' },
                    ],
                }),
            ],
        ])

        const { items } = await getEvmTransactionHistory(POLYGON, ME, scope)

        expect(items[0]?.summary).toMatchObject({
            kind: 'transfer',
            direction: 'in',
            amount: {
                assetRef: POLYGON.descriptor.nativeAsset.ref,
                value: new Decimal(7),
            },
        })
    })

    it('reads a token leg moving nothing out of the account to a look-alike, on a row with no sender, as an unsigned send', async () => {
        const token = '0x0000000000000000000000000000000000000c0c'
        const lookAlike = `${PEER.slice(0, 5)}${'1'.repeat(34)}${PEER.slice(-3)}`
        serve([
            [
                evmHistoryItem({
                    hash: hash(1),
                    token_transfers: [
                        {
                            asset_id: `eip155:1/erc20:${token}`,
                            contract: token,
                            from: ME,
                            to: lookAlike,
                            value: '0',
                            token_name: 'Fake Token',
                            token_symbol: 'FAKE',
                            token_decimals: 6,
                        },
                    ],
                }),
            ],
        ])

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items[0]?.summary).toMatchObject({
            kind: 'token-transfer',
            direction: 'out',
        })
        expect(items[0]?.summary.counterparty?.toLowerCase()).toBe(lookAlike)
        expect(items[0]?.initiator).toBeUndefined()
        expect(items[0]?.fee).toBeUndefined()
    })

    it('carries the block number onto the record, and keeps a row whose block number is unreadable', async () => {
        serve([
            [
                evmHistoryItem({ hash: hash(1), block_number: 19_000_000 }),
                {
                    ...evmHistoryItem({ hash: hash(2) }),
                    block_number: 'later' as unknown as number,
                },
            ],
        ])

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items).toHaveLength(2)
        expect(items[0]?.blockNumber).toBe(19_000_000)
        expect(items[1]?.blockNumber).toBeUndefined()
    })

    it("names a single NFT's standard and collection on the record, and no NFT on a batch or a plain send", async () => {
        const nftRow = (
            n: number,
            legs: ReturnType<typeof evmNftTransferLeg>[],
        ) =>
            evmHistoryItem({
                hash: hash(n),
                from: PEER,
                to: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
                value: '0',
                method: 'safeTransferFrom',
                nft_transfers: legs,
            })
        serve([
            [
                nftRow(1, [
                    evmNftTransferLeg({
                        standard: 'erc1155',
                        from: PEER,
                        to: ME,
                    }),
                ]),
                nftRow(2, [
                    evmNftTransferLeg({ from: PEER, to: ME, token_id: '1' }),
                    evmNftTransferLeg({ from: PEER, to: ME, token_id: '2' }),
                ]),
                send,
            ],
        ])

        const { items } = await getEvmTransactionHistory(ETHEREUM, ME, MAINNET)

        expect(items.map(item => item.chainData)).toEqual([
            {
                family: 'evm',
                nft: {
                    standard: 'erc1155',
                    collectionName: 'Bored Ape Yacht Club',
                },
            },
            { family: 'evm' },
            { family: 'evm' },
        ])
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

    it('has at most two pages in flight, and reads the rest as those answer', async () => {
        let inFlight = 0
        let mostInFlight = 0
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                async () => {
                    inFlight++
                    mostInFlight = Math.max(mostInFlight, inFlight)
                    await new Promise(resolve => setTimeout(resolve, 10))
                    inFlight--
                    return HttpResponse.json({
                        next: null,
                        previous: null,
                        results: [],
                    })
                },
            ),
        )

        const pages = await Promise.all(
            Array.from({ length: 5 }, () =>
                getEvmTransactionHistory(ETHEREUM, ME, MAINNET),
            ),
        )

        expect(pages).toHaveLength(5)
        expect(mostInFlight).toBe(2)
    })

    it('skips a cancelled queued page and lets the foreground read take its slot', async () => {
        const started: string[] = []
        const releases = new Map<string, () => void>()
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                async ({ request }) => {
                    const cursor = new URL(request.url).searchParams.get(
                        'cursor',
                    )!
                    started.push(cursor)
                    if (cursor !== 'foreground') {
                        await new Promise<void>(resolve =>
                            releases.set(cursor, resolve),
                        )
                    }
                    return HttpResponse.json({ next: null, results: [] })
                },
            ),
        )
        const adapter = createEvmHistoryAdapter(ETHEREUM, testChainContext())
        const read = (cursor: string, signal?: AbortSignal) =>
            adapter.getTransactionHistory(
                ME,
                MAINNET,
                { cursor },
                {
                    capabilities: evmCapabilityDefaults,
                    signal,
                },
            )
        const first = read('first')
        const second = read('second')
        const controller = new AbortController()
        let obsolete: Promise<unknown> | undefined
        let foreground: Promise<unknown> | undefined
        try {
            await vi.waitFor(() => expect(started).toEqual(['first', 'second']))
            obsolete = read('obsolete', controller.signal).catch(error => error)
            foreground = read('foreground')
            controller.abort()

            releases.get('first')!()

            await vi.waitFor(() =>
                expect(started).toEqual(['first', 'second', 'foreground']),
            )
            expect(await obsolete).toHaveProperty('name', 'AbortError')
            await foreground
            expect(started).toEqual(['first', 'second', 'foreground'])
        } finally {
            releases.forEach(release => release())
            await Promise.allSettled([first, second, obsolete, foreground])
        }
    })

    it('reads a page someone is waiting on before a queued background scan page', async () => {
        const started: string[] = []
        const releases = new Map<string, () => void>()
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                async ({ request }) => {
                    const cursor = new URL(request.url).searchParams.get(
                        'cursor',
                    )!
                    started.push(cursor)
                    await new Promise<void>(resolve =>
                        releases.set(cursor, resolve),
                    )
                    return HttpResponse.json({ next: null, results: [] })
                },
            ),
        )
        const read = (cursor: string) =>
            getEvmTransactionHistory(ETHEREUM, ME, MAINNET, { cursor })
        const first = read('first')
        const second = read('second')
        let background: Promise<unknown> | undefined
        let foreground: Promise<unknown> | undefined
        try {
            await vi.waitFor(() => expect(started).toEqual(['first', 'second']))
            background = fetchHistoryPage(
                MAINNET,
                ETHEREUM,
                ME,
                { cursor: 'background' },
                { isBackground: true },
            )
            foreground = read('foreground')

            releases.get('first')!()

            await vi.waitFor(() =>
                expect(started).toEqual(['first', 'second', 'foreground']),
            )
        } finally {
            for (const cursor of ['second', 'foreground', 'background']) {
                await vi.waitFor(() => expect(releases.has(cursor)).toBe(true))
                releases.get(cursor)!()
            }
            await Promise.allSettled([first, second, background, foreground])
        }
    })

    it('cancels an active HTTP read without waiting for its response', async () => {
        let received: Request | undefined
        let release: (() => void) | undefined
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                async ({ request }) => {
                    received = request
                    await new Promise<void>(resolve => {
                        release = resolve
                    })
                    return HttpResponse.json({ next: null, results: [] })
                },
            ),
        )
        const adapter = createEvmHistoryAdapter(ETHEREUM, testChainContext())
        const controller = new AbortController()
        const read = adapter
            .getTransactionHistory(ME, MAINNET, undefined, {
                capabilities: evmCapabilityDefaults,
                signal: controller.signal,
            })
            .then(
                () => 'fulfilled',
                () => 'rejected',
            )
        try {
            await vi.waitFor(() => expect(received).toBeDefined())

            controller.abort()

            await vi.waitFor(() => expect(received?.signal.aborted).toBe(true))
            expect(await read).toBe('rejected')
        } finally {
            release?.()
            await read
        }
    })
})

describe('filtered to one asset', () => {
    const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    const BAYC = '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'

    const readParams = async (assetId: string, cursor?: string) => {
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
        await createEvmHistoryAdapter(
            ETHEREUM,
            testChainContext(),
        ).getTransactionHistory(ME, MAINNET, cursor ? { cursor } : undefined, {
            capabilities: evmCapabilityDefaults,
            assetId,
        })
        return url?.searchParams
    }

    it('asks the backend for an ERC-20 by its lowercased contract, on a cursor page too', async () => {
        const params = await readParams(getAddress(USDC), 'abc')

        expect(params?.get('asset_id')).toBe(`eip155:1/erc20:${USDC}`)
        expect(params?.get('cursor')).toBe('abc')
    })

    it('reads the native coin’s history unfiltered, since its view drops other assets’ legs', async () => {
        const params = await readParams(ETHEREUM.nativeAsset.assetId)

        expect(params?.has('asset_id')).toBe(false)
    })

    it('reads an ERC-20 view’s rows with no fee or initiator, as the view names no sender', async () => {
        const { request, response } = readBackendRecording(
            'evm-account-transactions-erc20',
        )
        server.use(
            http.get(
                `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/transactions/`,
                () => HttpResponse.json(response as JsonBodyType),
            ),
        )

        const { items } = await getEvmTransactionHistory(
            ETHEREUM,
            request.pathParams?.address ?? '',
            MAINNET,
            undefined,
            false,
            getAddress('0x6b175474e89094c44da98b954eedeac495271d0f'),
        )

        expect(items.length).toBeGreaterThan(0)
        expect(
            items.filter(
                item => item.fee !== undefined || item.initiator !== undefined,
            ),
        ).toEqual([])
    })

    it('reads an NFT’s history unfiltered, since the backend filters no NFT view', async () => {
        const params = await readParams(`${getAddress(BAYC)}/1234`)

        expect(params?.has('asset_id')).toBe(false)
    })

    it('reads unfiltered, rather than failing, for an id it cannot place', async () => {
        const params = await readParams('not-a-contract')

        expect(params?.has('asset_id')).toBe(false)
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
        [false, 'transactions.list_item.contract_interaction'],
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

    it('holds a supplementary read to its capped share', async () => {
        serve([[swap], [swap]])
        supplementary.share = createHistoryPageBudget(
            () => 0,
            60_000,
            () => 0,
        )
        const adapter = createEvmHistoryAdapter(ETHEREUM, testChainContext())

        const refusal = await adapter
            .getTransactionHistory(
                ME,
                MAINNET,
                { cursor: 'older' },
                {
                    capabilities: evmCapabilityDefaults,
                    isSupplementary: true,
                },
            )
            .catch((error: unknown) => error)

        expect(isRequestBudgetSpentError(refusal)).toBe(true)
    })

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
            'transactions.list_item.contract_interaction',
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
            'transactions.list_item.contract_interaction',
        )
    })

    it("reads a record's transaction from the node, with the fee the history gave", async () => {
        const mined = await evmSignedRpcTransaction({
            chainId: 1,
            to: PEER,
            gasPrice: 1n,
        })
        serve([[{ ...swap, hash: mined.hash }]])
        server.use(
            ...evmRpcHandlers({
                rpcUrl: TEST_RPC_URL,
                responses: { eth_getTransactionByHash: mined },
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
