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
import { Decimal } from 'decimal.js'
import {
    addressCodecs,
    type ChainScope,
    type Page,
    type PageRef,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    fetchAndPersistPrices,
    getAssetPricesByIds,
    getAssetsByIds,
} from '@perawallet/wallet-core-assets'
import { historyChainAdapters } from '../../history-adapter'
import {
    fetchTrustedCounterparties,
    isTrustedTransfer,
    MAX_COUNTERPARTY_HISTORY_PAGES,
    MIN_TRUSTED_TRANSFERS,
} from '../trusted-counterparties'
import { fakeCodec } from './fakeCodecs'

const SCOPE: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ME = 'ME'
const NATIVE = 'native'
const STABLE = 'stable'
const SUSPICIOUS = 'suspicious-token'
const UNPRICED = 'unpriced-token'
const VERIFIED_UNPRICED = 'verified-unpriced-token'

const DECIMALS: Record<string, number> = {
    [NATIVE]: 6,
    [STABLE]: 6,
    [SUSPICIOUS]: 6,
    [UNPRICED]: 6,
    [VERIFIED_UNPRICED]: 6,
}
const TIERS: Record<string, string> = {
    [SUSPICIOUS]: 'suspicious',
    [UNPRICED]: 'unverified',
}
const USD_PRICES: Record<string, string> = {
    [NATIVE]: '0.2',
    [STABLE]: '1',
    [SUSPICIOUS]: '1',
}

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: (chainId: string) => ({
        id: chainId,
        nativeAsset: { ref: { chainId, assetId: 'native' } },
    }),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    PeraAssetVerificationTier: {
        verified: 'verified',
        suspicious: 'suspicious',
        unverified: 'unverified',
    },
    getAssetsByIds: vi.fn(),
    getAssetPricesByIds: vi.fn(),
    fetchAndPersistPrices: vi.fn(),
    assetsAdapterFor: () => ({ syncAssets: vi.fn() }),
}))

type RecordInput = {
    direction: TransactionSummary['direction']
    counterparty: string
    assetId?: string
    value?: string
    status?: TransactionRecord['status']
    kind?: TransactionSummary['kind']
    /** Defaults to the account for a send and to the counterparty otherwise. */
    initiator?: string
}

let nextId = 0
const record = ({
    direction,
    counterparty,
    assetId = NATIVE,
    value = '1000000',
    status = 'confirmed',
    kind = 'transfer',
    initiator = direction === 'out' ? ME : counterparty,
}: RecordInput): TransactionRecord => ({
    id: `tx-${nextId++}`,
    scope: SCOPE,
    status,
    initiator,
    chainData: { family: 'evm' } as TransactionRecord['chainData'],
    summary: {
        kind,
        title: { key: 'title' },
        direction,
        counterparty,
        icon: direction === 'out' ? 'send' : 'receive',
        amount: {
            assetRef: { chainId: SCOPE.chainId, assetId },
            value: new Decimal(value),
        },
    },
})

const getTransactionHistory =
    vi.fn<
        (
            address: string,
            scope: ChainScope,
            page?: PageRef,
        ) => Promise<Page<TransactionRecord>>
    >()

const historyOf = (items: TransactionRecord[]) =>
    getTransactionHistory.mockResolvedValue({ items })

const trustedFor = () =>
    fetchTrustedCounterparties({ accountAddress: ME, scope: SCOPE })

const paid = (address: string) => ({ address, hasBeenPaid: true })
const payer = (address: string) => ({ address, hasBeenPaid: false })

