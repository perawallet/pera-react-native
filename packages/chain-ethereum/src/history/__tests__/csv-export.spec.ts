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
import { Decimal } from 'decimal.js'
import { getAddress } from 'viem'
import { setupServer } from 'msw/node'
import {
    i18nKey,
    type BalanceChange,
    type ChainScope,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    runMigrations,
    migrations,
    type Database,
} from '@perawallet/wallet-core-database'
import { createTestDatabase } from '@perawallet/wallet-core-database/test-utils'
import {
    assetsChainAdapters,
    type AssetsChainAdapter,
} from '@perawallet/wallet-core-assets'
import {
    CsvExportError,
    historyChainAdapters,
} from '@perawallet/wallet-core-transactions'
import { ETHEREUM } from '../../__tests__/evm-chains'
import { testChainContext } from '../../__tests__/context'
import { createEvmHistoryAdapter } from '../adapter'
import { evmHistoryItem } from '../api/msw-handlers'
import { evmHistoryItemSchema, type EvmHistoryItem } from '../api/schema'
import { buildEvmHistoryCsv, exportStoredEvmHistoryCsv } from '../csv-export'
import { storeEvmHistoryPage } from '../history-cache'

const mocks = vi.hoisted(() => ({ db: undefined as unknown as Database }))

vi.mock('@perawallet/wallet-core-database', async importActual => ({
    ...(await importActual<
        typeof import('@perawallet/wallet-core-database')
    >()),
    getDatabase: () => mocks.db,
}))

