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

// Proves the adapter's summaries equal what the row renders today, so the
// row can switch to them without a visible change.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
    type UseQueryResult,
} from '@tanstack/react-query'
import type {
    LocalizedText,
    TransactionIconKind,
} from '@perawallet/wallet-core-chain-contract'
import {
    useSingleAssetDetailsQuery,
    type PeraAsset,
} from '@perawallet/wallet-core-assets'
import {
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import {
    baseUnitsToDisplayUnits,
    formatNumber,
} from '@perawallet/wallet-core-shared'
import {
    ALGORAND_HISTORY_SUMMARY_GOLDENS,
    type HistorySummaryGolden,
} from '@perawallet/wallet-core-chain-algorand/test-handlers'
import type { TransactionIconType } from '@components/TransactionIcon'
import { useLanguage } from '@hooks/useLanguage'
import { useTransactionListItem } from '../useTransactionListItem'

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(),
    chainAccountOf: (account: WalletAccount, chainId: 'algorand') =>
        account.chains[chainId],
}))

vi.mock('@perawallet/wallet-core-assets', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-assets')>()
    return {
        ...actual,
        useSingleAssetDetailsQuery: vi.fn(),
        useNativeAsset: () => ({ assetId: '0', decimals: 6 }),
    }
})

vi.mock(
    '@perawallet/wallet-core-chain-algorand/blockchain',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@perawallet/wallet-core-chain-algorand/blockchain')
        >()),
    }),
)

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useNetwork: vi.fn(() => ({ network: 'mainnet' })),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: vi.fn() }),
}))

vi.mock('@hooks/useResolvedAddress', () => ({
    useResolvedAddress: (address: string) => ({
        displayName: `name:${address}`,
        isNfd: false,
        isResolving: false,
    }),
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

// Icon types that share a glyph with a summary icon.
const ROW_ICON_TYPES: Record<
    TransactionIconKind,
    readonly TransactionIconType[]
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

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
        {children}
    </QueryClientProvider>
)

const decimalsOf = (
    { item }: HistorySummaryGolden,
    assetId: string,
): number => {
    if (item.swapGroupDetail) return item.swapGroupDetail.assetOutDecimals
    if (assetId === '0') return 6
    if (item.asset?.assetId === assetId) return item.asset.decimals
    return (
        item.balanceImpacts.find(impact => impact.assetId === assetId)
            ?.fractionDecimals ?? 0
    )
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
        // The global setup mocks formatNumber down to String(value), which
        // erases the digits the swap subtitle is compared on.
        const actual = await vi.importActual<
            typeof import('@perawallet/wallet-core-shared')
        >('@perawallet/wallet-core-shared')
        vi.mocked(formatNumber).mockImplementation(actual.formatNumber)
        vi.mocked(useSingleAssetDetailsQuery).mockReturnValue({
            data: undefined,
        } as UseQueryResult<PeraAsset, Error>)
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

            expect(ROW_ICON_TYPES[summary.icon]).toContain(row.iconType)
            expect(row.subtitle).toBe(
                summary.subtitle
                    ? render(summary.subtitle)
                    : summary.counterparty
                      ? `name:${summary.counterparty}`
                      : null,
            )
            expect(row.title).toBe(render(summary.title))

            const expected = expectedAmounts(golden)
            expect(row.amounts).toHaveLength(Math.min(expected.length, 2))
            expected.slice(0, 2).forEach((amount, index) => {
                expect(row.amounts[index].assetId).toBe(amount.assetId)
                expect(row.amounts[index].prefix).toBe(amount.prefix)
                expect(
                    row.amounts[index].value.equals(
                        baseUnitsToDisplayUnits(
                            amount.base,
                            decimalsOf(golden, amount.assetId),
                        ),
                    ),
                ).toBe(true)
            })
            expect(row.amountsOverflowCount).toBe(
                Math.max(0, expected.length - 2),
            )
        },
    )
})
