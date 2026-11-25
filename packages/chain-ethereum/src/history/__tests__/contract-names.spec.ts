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
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type {
    ChainScope,
    TransactionRecord,
    TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { PERA_URL } from '../../__tests__/pera-backend'
import { contractPath } from '../../contracts/api/endpoints'
import {
    contractMetadataResponse,
    peraEvmContractHandlers,
} from '../../contracts/api/msw-handlers'
import {
    CONTRACT_NAME_TTL_MS,
    useEvmContractNamesStore,
    withContractNames,
} from '../contract-names'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
        ['contracts'],
    ),
)

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const POOL = '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2'
const WALLET = '0x1111111111111111111111111111111111111111'
const UNVERIFIED = '0x2222222222222222222222222222222222222222'
const ROUTER = '0x3333333333333333333333333333333333333333'
const UNISWAP_LOGO = 'https://pera.test/uniswap.png'

const server = setupServer()
const requested: string[] = []

const withLogo = (
    response: ReturnType<typeof contractMetadataResponse>,
): ReturnType<typeof contractMetadataResponse> => ({
    ...response,
    project: { ...response.project, logo_png: UNISWAP_LOGO },
})

const serveMetadata = (): void => {
    server.use(
        ...peraEvmContractHandlers({
            baseUrl: PERA_URL,
            contractMetadata: {
                [POOL]: contractMetadataResponse(
                    'Pool V3',
                    'Aave',
                    'https://aave.com',
                ),
                [UNVERIFIED]: contractMetadataResponse(
                    'Lookalike',
                    'Lookalike',
                    'https://example.com',
                    'unverified',
                ),
                [ROUTER]: withLogo(
                    contractMetadataResponse(
                        'Universal Router',
                        'Uniswap',
                        'https://uniswap.org',
                    ),
                ),
            },
        }),
    )
}

const record = (
    id: string,
    summary: Partial<TransactionSummary>,
): TransactionRecord => ({
    id,
    scope: MAINNET,
    status: 'confirmed',
    summary: {
        kind: 'contract-call',
        title: { key: 'transactions.list_item.contract_interaction' },
        ...summary,
    } as TransactionSummary,
})

const subtitleOf = (r: TransactionRecord): unknown => r.summary.subtitle

beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' })
    server.events.on('request:start', ({ request }) => {
        requested.push(new URL(request.url).pathname)
    })
})
afterEach(() => {
    server.resetHandlers()
    requested.length = 0
    useEvmContractNamesStore.getState().resetState()
    vi.useRealTimers()
})
afterAll(() => server.close())

describe('withContractNames', () => {
    it('names a counterparty Pera vouches for by its project, asking once per distinct address on the page', async () => {
        serveMetadata()

        const named = await withContractNames(
            [
                record('a', { counterparty: POOL }),
                record('b', {
                    counterparty: POOL.toUpperCase().replace('0X', '0x'),
                }),
                record('c', { counterparty: WALLET }),
                record('d', { counterparty: UNVERIFIED }),
            ],
            MAINNET,
            ETHEREUM,
        )

        const aave = {
            key: 'transactions.list_item.interpreted_title',
            params: { title: 'Aave' },
        }
        expect(named.map(subtitleOf)).toEqual([
            aave,
            aave,
            undefined,
            undefined,
        ])
        expect(named[0]?.summary.subtitleEllipsis).toBe('tail')
        expect(named.map(r => r.summary.projectName)).toEqual([
            'Aave',
            'Aave',
            undefined,
            undefined,
        ])
        expect([...requested].sort()).toEqual(
            [POOL, WALLET, UNVERIFIED].map(a => contractPath(1, a)).sort(),
        )
    })

    it("keeps a bundled name, adding only the project's logo, and leaves a row without a counterparty unasked", async () => {
        serveMetadata()
        const bundled = (counterparty: string) =>
            record(counterparty, {
                counterparty,
                subtitle: {
                    key: 'transactions.list_item.interpreted_title',
                    params: { title: 'Uniswap' },
                },
                projectName: 'Uniswap',
            })
        const anonymous = record('b', {})

        const named = await withContractNames(
            [bundled(ROUTER), bundled(POOL), anonymous],
            MAINNET,
            ETHEREUM,
        )

        expect(named).toEqual([
            {
                ...bundled(ROUTER),
                summary: {
                    ...bundled(ROUTER).summary,
                    projectLogoUrl: UNISWAP_LOGO,
                },
            },
            bundled(POOL),
            anonymous,
        ])
        expect([...requested].sort()).toEqual(
            [ROUTER, POOL].map(a => contractPath(1, a)).sort(),
        )
    })

    it('carries the logo of a project it names', async () => {
        serveMetadata()

        const [named] = await withContractNames(
            [record('a', { counterparty: ROUTER })],
            MAINNET,
            ETHEREUM,
        )

        expect(named?.summary).toMatchObject({
            projectName: 'Uniswap',
            projectLogoUrl: UNISWAP_LOGO,
        })
    })

    it("names an approval's spender as the bundled names do, keeping an unlimited grant unlimited", async () => {
        serveMetadata()
        const approval = { kind: 'approval' as const, counterparty: POOL }
        const unlimited = {
            key: 'transactions.list_item.unlimited_approval_for',
            params: { spender: '0x8787…a4e2' },
        }

        const named = await withContractNames(
            [
                record('a', approval),
                record('b', { ...approval, subtitle: unlimited }),
            ],
            MAINNET,
            ETHEREUM,
        )

        expect(named.map(subtitleOf)).toEqual([
            {
                key: 'transactions.list_item.approval_for',
                params: { spender: 'Aave' },
            },
            { ...unlimited, params: { spender: 'Aave' } },
        ])
        expect(named.map(r => r.summary.projectName)).toEqual(['Aave', 'Aave'])
        expect(requested).toEqual([contractPath(1, POOL)])
    })

    it('answers a later page from the cache, misses included, until an entry is a week old', async () => {
        serveMetadata()
        const page = [
            record('a', { counterparty: POOL }),
            record('b', { counterparty: WALLET }),
        ]
        await withContractNames(page, MAINNET, ETHEREUM)
        requested.length = 0

        const again = await withContractNames(page, MAINNET, ETHEREUM)

        expect(subtitleOf(again[0]!)).toBeDefined()
        expect(requested).toEqual([])

        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(Date.now() + CONTRACT_NAME_TTL_MS)
        await withContractNames(page, MAINNET, ETHEREUM)

        expect(requested).toHaveLength(2)
    })

    it('keeps the row unnamed when the lookup fails, and asks again on the next read', async () => {
        server.use(
            http.get(`${PERA_URL}${contractPath(':chainId', ':address')}`, () =>
                HttpResponse.json({}, { status: 500 }),
            ),
        )
        const page = [record('a', { counterparty: POOL })]

        const named = await withContractNames(page, MAINNET, ETHEREUM)
        serveMetadata()
        const retried = await withContractNames(page, MAINNET, ETHEREUM)

        expect(subtitleOf(named[0]!)).toBeUndefined()
        expect(subtitleOf(retried[0]!)).toBeDefined()
    })
})
