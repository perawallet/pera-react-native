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
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest'
import { setupServer } from 'msw/node'
import { Decimal } from 'decimal.js'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    createEthereumBalanceHistoryOps,
    fetchGridBalances,
    priceAt,
    valueHolding,
    valuePortfolio,
    type BalanceHistoryRequest,
    type BalanceHistoryResponse,
    type GridPoint,
} from '../balance-history'
import { peraEvmHandlers } from '../msw-handlers'
import { nativeWhitelistItem } from '../../assets/api/msw-handlers'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { TEST_PERA_URL, testChainContext } from '../../__tests__/context'

const stored = vi.hoisted(() => ({
    holdings: {} as Record<string, { assetId: string; amount: string }[]>,
    decimals: {} as Record<string, number>,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<object>()),
    getAccountHoldings: vi.fn(
        async ({ accountAddress }: { accountAddress: string }) =>
            (stored.holdings[accountAddress] ?? []).map(row => ({
                assetId: row.assetId,
                amount: new Decimal(row.amount),
                native: null,
            })),
    ),
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<object>()),
    getAssetsByIds: vi.fn(async ({ assetIds }: { assetIds: string[] }) =>
        assetIds
            .filter(id => stored.decimals[id] !== undefined)
            .map(id => ({ assetId: id, decimals: stored.decimals[id] })),
    ),
}))

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ALICE = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const BOB = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ETH_ID = ETHEREUM.nativeAsset.assetId
const ETH = 'eip155:1/slip44:60'
const USDC_CAIP19 = `eip155:1/erc20:${USDC.toLowerCase()}`
const DAI_CAIP19 = 'eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f'
const NOW = Date.parse('2026-10-21T14:30:00Z')
const SERVICES = ['assets', 'prices']