describe('isTrustedTransfer', () => {
    const valuation = {
        value: new Decimal(100_000),
        decimals: 6,
        usdPrice: new Decimal(1),
        isNative: false,
        isVerified: true,
        isSuspicious: false,
        isSignedByAccount: false,
    }

    it('trusts a transfer worth exactly the threshold', () => {
        expect(isTrustedTransfer(valuation)).toBe(true)
    })

    it('does not trust a transfer just under the threshold', () => {
        expect(
            isTrustedTransfer({ ...valuation, value: new Decimal(99_999) }),
        ).toBe(false)
    })

    it.each([
        ['zero-value', { value: new Decimal(0) }],
        ['suspicious', { isSuspicious: true }],
        ['unpriced', { usdPrice: undefined }],
        ['decimals-less', { decimals: undefined }],
    ])('does not trust a %s transfer', (_, overrides) => {
        expect(isTrustedTransfer({ ...valuation, ...overrides })).toBe(false)
    })

    describe('for a send the account signed', () => {
        const signed = {
            ...valuation,
            value: new Decimal(1),
            usdPrice: undefined,
            isVerified: false,
            isSignedByAccount: true,
        }

        it.each([
            ['the native asset', { isNative: true }],
            ['a verified asset', { isVerified: true }],
            ['a priced asset', { usdPrice: new Decimal(1) }],
        ])('trusts any amount of %s', (_, overrides) => {
            expect(isTrustedTransfer({ ...signed, ...overrides })).toBe(true)
        })

        it.each([
            ['an unverified, unpriced asset', {}],
            ['a suspicious asset', { isSuspicious: true, isVerified: true }],
            ['a zero amount', { isNative: true, value: new Decimal(0) }],
        ])('does not trust %s', (_, overrides) => {
            expect(isTrustedTransfer({ ...signed, ...overrides })).toBe(false)
        })
    })
})

