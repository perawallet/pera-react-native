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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createQueryClientWrapper } from '@test-utils/render'
import { Decimal } from 'decimal.js'
import { useAssetsQuery, type PeraAsset } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type TransactionRecord,
} from '@perawallet/wallet-core-chain-contract'
import {
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    historyChainAdapters,
    type TransactionHistoryItem,
} from '@perawallet/wallet-core-transactions'
import { algorandHistoryAdapter } from '@perawallet/wallet-core-chain-algorand/transactions'
import {
    ALGORAND_HISTORY_SUMMARY_GOLDENS,
    type HistorySummaryGolden,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import { useCounterpartyName } from '../../../hooks/history/useCounterpartyName'
import { useTransactionListItem } from '../useTransactionListItem'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    chainAccountOf: (account: WalletAccount, chainId: 'algorand') =>
        account.chains[chainId],
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-assets')
    >()),
    useAssetsQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
}))

const mockCopyToClipboard = vi.fn()
vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

const mockReplace = vi.hoisted(() => ({
    canReplace: false,
    handleReplace: vi.fn(async () => undefined),
}))
vi.mock('../../../hooks/history/useReplaceTransaction', () => ({
    useReplaceTransaction: () => mockReplace,
}))

const mockOpenSuspectedPoisoningSheet = vi.hoisted(() => vi.fn())
vi.mock('../../../hooks/address-safety/useSuspectedPoisoningSheet', () => ({
    useSuspectedPoisoningSheet: () => ({
        openSuspectedPoisoningSheet: mockOpenSuspectedPoisoningSheet,
    }),
}))

vi.mock('../../../hooks/history/useCounterpartyName', () => ({
    useCounterpartyName: vi.fn(() => 'Counterparty'),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, string>) =>
            params ? `${key} ${JSON.stringify(params)}` : key,
        currentLanguage: 'en',
        changeLanguage: vi.fn(),
    }),
}))

const golden = (name: string): HistorySummaryGolden =>
    ALGORAND_HISTORY_SUMMARY_GOLDENS.find(g => g.name === name)!

const stored = (assets: Partial<PeraAsset>[]) =>
    vi.mocked(useAssetsQuery).mockReturnValue({
        data: new Map(assets.map(asset => [asset.assetId!, asset])),
    } as ReturnType<typeof useAssetsQuery>)

const wrapper = createQueryClientWrapper()

const renderRow = (
    { account, item }: HistorySummaryGolden,
    onPress?: (transaction: TransactionHistoryItem) => void,
) => {
    vi.mocked(useSelectedAccount).mockReturnValue({
        chains: { algorand: { address: account } },
    } as unknown as ReturnType<typeof useSelectedAccount>)
    return renderHook(
        () => useTransactionListItem({ transaction: item, onPress }),
        { wrapper },
    ).result.current
}

describe('useTransactionListItem', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        historyChainAdapters.reset()
        historyChainAdapters.register(algorandHistoryAdapter)
        stored([])
    })

    describe('transfers', () => {
        it("names the counterparty on the selected account's chain", () => {
            const row = renderRow(golden('payment sent'))

            expect(useCounterpartyName).toHaveBeenCalledWith(
                'ACCOUNT_B',
                'algorand',
            )
            expect(row.subtitle).toBe('Counterparty')
            expect(row.title).toBe('transactions.list_item.send')
            expect(row.iconName).toBe('transactions/send')
            expect(row.amounts).toEqual([
                {
                    value: new Decimal('0.5'),
                    assetId: '0',
                    currency: 'ALGO',
                    decimals: 6,
                    prefix: '-',
                },
            ])
        })

        it('signs a received amount as incoming', () => {
            const row = renderRow(golden('asset transfer received'))

            expect(row.iconName).toBe('transactions/receive')
            expect(row.amounts[0]).toMatchObject({
                currency: 'USDC',
                prefix: '+',
            })
        })

        it("prefers the stored asset's facts over the summary's own", () => {
            stored([{ assetId: '31566704', unitName: 'USDCx', decimals: 2 }])

            const row = renderRow(golden('asset transfer sent'))

            expect(row.amounts[0]).toMatchObject({
                currency: 'USDCx',
                value: new Decimal(10_000),
            })
        })
    })

    describe('opt-ins', () => {
        it('shows a zero amount without a sign', () => {
            const row = renderRow(golden('asset opt-in with a zero amount'))

            expect(row.iconName).toBe('transactions/opt-in')
            expect(row.amounts[0].prefix).toBeUndefined()
            expect(row.amounts[0].value.isZero()).toBe(true)
        })
    })

    describe('swaps', () => {
        it('shows its own subtitle and skips the counterparty lookup', () => {
            const row = renderRow(golden('swap'))

            expect(useCounterpartyName).toHaveBeenCalledWith('', 'algorand')
            expect(row.subtitle).toMatch(
                /^transactions\.list_item\.swap_subtitle /,
            )
            expect(row.amounts[0]).toMatchObject({
                currency: 'USDC',
                prefix: '+',
            })
        })
    })

    describe('app calls', () => {
        it('stacks two balance changes, reports the rest and only looks up the visible assets', () => {
            const row = renderRow(
                golden(
                    'app call with three balance impacts and three inner transactions',
                ),
            )

            expect(row.amounts.map(a => [a.currency, a.prefix])).toEqual([
                ['ALGO', '-'],
                ['USDC', '+'],
            ])
            expect(row.amountsOverflowCount).toBe(1)
            expect(useAssetsQuery).toHaveBeenCalledWith(
                expect.objectContaining({ chainId: 'algorand' }),
                ['0', '31566704'],
            )
        })

        it('survives decimals the backend could not resolve', () => {
            const appCall = golden(
                'app call with three balance impacts and three inner transactions',
            )
            const row = renderRow({
                ...appCall,
                item: {
                    ...appCall.item,
                    balanceImpacts: [
                        {
                            assetId: '777',
                            unitName: 'XYZ',
                            fractionDecimals: NaN,
                            amount: new Decimal(-5),
                        },
                    ],
                },
            })

            expect(row.amounts[0].value).toEqual(new Decimal(5))
        })
    })

    describe('chain-specific kinds', () => {
        it('has no subtitle or amount when nothing moved', () => {
            const row = renderRow(golden('key registration'))

            expect(row.title).toBe('transactions.list_item.key_registration')
            expect(row.iconName).toBe('transactions/key-registration')
            expect(row.subtitle).toBeNull()
            expect(row.amounts).toEqual([])
        })
    })

    describe('status notices', () => {
        it.each([
            ['pending payment', 'warning', 'transactions.notice.pending'],
            ['failed payment', 'error', 'transactions.notice.failed'],
            ['replaced payment', 'warning', 'transactions.notice.replaced'],
        ] as const)('flags a %s', (name, kind, titleKey) => {
            expect(renderRow(golden(name)).notice).toMatchObject({
                kind,
                titleKey,
            })
        })

        it('says since when a pending row has been waiting', () => {
            expect(
                renderRow(golden('pending payment')).notice?.params?.since,
            ).toBeTruthy()
        })

        it('has no notice on a confirmed row', () => {
            expect(renderRow(golden('payment sent')).notice).toBeNull()
            expect(
                renderRow(golden('payment confirmed with an explicit status'))
                    .notice,
            ).toBeNull()
        })
    })

    describe('interactions', () => {
        it('passes the transaction to onPress', () => {
            const onPress = vi.fn()
            const transfer = golden('payment sent')

            renderRow(transfer, onPress).handlePress?.()

            expect(onPress).toHaveBeenCalledWith(transfer.item)
        })

        it('copies the transaction id on long press', () => {
            renderRow(golden('payment sent')).handleLongPress()

            expect(mockCopyToClipboard).toHaveBeenCalledWith('TX')
        })
    })
})