// Any request fails the spec: an export reads the device alone.
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'
const OTHER_ME = '0x00000000000000000000000000000000000000cc'
const PEER = '0x00000000000000000000000000000000000000bb'
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`
const NATIVE_ID = ETHEREUM.nativeAsset.assetId
const ETH = new Decimal('1000000000000000000')
const FEE = '21000000000000'
const HEADER =
    '"Date (UTC)","Transaction Hash","Block","Status","Type","Direction","Asset","Asset ID","Amount","Amount (base units)","Fee","Fee Asset","From","Counterparty"'

const cellsOf = (csv: string): string[][] =>
    csv
        .split('\r\n')
        .filter(line => line.length > 0)
        .map(line => line.slice(1, -1).split('","'))

const summary = (
    overrides: Partial<TransactionSummary>,
): TransactionSummary => ({
    kind: 'transfer',
    title: { key: i18nKey('transactions.list_item.approval') },
    direction: 'out',
    icon: 'send',
    ...overrides,
})

const record = (
    overrides: Partial<TransactionRecord> = {},
): TransactionRecord => ({
    id: hash(1),
    scope: SCOPE,
    status: 'confirmed',
    timestamp: Date.parse('2026-01-02T03:04:05Z'),
    blockNumber: 42,
    fee: new Decimal(FEE),
    initiator: ME,
    summary: summary({}),
    chainData: { family: 'evm' },
    ...overrides,
})

const native = (value: Decimal): BalanceChange => ({
    assetRef: { chainId: 'ethereum', assetId: NATIVE_ID },
    value,
})

const usdc = (value: Decimal, decimals: number | undefined): BalanceChange => ({
    assetRef: { chainId: 'ethereum', assetId: USDC },
    value,
    ...(decimals !== undefined && { display: { symbol: 'USDC', decimals } }),
})

describe('buildEvmHistoryCsv', () => {
    it('writes the header row', () => {
        const csv = buildEvmHistoryCsv([], ME, ETHEREUM)

        expect(csv).toBe(`${HEADER}\r\n`)
    })

    it('writes an ETH send as a negative amount with the fee in ETH', () => {
        const csv = buildEvmHistoryCsv(
            [
                record({
                    summary: summary({
                        counterparty: PEER,
                        amount: { assetRef: native(ETH).assetRef, value: ETH },
                    }),
                }),
            ],
            ME,
            ETHEREUM,
        )

        expect(cellsOf(csv)[1]).toEqual([
            '2026-01-02 03:04:05',
            hash(1),
            '42',
            'confirmed',
            'transfer',
            'out',
            'ETH',
            NATIVE_ID,
            '-1',
            '-1000000000000000000',
            '0.000021',
            'ETH',
            ME,
            PEER,
        ])
    })

    it('writes a received token with its decimals as a positive amount', () => {
        const csv = buildEvmHistoryCsv(
            [
                record({
                    fee: undefined,
                    initiator: PEER,
                    summary: summary({
                        kind: 'token-transfer',
                        direction: 'in',
                        balanceChanges: [usdc(new Decimal('2500000'), 6)],
                    }),
                }),
            ],
            ME,
            ETHEREUM,
        )

        const [, row] = cellsOf(csv)
        expect(row.slice(6, 10)).toEqual(['USDC', USDC, '2.5', '2500000'])
    })

    it('leaves the amount empty for a token with no decimals', () => {
        const csv = buildEvmHistoryCsv(
            [
                record({
                    summary: summary({
                        kind: 'token-transfer',
                        balanceChanges: [usdc(new Decimal('-7'), undefined)],
                    }),
                }),
            ],
            ME,
            ETHEREUM,
        )

        const [, row] = cellsOf(csv)
        expect(row.slice(6, 10)).toEqual(['', USDC, '', '-7'])
    })

    it('writes a swap as two rows with the fee on the first only', () => {
        const csv = buildEvmHistoryCsv(
            [
                record({
                    summary: summary({
                        kind: 'swap',
                        balanceChanges: [
                            native(ETH.negated()),
                            usdc(new Decimal('3000000000'), 6),
                        ],
                    }),
                }),
            ],
            ME,
            ETHEREUM,
        )

        const [, first, second] = cellsOf(csv)
        expect(first.slice(6, 12)).toEqual([
            'ETH',
            NATIVE_ID,
            '-1',
            '-1000000000000000000',
            '0.000021',
            'ETH',
        ])
        expect(second.slice(6, 12)).toEqual([
            'USDC',
            USDC,
            '3000',
            '3000000000',
            '',
            '',
        ])
    })

    it('writes an approval as one row with empty asset cells and the fee', () => {
        const csv = buildEvmHistoryCsv(
            [
                record({
                    summary: summary({ kind: 'approval', direction: 'none' }),
                }),
            ],
            ME,
            ETHEREUM,
        )

        const rows = cellsOf(csv)
        expect(rows).toHaveLength(2)
        expect(rows[1].slice(6, 12)).toEqual([
            '',
            '',
            '',
            '',
            '0.000021',
            'ETH',
        ])
    })

    it('writes a failed transaction with its status', () => {
        const csv = buildEvmHistoryCsv(
            [record({ status: 'failed' })],
            ME,
            ETHEREUM,
        )

        expect(cellsOf(csv)[1][3]).toBe('failed')
    })

    it('leaves the fee out of a transfer another address paid for', () => {
        const csv = buildEvmHistoryCsv(
            [
                record({
                    initiator: PEER,
                    summary: summary({
                        direction: 'in',
                        amount: { assetRef: native(ETH).assetRef, value: ETH },
                    }),
                }),
            ],
            ME,
            ETHEREUM,
        )

        const [, row] = cellsOf(csv)
        expect(row.slice(8, 12)).toEqual(['1', '1000000000000000000', '', ''])
    })

    it('keeps a token symbol from running as a formula', () => {
        const hostile: BalanceChange = {
            assetRef: { chainId: 'ethereum', assetId: USDC },
            value: new Decimal('-5'),
            display: { symbol: '=HYPERLINK("x")', decimals: 0 },
        }

        const csv = buildEvmHistoryCsv(
            [record({ summary: summary({ balanceChanges: [hostile] }) })],
            ME,
            ETHEREUM,
        )

        expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
        expect(cellsOf(csv)[1][8]).toBe('-5')
    })
})

const item = (
    overrides: Parameters<typeof evmHistoryItem>[0] = {},
): EvmHistoryItem => evmHistoryItemSchema.parse(evmHistoryItem(overrides))

const ethSent = (n: number, blockTime: string, to = PEER) =>
    item({
        hash: hash(n),
        from: ME,
        to,
        value: ETH.toFixed(),
        fee: FEE,
        block_time: blockTime,
        balance_impacts: [
            {
                asset_id: 'eip155:1/slip44:60',
                amount: ETH.plus(FEE).negated().toFixed(),
            },
        ],
    })

const usdcSent = (n: number, blockTime: string) =>
    item({
        hash: hash(n),
        from: ME,
        to: USDC,
        value: '0',
        fee: FEE,
        block_time: blockTime,
        token_transfers: [
            {
                asset_id: `eip155:1/erc20:${USDC}`,
                contract: USDC,
                token_name: 'USD Coin',
                from: ME,
                to: PEER,
                value: '4000000',
                token_symbol: 'USDC',
                token_decimals: 6,
            },
        ],
        balance_impacts: [
            {
                asset_id: `eip155:1/erc20:${USDC}`,
                amount: '-4000000',
            },
            { asset_id: 'eip155:1/slip44:60', amount: `-${FEE}` },
        ],
    })

const approval = (n: number, blockTime: string) =>
    item({
        hash: hash(n),
        from: ME,
        to: USDC,
        value: '0',
        fee: FEE,
        block_time: blockTime,
        input: '0x12345678',
    })

describe('exportStoredEvmHistoryCsv', () => {
    let teardown: () => void

    beforeEach(async () => {
        const result = createTestDatabase()
        mocks.db = result.db
        teardown = result.teardown
        await runMigrations(mocks.db, migrations)
        historyChainAdapters.register(
            createEvmHistoryAdapter(ETHEREUM, testChainContext()),
        )
        // Only the native asset lookup, which the asset filter reads.
        assetsChainAdapters.register({
            chainId: 'ethereum',
            getNativeAsset: () => ETHEREUM.nativeAsset,
        } as AssetsChainAdapter)
    })

    afterEach(() => {
        teardown()
        historyChainAdapters.reset()
        assetsChainAdapters.reset()
    })

    const exportFor = (
        params: Partial<Parameters<typeof exportStoredEvmHistoryCsv>[1]> = {},
    ) =>
        exportStoredEvmHistoryCsv(ETHEREUM, {
            accountAddress: ME,
            scope: SCOPE,
            ...params,
        })

    const hashesOf = (csv: string): string[] =>
        cellsOf(csv)
            .slice(1)
            .map(row => row[1])

    it('exports only the stored rows inside the date range', async () => {
        await storeEvmHistoryPage(
            [
                ethSent(1, '2026-01-01T23:59:59Z'),
                ethSent(2, '2026-01-02T12:00:00Z'),
                ethSent(3, '2026-01-03T00:00:00Z'),
            ],
            ME,
            SCOPE,
        )

        const result = await exportFor({
            dateRange: { startDate: '2026-01-02', endDate: '2026-01-02' },
        })

        expect(hashesOf(result.csvContent)).toEqual([hash(2)])
        expect(result.rowCount).toBe(1)
    })

    it('exports every stored row when no range is given', async () => {
        await storeEvmHistoryPage(
            [
                ethSent(1, '2026-01-01T00:00:00Z'),
                ethSent(2, '2026-02-01T00:00:00Z'),
            ],
            ME,
            SCOPE,
        )

        const result = await exportFor()

        expect(hashesOf(result.csvContent)).toEqual([hash(2), hash(1)])
    })

    it('writes a header-only file when nothing is stored', async () => {
        const result = await exportFor({
            dateRange: { startDate: '2026-01-02' },
        })

        expect(result.csvContent).toBe(`${HEADER}\r\n`)
        expect(result.rowCount).toBe(0)
    })

    it('keeps the rows moving an ERC-20 for its asset filter', async () => {
        await storeEvmHistoryPage(
            [
                ethSent(1, '2026-01-01T00:00:00Z'),
                usdcSent(2, '2026-01-02T00:00:00Z'),
                approval(3, '2026-01-03T00:00:00Z'),
            ],
            ME,
            SCOPE,
        )

        const result = await exportFor({ assetId: getAddress(USDC) })

        expect(hashesOf(result.csvContent)).toEqual([hash(2)])
    })

    it('also keeps an approval the account paid for under the native filter', async () => {
        await storeEvmHistoryPage(
            [
                ethSent(1, '2026-01-01T00:00:00Z'),
                usdcSent(2, '2026-01-02T00:00:00Z'),
                approval(3, '2026-01-03T00:00:00Z'),
            ],
            ME,
            SCOPE,
        )

        const result = await exportFor({ assetId: NATIVE_ID })

        expect(hashesOf(result.csvContent)).toEqual([hash(3), hash(1)])
    })

    it('reads a transfer between two own accounts from each side', async () => {
        const transfer = ethSent(5, '2026-01-02T00:00:00Z', OTHER_ME)
        await storeEvmHistoryPage([transfer], ME, SCOPE)
        await storeEvmHistoryPage([transfer], OTHER_ME, SCOPE)

        const sender = cellsOf((await exportFor()).csvContent)[1]
        const receiver = cellsOf(
            (await exportFor({ accountAddress: OTHER_ME })).csvContent,
        )[1]

        expect(sender.slice(8, 12)).toEqual([
            '-1',
            '-1000000000000000000',
            '0.000021',
            'ETH',
        ])
        expect(receiver.slice(8, 12)).toEqual([
            '1',
            '1000000000000000000',
            '',
            '',
        ])
    })

    describe.each([
        ['sender first', ['sender', 'receiver']],
        ['receiver first', ['receiver', 'sender']],
    ] as const)('a token send between two own accounts, %s', (_name, order) => {
        // The backend reads one transaction from each side: the receiver's
        // view lacks the call, and each side's impacts are its own.
        const legs = [
            {
                asset_id: `eip155:1/erc20:${USDC}`,
                contract: USDC,
                token_name: 'USD Coin',
                from: OTHER_ME,
                to: ME,
                value: '4000000',
                token_symbol: 'USDC',
                token_decimals: 6,
            },
        ]
        const views = {
            sender: item({
                hash: hash(7),
                from: OTHER_ME,
                to: USDC,
                value: '0',
                fee: FEE,
                method: 'transfer',
                input: '0xa9059cbb',
                block_time: '2026-01-02T00:00:00Z',
                token_transfers: legs,
                balance_impacts: [
                    { asset_id: `eip155:1/erc20:${USDC}`, amount: '-4000000' },
                    { asset_id: 'eip155:1/slip44:60', amount: `-${FEE}` },
                ],
            }),
            receiver: item({
                hash: hash(7),
                block_time: '2026-01-02T00:00:00Z',
                token_transfers: legs,
                balance_impacts: [
                    { asset_id: `eip155:1/erc20:${USDC}`, amount: '4000000' },
                ],
            }),
        }

        beforeEach(async () => {
            for (const side of order) {
                await storeEvmHistoryPage(
                    [views[side]],
                    side === 'sender' ? OTHER_ME : ME,
                    SCOPE,
                )
            }
        })

        it('keeps the sender its fee, initiator and negative amount', async () => {
            const result = await exportFor({ accountAddress: OTHER_ME })

            const [row] = cellsOf(result.csvContent).slice(1)
            expect(row.slice(8, 13)).toEqual([
                '-4',
                '-4000000',
                '0.000021',
                'ETH',
                OTHER_ME,
            ])
        })

        it('gives the receiver its own positive amount and no fee', async () => {
            const result = await exportFor()

            const [row] = cellsOf(result.csvContent).slice(1)
            expect(row.slice(8, 12)).toEqual(['4', '4000000', '', ''])
        })
    })

    it('names the file as the backend did', async () => {
        const result = await exportFor()

        expect(result.filename).toBe('Transactions-1-0x5aae--eaed-Pera.csv')
    })

    it('rejects an invalid start date with a CsvExportError', async () => {
        await expect(
            exportFor({ dateRange: { startDate: '01/02/2026' } }),
        ).rejects.toBeInstanceOf(CsvExportError)
    })

    it('wraps any other failure in a CsvExportError', async () => {
        await expect(
            exportFor({ scope: { chainId: 'ethereum', networkId: 'nowhere' } }),
        ).rejects.toBeInstanceOf(CsvExportError)
    })
})