describe('fetchTrustedCounterparties', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        addressCodecs.reset()
        addressCodecs.register(fakeCodec('ethereum', { isCaseBlind: true }))
        historyChainAdapters.reset()
        historyChainAdapters.register({
            chainId: SCOPE.chainId,
            getTransactionHistory,
        })
        vi.mocked(getAssetsByIds).mockImplementation(
            async ({ assetIds }) =>
                assetIds.map(assetId => ({
                    assetId,
                    decimals: DECIMALS[assetId] ?? 0,
                    peraMetadata: {
                        verificationTier: TIERS[assetId] ?? 'verified',
                    },
                })) as never,
        )
        vi.mocked(getAssetPricesByIds).mockImplementation(
            async ({ assetIds }) =>
                assetIds.flatMap(assetId =>
                    USD_PRICES[assetId]
                        ? [
                              {
                                  assetId,
                                  usdPrice: new Decimal(USD_PRICES[assetId]),
                              },
                          ]
                        : [],
                ),
        )
        vi.mocked(fetchAndPersistPrices).mockResolvedValue()
    })

    it('trusts a counterparty that paid the account a real amount, as a payer only', async () => {
        historyOf([record({ direction: 'in', counterparty: 'PAYER' })])

        expect(await trustedFor()).toEqual([payer('PAYER')])
    })

    it('trusts a recipient of native dust the account signed, without any lookups', async () => {
        historyOf([
            record({ direction: 'out', counterparty: 'PAYEE', value: '1' }),
        ])

        expect(await trustedFor()).toEqual([paid('PAYEE')])
        expect(getAssetsByIds).not.toHaveBeenCalled()
        expect(getAssetPricesByIds).not.toHaveBeenCalled()
    })

    it.each([
        ['a verified token with no price', VERIFIED_UNPRICED],
        ['a priced token below the minimum value', STABLE],
    ])('trusts a recipient of %s the account signed', async (_, assetId) => {
        historyOf([
            record({
                direction: 'out',
                counterparty: 'PAYEE',
                kind: 'token-transfer',
                assetId,
                value: '1',
            }),
        ])

        expect(await trustedFor()).toEqual([paid('PAYEE')])
    })

    it.each([
        ['a suspicious token', SUSPICIOUS],
        ['an unverified token with no price', UNPRICED],
    ])(
        'does not trust a recipient of %s even though the account signed it',
        async (_, assetId) => {
            historyOf([
                record({
                    direction: 'out',
                    counterparty: 'LOOK-ALIKE',
                    kind: 'token-transfer',
                    assetId,
                }),
            ])

            expect(await trustedFor()).toEqual([])
        },
    )

    it('does not trust a zero-value send even when the account signed it', async () => {
        historyOf([
            record({ direction: 'out', counterparty: 'PAYEE', value: '0' }),
        ])

        expect(await trustedFor()).toEqual([])
    })

    it.each([
        ['a zero-value transfer', { value: '0' }],
        ['native dust', { value: '1' }],
        ['a suspicious token', { assetId: SUSPICIOUS, kind: 'token-transfer' }],
        ['an unpriced token', { assetId: UNPRICED, kind: 'token-transfer' }],
        ['a failed transfer', { status: 'failed' }],
        ['a contract call', { kind: 'contract-call' }],
    ] as const)(
        'does not trust a counterparty known only from %s',
        async (_, overrides) => {
            historyOf([
                record({
                    direction: 'in',
                    counterparty: 'POISONER',
                    ...overrides,
                }),
            ])

            expect(await trustedFor()).toEqual([])
        },
    )

    it("does not trust a worthless send someone else signed in the account's name", async () => {
        historyOf([
            record({
                direction: 'out',
                counterparty: 'POISONER',
                kind: 'token-transfer',
                assetId: UNPRICED,
                initiator: 'POISONER',
            }),
        ])

        expect(await trustedFor()).toEqual([])
    })

    it('counts a valuable send someone else signed only as a payer', async () => {
        historyOf([
            record({
                direction: 'out',
                counterparty: 'PEER',
                kind: 'token-transfer',
                assetId: STABLE,
                value: '5000000',
                initiator: 'SPENDER',
            }),
        ])

        expect(await trustedFor()).toEqual([payer('PEER')])
    })

    it('lists a counterparty once whatever the spelling, paid if any transfer was a send', async () => {
        historyOf([
            record({ direction: 'in', counterparty: 'PAYER' }),
            record({ direction: 'out', counterparty: 'payer' }),
        ])

        const trusted = await trustedFor()

        expect(trusted).toHaveLength(1)
        expect(trusted[0]?.address.toLowerCase()).toBe('payer')
        expect(trusted[0]?.hasBeenPaid).toBe(true)
    })

    it('fetches prices it does not have yet', async () => {
        historyOf([
            record({
                direction: 'in',
                counterparty: 'PAYER',
                assetId: UNPRICED,
                kind: 'token-transfer',
            }),
        ])

        await trustedFor()

        expect(fetchAndPersistPrices).toHaveBeenCalledWith([UNPRICED], SCOPE)
    })

    it('reads past pages a poisoner filled with spam to find the real payee', async () => {
        const spamPages = MAX_COUNTERPARTY_HISTORY_PAGES - 1
        getTransactionHistory.mockImplementation(async (_, __, page) => {
            const index = Number(page?.cursor ?? 0)
            const items =
                index < spamPages
                    ? Array.from({ length: 50 }, () =>
                          record({
                              direction: 'in',
                              counterparty: 'POISONER',
                              value: '0',
                          }),
                      )
                    : [record({ direction: 'out', counterparty: 'PAYEE' })]
            return {
                items,
                ...(index + 1 < MAX_COUNTERPARTY_HISTORY_PAGES && {
                    next: { cursor: `${index + 1}` },
                }),
            }
        })

        expect(await trustedFor()).toEqual([paid('PAYEE')])
    })

    it(`stops paging once ${MIN_TRUSTED_TRANSFERS} transfers prove trust`, async () => {
        getTransactionHistory.mockImplementation(async (_, __, page) => {
            const index = Number(page?.cursor ?? 0)
            return {
                items: Array.from({ length: 5 }, (_, n) =>
                    record({
                        direction: 'out',
                        counterparty: `PAYEE-${index}-${n}`,
                    }),
                ),
                next: { cursor: `${index + 1}` },
            }
        })

        await trustedFor()

        expect(getTransactionHistory).toHaveBeenCalledTimes(
            Math.ceil(MIN_TRUSTED_TRANSFERS / 5),
        )
    })

    it(`stops after ${MAX_COUNTERPARTY_HISTORY_PAGES} pages without enough trusted transfers`, async () => {
        getTransactionHistory.mockImplementation(async (_, __, page) => ({
            items: [
                record({
                    direction: 'in',
                    counterparty: 'POISONER',
                    value: '0',
                }),
            ],
            next: { cursor: `${Number(page?.cursor ?? 0) + 1}` },
        }))

        expect(await trustedFor()).toEqual([])
        expect(getTransactionHistory).toHaveBeenCalledTimes(
            MAX_COUNTERPARTY_HISTORY_PAGES,
        )
    })

    it('has no counterparties on a chain without history', async () => {
        historyChainAdapters.reset()

        expect(await trustedFor()).toEqual([])
    })
})