describe('useTransactionListItem with a record', () => {
    const record: TransactionRecord = {
        id: '0xhash',
        scope: { chainId: 'ethereum', networkId: 'mainnet' },
        status: 'confirmed',
        timestamp: 1_704_067_200_000,
        summary: {
            kind: 'transfer',
            title: { key: i18nKey('transactions.list_item.send') },
            direction: 'out',
            counterparty: '0xbob',
            amount: {
                assetRef: { chainId: 'ethereum', assetId: '0xusdc' },
                value: new Decimal(1),
            },
            icon: 'send',
        },
        chainData: { family: 'evm' },
    }

    const suspectedPoisoning = {
        transactionId: record.id,
        counterparty: '0xbob',
        imitates: { address: '0xb0b', source: 'contact' as const },
    }

    const renderRecord = (
        params: { suspectedPoisoning?: typeof suspectedPoisoning } = {},
    ) => {
        vi.mocked(useSelectedAccount).mockReturnValue({
            chains: { ethereum: { address: '0xalice' } },
        } as unknown as ReturnType<typeof useSelectedAccount>)
        return renderHook(() => useTransactionListItem({ record, ...params }), {
            wrapper,
        }).result.current
    }

    beforeEach(() => {
        vi.clearAllMocks()
        historyChainAdapters.reset()
        stored([])
        mockReplace.canReplace = false
    })

    it("renders the record's own summary without a history adapter", () => {
        const row = renderRecord()

        expect(row.title).toBe('transactions.list_item.send')
        expect(row.subtitle).toBe('Counterparty')
        expect(useCounterpartyName).toHaveBeenCalledWith('0xbob', 'ethereum')
    })

    it("looks its amounts' assets up on the record's own scope", () => {
        renderRecord()

        expect(useAssetsQuery).toHaveBeenCalledWith(record.scope, ['0xusdc'])
    })

    it('opens nothing on press, and still copies its id on long-press', () => {
        const row = renderRecord()

        expect(row.handlePress).toBeUndefined()
        row.handleLongPress()
        expect(mockCopyToClipboard).toHaveBeenCalledWith('0xhash')
    })

    it('offers speed up and cancel on press when the wallet can re-price it', () => {
        mockReplace.canReplace = true
        const row = renderRecord()

        row.handlePress?.()

        expect(mockReplace.handleReplace).toHaveBeenCalled()
    })

    it('is not marked unless suspected', () => {
        expect(renderRecord().isSuspectedPoisoning).toBe(false)
    })

    it('explains a suspected record on press instead of opening anything else', () => {
        mockReplace.canReplace = true
        const row = renderRecord({ suspectedPoisoning })

        row.handlePress?.()

        expect(row.isSuspectedPoisoning).toBe(true)
        expect(mockOpenSuspectedPoisoningSheet).toHaveBeenCalledWith(
            suspectedPoisoning,
            record.scope,
        )
        expect(mockReplace.handleReplace).not.toHaveBeenCalled()
    })
})