const usd = (value: string) => new Decimal(value)
const pricePoint = (datetime: string, price: string) => ({
    timestamp: Date.parse(datetime),
    usdPrice: usd(price),
})
const answered = (
    timestamp: string,
    balances: Record<string, Record<string, string | null>>,
) => ({ timestamp, error: null, balances })
const failed = (timestamp: string, error: string) => ({
    timestamp,
    error,
    balances: null,
})
const chartPoint = (datetime: string, price: string) => ({
    datetime,
    price: new Decimal(price).toFixed(24),
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
beforeEach(() => {
    stored.holdings = {}
    stored.decimals = { [USDC]: 6 }
})
afterEach(() => {
    server.resetHandlers()
    server.events.removeAllListeners()
})
afterAll(() => server.close())

const recordRequests = (): Request[] => {
    const requests: Request[] = []
    server.events.on('request:start', ({ request }) => {
        requests.push(request.clone())
    })
    return requests
}

describe('priceAt', () => {
    const prices = [
        pricePoint('2026-10-21T10:00:00Z', '1'),
        pricePoint('2026-10-21T11:00:00Z', '2'),
    ]

    it('takes the last point at or before the time', () => {
        expect(
            priceAt(prices, Date.parse('2026-10-21T10:59:59Z'))?.toFixed(),
        ).toBe('1')
        expect(
            priceAt(prices, Date.parse('2026-10-21T11:00:00Z'))?.toFixed(),
        ).toBe('2')
    })

    it('has no price before the first point', () => {
        expect(priceAt(prices, Date.parse('2026-10-21T09:00:00Z'))).toBeNull()
    })
})

describe('valuation', () => {
    const at = (iso: string, balances: [string, string][]): GridPoint => ({
        timestamp: Date.parse(iso),
        balances: new Map(balances.map(([id, units]) => [id, usd(units)])),
    })
    const usdcPrices = {
        decimals: 6,
        prices: [pricePoint('2026-10-21T11:00:00Z', '1.5')],
    }
    const ethPrices = {
        decimals: 18,
        prices: [pricePoint('2026-10-21T10:00:00Z', '2000')],
    }

    it('values a holding in display units and leaves out a point with no price yet', () => {
        const points = valueHolding(
            [
                at('2026-10-21T10:00:00Z', [[USDC_CAIP19, '1000000']]),
                at('2026-10-21T11:00:00Z', [[USDC_CAIP19, '2500000']]),
                at('2026-10-21T12:00:00Z', []),
            ],
            USDC_CAIP19,
            usdcPrices,
        )

        expect(
            points.map(p => [p.amount.toFixed(), p.usdValue.toFixed()]),
        ).toEqual([
            ['2.5', '3.75'],
            ['0', '0'],
        ])
    })

    it('sums a portfolio, adds nothing for an unpriced asset, and states the total in ETH', () => {
        const [early, late] = valuePortfolio(
            [
                at('2026-10-21T10:00:00Z', [
                    [ETH, '500000000000000000'],
                    [USDC_CAIP19, '1000000'],
                ]),
                at('2026-10-21T11:00:00Z', [
                    [ETH, '500000000000000000'],
                    [USDC_CAIP19, '2000000'],
                ]),
            ],
            new Map([
                [ETH, ethPrices],
                [USDC_CAIP19, usdcPrices],
            ]),
            ETH,
        )

        expect(early?.usdValue.toFixed()).toBe('1000')
        expect(late?.usdValue.toFixed()).toBe('1003')
        expect(late?.nativeValue.toFixed()).toBe('0.5015')
    })
})

describe('fetchGridBalances', () => {
    it('splits a request under the read cap and keeps a point only when every call read it', async () => {
        const ids = Array.from(
            { length: 70 },
            (_, index) =>
                `eip155:1/erc20:0x${index.toString(16).padStart(40, '0')}`,
        )
        const bodies: BalanceHistoryRequest[] = []
        server.use(
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                balanceHistory: body => {
                    bodies.push(body)
                    return {
                        results: [
                            answered('2026-10-19T00:00:00Z', {
                                [ALICE.toLowerCase()]: {
                                    [body.asset_ids[0]!]: '1',
                                },
                            }),
                            bodies.length === 1
                                ? failed(
                                      '2026-10-20T00:00:00Z',
                                      'budget_exhausted',
                                  )
                                : answered('2026-10-20T00:00:00Z', {}),
                            failed(
                                '2026-10-21T00:00:00Z',
                                'before_chain_start',
                            ),
                        ],
                    } as BalanceHistoryResponse
                },
            }),
        )

        const points = await fetchGridBalances(
            SCOPE,
            ETHEREUM,
            [ALICE, BOB, '0x0000000000000000000000000000000000000001'],
            ids,
            'one-year',
        )

        // 73,000 / (3 addresses × 365 points) = 66 ids a call.
        expect(bodies.map(body => body.asset_ids.length).sort()).toEqual([
            4, 66,
        ])
        expect(bodies[0]?.addresses).toContain(ALICE.toLowerCase())
        expect(
            points?.map(p => [
                new Date(p.timestamp).toISOString(),
                p.balances.size,
            ]),
        ).toEqual([
            ['2026-10-19T00:00:00.000Z', 2],
            ['2026-10-21T00:00:00.000Z', 0],
        ])
    })

    it('answers null on a chain the backend serves no balance history for', async () => {
        server.use(...peraEvmHandlers({ baseUrl: TEST_PERA_URL }))

        await expect(
            fetchGridBalances(SCOPE, ETHEREUM, [ALICE], [ETH], 'one-day'),
        ).resolves.toBeNull()
    })
})

