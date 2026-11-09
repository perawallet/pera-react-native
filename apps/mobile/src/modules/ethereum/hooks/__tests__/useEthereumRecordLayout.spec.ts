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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { useAssetsQuery } from '@perawallet/wallet-core-assets'
import {
    i18nKey,
    type BalanceChange,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import { useEthereumRecordLayout } from '../useEthereumRecordLayout'
import type { EthereumTransactionPresentation } from '../useEthereumTransactionPresentation'

const ME = '0x00000000000000000000000000000000000000aa'
const PEER = '0x00000000000000000000000000000000000000bb'
const HASH = `0x${'1'.padStart(64, '0')}`
const SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const ETHER = { assetId: 'native', unitName: 'ETH', decimals: 18 }
const NATIVE_REF = { chainId: 'ethereum', assetId: 'native' } as const
const USDC_REF = { chainId: 'ethereum', assetId: '0xusdc' } as const

// The suffix has its own spec; here the hero's title is the row label it wraps.
const heroTitleOf = vi.hoisted(() => vi.fn(({ key }: { key: string }) => key))
vi.mock('@modules/signing/hooks/useTransactionHeroTitle', () => ({
    useTransactionHeroTitle: () => heroTitleOf,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => ETHER,
    useAssetsQuery: vi.fn(),
}))

let mockOwnAddress: string | undefined = ME
vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: () => ({ id: 'a1' }),
    chainAccountOf: () =>
        mockOwnAddress === undefined ? undefined : { address: mockOwnAddress },
    isSameAddress: (_chainId: string, a: string, b: string) =>
        a.toLowerCase() === b.toLowerCase(),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

const summaryOf = (
    overrides: Partial<TransactionSummary> = {},
): TransactionSummary => ({
    kind: 'transfer',
    title: { key: i18nKey('transactions.list_item.send') },
    direction: 'out',
    counterparty: PEER,
    icon: 'send',
    amount: { assetRef: NATIVE_REF, value: new Decimal(10).pow(18) },
    ...overrides,
})

const recordOf = (
    overrides: Partial<TransactionRecord> = {},
    summary: Partial<TransactionSummary> = {},
): TransactionRecord => ({
    id: HASH,
    scope: SCOPE,
    status: 'confirmed',
    timestamp: 1_700_000_000_000,
    blockNumber: 19_000_000,
    fee: new Decimal(21_000).mul(1_000_000_000),
    initiator: ME,
    summary: summaryOf(summary),
    chainData: { family: 'evm' },
    ...overrides,
})

const layoutOf = (
    record: TransactionRecord,
    presentation?: EthereumTransactionPresentation,
) =>
    renderHook(() => useEthereumRecordLayout(record, presentation)).result
        .current

describe('useEthereumRecordLayout', () => {
    beforeEach(() => {
        mockOwnAddress = ME
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map(),
            isPending: false,
        } as unknown as ReturnType<typeof useAssetsQuery>)
    })

    it.each([
        ['confirmed', 'completed'],
        ['pending', 'pending'],
        ['failed', 'failed'],
        ['replaced', 'failed'],
    ] as const)('Given a %s record, then the pill reads %s', (status, pill) => {
        expect(layoutOf(recordOf({ status })).summary.status).toBe(pill)
    })

    it('Given a mined transfer, then it carries the id, block, time, parties and fee', () => {
        const { summary, amountRows } = layoutOf(recordOf())

        expect(summary).toMatchObject({
            scope: SCOPE,
            title: 'transactions.list_item.send',
            transactionId: HASH,
            timestamp: 1_700_000_000_000,
            block: {
                labelKey: 'transactions.common.block',
                number: '19000000',
            },
            from: ME,
            to: PEER,
        })
        expect(summary.fee?.value.toString()).toBe('0.000021')
        expect(summary.fee?.asset.unitName).toBe('ETH')
        expect(amountRows).toEqual([])
    })

    it("Given a transfer of ETH, then the hero's amount is the ETH sent, unsigned", () => {
        const { summary } = layoutOf(recordOf())

        expect(summary.amount?.value.toString()).toBe('1')
        expect(summary.amount?.asset.unitName).toBe('ETH')
    })

    it("Given a token transfer, then the hero's amount is the token, read from the asset store when it holds it", () => {
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([
                [
                    '0xusdc',
                    { assetId: '0xusdc', unitName: 'USDC', decimals: 6 },
                ],
            ]),
            isPending: false,
        } as unknown as ReturnType<typeof useAssetsQuery>)

        const { summary } = layoutOf(
            recordOf(
                {},
                {
                    kind: 'token-transfer',
                    amount: {
                        assetRef: USDC_REF,
                        value: new Decimal(2_500_000),
                    },
                },
            ),
        )

        expect(summary.amount?.value.toString()).toBe('2.5')
        expect(summary.amount?.asset.unitName).toBe('USDC')
    })

    it("Given a token the store doesn't hold, then the summary's own symbol and decimals cover it", () => {
        const { summary } = layoutOf(
            recordOf(
                {},
                {
                    kind: 'token-transfer',
                    amount: {
                        assetRef: USDC_REF,
                        value: new Decimal(1_000_000),
                        display: { symbol: 'USDC', decimals: 6 },
                    },
                },
            ),
        )

        expect(summary.amount?.value.toString()).toBe('1')
        expect(summary.amount?.asset.unitName).toBe('USDC')
    })

    it('Given a token it can name no decimals for, then it leads with no amount', () => {
        const { summary } = layoutOf(
            recordOf(
                {},
                {
                    kind: 'token-transfer',
                    amount: { assetRef: USDC_REF, value: new Decimal(5) },
                },
            ),
        )

        expect(summary.amount).toBeUndefined()
    })

    it("Given a token leg the hero can't name, then the raw leg is still listed so the amount never disappears", () => {
        const { summary, amountRows } = layoutOf(
            recordOf(
                {},
                {
                    kind: 'token-transfer',
                    amount: { assetRef: USDC_REF, value: new Decimal(5) },
                },
            ),
        )

        expect(summary.amount).toBeUndefined()
        expect(amountRows).toHaveLength(1)
        expect(amountRows[0]?.value.toString()).toBe('-5')
    })

    it('Given an NFT summary, then the collection and token id it names are carried as the asset label', () => {
        const { assetLabel } = layoutOf(
            recordOf(
                {},
                {
                    kind: 'nft-transfer',
                    subtitle: {
                        key: i18nKey('transactions.list_item.nft_subtitle'),
                        params: { collection: 'Apes', tokenId: '7' },
                    },
                },
            ),
        )

        expect(assetLabel).toBe('transactions.list_item.nft_subtitle')
    })

    it('Given a swap through a known contract, then its protocol name is not carried as an asset label', () => {
        const { assetLabel } = layoutOf(
            recordOf(
                {},
                {
                    kind: 'swap',
                    subtitle: {
                        key: i18nKey('transactions.list_item.nft_subtitle'),
                        params: { collection: 'Uniswap', tokenId: '1' },
                    },
                },
            ),
        )

        expect(assetLabel).toBeUndefined()
    })

    it('Given a summary that names no asset, then there is no asset label', () => {
        expect(layoutOf(recordOf()).assetLabel).toBeUndefined()
    })

    it('Given balance changes, then none leads and every leg is listed, so gas never headlines', () => {
        const legs: BalanceChange[] = [
            { assetRef: NATIVE_REF, value: new Decimal(-5) },
            { assetRef: USDC_REF, value: new Decimal(7) },
        ]

        const { summary, amountRows } = layoutOf(
            recordOf({}, { kind: 'swap', balanceChanges: legs }),
        )

        expect(summary.amount).toBeUndefined()
        expect(amountRows).toEqual(legs)
    })

    it('Given an approval, then its amount is listed rather than led with', () => {
        const { summary, amountRows } = layoutOf(
            recordOf({}, { kind: 'approval', direction: 'none' }),
        )

        expect(summary.amount).toBeUndefined()
        expect(amountRows).toHaveLength(1)
    })

    it('Given a payment received, then it shows no fee, since the sender paid it', () => {
        const { summary } = layoutOf(
            recordOf({ initiator: PEER }, { direction: 'in' }),
        )

        expect(summary.fee).toBeUndefined()
        expect(summary.from).toBe(PEER)
        expect(summary.to).toBe(ME)
    })

    it('Given an account with no Ethereum address, then it shows no fee, since the account cannot be said to have paid it', () => {
        mockOwnAddress = undefined

        const { summary } = layoutOf(recordOf())

        expect(summary.fee).toBeUndefined()
    })

    it('Given a pending send the history names no signer for, then it keeps its fee', () => {
        const { summary } = layoutOf(
            recordOf({ initiator: undefined, status: 'pending' }),
        )

        expect(summary.fee?.value.toString()).toBe('0.000021')
    })

    it.each(['replaced', 'failed'] as const)(
        'Given a %s attempt the wallet broadcast, which names no signer, then it shows no fee, since it never landed',
        status => {
            const { summary } = layoutOf(
                recordOf({ initiator: undefined, status }),
            )

            expect(summary.fee).toBeUndefined()
        },
    )

    it('Given a mined call of the account that reverted, then it keeps its fee', () => {
        const { summary } = layoutOf(recordOf({ status: 'failed' }))

        expect(summary.fee?.value.toString()).toBe('0.000021')
    })

    it('Given a pending send whose fee is the most it can be charged, then the fee is marked as a maximum', () => {
        const { summary } = layoutOf(
            recordOf({
                initiator: undefined,
                status: 'pending',
                isFeeMaximum: true,
            }),
        )

        expect(summary.fee?.value.toString()).toBe('0.000021')
        expect(summary.isFeeMaximum).toBe(true)
    })

    it('Given a mined record, then its fee is not marked as a maximum', () => {
        expect(layoutOf(recordOf()).summary.isFeeMaximum).toBeFalsy()
    })

    it('Given a record with no fee, then it shows none', () => {
        expect(
            layoutOf(recordOf({ fee: undefined })).summary.fee,
        ).toBeUndefined()
    })

    it.each(['approval', 'contract-call', 'swap'] as const)(
        'Given a %s record, then it names no recipient, as the signed view of the call does not',
        kind => {
            const { summary } = layoutOf(
                recordOf({}, { kind, direction: 'none', counterparty: PEER }),
            )

            expect(summary.to).toBeUndefined()
            expect(summary.from).toBe(ME)
        },
    )

    it.each(['transfer', 'token-transfer', 'nft-transfer'] as const)(
        'Given a %s record, then it names its recipient',
        kind => {
            expect(
                layoutOf(recordOf({}, { kind, counterparty: PEER })).summary.to,
            ).toBe(PEER)
        },
    )

    it("Given a token whose asset the store hasn't answered for, then the hero holds its place and no raw leg shows yet", () => {
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map(),
            isPending: true,
        } as unknown as ReturnType<typeof useAssetsQuery>)

        const { summary, amountRows } = layoutOf(
            recordOf(
                {},
                {
                    kind: 'token-transfer',
                    amount: { assetRef: USDC_REF, value: new Decimal(5) },
                },
            ),
        )

        expect(summary.amount).toBeUndefined()
        expect(summary.isAmountLoading).toBe(true)
        expect(amountRows).toEqual([])
    })

    it("Given an approval whose token the store knows, then the hero's title names its unit", () => {
        vi.mocked(useAssetsQuery).mockReturnValue({
            data: new Map([
                ['0xusdc', { assetId: '0xusdc', unitName: 'USDC' }],
            ]),
            isPending: false,
        } as unknown as ReturnType<typeof useAssetsQuery>)
        const record = recordOf(
            {},
            {
                kind: 'approval',
                title: {
                    key: i18nKey('transactions.list_item.approve_asset'),
                    params: { asset: '0xA0b8…eB48' },
                },
                titleAssets: { asset: USDC_REF },
                amount: undefined,
            },
        )

        layoutOf(record)

        expect(heroTitleOf).toHaveBeenCalledWith({
            key: 'transactions.list_item.approve_asset',
            params: { asset: 'USDC' },
        })
    })

    it('Given an amount that resolved, then nothing is loading', () => {
        expect(layoutOf(recordOf()).summary.isAmountLoading).toBe(false)
    })

    it('Given a withdrawal row, then it has no transaction id to copy or open', () => {
        expect(
            layoutOf(recordOf({ id: 'withdrawal:12' })).summary.transactionId,
        ).toBeUndefined()
    })

    it('Given a row with no block number or time, then those facts are left out', () => {
        const { summary } = layoutOf(
            recordOf({ blockNumber: undefined, timestamp: undefined }),
        )

        expect(summary.block).toBeUndefined()
        expect(summary.timestamp).toBeUndefined()
    })

    const presentationOf = (titleKey: string) =>
        ({
            titleKey,
            iconName: 'read-icon',
        }) as unknown as EthereumTransactionPresentation

    const titledRecord = (key: string, isActionUnknown?: boolean) =>
        recordOf(
            {},
            {
                kind: 'contract-call',
                title: { key: i18nKey(key) as never },
                ...(isActionUnknown && { isActionUnknown }),
            },
        )

    it("Given the decoded read of the call, then its icon wins over the history's but the row's title stays", () => {
        const { summary } = layoutOf(
            titledRecord('transactions.list_item.swap_pair'),
            presentationOf('transactions.list_item.contract_call'),
        )

        expect(summary.title).toBe('transactions.list_item.swap_pair')
        expect(summary.iconName).toBe('read-icon')
    })

    it('Given a row titled as an approval and a read that decodes a revocation, then the hero says revoke', () => {
        const { summary } = layoutOf(
            titledRecord('transactions.list_item.approve_asset'),
            presentationOf('transactions.list_item.revoke_approval'),
        )

        expect(summary.title).toBe('transactions.list_item.revoke_approval')
    })

    it('Given a row that names no action and a read that decodes a send, then the hero says send', () => {
        const { summary } = layoutOf(
            titledRecord('transactions.list_item.interpreted_title', true),
            presentationOf('transactions.list_item.send'),
        )

        expect(summary.title).toBe('transactions.list_item.send')
    })

    it("Given a row whose summary doesn't say it names no action, then a read that decodes a send leaves its title, whatever the title's key", () => {
        const { summary } = layoutOf(
            titledRecord('transactions.list_item.contract_interaction'),
            presentationOf('transactions.list_item.send'),
        )

        expect(summary.title).toBe(
            'transactions.list_item.contract_interaction',
        )
    })

    it("Given a row that names no action and a read that names none either, then the row's title stays", () => {
        const { summary } = layoutOf(
            titledRecord('transactions.list_item.contract_interaction', true),
            presentationOf('transactions.list_item.contract_call'),
        )

        expect(summary.title).toBe(
            'transactions.list_item.contract_interaction',
        )
    })

    it('Given a row and a read that agree on the title, then the hero shows it', () => {
        const { summary } = layoutOf(
            titledRecord('transactions.list_item.supply'),
            presentationOf('transactions.list_item.supply'),
        )

        expect(summary.title).toBe('transactions.list_item.supply')
    })
})
