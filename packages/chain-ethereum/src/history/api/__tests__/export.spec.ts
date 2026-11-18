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
import { getAddress } from 'viem'
import { delay, http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { CsvExportError } from '@perawallet/wallet-core-transactions'
import {
    PERA_URL,
    TEST_API_KEY,
    TEST_INTEGRITY_TOKEN,
} from '../../../__tests__/pera-backend'
import { ETHEREUM } from '../../../__tests__/evm-chains'
import { testChainContext } from '../../../__tests__/context'
import { createEvmHistoryAdapter } from '../../adapter'
import { EVM_HISTORY_EXPORT_BOUNDS, fetchEvmHistoryCsv } from '../export'

vi.mock('@perawallet/wallet-core-config', async importOriginal =>
    (await import('../../../__tests__/pera-backend')).withEthereumPeraBackend(
        importOriginal,
    ),
)

const MAINNET: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045'
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
const ROUTE = `${PERA_URL}/api/v3/evm/:chainId/accounts/:address/export-history/`
const CSV = '"Date","Chain"\r\n"2026-01-01 00:00:00","Ethereum"\r\n'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
    vi.useRealTimers()
    server.resetHandlers()
})
afterAll(() => server.close())

const serveCsv = (filename: string, onRequest?: (request: Request) => void) =>
    server.use(
        http.get(ROUTE, ({ request }) => {
            onRequest?.(request)
            return new HttpResponse(CSV, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename=${filename}`,
                },
            })
        }),
    )

const serveError = (status: number, code: string) => {
    const requests = { count: 0 }
    server.use(
        http.get(ROUTE, () => {
            requests.count += 1
            return HttpResponse.json({ error: 'refused', code }, { status })
        }),
    )
    return requests
}

const exportCsvError = async (): Promise<CsvExportError> =>
    fetchEvmHistoryCsv(ETHEREUM, {
        accountAddress: ME,
        scope: MAINNET,
    }).then(
        () => {
            throw new Error('expected the export to fail')
        },
        (error: unknown) => {
            expect(error).toBeInstanceOf(CsvExportError)
            return error as CsvExportError
        },
    )

describe('fetchEvmHistoryCsv', () => {
    it('asks the EIP-155 route for the lowercased address with the API key, integrity token and filters', async () => {
        let request: Request | undefined
        serveCsv('Transactions-1-0xd8da--6045-Pera.csv', received => {
            request = received
        })

        const result = await fetchEvmHistoryCsv(ETHEREUM, {
            accountAddress: getAddress(ME),
            scope: MAINNET,
            dateRange: { startDate: '2026-01-01', endDate: '2026-02-01' },
            assetId: USDC,
        })

        const url = new URL(request?.url ?? '')
        expect(url.pathname).toBe(
            `/api/v3/evm/1/accounts/${ME}/export-history/`,
        )
        expect(Object.fromEntries(url.searchParams)).toEqual({
            start_date: '2026-01-01',
            end_date: '2026-02-01',
            asset_id: `eip155:1/erc20:${USDC.toLowerCase()}`,
        })
        expect(request?.headers.get('x-api-key')).toBe(TEST_API_KEY)
        expect(request?.headers.get('x-app-integrity-token')).toBe(
            TEST_INTEGRITY_TOKEN,
        )
        expect(result).toMatchObject({
            csvContent: CSV,
            filename: 'Transactions-1-0xd8da--6045-Pera.csv',
            rowCount: 1,
            assetId: USDC,
        })
    })

    it('filters the native coin by its SLIP-44 id', async () => {
        let url: URL | undefined
        serveCsv('Transactions-1-0xd8da--6045-Pera.csv', request => {
            url = new URL(request.url)
        })

        await fetchEvmHistoryCsv(ETHEREUM, {
            accountAddress: ME,
            scope: MAINNET,
            assetId: ETHEREUM.nativeAsset.assetId,
        })

        expect(url?.searchParams.get('asset_id')).toBe('eip155:1/slip44:60')
    })

    it("keeps the backend's TRUNCATED name on a cut-short export", async () => {
        serveCsv('TRUNCATED-Transactions-1-0xd8da--6045-Pera.csv')

        const { filename } = await fetchEvmHistoryCsv(ETHEREUM, {
            accountAddress: ME,
            scope: MAINNET,
        })

        expect(filename).toBe('TRUNCATED-Transactions-1-0xd8da--6045-Pera.csv')
    })

    it.each(['../escape.csv', '"receipt.csv/escape.csv"', 'receipt.csv.exe'])(
        'refuses the invalid served filename %s',
        async served => {
            serveCsv(served)

            const { filename } = await fetchEvmHistoryCsv(ETHEREUM, {
                accountAddress: ME,
                scope: MAINNET,
            })

            expect(filename).toBe(`${ME}.csv`)
        },
    )

    it('carries the busy-network copy on a 429', async () => {
        serveError(429, 'upstream_rate_limited')

        const error = await exportCsvError()

        expect(error.statusCode).toBe(429)
        expect(error.metadata).toMatchObject({
            titleKey: 'errors.evm.rate_limited.title',
            messageKey: 'errors.evm.rate_limited.body',
        })
    })

    it('carries the server-error copy on a 503 without rerunning the export', async () => {
        const requests = serveError(503, 'upstream_unavailable')

        const error = await exportCsvError()

        expect(requests.count).toBe(1)
        expect(error.metadata).toMatchObject({
            titleKey: 'errors.api.server_error.title',
            messageKey: 'errors.api.server_error.body',
        })
    })

    it('waits past the default timeout for the backend to build the file', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        server.use(
            http.get(ROUTE, async () => {
                await delay(EVM_HISTORY_EXPORT_BOUNDS.timeout - 1000)
                return new HttpResponse(CSV, {
                    headers: { 'Content-Type': 'text/csv' },
                })
            }),
        )

        const outcome = fetchEvmHistoryCsv(ETHEREUM, {
            accountAddress: ME,
            scope: MAINNET,
        })
        await vi.advanceTimersByTimeAsync(EVM_HISTORY_EXPORT_BOUNDS.timeout)

        await expect(outcome).resolves.toMatchObject({ csvContent: CSV })
    })

    it.each([
        [404, 'not_found'],
        [422, 'invalid_asset_id'],
    ])('leaves a %i to the generic copy', async (status, code) => {
        serveError(status, code)

        const error = await exportCsvError()

        expect(error.statusCode).toBe(status)
        expect(error.metadata.messageKey).toBeUndefined()
    })

    it('is what the history adapter exports with', async () => {
        serveCsv('Transactions-1-0xd8da--6045-Pera.csv')
        const adapter = createEvmHistoryAdapter(ETHEREUM, testChainContext())

        const result = await adapter.exportCsv?.({
            accountAddress: ME,
            scope: MAINNET,
        })

        expect(result?.filename).toBe('Transactions-1-0xd8da--6045-Pera.csv')
    })
})
