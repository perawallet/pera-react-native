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

// Every Algorand kind rendered through the real history adapter must equal its
// HISTORY-01 golden, and keep the glyph the row drew before it read summaries.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createQueryClientWrapper } from '@test-utils/render'
import type {
    LocalizedText,
    TransactionIconKind,
} from '@perawallet/wallet-core-chain-contract'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    baseUnitsToDisplayUnits,
    formatNumber,
} from '@perawallet/wallet-core-shared'
import { historyChainAdapters } from '@perawallet/wallet-core-transactions'
import {
    algorandHistoryAdapter,
    algorandHistoryDataOf,
} from '@perawallet/wallet-core-chain-algorand/transactions'
import {
    ALGORAND_HISTORY_SUMMARY_GOLDENS,
    type HistorySummaryGolden,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import {
    algorandTransactionIconName,
    type AlgorandTransactionIconType,
} from '@modules/algorand/icons'
import { useLanguage } from '@hooks/useLanguage'
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

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: vi.fn() }),
}))

const mockReplace = vi.hoisted(() => ({
    canReplace: false,
    handleReplace: vi.fn(async () => undefined),
}))
vi.mock('../../../hooks/history/useReplaceTransaction', () => ({
    useReplaceTransaction: () => mockReplace,
}))

vi.mock('../../../hooks/history/useCounterpartyName', () => ({
    useCounterpartyName: (address: string) => `name:${address}`,
}))

// Resolves against the real en.json, so a missing key or an unfilled
// placeholder fails here.
vi.mock('@hooks/useLanguage', async () => {
    const bundle = (
        await vi.importActual<{ default: Record<string, unknown> }>(
            '../../../../../i18n/locales/en.json',
        )
    ).default
    const lookup = (key: string): string => {
        const value = key
            .split('.')
            .reduce<unknown>(
                (node, part) =>
                    typeof node === 'object' && node !== null
                        ? (node as Record<string, unknown>)[part]
                        : undefined,
                bundle,
            )
        return typeof value === 'string' ? value : key
    }
    return {
        useLanguage: () => ({
            t: (key: string, values?: Record<string, unknown>) =>
                lookup(key).replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
                    values && name in values ? String(values[name]) : match,
                ),
            currentLanguage: 'en',
            changeLanguage: vi.fn(),
        }),
    }
})

// The Algorand glyphs the row drew for each summary icon before it read summaries.
const PREVIOUS_ROW_ICONS: Record<
    TransactionIconKind,
    readonly AlgorandTransactionIconType[]
> = {
    send: ['send'],
    receive: ['receive'],
    self: ['send'],
    swap: ['swap'],
    'contract-call': ['app-call'],
    approval: ['app-call'],
    'opt-in': ['asset-opt-in'],
    'opt-out': ['asset-opt-out'],
    'asset-config': ['asset-config'],
    'asset-freeze': ['asset-freeze'],
    consensus: ['key-registration', 'heartbeat'],
    unknown: ['state-proof', 'unknown'],
}

const wrapper = createQueryClientWrapper()

// Read from the stored row, independently of the summary's display hint.
const factsOf = ({ item }: HistorySummaryGolden, assetId: string) => {
    const { swapGroupDetail } = algorandHistoryDataOf(item)
    if (swapGroupDetail) {
        return {
            decimals: swapGroupDetail.assetOutDecimals,
            unitName: swapGroupDetail.assetOutUnitName,
        }
    }
    if (assetId === '0') return { decimals: 6, unitName: 'ALGO' }
    if (item.asset?.assetId === assetId) return item.asset
    const impact = item.balanceImpacts.find(i => i.assetId === assetId)!
    return { decimals: impact.fractionDecimals, unitName: impact.unitName }
}

const expectedAmounts = (golden: HistorySummaryGolden) => {
    const { summary } = golden
    if (summary.balanceChanges) {
        return summary.balanceChanges.map(change => ({
            assetId: change.assetRef.assetId,
            base: change.value.abs(),
            prefix: change.value.isZero()
                ? undefined
                : change.value.isNegative()
                  ? '-'
                  : '+',
        }))
    }
    if (!summary.amount) return []
    const { assetRef, value } = summary.amount
    const prefix = value.isZero()
        ? undefined
        : { out: '-', in: '+' }[summary.direction as 'out' | 'in']
    return [{ assetId: assetRef.assetId, base: value, prefix }]
}

describe('useTransactionListItem against the history summary goldens', () => {
    beforeEach(async () => {
        historyChainAdapters.reset()
        historyChainAdapters.register(algorandHistoryAdapter)
        // The global setup mocks formatNumber down to String(value), which
        // erases the digits the swap subtitle is compared on.
        const actual = await vi.importActual<
            typeof import('@perawallet/wallet-core-shared')
        >('@perawallet/wallet-core-shared')
        vi.mocked(formatNumber).mockImplementation(actual.formatNumber)
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map(),
        } as ReturnType<typeof useAssetsQuery>)
    })

    it.each(ALGORAND_HISTORY_SUMMARY_GOLDENS)(
        'renders $name as its summary',
        golden => {
            vi.mocked(useSelectedAccount).mockReturnValue({
                chains: { algorand: { address: golden.account } },
            } as unknown as ReturnType<typeof useSelectedAccount>)
            const { summary } = golden

            const { result } = renderHook(
                () => useTransactionListItem({ transaction: golden.item }),
                { wrapper },
            )
            const row = result.current
            const { t } = useLanguage()
            const render = ({ key, params }: LocalizedText) => t(key, params)

            expect(
                PREVIOUS_ROW_ICONS[summary.icon].map(
                    algorandTransactionIconName,
                ),
            ).toContain(row.iconName)
            expect(row.title).toBe(render(summary.title))
            expect(row.subtitle).toBe(
                summary.subtitle
                    ? render(summary.subtitle)
                    : summary.counterparty
                      ? `name:${summary.counterparty}`
                      : null,
            )

            const expected = expectedAmounts(golden)
            expect(row.amounts).toHaveLength(Math.min(expected.length, 2))
            expected.slice(0, 2).forEach((amount, index) => {
                const { decimals, unitName } = factsOf(golden, amount.assetId)
                expect(row.amounts[index]).toMatchObject({
                    assetId: amount.assetId,
                    currency: unitName,
                    prefix: amount.prefix,
                })
                expect(
                    row.amounts[index].value.equals(
                        baseUnitsToDisplayUnits(amount.base, decimals),
                    ),
                ).toBe(true)
            })
            expect(row.amountsOverflowCount).toBe(
                Math.max(0, expected.length - 2),
            )

            expect(row.notice?.kind).toBe(summary.notice?.kind)
            if (row.notice) {
                const copy = t(row.notice.titleKey, row.notice.params)
                expect(copy).not.toBe(row.notice.titleKey)
                expect(copy).not.toMatch(/\{\{/)
            }
        },
    )
})
