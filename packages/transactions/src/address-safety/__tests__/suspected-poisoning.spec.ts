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
    type ChainId,
    type ChainScope,
    type TransactionRecord,
    type TransactionSummary,
} from '@perawallet/wallet-core-chain-contract'
import {
    fetchAndPersistPrices,
    getAssetPricesByIds,
    getAssetsByIds,
} from '@perawallet/wallet-core-assets'
import { historyChainAdapters } from '../../history-adapter'
import type { KnownAddress, SuspectableEntry } from '../models'
import {
    detectSuspectedPoisoning,
    findImitatedAddress,
} from '../suspected-poisoning'
import { fetchTrustedCounterparties } from '../trusted-counterparties'
import { fakeCodec } from './fakeCodecs'

const ME = 'MEEEAAAAAAAAAAAAMEEE'
const OTHER_ACCOUNT = 'ACC2AAAAAAAAAAAAACC2'
const CONTACT = 'CON1BBBBBBBBBBBBCON1'
const PAYEE = 'PAY1CCCCCCCCCCCCPAY1'
const STRANGER = 'NEW1DDDDDDDDDDDDNEW1'

const NATIVE = 'native'
const STABLE = 'stable'
const SUSPICIOUS = 'suspicious-token'
const UNPRICED = 'unpriced-token'