describe('the adapter methods', () => {
    const ops = (services = SERVICES) =>
        createEthereumBalanceHistoryOps(
            testChainContext({ services }),
            ETHEREUM,
            () => NOW,
        )

    it('values one holding over the period, ending on the stored balance now', async () => {
        stored.holdings[ALICE] = [{ assetId: USDC, amount: '3000000' }]
        const requests = recordRequests()
        server.use(
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                balanceHistory: {
                    results: [
                        answered('2026-10-20T15:00:00Z', {
                            [ALICE.toLowerCase()]: { [USDC_CAIP19]: '1000000' },
                        }),
                        answered('2026-10-21T14:00:00Z', {
                            [ALICE.toLowerCase()]: {},
                        }),
                    ],
                } as BalanceHistoryResponse,
                charts: {
                    [USDC_CAIP19]: [
                        chartPoint('2026-10-20T15:00:00Z', '1'),
                        chartPoint('2026-10-21T14:30:00Z', '1.1'),
                    ],
                },
            }),
        )

        const points = await ops().fetchHoldingBalanceHistory!(
            ALICE,
            USDC,
            'one-day',
            'USD',
            SCOPE,
        )

        expect(
            points.map(p => [
                p.timestamp,
                p.amount.toFixed(),
                p.usdValue.toFixed(),
            ]),
        ).toEqual([
            [Date.parse('2026-10-20T15:00:00Z'), '1', '1'],
            [Date.parse('2026-10-21T14:00:00Z'), '0', '0'],
            [NOW, '3', '3.3'],
        ])
        const chart = new URL(
            requests.find(r => r.url.includes('/assets/chart/'))!.url,
        ).searchParams
        expect(Object.fromEntries(chart)).toEqual({
            id: USDC_CAIP19,
            from: '2026-10-20',
            to: '2026-10-21',
            interval: 'hourly',
        })
    })

    it('sums the portfolio over the whitelist and stored holdings of every address', async () => {
        stored.holdings[ALICE] = [
            { assetId: ETH_ID, amount: '1000000000000000000' },
        ]
        stored.holdings[BOB] = [{ assetId: USDC, amount: '2000000' }]
        let asked: BalanceHistoryRequest | undefined
        server.use(
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                balanceHistory: body => {
                    asked = body
                    return {
                        results: [
                            answered('2026-10-21T00:00:00Z', {
                                [ALICE.toLowerCase()]: {
                                    [ETH]: '500000000000000000',
                                },
                                [BOB.toLowerCase()]: {
                                    [USDC_CAIP19]: '1000000',
                                },
                            }),
                        ],
                    } as BalanceHistoryResponse
                },
                charts: {
                    [ETH]: [chartPoint('2026-10-21T00:00:00Z', '2000')],
                    [USDC_CAIP19]: [chartPoint('2026-10-21T00:00:00Z', '1')],
                },
            }),
        )

        const points = await ops().fetchPortfolioHistory!(
            [ALICE, BOB],
            'one-month',
            SCOPE,
        )

        expect(asked?.asset_ids.sort()).toEqual([ETH, USDC_CAIP19].sort())
        expect(
            points.map(p => [p.usdValue.toFixed(), p.nativeValue.toFixed()]),
        ).toEqual([
            ['1001', '0.5005'],
            ['2002', '1.001'],
        ])
    })

    it('values a token held only in the past with no local row by its backend decimals', async () => {
        const dai = {
            ...nativeWhitelistItem(1),
            asset_id: DAI_CAIP19,
            type: 'erc20' as const,
            fraction_decimals: 18,
        }
        server.use(
            ...peraEvmHandlers({
                baseUrl: TEST_PERA_URL,
                whitelist: { 1: [nativeWhitelistItem(1), dai] },
                assets: { [DAI_CAIP19]: dai },
                balanceHistory: {
                    results: [
                        answered('2026-10-21T00:00:00Z', {
                            [ALICE.toLowerCase()]: {
                                [DAI_CAIP19]: '2000000000000000000',
                            },
                        }),
                    ],
                } as BalanceHistoryResponse,
                charts: {
                    [ETH]: [chartPoint('2026-10-21T00:00:00Z', '2000')],
                    [DAI_CAIP19]: [chartPoint('2026-10-21T00:00:00Z', '1')],
                },
            }),
        )

        const points = await ops().fetchPortfolioHistory!(
            [ALICE],
            'one-month',
            SCOPE,
        )

        expect(points.map(p => p.usdValue.toFixed())).toEqual(['2', '0'])
    })

    it('answers no points on a chain the backend serves no balance history for, and no portfolio source at all', async () => {
        server.use(...peraEvmHandlers({ baseUrl: TEST_PERA_URL }))

        await expect(
            ops().fetchHoldingBalanceHistory!(
                ALICE,
                USDC,
                'one-day',
                'USD',
                SCOPE,
            ),
        ).resolves.toEqual([])
        await expect(
            ops().fetchPortfolioHistory!([ALICE], 'one-day', SCOPE),
        ).resolves.toBeNull()
    })

    it('answers no points without a request on a scope missing the assets or prices service', async () => {
        const requests = recordRequests()

        await expect(
            ops(['assets']).fetchPortfolioHistory!([ALICE], 'one-day', SCOPE),
        ).resolves.toBeNull()
        await expect(
            ops(['prices']).fetchHoldingBalanceHistory!(
                ALICE,
                USDC,
                'one-day',
                'USD',
                SCOPE,
            ),
        ).resolves.toEqual([])
        expect(requests).toEqual([])
    })
})