const TIERS: Record<string, string> = {
    [SUSPICIOUS]: 'suspicious',
    [UNPRICED]: 'unverified',
}
const USD_PRICES: Record<string, string> = {
    [NATIVE]: '1',
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

const lookAlikeOf = (address: string) =>
    `${address.slice(0, 4)}ZZZZZZZZZZZZ${address.slice(-4)}`

const KNOWN: readonly KnownAddress[] = [
    { address: ME, source: 'own-account', name: 'Main' },
    { address: OTHER_ACCOUNT, source: 'own-account', name: 'Savings' },
    { address: CONTACT, source: 'contact', name: 'Alice' },
    { address: PAYEE, source: 'history' },
]

type EntryInput = {
    counterparty: string
    direction?: TransactionSummary['direction']
    kind?: TransactionSummary['kind']
    assetId?: string
    /** Base units, 6 decimals; unset means the summary carries no amount. */
    value?: string
    initiator?: string
}

let nextId = 0
const entryOf = (
    chainId: ChainId,
    {
        counterparty,
        direction = 'in',
        kind = 'transfer',
        assetId = NATIVE,
        value,
        initiator,
    }: EntryInput,
): SuspectableEntry => ({
    id: `tx-${nextId++}`,
    initiator,
    summary: {
        kind,
        title: { key: 'title' },
        direction,
        counterparty,
        icon: direction === 'out' ? 'send' : 'receive',
        ...(value !== undefined && {
            amount: {
                assetRef: { chainId, assetId },
                value: new Decimal(value),
                display: { decimals: 6 },
            },
        }),
    } as TransactionSummary,
})

describe.each([
    ['a strict codec', 'algorand', false],
    ['a case-blind codec', 'ethereum', true],
] as const)('suspected poisoning on %s', (_, chainId, isCaseBlind) => {
    const scope: ChainScope = { chainId, networkId: 'mainnet' }
    const entry = (input: EntryInput) => entryOf(chainId, input)
    const detect = (entries: SuspectableEntry[]) =>
        detectSuspectedPoisoning({
            entries,
            accountAddress: ME,
            scope,
            knownAddresses: KNOWN,
        })

    beforeEach(() => {
        vi.clearAllMocks()
        addressCodecs.reset()
        addressCodecs.register(fakeCodec(chainId, { isCaseBlind }))
        vi.mocked(getAssetsByIds).mockImplementation(
            async ({ assetIds }) =>
                assetIds.map(assetId => ({
                    assetId,
                    decimals: 6,
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

    it.each([
        ['a zero-value transfer', { value: '0' }],
        ['a transfer with no amount', {}],
    ])(
        'marks %s from a look-alike of a contact, naming the contact',
        async (__, overrides) => {
            const poisoning = entry({
                counterparty: lookAlikeOf(CONTACT),
                ...overrides,
            })

            expect(await detect([poisoning])).toEqual([
                {
                    transactionId: poisoning.id,
                    counterparty: lookAlikeOf(CONTACT),
                    imitates: KNOWN[2],
                },
            ])
            expect(getAssetsByIds).not.toHaveBeenCalled()
        },
    )

    it.each([
        ['dust', { value: '99999' }],
        [
            'an unpriced token',
            { kind: 'token-transfer', assetId: UNPRICED, value: '5000000' },
        ],
        [
            'a suspicious token',
            { kind: 'token-transfer', assetId: SUSPICIOUS, value: '5000000' },
        ],
        [
            'an unpriced collectible',
            { kind: 'nft-transfer', assetId: UNPRICED, value: '1' },
        ],
    ] as const)(
        'marks %s from a look-alike of an address the account paid',
        async (__, overrides) => {
            const poisoning = entry({
                counterparty: lookAlikeOf(PAYEE),
                ...overrides,
            })

            const [suspected] = await detect([poisoning])

            expect(suspected?.imitates).toEqual(KNOWN[3])
        },
    )

    it("names the user's other account when its look-alike pays this one", async () => {
        const [suspected] = await detect([
            entry({ counterparty: lookAlikeOf(OTHER_ACCOUNT), value: '0' }),
        ])

        expect(suspected?.imitates).toEqual(KNOWN[1])
    })

    it('does not mark a transfer of real value from a look-alike of a contact', async () => {
        expect(
            await detect([
                entry({ counterparty: lookAlikeOf(CONTACT), value: '100000' }),
            ]),
        ).toEqual([])
    })

    it('does not mark a worthless transfer from an address that resembles nothing known', async () => {
        expect(
            await detect([entry({ counterparty: STRANGER, value: '0' })]),
        ).toEqual([])
    })

    it('does not mark a worthless transfer from a known contact itself', async () => {
        expect(
            await detect([entry({ counterparty: CONTACT, value: '0' })]),
        ).toEqual([])
    })

    it('marks a worthless transfer even when the price lookup fails', async () => {
        vi.mocked(getAssetPricesByIds).mockResolvedValue([])
        vi.mocked(fetchAndPersistPrices).mockRejectedValue(new Error('offline'))

        expect(
            await detect([
                entry({ counterparty: lookAlikeOf(CONTACT), value: '5000000' }),
            ]),
        ).toHaveLength(1)
    })

    it.each([
        [
            'an outgoing transfer the account signed',
            { direction: 'out', initiator: ME },
        ],
        ['an outgoing transfer with no signer on record', { direction: 'out' }],
        ['a transfer to itself', { direction: 'self' }],
        ['a contract call', { kind: 'contract-call' }],
    ] as const)('does not mark %s', async (__, overrides) => {
        expect(
            await detect([
                entry({
                    counterparty: lookAlikeOf(CONTACT),
                    value: '0',
                    ...overrides,
                }),
            ]),
        ).toEqual([])
    })

    it('marks an outgoing worthless transfer someone else signed in the account name', async () => {
        const [suspected] = await detect([
            entry({
                counterparty: lookAlikeOf(PAYEE),
                direction: 'out',
                kind: 'token-transfer',
                assetId: STABLE,
                value: '0',
                initiator: 'SPOOFER',
            }),
        ])

        expect(suspected?.imitates).toEqual(KNOWN[3])
    })

    it('never lets a marked counterparty become a trusted one', async () => {
        const entries = [
            entry({ counterparty: lookAlikeOf(CONTACT), value: '0' }),
            entry({ counterparty: lookAlikeOf(PAYEE), value: '99999' }),
            entry({
                counterparty: lookAlikeOf(PAYEE),
                kind: 'token-transfer',
                assetId: UNPRICED,
                value: '5000000',
            }),
        ]
        historyChainAdapters.reset()
        historyChainAdapters.register({
            chainId,
            getTransactionHistory: async () => ({
                items: entries.map(({ id, summary }): TransactionRecord => ({
                    id,
                    scope,
                    status: 'confirmed',
                    initiator: summary.counterparty,
                    chainData: { family: 'evm' },
                    summary,
                })),
            }),
        })

        const suspected = await detect(entries)
        const trusted = await fetchTrustedCounterparties({
            accountAddress: ME,
            scope,
        })

        expect(suspected).toHaveLength(entries.length)
        expect(trusted).toEqual([])
    })
})

describe('findImitatedAddress', () => {
    beforeEach(() => {
        addressCodecs.reset()
        addressCodecs.register(fakeCodec('ethereum', { isCaseBlind: true }))
    })

    it('ignores the value, leaving that to the detector', () => {
        expect(
            findImitatedAddress({
                entry: entryOf('ethereum', {
                    counterparty: lookAlikeOf(CONTACT),
                    value: '999999999',
                }),
                accountAddress: ME,
                chainId: 'ethereum',
                knownAddresses: KNOWN,
            }),
        ).toEqual(KNOWN[2])
    })
})
